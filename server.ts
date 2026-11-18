import express from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool } from './src/db/index.ts';
import {
  evaluateResilientMarginGuardrail,
  getNextStripedSaltHint,
  evaluateEdgeAdmission,
  FallbackMode,
  EdgeAdmissionController,
} from './src/utils/commerceLogic.ts';
import { requireAuth, requireRole, AuthRequest } from './src/middleware/auth.ts';
import { listTenantMembersPg, updateMemberRolePg, NexusRole } from './src/db/users.ts';
import { computeShopifyHmacSha256, decryptTenantSecret } from './src/services/tenantCrypto.ts';
import { constructVerifiedStripeWebhookEvent, isStripeLiveConfigured } from './src/services/stripeEscrow.ts';
import { isShopifyAdminConfigured } from './src/services/shopifyAdmin.ts';
import { tenants } from './src/db/schema.ts';
import { db } from './src/db/index.ts';
import { eq } from 'drizzle-orm';
import {
  decayEmaPg,
  executeTransactionalClearancePg,
  getAuditTrailStatePg,
  getBenchmarkHistoryPg,
  getEmaTrackerPg,
  getIdempotentResponsePg,
  getMerkleEpochsStatePg,
  getShardsAndEmaStatePg,
  getTenantConfigPg,
  incrementEdgeShedCountPg,
  listShopifyWebhookEventsPg,
  listStripeEscrowTransactionsPg,
  recordGuardrailOutcomeAuditPg,
  recoverOutboxPg,
  replenishSkuSubLotsPg,
  runConcurrentPostgresBenchmarkPg,
  saveIdempotentResponsePg,
  settleStripeEscrowPg,
  shredEdgeSubjectPg,
  sweepDlqPg,
  tokenizeEdgeSubjectPg,
  updateTenantConfigPg,
  verifyAndProcessShopifyWebhookPg,
} from './src/db/ledgerRepository.ts';

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Trust Cloud Run / reverse-proxy headers for accurate rate limiting
app.set('trust proxy', 1);

// Security headers compatible with Google Sign-In popup & Cloud Run framing
app.use(
  helmet({
    contentSecurityPolicy: false,
    xFrameOptions: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
  })
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded. Retry after 60 seconds.' },
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Webhook rate limit exceeded.' },
});

// ============================================================================
// RAW-BODY SIGNED WEBHOOKS (MUST BE REGISTERED BEFORE express.json())
// ============================================================================

app.post(
  '/api/webhooks/shopify/:tenantId',
  webhookLimiter,
  express.raw({ type: 'application/json', limit: '2mb' }),
  async (req, res) => {
    try {
      const tenantId = String(req.params.tenantId || '').trim();
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Missing tenantId in webhook path.' });
      }
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}), 'utf8');

      let parsedPayload: Record<string, any> = {};
      try {
        parsedPayload = JSON.parse(rawBody.toString('utf8') || '{}');
      } catch {
        return res.status(400).json({ success: false, error: 'Malformed JSON payload.' });
      }

      const hmacHeader = req.get('x-shopify-hmac-sha256');
      const shopDomainHeader = req.get('x-shopify-shop-domain');
      const topic = req.get('x-shopify-topic') || 'orders/create';

      const result = await verifyAndProcessShopifyWebhookPg({
        tenantId,
        rawBody,
        hmacHeader,
        shopDomainHeader,
        topic,
        payload: parsedPayload,
      });

      if (!result.validHmac) {
        return res.status(401).json({
          success: false,
          hmacVerified: false,
          eventId: result.eventId,
          error: result.reason,
        });
      }

      return res.status(200).json({
        success: true,
        hmacVerified: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Shopify webhook handler failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal error processing Shopify webhook',
      });
    }
  }
);

app.post(
  '/api/webhooks/stripe',
  webhookLimiter,
  express.raw({ type: 'application/json', limit: '2mb' }),
  async (req, res) => {
    try {
      const signature = req.get('stripe-signature');
      if (!signature) {
        return res.status(400).json({ success: false, error: 'Missing stripe-signature header.' });
      }
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}), 'utf8');
      const event = constructVerifiedStripeWebhookEvent(rawBody, signature);
      return res.status(200).json({ received: true, eventId: event.id, type: event.type });
    } catch (error: any) {
      console.error('Stripe webhook verification failed:', error);
      return res.status(400).json({ success: false, error: error.message || 'Invalid Stripe webhook signature' });
    }
  }
);

// Standard JSON parsing & rate limiting for API routes
app.use('/api', apiLimiter);
app.use(express.json({ limit: '2mb' }));

// ============================================================================
// HEALTH & DIAGNOSTICS
// ============================================================================

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({
      status: 'ok',
      db: 'connected',
      system: 'NEXUS Commerce Clearing OS',
      version: '4.6.0-production',
      stripeLiveConfigured: isStripeLiveConfigured(),
      shopifyAdminConfigured: isShopifyAdminConfigured(),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (error: any) {
    console.error('Healthcheck DB probe failed:', error);
    return res.status(503).json({
      status: 'degraded',
      db: 'disconnected',
      error: 'PostgreSQL health probe failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// AUTH, MULTI-TENANT CONFIGURATION & RBAC
// ============================================================================

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({
    success: true,
    user: req.authContext,
  });
});

app.get('/api/tenant/config', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.authContext!.tenantId;
    const [config, members] = await Promise.all([
      getTenantConfigPg(tenantId),
      listTenantMembersPg(tenantId),
    ]);
    res.json({ success: true, config, members, currentRole: req.authContext!.role });
  } catch (error: any) {
    console.error('Failed to load tenant config:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load tenant settings' });
  }
});

app.put('/api/tenant/config', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.authContext!.tenantId;
    const {
      name,
      defaultMarginFloorPct,
      shopifyShopDomain,
      shopifyWebhookSecret,
      shopifyAutoHoldEnabled,
    } = req.body || {};

    const updated = await updateTenantConfigPg({
      tenantId,
      name,
      defaultMarginFloorPct: defaultMarginFloorPct !== undefined ? Number(defaultMarginFloorPct) : undefined,
      shopifyShopDomain,
      shopifyWebhookSecret,
      shopifyAutoHoldEnabled,
    });
    res.json({ success: true, config: updated });
  } catch (error: any) {
    console.error('Failed to update tenant config:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update tenant settings' });
  }
});

app.post('/api/tenant/members/role', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.authContext!.tenantId;
    const { targetUid, role } = req.body || {};
    if (!targetUid || !['admin', 'operator', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Valid targetUid and role (admin|operator|viewer) required.' });
    }
    if (targetUid === req.authContext!.uid && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot downgrade your own admin privileges.' });
    }
    const updated = await updateMemberRolePg({
      tenantId,
      targetUid: String(targetUid),
      newRole: role as NexusRole,
    });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Member not found in active tenant.' });
    }
    res.json({ success: true, member: updated });
  } catch (error: any) {
    console.error('Failed to update member role:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update member role' });
  }
});

// ============================================================================
// PHASE 2: LIVE STRIPE ESCROW & SIGNED SHOPIFY WEBHOOK MANAGEMENT
// ============================================================================

app.get('/api/integrations/events', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.authContext!.tenantId;
    const [shopifyEvents, stripeEscrows] = await Promise.all([
      listShopifyWebhookEventsPg(tenantId),
      listStripeEscrowTransactionsPg(tenantId),
    ]);
    res.json({
      success: true,
      stripeLiveConfigured: isStripeLiveConfigured(),
      shopifyEvents,
      stripeEscrows,
    });
  } catch (error: any) {
    console.error('Failed to fetch integration events:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load integration logs' });
  }
});

app.post(
  '/api/integrations/stripe-escrow/settle',
  requireAuth,
  requireRole('admin', 'operator'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.authContext!.tenantId;
      const { escrowRef, action } = req.body || {};
      if (!escrowRef || (action !== 'capture' && action !== 'cancel')) {
        return res.status(400).json({ success: false, error: 'Provide escrowRef and action (capture|cancel).' });
      }
      const updated = await settleStripeEscrowPg({
        tenantId,
        escrowRef: String(escrowRef),
        action,
      });
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Escrow transaction not found for active tenant.' });
      }
      res.json({ success: true, escrow: updated });
    } catch (error: any) {
      console.error('Failed to settle Stripe escrow:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to settle Stripe escrow' });
    }
  }
);

app.post(
  '/api/integrations/shopify/test-signed-webhook',
  requireAuth,
  requireRole('admin', 'operator'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.authContext!.tenantId;
      const {
        orderPrice = 239,
        discountAmount = 0,
        units = 1,
        skuId = 'SKU-ANC-PRO-09',
        tamperHmac = false,
      } = req.body || {};

      const tenantRows = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);
      const tenant = tenantRows[0];

      let secret = '';
      if (tenant?.shopifyWebhookSecretEncrypted) {
        secret = decryptTenantSecret(tenant.shopifyWebhookSecretEncrypted);
      } else if (
        process.env.SHOPIFY_WEBHOOK_SECRET &&
        !process.env.SHOPIFY_WEBHOOK_SECRET.includes('example')
      ) {
        secret = process.env.SHOPIFY_WEBHOOK_SECRET.trim();
      }

      if (!secret) {
        return res.status(400).json({
          success: false,
          error: 'Save a Shopify Webhook Secret in Tenant Connectors first before running a signed webhook test.',
        });
      }

      const netTotal = Math.max(1, Number(orderPrice) - Number(discountAmount));
      const payload = {
        id: Date.now(),
        order_number: `SHPFY-${Math.floor(1000 + Math.random() * 9000)}`,
        email: req.authContext!.email,
        total_price: netTotal.toFixed(2),
        total_discounts: Number(discountAmount).toFixed(2),
        total_shipping_price_set: { shop_money: { amount: (8.5 * Number(units)).toFixed(2) } },
        line_items: [
          {
            sku: String(skuId),
            quantity: Math.max(1, Number(units)),
            price: (netTotal / Math.max(1, Number(units))).toFixed(2),
          },
        ],
      };

      const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
      const validHmac = computeShopifyHmacSha256(rawBody, secret);
      const sentHmac = tamperHmac ? `INVALID_${validHmac.slice(8)}` : validHmac;

      // Exercise the real raw-body signed webhook endpoint over localhost
      const resp = await fetch(`http://127.0.0.1:${PORT}/api/webhooks/shopify/${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Hmac-Sha256': sentHmac,
          'X-Shopify-Shop-Domain': tenant?.shopifyShopDomain || 'nexus-verified-store.myshopify.com',
          'X-Shopify-Topic': 'orders/create',
        },
        body: rawBody,
      });

      const body = await resp.json();
      return res.status(200).json({
        success: true,
        webhookHttpStatus: resp.status,
        webhookResponse: body,
      });
    } catch (error: any) {
      console.error('Signed Shopify webhook test failed:', error);
      res.status(500).json({ success: false, error: error.message || 'Webhook test failed' });
    }
  }
);

// ============================================================================
// CORE POSTGRESQL ACID CLEARING, OUTBOX, RBAC & BENCHMARK ROUTES
// ============================================================================

let viralShardSaltCounter = 0;

const edgeAdmissionController: EdgeAdmissionController = {
  maxTxPerSec: 280,
  minPriorityMarginPct: 22.0,
  windowStartMs: Date.now(),
  windowCount: 0,
  shedCount: 0,
};

app.get('/api/agentforce/audit-trail', requireAuth, async (req: AuthRequest, res) => {
  try {
    const state = await getAuditTrailStatePg(req.authContext!.tenantId);
    res.json({ success: true, ...state });
  } catch (error: any) {
    console.error('Failed to fetch audit trail:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch audit ledger' });
  }
});

app.get('/api/agentforce/lots', requireAuth, async (req: AuthRequest, res) => {
  try {
    const skuId = String(req.query?.skuId || 'SKU-ANC-PRO-09');
    const state = await getShardsAndEmaStatePg(req.authContext!.tenantId, skuId);
    res.json({ success: true, lots: state.shards });
  } catch (error: any) {
    console.error('Failed to fetch lots:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch inventory lots' });
  }
});

app.post('/api/agentforce/lots/reset', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const skuId = String(req.body?.skuId || 'SKU-ANC-PRO-09');
    const totalUnits = Number(req.body?.totalUnits || 12000);
    const state = await replenishSkuSubLotsPg(req.authContext!.tenantId, skuId, totalUnits);
    res.json({ success: true, ...state });
  } catch (error: any) {
    console.error('Failed to reset SKU lots:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to reset inventory lots' });
  }
});

app.get('/api/agentforce/saga-status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const outbox = await recoverOutboxPg({
      tenantId: req.authContext!.tenantId,
      simulatePersistentFailure: false,
      maxRetries: 3,
      baseBackoffMs: 1000,
    });
    res.json({ success: true, recentOutbox: outbox.outboxRecords });
  } catch (error: any) {
    console.error('Failed to fetch SAGA status:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch SAGA history' });
  }
});

app.post('/api/security/crypto-shred', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  const startTime = process.hrtime.bigint();
  const { subjectOrToken = 'buyer-enterprise-01' } = req.body || {};

  try {
    const result = await shredEdgeSubjectPg(req.authContext!.tenantId, String(subjectOrToken));
    const elapsedMs = Math.max(0.2, Math.round(Number(process.hrtime.bigint() - startTime) / 10000) / 100);

    if (!result.shredded) {
      return res.status(404).json({
        success: false,
        error: `No active KMS key found in PostgreSQL edge vault for "${subjectOrToken}".`,
        erasureLatencyMs: elapsedMs,
        chainIntegrityValid: result.chainIntegrityValid,
      });
    }

    res.json({
      success: true,
      status: 'CRYPTOGRAPHICALLY_SHREDDED',
      subjectToken: result.subjectToken,
      shreddedAt: result.shreddedAt,
      erasureLatencyMs: elapsedMs,
      chainIntegrityValid: result.chainIntegrityValid,
      auditLedgerBlocksVerified: result.auditLedgerBlocksVerified,
      complianceNote: 'Per-subject KMS reference marked DESTROYED in Cloud SQL edge vault. No raw PII stored in SHA-256 audit blocks.',
    });
  } catch (error: any) {
    console.error('Crypto-shred failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Crypto-shredding failed' });
  }
});

app.get('/api/agentforce/shards', requireAuth, async (req: AuthRequest, res) => {
  try {
    const skuId = String(req.query?.skuId || 'SKU-ANC-PRO-09');
    const state = await getShardsAndEmaStatePg(req.authContext!.tenantId, skuId);
    res.json({
      success: true,
      tenantId: state.tenantId,
      skuId: state.skuId,
      shardCount: state.shardCount,
      totalAvailableUnits: state.totalAvailableUnits,
      totalReservedUnits: state.totalReservedUnits,
      minShardAvailable: state.minShardAvailable,
      maxShardAvailable: state.maxShardAvailable,
      emaCostTracker: state.emaCostTracker,
      edgeAdmissionController: {
        ...edgeAdmissionController,
        shedCount: state.shedCount,
      },
      shards: state.shards,
    });
  } catch (error: any) {
    console.error('Failed to fetch shards:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch shards' });
  }
});

app.post('/api/agentforce/outbox/recover', requireAuth, requireRole('admin', 'operator'), async (req: AuthRequest, res) => {
  const startTime = process.hrtime.bigint();
  const { simulatePersistentFailure = false, maxRetries = 3, baseBackoffMs = 1000, nowMs } = req.body || {};

  try {
    const recovery = await recoverOutboxPg({
      tenantId: req.authContext!.tenantId,
      simulatePersistentFailure: Boolean(simulatePersistentFailure),
      maxRetries: Number(maxRetries),
      baseBackoffMs: Number(baseBackoffMs),
      nowMs: nowMs !== undefined ? Number(nowMs) : undefined,
    });
    const elapsedMs = Math.max(0.24, Math.round(Number(process.hrtime.bigint() - startTime) / 10000) / 100);

    res.json({
      success: true,
      reaperLatencyMs: elapsedMs,
      recoveredCount: recovery.recoveredCount,
      recoveredIds: recovery.recoveredIds,
      deferredBackoffIds: recovery.deferredBackoffIds,
      deadLetterIds: recovery.deadLetterIds,
      emaCostTracker: recovery.emaCostTracker,
      merkleEpoch: recovery.merkleEpoch,
      outboxRecords: recovery.outboxRecords,
    });
  } catch (error: any) {
    console.error('Outbox recovery failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Outbox recovery failed' });
  }
});

app.post('/api/agentforce/outbox/sweep-dlq', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  const startTime = process.hrtime.bigint();
  const {
    simulateByzantineMismatch = false,
    simulateProviderSettled = false,
    totalTxPerSec = 280,
    dlqRate = 0.01,
  } = req.body || {};

  try {
    const result = await sweepDlqPg({
      tenantId: req.authContext!.tenantId,
      simulateByzantineMismatch: Boolean(simulateByzantineMismatch),
      simulateProviderSettled: Boolean(simulateProviderSettled),
      totalTxPerSec: Number(totalTxPerSec),
      dlqRate: Number(dlqRate),
    });
    const elapsedMs = Math.max(0.32, Math.round(Number(process.hrtime.bigint() - startTime) / 10000) / 100);

    res.json({
      success: true,
      sweepLatencyMs: elapsedMs,
      ...result,
    });
  } catch (error: any) {
    console.error('DLQ sweep failed:', error);
    res.status(500).json({ success: false, error: error.message || 'DLQ sweep failed' });
  }
});

app.post('/api/agentforce/ema/decay', requireAuth, requireRole('admin', 'operator'), async (req: AuthRequest, res) => {
  const { elapsedSilenceMs = 30000 } = req.body || {};
  try {
    const { tracker, canaryProbeEligible } = await decayEmaPg(
      req.authContext!.tenantId,
      Number(elapsedSilenceMs)
    );
    res.json({
      success: true,
      elapsedSilenceMs: Number(elapsedSilenceMs),
      canaryProbeEligible,
      emaCostTracker: tracker,
    });
  } catch (error: any) {
    console.error('EMA decay failed:', error);
    res.status(500).json({ success: false, error: error.message || 'EMA decay failed' });
  }
});

app.get('/api/agentforce/merkle-epochs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await getMerkleEpochsStatePg(req.authContext!.tenantId);
    res.json({
      success: true,
      pendingLeaves: 0,
      latestEpoch: data.epochs[0] ?? null,
      epochs: data.epochs,
      outboxQueueDepth: data.outboxQueueDepth,
    });
  } catch (error: any) {
    console.error('Failed to fetch Merkle epochs:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch Merkle epochs' });
  }
});

app.post('/api/agentforce/benchmark/run', requireAuth, requireRole('admin', 'operator'), async (req: AuthRequest, res) => {
  try {
    const totalRequests = Number(req.body?.totalRequests ?? 64);
    const concurrency = Number(req.body?.concurrency ?? 16);
    const unitsPerTx = Number(req.body?.unitsPerTx ?? 1);
    const skuId = String(req.body?.skuId || 'SKU-BENCH-LOAD-01');

    const result = await runConcurrentPostgresBenchmarkPg({
      tenantId: req.authContext!.tenantId,
      userUid: req.authContext!.uid,
      skuId,
      totalRequests,
      concurrency,
      unitsPerTx,
    });

    res.json({ success: true, benchmark: result });
  } catch (error: any) {
    console.error('Concurrent benchmark failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Benchmark execution failed' });
  }
});

app.get('/api/agentforce/benchmark/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const runs = await getBenchmarkHistoryPg(req.authContext!.tenantId);
    res.json({ success: true, runs });
  } catch (error: any) {
    console.error('Benchmark history failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch benchmark history' });
  }
});

app.post('/api/agentforce/clear-margin-floor', requireAuth, requireRole('admin', 'operator'), async (req: AuthRequest, res) => {
  const startTime = process.hrtime.bigint();
  const tenantId = req.authContext!.tenantId;

  const {
    skuId = 'SKU-ANC-PRO-09',
    excessUnits = 1200,
    minimumMarginFloorPct = 18.5,
    costOfGoodsSold = 168.00,
    freightCost = 8.50,
    paymentFeePct = 2.9,
    rtoProbability = 0.03,
    reverseLogisticsCost = 22.00,
    computeEgressCost,
    expectedVoidCompCost,
    elapsedSilenceMs = 0,
    inventoryAgeDays = 14,
    fallbackMode = 'HARD_HALT',
    shardHint,
    idempotencyKey,
    paymentMethodId,
    subjectId = 'buyer-enterprise-01',
    settlementChannel = isStripeLiveConfigured() ? 'STRIPE_LIVE_MANUAL_CAPTURE' : 'STRIPE_ESCROW_SIMULATOR',
    currentCompetitorPrice = 215.00,
    allowDynamicBundle = true,
    forceCircuitBreakerTest = false,
    simulateEscrowFailure = false,
    simulateWmsFailure = false,
    simulateWorkerCrashBeforeWms = false,
    simulateBurstOverflow = false,
  } = req.body || {};

  try {
    if (idempotencyKey) {
      const existing = await getIdempotentResponsePg(tenantId, String(idempotencyKey));
      if (existing) {
        return res.status(existing.statusCode).json({
          ...(existing.responseBody as Record<string, unknown>),
          idempotentReplay: true,
        });
      }
    }

    const edgeToken = await tokenizeEdgeSubjectPg(tenantId, String(subjectId));
    const bidPriceNum = Math.max(1, Number(currentCompetitorPrice));
    const rawCandidateMarginPct =
      Math.round(((bidPriceNum - (Number(costOfGoodsSold) + Number(freightCost))) / bidPriceNum) * 1000) / 10;

    const edgeAdmission = evaluateEdgeAdmission(
      edgeAdmissionController,
      rawCandidateMarginPct,
      Date.now(),
      Boolean(simulateBurstOverflow)
    );

    if (!edgeAdmission.admitted) {
      const persistedShedCount = await incrementEdgeShedCountPg(tenantId);
      const edgeShedMs = Math.max(0.5, Math.round(Number(process.hrtime.bigint() - startTime) / 10000) / 100);
      return res.status(429).json({
        success: false,
        status: 'EDGE_LOAD_SHED_DEFERRED',
        action: edgeAdmission.action,
        error: edgeAdmission.reason,
        edgeAdmission: {
          currentRatePerSec: edgeAdmission.currentRatePerSec,
          maxTxPerSec: edgeAdmissionController.maxTxPerSec,
          minPriorityMarginPct: edgeAdmissionController.minPriorityMarginPct,
          candidateMarginPct: rawCandidateMarginPct,
          totalShedCount: persistedShedCount,
        },
        decisionLockLatencyMs: edgeShedMs,
        asyncSagaSettlementMs: 0,
        executionLatencyMs: edgeShedMs,
      });
    }

    const effectiveClockMs = Date.now() + Math.max(0, Number(elapsedSilenceMs));
    const { tracker } = await getEmaTrackerPg(tenantId);

    const activeEgressCost =
      computeEgressCost !== undefined ? Number(computeEgressCost) : tracker.effectiveEgressCost;
    const activeVoidCompCost =
      expectedVoidCompCost !== undefined ? Number(expectedVoidCompCost) : (tracker.expectedVoidCompCost ?? 0);

    const effectiveBid =
      allowDynamicBundle && !forceCircuitBreakerTest && bidPriceNum < 239.00 ? 239.00 : bidPriceNum;
    const bundleAccessoryCogs =
      allowDynamicBundle && !forceCircuitBreakerTest && bidPriceNum < 239.00 ? 12.00 : undefined;
    const bundleSellPrice = bundleAccessoryCogs !== undefined ? 259.00 : undefined;

    const guardrail = evaluateResilientMarginGuardrail({
      cogs: Number(costOfGoodsSold),
      marginFloorPct: Number(minimumMarginFloorPct),
      attemptedPrice: effectiveBid,
      inventoryAgeDays: Number(inventoryAgeDays),
      fallbackMode: String(fallbackMode) as FallbackMode,
      landedCostInputs: {
        freightCost: Number(freightCost),
        paymentFeePct: Number(paymentFeePct),
        rtoProbability: Number(rtoProbability),
        reverseLogisticsCost: Number(reverseLogisticsCost),
        computeEgressCost: activeEgressCost,
        expectedVoidCompCost: activeVoidCompCost,
      },
      bundleAccessoryCogs,
      bundleSellPrice,
    });

    if (forceCircuitBreakerTest || !guardrail.passed || guardrail.status === 'CIRCUIT_BREAKER_TRIGGERED') {
      const elapsedMs = Math.max(0.5, Math.round(Number(process.hrtime.bigint() - startTime) / 10000) / 100);
      const { epoch, auditBlock } = await recordGuardrailOutcomeAuditPg({
        userUid: req.authContext!.uid,
        tenantId,
        subjectToken: edgeToken.subjectToken,
        action: 'NexusCommerce.circuitBreakerHalt',
        skuId: String(skuId),
        unitsCleared: 0,
        clearingPrice: effectiveBid,
        marginPct: guardrail.realizedMarginPct,
        grossProceeds: 0,
        escrowHoldId: 'ESCROW_BYPASSED_NO_COMMIT',
        wmsDispatchRef: 'WMS_NOT_INVOKED',
        decisionLockLatencyMs: elapsedMs,
        asyncSagaSettlementMs: 0,
        guardrailStatus: 'CIRCUIT_BREAKER_TRIPPED',
        effectiveEgressCost: activeEgressCost,
        merkleSeedInput: `${skuId}:CIRCUIT_BREAKER:${guardrail.realizedMarginPct}`,
      });

      const body = {
        success: false,
        status: 'CIRCUIT_BREAKER_TRIPPED',
        error: `Margin Floor Violation: Realized CM3 margin (${guardrail.realizedMarginPct}%) falls below effective minimum floor (${guardrail.effectiveMarginFloorPct}%). Required floor price: $${guardrail.minimumFloorPrice.toFixed(2)}.`,
        economics: {
          baseCogs: Number(costOfGoodsSold),
          totalLandedCogs: guardrail.landedBreakdown.totalLandedCogs,
          landedBreakdown: guardrail.landedBreakdown,
          minimumMarginFloorPct: Number(minimumMarginFloorPct),
          effectiveMarginFloorPct: guardrail.effectiveMarginFloorPct,
          degradedModeEngaged: guardrail.degradedModeEngaged,
          fallbackMode: guardrail.fallbackModeUsed,
          absoluteFloorPrice: guardrail.minimumFloorPrice,
          attemptedClearingPrice: effectiveBid,
          realizedMarginPct: guardrail.realizedMarginPct,
        },
        concurrency: null,
        settlement: null,
        saga: null,
        security: {
          guardrailStatus: 'CIRCUIT_BREAKER_TRIPPED',
          circuitBreakerTripped: true,
          zeroPiiTokenized: true,
          subjectToken: edgeToken.subjectToken,
          merkleEpochId: epoch.epochId,
          merkleRoot: epoch.merkleRoot,
          blockHeight: auditBlock.blockHeight,
          blockHash: auditBlock.blockHash,
          previousHash: auditBlock.previousHash,
          shaSignature: auditBlock.shaSignature,
        },
        decisionLockLatencyMs: elapsedMs,
        asyncSagaSettlementMs: 0,
        executionLatencyMs: elapsedMs,
      };
      if (idempotencyKey) await saveIdempotentResponsePg(tenantId, String(idempotencyKey), 422, body);
      return res.status(422).json(body);
    }

    const unitsToClear = Math.max(1, Math.min(Number(excessUnits) || 120, 4800));
    const shardHintResult =
      shardHint !== undefined
        ? Math.abs(Number(shardHint)) % 32
        : getNextStripedSaltHint(viralShardSaltCounter++);

    const pgTx = await executeTransactionalClearancePg({
      userUid: req.authContext!.uid,
      skuId: String(skuId),
      unitsToClear,
      shardIndexHint: shardHintResult,
      tenantId,
      subjectToken: edgeToken.subjectToken,
      clearingPrice: guardrail.bundleApplied ? 259.0 : effectiveBid,
      marginPct: guardrail.realizedMarginPct,
      guardrailStatus: guardrail.degradedModeEngaged
        ? 'DEGRADED_FLOOR_OVERRIDE_PASSED'
        : 'VERIFIED_PASSED',
      fallbackMode: String(fallbackMode) as FallbackMode,
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
      paymentMethodId: paymentMethodId ? String(paymentMethodId) : undefined,
      simulateEscrowFailure: Boolean(simulateEscrowFailure),
      simulateWmsFailure: Boolean(simulateWmsFailure),
      simulateWorkerCrashBeforeWms: Boolean(simulateWorkerCrashBeforeWms),
      effectiveClockMs,
    });

    const totalEndToEndMs = Math.max(
      0.5,
      Math.round(Number(process.hrtime.bigint() - startTime) / 10000) / 100
    );

    if (!pgTx.acquired) {
      return res.status(409).json({
        success: false,
        status: 'INVENTORY_LOCK_CONFLICT',
        error: pgTx.reason,
        concurrency: {
          shardId: pgTx.shardId,
          shardIndex: pgTx.shardIndex,
          availableUnits: pgTx.availableUnits,
          totalPoolAvailable: pgTx.totalPoolAvailable,
        },
        decisionLockLatencyMs: totalEndToEndMs,
        executionLatencyMs: totalEndToEndMs,
      });
    }

    if (pgTx.compensated) {
      const compBody = {
        success: false,
        status: 'SAGA_COMPENSATED_ROLLBACK',
        error: pgTx.wmsStatus === 'WMS_PICK_CANCELLED'
          ? 'Fulfillment WMS dispatch failed after Stripe escrow lock. Triggered compensating void + PostgreSQL lease restore.'
          : 'Stripe Escrow hold declined prior to WMS dispatch. Released PostgreSQL sub-lot reservation cleanly.',
        economics: {
          baseCogs: Number(costOfGoodsSold),
          totalLandedCogs: guardrail.landedBreakdown.totalLandedCogs,
          landedBreakdown: guardrail.landedBreakdown,
          minimumMarginFloorPct: Number(minimumMarginFloorPct),
          effectiveMarginFloorPct: guardrail.effectiveMarginFloorPct,
          degradedModeEngaged: guardrail.degradedModeEngaged,
          fallbackMode: guardrail.fallbackModeUsed,
          absoluteFloorPrice: guardrail.minimumFloorPrice,
          effectiveClearingPrice: guardrail.bundleApplied ? 259.0 : effectiveBid,
          realizedMarginPct: guardrail.realizedMarginPct,
          computeEgressOverheadPerTx: `$${pgTx.tracker.effectiveEgressCost.toFixed(4)}`,
          expectedVoidCompOverheadPerTx: `$${(pgTx.tracker.expectedVoidCompCost ?? 0).toFixed(4)}`,
        },
        concurrency: {
          shardId: pgTx.shardId,
          shardIndex: pgTx.shardIndex,
          fencingToken: pgTx.fencingToken,
          lotVersion: pgTx.lotVersion,
          remainingShardAvailable: pgTx.remainingShardAvailable,
          remainingAvailableUnits: pgTx.remainingPoolAvailable,
          reservedUnits: pgTx.reservedUnits,
          rebalancedFromShard: pgTx.rebalancedFromShard,
        },
        saga: {
          sagaId: pgTx.sagaId,
          finalState: pgTx.finalState,
          decisionLockLatencyMs: pgTx.decisionLockLatencyMs,
          asyncSagaSettlementMs: pgTx.asyncSagaSettlementMs,
          compensated: true,
          steps: pgTx.steps,
          escrowStatus: pgTx.escrowStatus,
          wmsStatus: pgTx.wmsStatus,
          stripeMode: pgTx.stripeMode,
          stripeStatus: pgTx.stripeStatus,
        },
        security: {
          guardrailStatus: 'SAGA_COMPENSATED_ROLLBACK',
          circuitBreakerTripped: false,
          zeroPiiTokenized: true,
          subjectToken: edgeToken.subjectToken,
          merkleEpochId: pgTx.epoch.epochId,
          merkleRoot: pgTx.epoch.merkleRoot,
          blockHeight: pgTx.newHeight,
          blockHash: pgTx.auditBlock.blockHash,
          previousHash: pgTx.auditBlock.previousHash,
          shaSignature: pgTx.auditBlock.shaSignature,
        },
        decisionLockLatencyMs: totalEndToEndMs,
        asyncSagaSettlementMs: pgTx.asyncSagaSettlementMs,
        executionLatencyMs: totalEndToEndMs,
      };
      if (idempotencyKey) await saveIdempotentResponsePg(tenantId, String(idempotencyKey), 502, compBody);
      return res.status(502).json(compBody);
    }

    if (pgTx.finalState === 'IN_FLIGHT_CRASHED') {
      const crashBody = {
        success: false,
        status: 'OUTBOX_CRASH_PENDING_REAPER',
        error: `Worker simulated crash after PostgreSQL Outbox commit (${pgTx.outboxId}). Lease held safely under Fencing #${pgTx.fencingToken} for Outbox Reaper recovery.`,
        concurrency: {
          shardId: pgTx.shardId,
          shardIndex: pgTx.shardIndex,
          fencingToken: pgTx.fencingToken,
          lotVersion: pgTx.lotVersion,
          remainingShardAvailable: pgTx.remainingShardAvailable,
          remainingAvailableUnits: pgTx.remainingPoolAvailable,
          reservedUnits: pgTx.reservedUnits,
          rebalancedFromShard: pgTx.rebalancedFromShard,
        },
        saga: {
          sagaId: pgTx.sagaId,
          outboxId: pgTx.outboxId,
          outboxStatus: pgTx.outboxStatus,
          finalState: pgTx.finalState,
          decisionLockLatencyMs: pgTx.decisionLockLatencyMs,
          asyncSagaSettlementMs: pgTx.asyncSagaSettlementMs,
          compensated: false,
          steps: pgTx.steps,
          escrowStatus: pgTx.escrowStatus,
          wmsStatus: pgTx.wmsStatus,
          stripeMode: pgTx.stripeMode,
          stripeStatus: pgTx.stripeStatus,
        },
        security: {
          guardrailStatus: 'OUTBOX_CRASH_PENDING_REAPER',
          circuitBreakerTripped: false,
          zeroPiiTokenized: true,
          subjectToken: edgeToken.subjectToken,
          merkleEpochId: pgTx.epoch.epochId,
          merkleRoot: pgTx.epoch.merkleRoot,
          blockHeight: pgTx.newHeight,
          blockHash: pgTx.auditBlock.blockHash,
          previousHash: pgTx.auditBlock.previousHash,
          shaSignature: pgTx.auditBlock.shaSignature,
        },
        decisionLockLatencyMs: totalEndToEndMs,
        asyncSagaSettlementMs: pgTx.asyncSagaSettlementMs,
        executionLatencyMs: totalEndToEndMs,
      };
      if (idempotencyKey) await saveIdempotentResponsePg(tenantId, String(idempotencyKey), 202, crashBody);
      return res.status(202).json(crashBody);
    }

    const effectiveClearingPrice = guardrail.bundleApplied ? 259.0 : effectiveBid;
    const grossProceeds = Math.round(unitsToClear * effectiveClearingPrice * 100) / 100;
    const routingStrategy = pgTx.rebalancedFromShard
      ? 'AUTO_REBALANCE_DONOR_SHARD'
      : shardHint !== undefined
      ? 'CLIENT_SHARD_HINT'
      : 'ROUND_ROBIN_STRIPED_SHARD';

    const successBody = {
      success: true,
      status: guardrail.degradedModeEngaged ? 'DEGRADED_FLOOR_OVERRIDE_PASSED' : 'VERIFIED_PASSED',
      skuId,
      unitsCleared: unitsToClear,
      canaryProbeWindowOpen: pgTx.canaryProbeWindowOpen,
      economics: {
        baseCogs: Number(costOfGoodsSold),
        totalLandedCogs: guardrail.landedBreakdown.totalLandedCogs,
        landedBreakdown: guardrail.landedBreakdown,
        minimumMarginFloorPct: Number(minimumMarginFloorPct),
        effectiveMarginFloorPct: guardrail.effectiveMarginFloorPct,
        degradedModeEngaged: guardrail.degradedModeEngaged,
        fallbackMode: guardrail.fallbackModeUsed,
        absoluteFloorPrice: guardrail.minimumFloorPrice,
        effectiveClearingPrice,
        realizedMarginPct: guardrail.realizedMarginPct,
        grossProceeds,
        bundleApplied: Boolean(guardrail.bundleApplied),
        computeEgressOverheadPerTx: `$${pgTx.tracker.effectiveEgressCost.toFixed(4)}`,
        expectedVoidCompOverheadPerTx: `$${(pgTx.tracker.expectedVoidCompCost ?? 0).toFixed(4)}`,
      },
      concurrency: {
        shardId: pgTx.shardId,
        shardIndex: pgTx.shardIndex,
        routingStrategy,
        fencingToken: pgTx.fencingToken,
        lotVersion: pgTx.lotVersion,
        remainingShardAvailable: pgTx.remainingShardAvailable,
        remainingAvailableUnits: pgTx.remainingPoolAvailable,
        reservedUnits: pgTx.reservedUnits,
        rebalancedFromShard: pgTx.rebalancedFromShard,
      },
      settlement: {
        channel: settlementChannel,
        ordering: 'FUNDS_FIRST_MANUAL_CAPTURE_ESCROW',
        escrowHoldId: pgTx.escrowHoldId,
        stripeMode: pgTx.stripeMode,
        stripeStatus: pgTx.stripeStatus,
        escrowStatus: pgTx.escrowStatus,
        wmsDispatchRef: pgTx.wmsDispatchRef,
        wmsStatus: pgTx.wmsStatus,
      },
      saga: {
        sagaId: pgTx.sagaId,
        finalState: pgTx.finalState,
        decisionLockLatencyMs: pgTx.decisionLockLatencyMs,
        asyncSagaSettlementMs: pgTx.asyncSagaSettlementMs,
        compensated: false,
        steps: pgTx.steps,
        escrowStatus: pgTx.escrowStatus,
        wmsStatus: pgTx.wmsStatus,
      },
      security: {
        guardrailStatus: pgTx.auditBlock.guardrailStatus,
        circuitBreakerTripped: false,
        zeroPiiTokenized: true,
        subjectToken: edgeToken.subjectToken,
        merkleEpochId: pgTx.epoch.epochId,
        merkleRoot: pgTx.epoch.merkleRoot,
        blockHeight: pgTx.newHeight,
        blockHash: pgTx.auditBlock.blockHash,
        previousHash: pgTx.auditBlock.previousHash,
        shaSignature: pgTx.auditBlock.shaSignature,
      },
      decisionLockLatencyMs: totalEndToEndMs,
      asyncSagaSettlementMs: pgTx.asyncSagaSettlementMs,
      executionLatencyMs: totalEndToEndMs,
    };

    if (idempotencyKey) await saveIdempotentResponsePg(tenantId, String(idempotencyKey), 200, successBody);
    res.json(successBody);
  } catch (error: any) {
    console.error('Error executing clear-margin-floor:', error);
    res.status(500).json({ success: false, error: error.message || 'Transactional clearance failed' });
  }
});

// Technical Dossier PDF Download (serves pre-built PDF cleanly in dev and production)
app.get('/api/dossier/download-pdf', (_req, res) => {
  const candidates = [
    path.join(process.cwd(), 'dist', 'Nexus_Enterprise_Technical_Dossier.pdf'),
    path.join(process.cwd(), 'public', 'Nexus_Enterprise_Technical_Dossier.pdf'),
  ];
  const pdfPath = candidates.find((p) => fs.existsSync(p));
  if (!pdfPath) {
    return res.status(404).json({
      success: false,
      error: 'Technical dossier PDF not found on disk.',
    });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Nexus_Enterprise_Technical_Dossier.pdf"');
  return res.sendFile(pdfPath);
});

// Reject unknown API routes with JSON 404 rather than SPA fallback
app.use('/api/*', (_req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found.' });
});

// ============================================================================
// VITE DEV / PRODUCTION STATIC FILE SERVING & GRACEFUL SHUTDOWN
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEXUS Commerce Clearing OS listening at http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}; closing HTTP server and PostgreSQL pool...`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
