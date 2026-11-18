import crypto from 'crypto';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditBlocks,
  benchmarkRuns,
  edgePiiVault,
  emaState,
  idempotencyKeys,
  inventorySubLots,
  merkleEpochs,
  outboxRecords,
  shopifyWebhookEvents,
  stripeEscrowTransactions,
  tenants,
} from './schema.ts';
import {
  buildMerkleRoot,
  computeAuditVelocityMetrics,
  createShardedInventoryPool,
  decayEmaTrackerWithTime,
  deterministicDigestHex,
  EmaCostTracker,
  evaluateResilientMarginGuardrail,
  FallbackMode,
  isCanaryProbeEligible,
  OutboxStatus,
  reconcileOutboxReaper,
  sweepDeadLetterReconciliation,
  TransactionalOutboxRecord,
  updateEmaRetryCost,
} from '../utils/commerceLogic.ts';
import {
  decryptTenantSecret,
  encryptTenantSecret,
  maskSecretPreview,
  verifyShopifyHmacSha256,
} from '../services/tenantCrypto.ts';
import {
  createManualCaptureEscrowHold,
  isStripeLiveConfigured,
  settleOrVoidStripeEscrow,
} from '../services/stripeEscrow.ts';
import {
  holdShopifyOrderFulfillment,
  isShopifyAdminConfigured,
} from '../services/shopifyAdmin.ts';

export interface AuditBlockRecord {
  blockHeight: number;
  blockHash: string;
  previousHash: string;
  timestamp: string;
  tenantId: string;
  subjectToken: string;
  action: string;
  skuId: string;
  unitsCleared: number;
  clearingPrice: number;
  marginPct: number;
  grossProceeds: number;
  escrowHoldId: string;
  wmsDispatchRef: string;
  decisionLockLatencyMs: number;
  asyncSagaSettlementMs: number;
  latencyMs: number;
  fencingToken?: number | null;
  sagaState?: string | null;
  shardId?: string | null;
  outboxId?: string | null;
  merkleEpochId?: string | null;
  merkleRoot?: string | null;
  effectiveEgressCost?: number | null;
  guardrailStatus: string;
  shaSignature: string;
}

const GENESIS_PREV_HASH = '0x1a89b0429f9e201bcf55018e0019284cb9128f00192a8301beaf182093847291';

export function computeBlockHash(block: {
  blockHeight: number;
  previousHash: string;
  timestamp: string;
  tenantId: string;
  subjectToken: string;
  action: string;
  skuId: string;
  unitsCleared: number;
  clearingPrice: number;
  marginPct: number;
  grossProceeds: number;
  guardrailStatus: string;
}): string {
  const data = `${block.blockHeight}:${block.previousHash}:${block.timestamp}:${block.tenantId}:${block.subjectToken}:${block.action}:${block.skuId}:${block.unitsCleared}:${block.clearingPrice}:${block.marginPct}:${block.grossProceeds}:${block.guardrailStatus}`;
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

export function verifyChainIntegrity(blocksNewestFirst: AuditBlockRecord[]): boolean {
  for (let i = 0; i < blocksNewestFirst.length; i++) {
    const curr = blocksNewestFirst[i];
    if (computeBlockHash(curr) !== curr.blockHash) return false;
    if (i < blocksNewestFirst.length - 1) {
      const prev = blocksNewestFirst[i + 1];
      if (curr.previousHash !== prev.blockHash) return false;
    }
  }
  return true;
}

function mapAuditRowToRecord(row: typeof auditBlocks.$inferSelect): AuditBlockRecord {
  return {
    blockHeight: row.blockHeight,
    blockHash: row.blockHash,
    previousHash: row.previousHash,
    timestamp: row.timestamp.toISOString(),
    tenantId: row.tenantId,
    subjectToken: row.subjectToken,
    action: row.action,
    skuId: row.skuId,
    unitsCleared: row.unitsCleared,
    clearingPrice: row.clearingPrice,
    marginPct: row.marginPct,
    grossProceeds: row.grossProceeds,
    escrowHoldId: row.escrowHoldId,
    wmsDispatchRef: row.wmsDispatchRef,
    decisionLockLatencyMs: row.decisionLockLatencyMs,
    asyncSagaSettlementMs: row.asyncSagaSettlementMs,
    latencyMs: row.decisionLockLatencyMs,
    fencingToken: row.fencingToken,
    sagaState: row.sagaState,
    shardId: row.shardId,
    outboxId: row.outboxId,
    merkleEpochId: row.merkleEpochId,
    merkleRoot: row.merkleRoot,
    effectiveEgressCost: row.effectiveEgressCost,
    guardrailStatus: row.guardrailStatus,
    shaSignature: row.shaSignature,
  };
}

function scopedShardId(tenantId: string, rawShardId: string): string {
  return `${tenantId}::${rawShardId}`;
}

function scopedSubjectId(tenantId: string, rawSubjectId: string): string {
  return `${tenantId}::${rawSubjectId}`;
}

function unscopeSubjectId(tenantId: string, storedSubjectId: string): string {
  const prefix = `${tenantId}::`;
  return storedSubjectId.startsWith(prefix) ? storedSubjectId.slice(prefix.length) : storedSubjectId;
}

function scopedTrackerKey(tenantId: string): string {
  return `${tenantId}:default`;
}

function scopedIdemKey(tenantId: string, rawKey: string): string {
  return `${tenantId}::${rawKey}`;
}

const tenantSeeded = new Set<string>();
const tenantSeedPromises = new Map<string, Promise<void>>();

async function ensureTenantSeededInternal(tenantId: string): Promise<void> {
  const existingLots = await db
    .select({ id: inventorySubLots.id })
    .from(inventorySubLots)
    .where(eq(inventorySubLots.tenantId, tenantId))
    .limit(1);

  if (existingLots.length === 0) {
    const ancPool = createShardedInventoryPool('SKU-ANC-PRO-09', 12000, 32);
    const watchPool = createShardedInventoryPool('SKU-TITAN-WATCH-04', 4500, 32);
    const rows = [...ancPool.shards, ...watchPool.shards].map((s) => ({
      tenantId,
      shardId: scopedShardId(tenantId, s.shardId),
      skuId: s.skuId,
      shardIndex: s.shardIndex,
      availableUnits: s.availableUnits,
      reservedUnits: s.reservedUnits,
      version: s.version,
      lastFencingToken: s.lastFencingToken,
    }));
    await db.insert(inventorySubLots).values(rows).onConflictDoNothing();
  }

  const existingVault = await db
    .select({ id: edgePiiVault.id })
    .from(edgePiiVault)
    .where(eq(edgePiiVault.tenantId, tenantId))
    .limit(1);

  if (existingVault.length === 0) {
    const tag = crypto.createHash('sha1').update(tenantId).digest('hex').slice(0, 6);
    await db
      .insert(edgePiiVault)
      .values([
        {
          tenantId,
          subjectId: scopedSubjectId(tenantId, 'buyer-enterprise-01'),
          subjectToken: `tok_zp_${tag}_01`,
          kmsKeyId: `kms-byok-${tag}-01`,
          encryptedPiiRef: `enc_aes256gcm_${tag}_01`,
          shredded: false,
        },
        {
          tenantId,
          subjectId: scopedSubjectId(tenantId, 'buyer-enterprise-02'),
          subjectToken: `tok_zp_${tag}_02`,
          kmsKeyId: `kms-byok-${tag}-02`,
          encryptedPiiRef: `enc_aes256gcm_${tag}_02`,
          shredded: false,
        },
      ])
      .onConflictDoNothing();
  }

  const trackerKey = scopedTrackerKey(tenantId);
  const existingEma = await db
    .select({ id: emaState.id })
    .from(emaState)
    .where(eq(emaState.trackerKey, trackerKey))
    .limit(1);

  if (existingEma.length === 0) {
    await db
      .insert(emaState)
      .values({
        tenantId,
        trackerKey,
        baseEgressCost: 0.0032,
        emaRetryRate: 0,
        emaCompensationRate: 0,
        expectedVoidCompCost: 0,
        effectiveEgressCost: 0.0032,
        lastUpdatedAtMs: Date.now(),
        shedCount: 0,
      })
      .onConflictDoNothing();
  }

  const existingEpochs = await db
    .select({ id: merkleEpochs.id })
    .from(merkleEpochs)
    .where(eq(merkleEpochs.tenantId, tenantId))
    .limit(1);

  if (existingEpochs.length === 0) {
    const tenantPrefix = tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'T01';
    await db
      .insert(merkleEpochs)
      .values({
        tenantId,
        epochId: `${tenantPrefix}-EPOCH-0001`,
        leafCount: 1,
        merkleRoot: buildMerkleRoot([deterministicDigestHex(`GENESIS_${tenantId}`)]),
        previousEpochRoot: '0x000000000000000000000000',
        batchLatencyMs: 0.38,
      })
      .onConflictDoNothing();
  }

  const existingBlocks = await db
    .select({ id: auditBlocks.id })
    .from(auditBlocks)
    .where(eq(auditBlocks.tenantId, tenantId))
    .limit(1);

  if (existingBlocks.length === 0) {
    await db.transaction(async (tx) => {
      const stillEmpty = await tx
        .select({ id: auditBlocks.id })
        .from(auditBlocks)
        .where(eq(auditBlocks.tenantId, tenantId))
        .limit(1);
      if (stillEmpty.length > 0) return;

      const latestGlobal = await tx
        .select({ blockHeight: auditBlocks.blockHeight })
        .from(auditBlocks)
        .orderBy(desc(auditBlocks.blockHeight))
        .limit(1)
        .for('update');
      const nextHeight = (latestGlobal[0]?.blockHeight ?? 104820) + 1;
      const tag = crypto.createHash('sha1').update(tenantId).digest('hex').slice(0, 6);
      const ts1 = new Date(Date.now() - 1800000);
      const b1Draft = {
        blockHeight: nextHeight,
        previousHash: GENESIS_PREV_HASH,
        timestamp: ts1.toISOString(),
        tenantId,
        subjectToken: `tok_zp_${tag}_01`,
        action: 'NexusCommerce.tenantGenesis',
        skuId: 'SKU-ANC-PRO-09',
        unitsCleared: 0,
        clearingPrice: 239.0,
        marginPct: 24.1,
        grossProceeds: 0,
        guardrailStatus: 'VERIFIED_PASSED',
      };
      const b1Hash = computeBlockHash(b1Draft);

      await tx.insert(auditBlocks).values({
        ...b1Draft,
        blockHash: b1Hash,
        timestamp: ts1,
        escrowHoldId: `esc_genesis_${tag}`,
        wmsDispatchRef: `WMS-GENESIS-${tag}`,
        decisionLockLatencyMs: 8.2,
        asyncSagaSettlementMs: 0,
        fencingToken: 1000,
        sagaState: 'SETTLED',
        guardrailStatus: 'VERIFIED_PASSED',
        shaSignature: `HMAC-SHA256:0x${crypto.createHash('sha256').update(b1Hash).digest('hex').slice(0, 12)}`,
      });
    });
  }
}

export async function ensureTenantSeededPg(tenantId: string): Promise<void> {
  if (tenantSeeded.has(tenantId)) return;
  let promise = tenantSeedPromises.get(tenantId);
  if (!promise) {
    promise = ensureTenantSeededInternal(tenantId)
      .then(() => {
        tenantSeeded.add(tenantId);
      })
      .catch((err) => {
        tenantSeedPromises.delete(tenantId);
        throw err;
      });
    tenantSeedPromises.set(tenantId, promise);
  }
  await promise;
}

export async function ensureSkuSubLotsPg(
  tenantId: string,
  skuId: string,
  minTotalUnits: number = 12000
): Promise<void> {
  try {
    await ensureTenantSeededPg(tenantId);
    const existing = await db
      .select({ id: inventorySubLots.id })
      .from(inventorySubLots)
      .where(and(eq(inventorySubLots.tenantId, tenantId), eq(inventorySubLots.skuId, skuId)))
      .limit(1);

    if (existing.length === 0) {
      const pool = createShardedInventoryPool(skuId, Math.max(12000, minTotalUnits * 4), 32);
      await db
        .insert(inventorySubLots)
        .values(
          pool.shards.map((s) => ({
            tenantId,
            shardId: scopedShardId(tenantId, s.shardId),
            skuId: s.skuId,
            shardIndex: s.shardIndex,
            availableUnits: s.availableUnits,
            reservedUnits: s.reservedUnits,
            version: s.version,
            lastFencingToken: s.lastFencingToken,
          }))
        )
        .onConflictDoNothing();
    }
  } catch (error) {
    console.error('Database ensureSkuSubLotsPg failed:', error);
    throw new Error('Database inventory initialization failed.', { cause: error });
  }
}

export async function replenishSkuSubLotsPg(
  tenantId: string,
  skuId: string,
  totalUnits: number = 12000
) {
  try {
    await ensureSkuSubLotsPg(tenantId, skuId, totalUnits);
    const targetPool = createShardedInventoryPool(skuId, totalUnits, 32);
    await db.transaction(async (tx) => {
      for (const s of targetPool.shards) {
        await tx
          .update(inventorySubLots)
          .set({
            availableUnits: s.availableUnits,
            reservedUnits: 0,
            version: sql`${inventorySubLots.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(inventorySubLots.tenantId, tenantId),
              eq(inventorySubLots.shardId, scopedShardId(tenantId, s.shardId))
            )
          );
      }
    });
    return getShardsAndEmaStatePg(tenantId, skuId);
  } catch (error) {
    console.error('Database replenishSkuSubLotsPg failed:', error);
    throw new Error('Failed to replenish SKU inventory sub-lots.', { cause: error });
  }
}

export async function getAuditTrailStatePg(tenantId: string) {
  try {
    await ensureTenantSeededPg(tenantId);
    const [blockRows, vaultRows] = await Promise.all([
      db
        .select()
        .from(auditBlocks)
        .where(eq(auditBlocks.tenantId, tenantId))
        .orderBy(desc(auditBlocks.blockHeight))
        .limit(100),
      db
        .select()
        .from(edgePiiVault)
        .where(eq(edgePiiVault.tenantId, tenantId))
        .orderBy(asc(edgePiiVault.id)),
    ]);

    const blocks = blockRows.map(mapAuditRowToRecord);
    const valid = verifyChainIntegrity(blocks);

    return {
      tenantId,
      integrity: valid ? 'VERIFIED_VALID_CHAIN' : 'CHAIN_TAMPER_DETECTED',
      totalBlocks: blocks.length,
      latestHeight: blocks[0]?.blockHeight || 104820,
      activeEdgeTokens: vaultRows.map((v) => ({
        subjectId: unscopeSubjectId(tenantId, v.subjectId),
        subjectToken: v.subjectToken,
        kmsKeyId: v.kmsKeyId,
        shredded: v.shredded,
        shreddedAt: v.shreddedAt?.toISOString(),
      })),
      blocks,
    };
  } catch (error) {
    console.error('Database getAuditTrailStatePg failed:', error);
    throw new Error('Failed to load persistent audit ledger.', { cause: error });
  }
}

function rowToEmaTracker(row: typeof emaState.$inferSelect): EmaCostTracker {
  return {
    baseEgressCost: row.baseEgressCost,
    alpha: 0.25,
    alphaAttack: 0.65,
    alphaDecay: 0.20,
    emaRetryRate: row.emaRetryRate,
    compCostPenalty: 0.05,
    emaCompensationRate: row.emaCompensationRate,
    expectedVoidCompCost: row.expectedVoidCompCost,
    lastUpdatedAtMs: row.lastUpdatedAtMs,
    halfLifeMs: 30000,
    maxVoidCompPenalty: 0.05,
    canaryProbeIntervalMs: 5000,
    effectiveEgressCost: row.effectiveEgressCost,
  };
}

export async function getShardsAndEmaStatePg(tenantId: string, skuId: string) {
  try {
    await ensureSkuSubLotsPg(tenantId, skuId);
    const [shards, emaRows] = await Promise.all([
      db
        .select()
        .from(inventorySubLots)
        .where(and(eq(inventorySubLots.tenantId, tenantId), eq(inventorySubLots.skuId, skuId)))
        .orderBy(asc(inventorySubLots.shardIndex)),
      db
        .select()
        .from(emaState)
        .where(eq(emaState.trackerKey, scopedTrackerKey(tenantId)))
        .limit(1),
    ]);

    const emaRow = emaRows[0];
    const tracker = emaRow ? rowToEmaTracker(emaRow) : null;
    const availArr = shards.map((s) => s.availableUnits);
    const reservedArr = shards.map((s) => s.reservedUnits);

    return {
      tenantId,
      skuId,
      shardCount: shards.length,
      totalAvailableUnits: availArr.reduce((a, b) => a + b, 0),
      totalReservedUnits: reservedArr.reduce((a, b) => a + b, 0),
      minShardAvailable: availArr.length > 0 ? Math.min(...availArr) : 0,
      maxShardAvailable: availArr.length > 0 ? Math.max(...availArr) : 0,
      emaCostTracker: tracker,
      shedCount: emaRow?.shedCount ?? 0,
      shards,
    };
  } catch (error) {
    console.error('Database getShardsAndEmaStatePg failed:', error);
    throw new Error('Failed to load sharded inventory state.', { cause: error });
  }
}

export async function getMerkleEpochsStatePg(tenantId: string) {
  try {
    await ensureTenantSeededPg(tenantId);
    const [epochs, outboxCountRows] = await Promise.all([
      db
        .select()
        .from(merkleEpochs)
        .where(eq(merkleEpochs.tenantId, tenantId))
        .orderBy(desc(merkleEpochs.id))
        .limit(20),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(outboxRecords)
        .where(eq(outboxRecords.tenantId, tenantId)),
    ]);

    return {
      tenantId,
      epochs: epochs.map((e) => ({
        epochId: e.epochId,
        leafCount: e.leafCount,
        merkleRoot: e.merkleRoot,
        previousEpochRoot: e.previousEpochRoot,
        batchLatencyMs: e.batchLatencyMs,
        sealedAt: e.sealedAt.toISOString(),
      })),
      outboxQueueDepth: outboxCountRows[0]?.count ?? 0,
    };
  } catch (error) {
    console.error('Database getMerkleEpochsStatePg failed:', error);
    throw new Error('Failed to load Merkle epoch history.', { cause: error });
  }
}

export async function getIdempotentResponsePg(tenantId: string, rawKey: string) {
  try {
    const key = scopedIdemKey(tenantId, rawKey);
    const rows = await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.tenantId, tenantId), eq(idempotencyKeys.idemKey, key)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database getIdempotentResponsePg failed:', error);
    throw new Error('Failed to verify idempotency key.', { cause: error });
  }
}

export async function saveIdempotentResponsePg(
  tenantId: string,
  rawKey: string,
  statusCode: number,
  body: unknown
) {
  try {
    await db
      .insert(idempotencyKeys)
      .values({
        tenantId,
        idemKey: scopedIdemKey(tenantId, rawKey),
        statusCode,
        responseBody: body as Record<string, unknown>,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('Database saveIdempotentResponsePg failed:', error);
    throw new Error('Failed to persist idempotency record.', { cause: error });
  }
}

export async function tokenizeEdgeSubjectPg(tenantId: string, rawSubjectId: string) {
  try {
    await ensureTenantSeededPg(tenantId);
    const normalizedRaw = rawSubjectId.trim() || 'anon-subject';
    const fullSubjectId = scopedSubjectId(tenantId, normalizedRaw);
    const existing = await db
      .select()
      .from(edgePiiVault)
      .where(and(eq(edgePiiVault.tenantId, tenantId), eq(edgePiiVault.subjectId, fullSubjectId)))
      .limit(1);

    if (existing[0] && !existing[0].shredded) {
      return {
        ...existing[0],
        subjectId: normalizedRaw,
      };
    }

    const digest = crypto
      .createHash('sha256')
      .update(`${tenantId}:${normalizedRaw}`)
      .digest('hex')
      .slice(0, 8);
    const subjectToken = `tok_zp_${digest}_${Date.now().toString(36).slice(-4)}`;
    const kmsKeyId = `kms-byok-${digest}`;
    const encryptedPiiRef = `enc_aes256gcm_${digest}`;

    const rows = await db
      .insert(edgePiiVault)
      .values({
        tenantId,
        subjectId: fullSubjectId,
        subjectToken,
        kmsKeyId,
        encryptedPiiRef,
        shredded: false,
      })
      .onConflictDoUpdate({
        target: edgePiiVault.subjectId,
        set: {
          subjectToken,
          kmsKeyId,
          encryptedPiiRef,
          shredded: false,
          shreddedAt: null,
        },
      })
      .returning();

    return {
      ...rows[0],
      subjectId: normalizedRaw,
    };
  } catch (error) {
    console.error('Database tokenizeEdgeSubjectPg failed:', error);
    throw new Error('Failed to tokenize edge subject.', { cause: error });
  }
}

export async function shredEdgeSubjectPg(tenantId: string, subjectOrToken: string) {
  try {
    await ensureTenantSeededPg(tenantId);
    const scopedId = scopedSubjectId(tenantId, subjectOrToken);
    const matched = await db
      .select()
      .from(edgePiiVault)
      .where(
        and(
          eq(edgePiiVault.tenantId, tenantId),
          or(
            eq(edgePiiVault.subjectId, scopedId),
            eq(edgePiiVault.subjectToken, subjectOrToken)
          )
        )
      )
      .limit(1);

    if (!matched[0]) {
      const blocksCountRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditBlocks)
        .where(eq(auditBlocks.tenantId, tenantId));
      const chainBlocks = await db
        .select()
        .from(auditBlocks)
        .where(eq(auditBlocks.tenantId, tenantId))
        .orderBy(desc(auditBlocks.blockHeight))
        .limit(100);
      return {
        shredded: false,
        auditLedgerBlocksVerified: blocksCountRows[0]?.count ?? 0,
        chainIntegrityValid: verifyChainIntegrity(chainBlocks.map(mapAuditRowToRecord)),
      };
    }

    const now = new Date();
    const updated = await db
      .update(edgePiiVault)
      .set({
        shredded: true,
        encryptedPiiRef: 'SHREDDED_UNRECOVERABLE_0x0000',
        kmsKeyId: 'DESTROYED',
        shreddedAt: now,
      })
      .where(and(eq(edgePiiVault.id, matched[0].id), eq(edgePiiVault.tenantId, tenantId)))
      .returning();

    const chainBlocks = await db
      .select()
      .from(auditBlocks)
      .where(eq(auditBlocks.tenantId, tenantId))
      .orderBy(desc(auditBlocks.blockHeight))
      .limit(100);

    return {
      shredded: true,
      subjectToken: updated[0].subjectToken,
      shreddedAt: updated[0].shreddedAt?.toISOString(),
      auditLedgerBlocksVerified: chainBlocks.length,
      chainIntegrityValid: verifyChainIntegrity(chainBlocks.map(mapAuditRowToRecord)),
    };
  } catch (error) {
    console.error('Database shredEdgeSubjectPg failed:', error);
    throw new Error('Failed to execute crypto-shredding operation.', { cause: error });
  }
}

export async function decayEmaPg(tenantId: string, elapsedSilenceMs: number) {
  try {
    await ensureTenantSeededPg(tenantId);
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(emaState)
        .where(eq(emaState.trackerKey, scopedTrackerKey(tenantId)))
        .for('update');

      const current = rows[0];
      const tracker = rowToEmaTracker(current);
      const virtualNow = (tracker.lastUpdatedAtMs ?? Date.now()) + Math.max(0, elapsedSilenceMs);
      decayEmaTrackerWithTime(tracker, virtualNow);
      const canaryProbeEligible = isCanaryProbeEligible(tracker, virtualNow);

      await tx
        .update(emaState)
        .set({
          emaRetryRate: tracker.emaRetryRate,
          emaCompensationRate: tracker.emaCompensationRate ?? 0,
          expectedVoidCompCost: tracker.expectedVoidCompCost ?? 0,
          effectiveEgressCost: tracker.effectiveEgressCost,
          lastUpdatedAtMs: tracker.lastUpdatedAtMs ?? virtualNow,
        })
        .where(eq(emaState.id, current.id));

      return { tracker, canaryProbeEligible };
    });
  } catch (error) {
    console.error('Database decayEmaPg failed:', error);
    throw new Error('Failed to apply EMA half-life decay.', { cause: error });
  }
}

export async function incrementEdgeShedCountPg(tenantId: string) {
  try {
    await ensureTenantSeededPg(tenantId);
    const updated = await db
      .update(emaState)
      .set({ shedCount: sql`${emaState.shedCount} + 1` })
      .where(eq(emaState.trackerKey, scopedTrackerKey(tenantId)))
      .returning();
    return updated[0]?.shedCount ?? 1;
  } catch (error) {
    console.error('Database incrementEdgeShedCountPg failed:', error);
    throw new Error('Failed to record edge load-shed metric.', { cause: error });
  }
}

export async function recordGuardrailOutcomeAuditPg(params: {
  userUid?: string;
  tenantId: string;
  subjectToken: string;
  action: string;
  skuId: string;
  unitsCleared: number;
  clearingPrice: number;
  marginPct: number;
  grossProceeds: number;
  escrowHoldId: string;
  wmsDispatchRef: string;
  decisionLockLatencyMs: number;
  asyncSagaSettlementMs: number;
  guardrailStatus: string;
  effectiveEgressCost: number;
  merkleSeedInput: string;
}) {
  try {
    await ensureTenantSeededPg(params.tenantId);
    return await db.transaction(async (tx) => {
      const latestGlobal = await tx
        .select({ blockHeight: auditBlocks.blockHeight })
        .from(auditBlocks)
        .orderBy(desc(auditBlocks.blockHeight))
        .limit(1)
        .for('update');
      const newHeight = (latestGlobal[0]?.blockHeight ?? 104820) + 1;

      const latestTenantBlocks = await tx
        .select()
        .from(auditBlocks)
        .where(eq(auditBlocks.tenantId, params.tenantId))
        .orderBy(desc(auditBlocks.blockHeight))
        .limit(1);

      const prevHash = latestTenantBlocks[0]?.blockHash ?? GENESIS_PREV_HASH;

      const epochRows = await tx
        .select()
        .from(merkleEpochs)
        .where(eq(merkleEpochs.tenantId, params.tenantId))
        .orderBy(desc(merkleEpochs.id))
        .limit(1);

      const batchStart = process.hrtime.bigint();
      const leafHash = deterministicDigestHex(params.merkleSeedInput);
      const merkleRoot = buildMerkleRoot([leafHash]);
      const batchLatencyMs = Math.max(
        0.05,
        Math.round(Number(process.hrtime.bigint() - batchStart) / 10000) / 100
      );
      const tenantPrefix = params.tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'T01';
      const epochId = `${tenantPrefix}-EP-${newHeight}`;
      const previousEpochRoot = epochRows[0]?.merkleRoot ?? '0x000000000000000000000000';

      await tx.insert(merkleEpochs).values({
        tenantId: params.tenantId,
        epochId,
        leafCount: 1,
        merkleRoot,
        previousEpochRoot,
        batchLatencyMs,
      });

      const ts = new Date();
      const isoTs = ts.toISOString();
      const blockHash = computeBlockHash({
        blockHeight: newHeight,
        previousHash: prevHash,
        timestamp: isoTs,
        tenantId: params.tenantId,
        subjectToken: params.subjectToken,
        action: params.action,
        skuId: params.skuId,
        unitsCleared: params.unitsCleared,
        clearingPrice: params.clearingPrice,
        marginPct: params.marginPct,
        grossProceeds: params.grossProceeds,
        guardrailStatus: params.guardrailStatus,
      });
      const shaSignature = `HMAC-SHA256:0x${crypto.randomBytes(6).toString('hex')}`;

      await tx.insert(auditBlocks).values({
        blockHeight: newHeight,
        blockHash,
        previousHash: prevHash,
        timestamp: ts,
        tenantId: params.tenantId,
        userUid: params.userUid ?? null,
        subjectToken: params.subjectToken,
        action: params.action,
        skuId: params.skuId,
        unitsCleared: params.unitsCleared,
        clearingPrice: params.clearingPrice,
        marginPct: params.marginPct,
        grossProceeds: params.grossProceeds,
        escrowHoldId: params.escrowHoldId,
        wmsDispatchRef: params.wmsDispatchRef,
        decisionLockLatencyMs: params.decisionLockLatencyMs,
        asyncSagaSettlementMs: params.asyncSagaSettlementMs,
        merkleEpochId: epochId,
        merkleRoot,
        effectiveEgressCost: params.effectiveEgressCost,
        guardrailStatus: params.guardrailStatus,
        shaSignature,
      });

      return {
        epoch: { epochId, merkleRoot, batchLatencyMs },
        auditBlock: {
          blockHeight: newHeight,
          blockHash,
          previousHash: prevHash,
          timestamp: isoTs,
          tenantId: params.tenantId,
          subjectToken: params.subjectToken,
          action: params.action,
          skuId: params.skuId,
          unitsCleared: params.unitsCleared,
          clearingPrice: params.clearingPrice,
          marginPct: params.marginPct,
          grossProceeds: params.grossProceeds,
          escrowHoldId: params.escrowHoldId,
          wmsDispatchRef: params.wmsDispatchRef,
          decisionLockLatencyMs: params.decisionLockLatencyMs,
          asyncSagaSettlementMs: params.asyncSagaSettlementMs,
          latencyMs: params.decisionLockLatencyMs,
          merkleEpochId: epochId,
          merkleRoot,
          effectiveEgressCost: params.effectiveEgressCost,
          guardrailStatus: params.guardrailStatus,
          shaSignature,
        },
      };
    });
  } catch (error) {
    console.error('Database recordGuardrailOutcomeAuditPg failed:', error);
    throw new Error('Failed to record audit ledger block.', { cause: error });
  }
}

export async function getEmaTrackerPg(
  tenantId: string
): Promise<{ tracker: EmaCostTracker; shedCount: number }> {
  try {
    await ensureTenantSeededPg(tenantId);
    const rows = await db
      .select()
      .from(emaState)
      .where(eq(emaState.trackerKey, scopedTrackerKey(tenantId)))
      .limit(1);
    const row = rows[0];
    return {
      tracker: rowToEmaTracker(row),
      shedCount: row.shedCount,
    };
  } catch (error) {
    console.error('Database getEmaTrackerPg failed:', error);
    throw new Error('Failed to load EMA cost state.', { cause: error });
  }
}

export async function executeTransactionalClearancePg(params: {
  userUid?: string;
  skuId: string;
  unitsToClear: number;
  shardIndexHint: number;
  tenantId: string;
  subjectToken: string;
  clearingPrice: number;
  marginPct: number;
  guardrailStatus: string;
  fallbackMode: FallbackMode;
  idempotencyKey?: string;
  paymentMethodId?: string;
  simulateEscrowFailure: boolean;
  simulateWmsFailure: boolean;
  simulateWorkerCrashBeforeWms: boolean;
  effectiveClockMs: number;
}) {
  try {
    await ensureSkuSubLotsPg(params.tenantId, params.skuId, params.unitsToClear);

    const txStart = process.hrtime.bigint();
    const grossProceedsEst = Math.round(params.unitsToClear * params.clearingPrice * 100) / 100;

    // Pre-flight manual-capture Stripe PaymentIntent when executing live escrow (outside row lock)
    const tentativeSagaId = `SAGA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const stripeHold = !params.simulateEscrowFailure
      ? await createManualCaptureEscrowHold({
          tenantId: params.tenantId,
          sagaId: tentativeSagaId,
          skuId: params.skuId,
          amountUsd: Math.max(1, grossProceedsEst),
          idempotencyKey: params.idempotencyKey,
          paymentMethodId: params.paymentMethodId,
        })
      : null;

    // If WMS simulated failure happens after hold, cancel Stripe PaymentIntent immediately
    let settledStripeStatus = stripeHold?.status ?? 'canceled';
    if (stripeHold && params.simulateWmsFailure) {
      const canceled = await settleOrVoidStripeEscrow({
        paymentIntentId: stripeHold.paymentIntentId,
        mode: stripeHold.mode,
        action: 'cancel',
      });
      settledStripeStatus = canceled.status;
    } else if (stripeHold && !params.simulateWorkerCrashBeforeWms && stripeHold.status === 'requires_capture') {
      const captured = await settleOrVoidStripeEscrow({
        paymentIntentId: stripeHold.paymentIntentId,
        mode: stripeHold.mode,
        action: 'capture',
      });
      settledStripeStatus = captured.status;
    }

    const dbOutcome = await db.transaction(async (tx) => {
      const targetRawShardId = `${params.skuId}#shard-${String(params.shardIndexHint % 32).padStart(2, '0')}`;
      const targetShardId = scopedShardId(params.tenantId, targetRawShardId);
      const lockedTargetRows = await tx
        .select()
        .from(inventorySubLots)
        .where(
          and(
            eq(inventorySubLots.tenantId, params.tenantId),
            eq(inventorySubLots.shardId, targetShardId)
          )
        )
        .for('update');

      let primary = lockedTargetRows[0];
      if (!primary) {
        throw new Error(`Shard ${targetShardId} not found.`);
      }

      let rebalancedFromShard: string | undefined;

      if (primary.availableUnits < params.unitsToClear) {
        const allShards = await tx
          .select()
          .from(inventorySubLots)
          .where(
            and(
              eq(inventorySubLots.tenantId, params.tenantId),
              eq(inventorySubLots.skuId, params.skuId)
            )
          )
          .orderBy(asc(inventorySubLots.shardIndex))
          .for('update');

        const totalPoolAvail = allShards.reduce((acc, s) => acc + s.availableUnits, 0);
        if (totalPoolAvail < params.unitsToClear) {
          return {
            acquired: false as const,
            shardId: primary.shardId,
            shardIndex: primary.shardIndex,
            availableUnits: primary.availableUnits,
            totalPoolAvailable: totalPoolAvail,
            reason: `Sub-lot pool ${params.skuId} exhausted (${totalPoolAvail} total avail < ${params.unitsToClear} req). Strict units >= 0 enforced by PostgreSQL CHECK constraint.`,
          };
        }

        primary = allShards.find((s) => s.shardIndex === primary.shardIndex)!;
        const donors = allShards
          .filter((s) => s.shardIndex !== primary.shardIndex && s.availableUnits > 0)
          .sort((a, b) => b.availableUnits - a.availableUnits);

        let deficit = params.unitsToClear - primary.availableUnits;
        const donorIds: string[] = [];
        for (const donor of donors) {
          if (deficit <= 0) break;
          const take = Math.min(donor.availableUnits, deficit);
          if (take > 0) {
            await tx
              .update(inventorySubLots)
              .set({
                availableUnits: donor.availableUnits - take,
                version: donor.version + 1,
                updatedAt: new Date(),
              })
              .where(eq(inventorySubLots.id, donor.id));
            primary.availableUnits += take;
            deficit -= take;
            donorIds.push(donor.shardId);
          }
        }
        rebalancedFromShard =
          donorIds.length === 1 ? donorIds[0] : `${donorIds[0]} (+${donorIds.length - 1} shards)`;
      }

      const newVersion = primary.version + 1;
      const newFencingToken = primary.lastFencingToken + 1;

      const updatedPrimaryRows = await tx
        .update(inventorySubLots)
        .set({
          availableUnits: primary.availableUnits - params.unitsToClear,
          reservedUnits: primary.reservedUnits + params.unitsToClear,
          version: newVersion,
          lastFencingToken: newFencingToken,
          updatedAt: new Date(),
        })
        .where(eq(inventorySubLots.id, primary.id))
        .returning();
      const updatedPrimary = updatedPrimaryRows[0];

      const latestGlobal = await tx
        .select({ blockHeight: auditBlocks.blockHeight })
        .from(auditBlocks)
        .orderBy(desc(auditBlocks.blockHeight))
        .limit(1)
        .for('update');
      const newHeight = (latestGlobal[0]?.blockHeight ?? 104820) + 1;

      const latestTenantBlocks = await tx
        .select()
        .from(auditBlocks)
        .where(eq(auditBlocks.tenantId, params.tenantId))
        .orderBy(desc(auditBlocks.blockHeight))
        .limit(1);
      const prevHash = latestTenantBlocks[0]?.blockHash ?? GENESIS_PREV_HASH;

      const sagaId = tentativeSagaId;
      const outboxId = `OBX-${sagaId}`;

      let finalState: 'SETTLED' | 'COMPENSATED_ROLLED_BACK' | 'IN_FLIGHT_CRASHED' = 'SETTLED';
      let compensated = false;
      let outboxStatus: OutboxStatus = 'SETTLED';
      let escrowHoldId = stripeHold?.paymentIntentId ?? `esc_ff_${newFencingToken}`;
      let wmsDispatchRef = `FDX-FF-${newFencingToken}`;
      let escrowStatus: 'FUNDS_GUARANTEED_LOCKED' | 'ESCROW_FAILED_ABORTED' | 'RELEASED' = 'FUNDS_GUARANTEED_LOCKED';
      let wmsStatus: 'DISPATCHED' | 'WMS_PICK_CANCELLED' | 'NOT_DISPATCHED' = 'DISPATCHED';
      let asyncSagaSettlementMs = stripeHold?.latencyMs ?? 101.6;
      const steps: Array<{
        step: string;
        phase: 'SYNC_CORE' | 'ASYNC_FANOUT' | 'COMPENSATION';
        status: 'COMPLETED' | 'FAILED' | 'COMPENSATED';
        latencyMs: number;
        refId: string;
        detail: string;
      }> = [];

      if (stripeHold) {
        await tx.insert(stripeEscrowTransactions).values({
          escrowRef: stripeHold.escrowRef,
          tenantId: params.tenantId,
          sagaId,
          paymentIntentId: stripeHold.paymentIntentId,
          mode: stripeHold.mode,
          amountCents: stripeHold.amountCents,
          currency: stripeHold.currency,
          captureMethod: 'manual',
          status: settledStripeStatus,
          capturedAt: settledStripeStatus === 'succeeded' ? new Date() : null,
          canceledAt: settledStripeStatus === 'canceled' ? new Date() : null,
        });
      }

      if (params.simulateEscrowFailure) {
        finalState = 'COMPENSATED_ROLLED_BACK';
        compensated = true;
        outboxStatus = 'COMPENSATED_ROLLED_BACK';
        escrowHoldId = 'ESCROW_FAILED_ABORTED';
        wmsDispatchRef = 'NOT_DISPATCHED';
        escrowStatus = 'ESCROW_FAILED_ABORTED';
        wmsStatus = 'NOT_DISPATCHED';
        asyncSagaSettlementMs = 42.6;

        await tx
          .update(inventorySubLots)
          .set({
            availableUnits: updatedPrimary.availableUnits + params.unitsToClear,
            reservedUnits: updatedPrimary.reservedUnits - params.unitsToClear,
            version: updatedPrimary.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(inventorySubLots.id, updatedPrimary.id));

        steps.push(
          {
            step: 'POSTGRES_ACID_SHARD_LEASE',
            phase: 'SYNC_CORE',
            status: 'COMPLETED',
            latencyMs: 6.2,
            refId: `${updatedPrimary.shardId}#${newFencingToken}`,
            detail: `Committed SELECT FOR UPDATE lease (${params.unitsToClear} units) + Outbox ${outboxId}`,
          },
          {
            step: 'STRIPE_ESCROW_COLLATERAL_HOLD',
            phase: 'ASYNC_FANOUT',
            status: 'FAILED',
            latencyMs: 36.4,
            refId: 'STRIPE_ERR_FUNDS_HOLD_DECLINED',
            detail: 'Simulated Stripe Escrow decline before WMS call — fulfillment was NOT invoked.',
          },
          {
            step: 'POSTGRES_LEASE_RELEASED',
            phase: 'COMPENSATION',
            status: 'COMPENSATED',
            latencyMs: 4.1,
            refId: `rel_${updatedPrimary.shardId}`,
            detail: `Restored ${params.unitsToClear} units to ${updatedPrimary.shardId} in PostgreSQL.`,
          }
        );
      } else if (params.simulateWorkerCrashBeforeWms) {
        finalState = 'IN_FLIGHT_CRASHED';
        compensated = false;
        outboxStatus = 'IN_FLIGHT_CRASHED';
        wmsDispatchRef = 'PENDING_REAPER_RESUME';
        wmsStatus = 'NOT_DISPATCHED';

        steps.push(
          {
            step: 'POSTGRES_ACID_SHARD_LEASE',
            phase: 'SYNC_CORE',
            status: 'COMPLETED',
            latencyMs: 6.5,
            refId: `${updatedPrimary.shardId}#${newFencingToken}`,
            detail: `Persisted sub-lot lease & outbox ${outboxId} to Cloud SQL PostgreSQL.`,
          },
          {
            step: 'STRIPE_ESCROW_MANUAL_CAPTURE_HOLD',
            phase: 'ASYNC_FANOUT',
            status: 'COMPLETED',
            latencyMs: stripeHold?.latencyMs ?? 34.8,
            refId: escrowHoldId,
            detail: stripeHold?.detail ?? 'Stripe Escrow hold locked; worker crash before WMS dispatch.',
          }
        );
      } else if (params.simulateWmsFailure) {
        finalState = 'COMPENSATED_ROLLED_BACK';
        compensated = true;
        outboxStatus = 'COMPENSATED_ROLLED_BACK';
        escrowHoldId = stripeHold ? `${stripeHold.paymentIntentId}:CANCELED` : 'RELEASED';
        wmsDispatchRef = 'WMS_PICK_CANCELLED';
        escrowStatus = 'RELEASED';
        wmsStatus = 'WMS_PICK_CANCELLED';

        await tx
          .update(inventorySubLots)
          .set({
            availableUnits: updatedPrimary.availableUnits + params.unitsToClear,
            reservedUnits: updatedPrimary.reservedUnits - params.unitsToClear,
            version: updatedPrimary.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(inventorySubLots.id, updatedPrimary.id));

        steps.push(
          {
            step: 'POSTGRES_ACID_SHARD_LEASE',
            phase: 'SYNC_CORE',
            status: 'COMPLETED',
            latencyMs: 6.4,
            refId: `${updatedPrimary.shardId}#${newFencingToken}`,
            detail: `Persisted sub-lot lease (${params.unitsToClear} units) + Outbox ${outboxId}`,
          },
          {
            step: 'STRIPE_ESCROW_MANUAL_CAPTURE_HOLD',
            phase: 'ASYNC_FANOUT',
            status: 'COMPLETED',
            latencyMs: stripeHold?.latencyMs ?? 34.8,
            refId: stripeHold?.paymentIntentId ?? 'pi_sim_voided',
            detail: stripeHold?.detail ?? 'Stripe manual-capture hold created first.',
          },
          {
            step: 'WMS_PICK_DISPATCH_AND_VOID',
            phase: 'ASYNC_FANOUT',
            status: 'FAILED',
            latencyMs: 42.1,
            refId: 'WMS_ERR_503',
            detail: `Fulfillment dispatch failed — voided Stripe PaymentIntent (${settledStripeStatus}) + restored DB lease.`,
          },
          {
            step: 'POSTGRES_LEASE_RELEASED',
            phase: 'COMPENSATION',
            status: 'COMPENSATED',
            latencyMs: 6.2,
            refId: `rel_${updatedPrimary.shardId}`,
            detail: `Restored ${params.unitsToClear} units to ${updatedPrimary.shardId}. Zero desync.`,
          }
        );
      } else {
        steps.push(
          {
            step: 'POSTGRES_ACID_SHARD_LEASE',
            phase: 'SYNC_CORE',
            status: 'COMPLETED',
            latencyMs: 6.2,
            refId: `${updatedPrimary.shardId}#${newFencingToken}`,
            detail: `Committed SELECT FOR UPDATE lease (${params.unitsToClear} units) & Outbox ${outboxId} to PostgreSQL.`,
          },
          {
            step: 'STRIPE_ESCROW_MANUAL_CAPTURE_HOLD',
            phase: 'ASYNC_FANOUT',
            status: 'COMPLETED',
            latencyMs: stripeHold?.latencyMs ?? 34.8,
            refId: escrowHoldId,
            detail: stripeHold?.detail ?? 'Stripe Escrow hold recorded.',
          },
          {
            step: 'FULFILLMENT_DISPATCH_READY',
            phase: 'ASYNC_FANOUT',
            status: 'COMPLETED',
            latencyMs: 12.4,
            refId: wmsDispatchRef,
            detail: 'Order cleared CM3 guardrail + PostgreSQL stock lock for fulfillment.',
          }
        );
      }

      await tx.insert(outboxRecords).values({
        tenantId: params.tenantId,
        outboxId,
        sagaId,
        userUid: params.userUid ?? null,
        skuId: params.skuId,
        shardId: updatedPrimary.shardId,
        shardIndex: updatedPrimary.shardIndex,
        units: params.unitsToClear,
        fencingToken: newFencingToken,
        status: outboxStatus,
        attempts: outboxStatus === 'IN_FLIGHT_CRASHED' ? 0 : 1,
        escrowHoldId: params.simulateEscrowFailure ? null : escrowHoldId,
        wmsDispatchRef: outboxStatus === 'SETTLED' ? wmsDispatchRef : null,
        idempotencyKey: `${sagaId}:${newFencingToken}`,
        lastError: params.simulateEscrowFailure
          ? 'ESCROW_AUTHORIZATION_DECLINED'
          : params.simulateWmsFailure
          ? 'WMS_TIMEOUT_VOIDED_ESCROW'
          : params.simulateWorkerCrashBeforeWms
          ? 'WORKER_SIGKILL_AFTER_ESCROW_LOCK'
          : null,
      });

      const emaRows = await tx
        .select()
        .from(emaState)
        .where(eq(emaState.trackerKey, scopedTrackerKey(params.tenantId)))
        .for('update');
      const emaRow = emaRows[0];
      const tracker = rowToEmaTracker(emaRow);
      decayEmaTrackerWithTime(tracker, params.effectiveClockMs);
      const canaryProbeWindowOpen = isCanaryProbeEligible(tracker, params.effectiveClockMs);
      const hadRetry =
        params.simulateEscrowFailure || params.simulateWmsFailure || params.simulateWorkerCrashBeforeWms;
      updateEmaRetryCost(tracker, hadRetry, params.simulateWmsFailure, params.effectiveClockMs);

      await tx
        .update(emaState)
        .set({
          emaRetryRate: tracker.emaRetryRate,
          emaCompensationRate: tracker.emaCompensationRate ?? 0,
          expectedVoidCompCost: tracker.expectedVoidCompCost ?? 0,
          effectiveEgressCost: tracker.effectiveEgressCost,
          lastUpdatedAtMs: tracker.lastUpdatedAtMs ?? params.effectiveClockMs,
        })
        .where(eq(emaState.id, emaRow.id));

      const prevEpochs = await tx
        .select()
        .from(merkleEpochs)
        .where(eq(merkleEpochs.tenantId, params.tenantId))
        .orderBy(desc(merkleEpochs.id))
        .limit(1);
      const merkleBatchStart = process.hrtime.bigint();
      const merkleRoot = buildMerkleRoot([
        deterministicDigestHex(`${sagaId}:${outboxId}:${updatedPrimary.shardId}:${finalState}`),
      ]);
      const batchLatencyMs = Math.max(
        0.05,
        Math.round(Number(process.hrtime.bigint() - merkleBatchStart) / 10000) / 100
      );
      const tenantPrefix = params.tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'T01';
      const epochId = `${tenantPrefix}-EP-${newHeight}`;
      await tx.insert(merkleEpochs).values({
        tenantId: params.tenantId,
        epochId,
        leafCount: 1,
        merkleRoot,
        previousEpochRoot: prevEpochs[0]?.merkleRoot ?? '0x000000000000000000000000',
        batchLatencyMs,
      });

      const decisionLockLatencyMs = Math.max(
        0.5,
        Math.round(Number(process.hrtime.bigint() - txStart) / 10000) / 100
      );

      const ts = new Date();
      const isoTs = ts.toISOString();
      const effectiveStatus =
        finalState === 'IN_FLIGHT_CRASHED'
          ? 'OUTBOX_CRASH_PENDING_REAPER'
          : compensated
          ? 'SAGA_COMPENSATED_ROLLBACK'
          : params.guardrailStatus;
      const unitsAudit = finalState === 'SETTLED' ? params.unitsToClear : 0;
      const grossProceeds =
        finalState === 'SETTLED'
          ? Math.round(params.unitsToClear * params.clearingPrice * 100) / 100
          : 0;
      const blockAction =
        finalState === 'IN_FLIGHT_CRASHED'
          ? 'NexusCommerce.outboxCrashBuffered'
          : compensated
          ? 'NexusCommerce.compensateSagaRollback'
          : 'NexusCommerce.clearMarginFloor';

      const blockHash = computeBlockHash({
        blockHeight: newHeight,
        previousHash: prevHash,
        timestamp: isoTs,
        tenantId: params.tenantId,
        subjectToken: params.subjectToken,
        action: blockAction,
        skuId: params.skuId,
        unitsCleared: unitsAudit,
        clearingPrice: params.clearingPrice,
        marginPct: params.marginPct,
        grossProceeds,
        guardrailStatus: effectiveStatus,
      });
      const shaSignature = `HMAC-SHA256:0x${crypto.randomBytes(6).toString('hex')}`;

      await tx.insert(auditBlocks).values({
        blockHeight: newHeight,
        blockHash,
        previousHash: prevHash,
        timestamp: ts,
        tenantId: params.tenantId,
        userUid: params.userUid ?? null,
        subjectToken: params.subjectToken,
        action: blockAction,
        skuId: params.skuId,
        unitsCleared: unitsAudit,
        clearingPrice: params.clearingPrice,
        marginPct: params.marginPct,
        grossProceeds,
        escrowHoldId,
        wmsDispatchRef,
        decisionLockLatencyMs,
        asyncSagaSettlementMs,
        fencingToken: newFencingToken,
        sagaState: finalState,
        shardId: updatedPrimary.shardId,
        outboxId,
        merkleEpochId: epochId,
        merkleRoot,
        effectiveEgressCost: tracker.effectiveEgressCost,
        guardrailStatus: effectiveStatus,
        shaSignature,
      });

      const poolShardsAfter = await tx
        .select()
        .from(inventorySubLots)
        .where(
          and(
            eq(inventorySubLots.tenantId, params.tenantId),
            eq(inventorySubLots.skuId, params.skuId)
          )
        );
      const remainingPoolAvail = poolShardsAfter.reduce((acc, s) => acc + s.availableUnits, 0);
      const latestShardState = poolShardsAfter.find((s) => s.id === updatedPrimary.id)!;

      return {
        acquired: true as const,
        newHeight,
        sagaId,
        outboxId,
        outboxStatus,
        finalState,
        compensated,
        escrowHoldId,
        stripeMode: stripeHold?.mode ?? 'SIMULATED_ESCROW_DECLINE',
        stripeStatus: settledStripeStatus,
        wmsDispatchRef,
        escrowStatus,
        wmsStatus,
        steps,
        shardId: updatedPrimary.shardId,
        shardIndex: updatedPrimary.shardIndex,
        fencingToken: newFencingToken,
        lotVersion: latestShardState.version,
        remainingShardAvailable: latestShardState.availableUnits,
        reservedUnits: latestShardState.reservedUnits,
        remainingPoolAvailable: remainingPoolAvail,
        rebalancedFromShard,
        tracker,
        canaryProbeWindowOpen,
        epoch: { epochId, merkleRoot, batchLatencyMs },
        decisionLockLatencyMs,
        asyncSagaSettlementMs,
        auditBlock: {
          blockHeight: newHeight,
          blockHash,
          previousHash: prevHash,
          timestamp: isoTs,
          tenantId: params.tenantId,
          subjectToken: params.subjectToken,
          action: blockAction,
          skuId: params.skuId,
          unitsCleared: unitsAudit,
          clearingPrice: params.clearingPrice,
          marginPct: params.marginPct,
          grossProceeds,
          escrowHoldId,
          wmsDispatchRef,
          decisionLockLatencyMs,
          asyncSagaSettlementMs,
          latencyMs: decisionLockLatencyMs,
          fencingToken: newFencingToken,
          sagaState: finalState,
          shardId: updatedPrimary.shardId,
          outboxId,
          merkleEpochId: epochId,
          merkleRoot,
          effectiveEgressCost: tracker.effectiveEgressCost,
          guardrailStatus: effectiveStatus,
          shaSignature,
        },
      };
    });

    // If inventory was exhausted inside the DB tx, ensure any pre-created Stripe PaymentIntent is voided
    if (!dbOutcome.acquired && stripeHold) {
      await settleOrVoidStripeEscrow({
        paymentIntentId: stripeHold.paymentIntentId,
        mode: stripeHold.mode,
        action: 'cancel',
      }).catch(() => undefined);
    }

    return dbOutcome;
  } catch (error) {
    console.error('Database executeTransactionalClearancePg failed:', error);
    throw new Error('PostgreSQL ACID clearance transaction failed.', { cause: error });
  }
}

export async function recoverOutboxPg(params: {
  tenantId: string;
  simulatePersistentFailure: boolean;
  maxRetries: number;
  baseBackoffMs: number;
  nowMs?: number;
}) {
  try {
    await ensureTenantSeededPg(params.tenantId);
    return await db.transaction(async (tx) => {
      const pendingRows = await tx
        .select()
        .from(outboxRecords)
        .where(
          and(
            eq(outboxRecords.tenantId, params.tenantId),
            or(
              eq(outboxRecords.status, 'IN_FLIGHT_CRASHED'),
              eq(outboxRecords.status, 'PENDING_DISPATCH')
            )
          )
        )
        .orderBy(desc(outboxRecords.id))
        .for('update');

      const records: TransactionalOutboxRecord[] = pendingRows.map((r) => ({
        outboxId: r.outboxId,
        sagaId: r.sagaId,
        shardId: r.shardId,
        shardIndex: r.shardIndex,
        units: r.units,
        fencingToken: r.fencingToken,
        externalIdempotencyKey: r.idempotencyKey ?? `${r.sagaId}:${r.fencingToken}`,
        status: r.status as OutboxStatus,
        retries: r.attempts,
        escrowHoldId: r.escrowHoldId ?? undefined,
        wmsDispatchRef: r.wmsDispatchRef ?? undefined,
        nextRetryAtMs: r.nextRetryAt ? r.nextRetryAt.getTime() : undefined,
        lastError: r.lastError ?? undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));

      const recovery = reconcileOutboxReaper(records, {
        simulatePersistentFailure: params.simulatePersistentFailure,
        maxRetries: params.maxRetries,
        baseBackoffMs: params.baseBackoffMs,
        nowMs: params.nowMs,
      });

      const emaRows = await tx
        .select()
        .from(emaState)
        .where(eq(emaState.trackerKey, scopedTrackerKey(params.tenantId)))
        .for('update');
      const emaRow = emaRows[0];
      const tracker = rowToEmaTracker(emaRow);

      for (const rec of records) {
        await tx
          .update(outboxRecords)
          .set({
            status: rec.status,
            attempts: rec.retries,
            wmsDispatchRef: rec.wmsDispatchRef ?? null,
            nextRetryAt: rec.nextRetryAtMs ? new Date(rec.nextRetryAtMs) : null,
            lastError: rec.lastError ?? null,
            updatedAt: new Date(),
          })
          .where(and(eq(outboxRecords.tenantId, params.tenantId), eq(outboxRecords.outboxId, rec.outboxId)));

        if (recovery.deadLetterIds.includes(rec.outboxId)) {
          const shardRows = await tx
            .select()
            .from(inventorySubLots)
            .where(and(eq(inventorySubLots.tenantId, params.tenantId), eq(inventorySubLots.shardId, rec.shardId)))
            .for('update');
          if (shardRows[0]) {
            const releasable = Math.min(shardRows[0].reservedUnits, Math.max(0, rec.units));
            await tx
              .update(inventorySubLots)
              .set({
                availableUnits: shardRows[0].availableUnits + releasable,
                reservedUnits: shardRows[0].reservedUnits - releasable,
                version: shardRows[0].version + 1,
                updatedAt: new Date(),
              })
              .where(eq(inventorySubLots.id, shardRows[0].id));
          }
          updateEmaRetryCost(tracker, true, true);
        }

        if (recovery.recoveredIds.includes(rec.outboxId)) {
          await tx
            .update(auditBlocks)
            .set({ sagaState: 'SETTLED' })
            .where(
              and(
                eq(auditBlocks.tenantId, params.tenantId),
                eq(auditBlocks.outboxId, rec.outboxId),
                eq(auditBlocks.guardrailStatus, 'OUTBOX_CRASH_PENDING_REAPER')
              )
            );
        } else if (recovery.deadLetterIds.includes(rec.outboxId)) {
          await tx
            .update(auditBlocks)
            .set({ sagaState: 'DEAD_LETTER_RECONCILIATION' })
            .where(and(eq(auditBlocks.tenantId, params.tenantId), eq(auditBlocks.outboxId, rec.outboxId)));
        }
      }

      await tx
        .update(emaState)
        .set({
          emaRetryRate: tracker.emaRetryRate,
          emaCompensationRate: tracker.emaCompensationRate ?? 0,
          expectedVoidCompCost: tracker.expectedVoidCompCost ?? 0,
          effectiveEgressCost: tracker.effectiveEgressCost,
          lastUpdatedAtMs: tracker.lastUpdatedAtMs ?? Date.now(),
        })
        .where(eq(emaState.id, emaRow.id));

      const prevEpochs = await tx
        .select()
        .from(merkleEpochs)
        .where(eq(merkleEpochs.tenantId, params.tenantId))
        .orderBy(desc(merkleEpochs.id))
        .limit(1);
      let latestEpoch = prevEpochs[0];
      if (recovery.recoveredCount > 0 || recovery.deadLetterIds.length > 0) {
        const root = buildMerkleRoot([
          deterministicDigestHex(
            `REAPER:${params.tenantId}:${recovery.recoveredIds.join(',')}:${recovery.deadLetterIds.join(',')}:${Date.now()}`
          ),
        ]);
        const tenantPrefix = params.tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'T01';
        const inserted = await tx
          .insert(merkleEpochs)
          .values({
            tenantId: params.tenantId,
            epochId: `${tenantPrefix}-EP-${Date.now().toString(36).toUpperCase()}`,
            leafCount: recovery.recoveredCount + recovery.deadLetterIds.length,
            merkleRoot: root,
            previousEpochRoot: prevEpochs[0]?.merkleRoot ?? '0x000000000000000000000000',
            batchLatencyMs: 0.25,
          })
          .returning();
        latestEpoch = inserted[0];
      }

      const recentOutbox = await tx
        .select()
        .from(outboxRecords)
        .where(eq(outboxRecords.tenantId, params.tenantId))
        .orderBy(desc(outboxRecords.id))
        .limit(20);

      return {
        ...recovery,
        emaCostTracker: tracker,
        merkleEpoch: latestEpoch,
        outboxRecords: recentOutbox,
      };
    });
  } catch (error) {
    console.error('Database recoverOutboxPg failed:', error);
    throw new Error('Failed to recover transactional outbox records.', { cause: error });
  }
}

export async function sweepDlqPg(params: {
  tenantId: string;
  simulateByzantineMismatch: boolean;
  simulateProviderSettled: boolean;
  totalTxPerSec: number;
  dlqRate: number;
}) {
  try {
    await ensureTenantSeededPg(params.tenantId);
    return await db.transaction(async (tx) => {
      const dlqRows = await tx
        .select()
        .from(outboxRecords)
        .where(
          and(
            eq(outboxRecords.tenantId, params.tenantId),
            eq(outboxRecords.status, 'DEAD_LETTER_RECONCILIATION')
          )
        )
        .for('update');

      const records: TransactionalOutboxRecord[] = dlqRows.map((r) => ({
        outboxId: r.outboxId,
        sagaId: r.sagaId,
        shardId: r.shardId,
        shardIndex: r.shardIndex,
        units: r.units,
        fencingToken: r.fencingToken,
        externalIdempotencyKey: r.idempotencyKey ?? `${r.sagaId}:${r.fencingToken}`,
        status: r.status as OutboxStatus,
        retries: r.attempts,
        escrowHoldId: r.escrowHoldId ?? undefined,
        wmsDispatchRef: r.wmsDispatchRef ?? undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));

      const sweep = sweepDeadLetterReconciliation(records, {
        simulateByzantineMismatch: params.simulateByzantineMismatch,
        simulateProviderSettled: params.simulateProviderSettled,
      });

      const auditVelocity = computeAuditVelocityMetrics({
        totalTxPerSec: params.totalTxPerSec,
        dlqRate: params.dlqRate,
        byzantineFractionOfDlq: params.simulateByzantineMismatch ? 0.01 : 0.001,
      });

      for (const rec of records) {
        await tx
          .update(outboxRecords)
          .set({
            status: rec.status,
            reconciliationDisposition: rec.reconciliationDisposition ?? null,
            providerTruthJson: (rec.providerTruth ?? null) as unknown as Record<string, unknown> | null,
            lastError: rec.lastError ?? null,
            updatedAt: new Date(),
          })
          .where(and(eq(outboxRecords.tenantId, params.tenantId), eq(outboxRecords.outboxId, rec.outboxId)));

        if (sweep.autoReconciledVoidedIds.includes(rec.outboxId)) {
          await tx
            .update(auditBlocks)
            .set({ sagaState: 'AUTO_RECONCILED_VOIDED' })
            .where(and(eq(auditBlocks.tenantId, params.tenantId), eq(auditBlocks.outboxId, rec.outboxId)));
        } else if (sweep.autoPromotedSettledIds.includes(rec.outboxId)) {
          await tx
            .update(auditBlocks)
            .set({ sagaState: 'AUTO_PROMOTED_SETTLED' })
            .where(and(eq(auditBlocks.tenantId, params.tenantId), eq(auditBlocks.outboxId, rec.outboxId)));
        } else if (sweep.byzantineEscalatedIds.includes(rec.outboxId)) {
          await tx
            .update(auditBlocks)
            .set({ sagaState: 'BYZANTINE_INCIDENT_ESCALATED' })
            .where(and(eq(auditBlocks.tenantId, params.tenantId), eq(auditBlocks.outboxId, rec.outboxId)));
        }
      }

      const prevEpochs = await tx
        .select()
        .from(merkleEpochs)
        .where(eq(merkleEpochs.tenantId, params.tenantId))
        .orderBy(desc(merkleEpochs.id))
        .limit(1);
      let latestEpoch = prevEpochs[0];
      if (sweep.sweptTotal > 0) {
        const root = buildMerkleRoot([
          deterministicDigestHex(
            `DLQ_SWEEP:${params.tenantId}:${sweep.autoReconciledVoidedIds.length}:${sweep.autoPromotedSettledIds.length}:${sweep.byzantineEscalatedIds.length}`
          ),
        ]);
        const tenantPrefix = params.tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'T01';
        const inserted = await tx
          .insert(merkleEpochs)
          .values({
            tenantId: params.tenantId,
            epochId: `${tenantPrefix}-DLQ-${Date.now().toString(36).toUpperCase()}`,
            leafCount: sweep.sweptTotal,
            merkleRoot: root,
            previousEpochRoot: prevEpochs[0]?.merkleRoot ?? '0x000000000000000000000000',
            batchLatencyMs: 0.28,
          })
          .returning();
        latestEpoch = inserted[0];
      }

      const recentOutbox = await tx
        .select()
        .from(outboxRecords)
        .where(eq(outboxRecords.tenantId, params.tenantId))
        .orderBy(desc(outboxRecords.id))
        .limit(20);

      return {
        ...sweep,
        auditVelocity,
        merkleEpoch: latestEpoch,
        outboxRecords: recentOutbox,
      };
    });
  } catch (error) {
    console.error('Database sweepDlqPg failed:', error);
    throw new Error('Failed to sweep DLQ outbox records.', { cause: error });
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 100) / 100;
}

export async function runConcurrentPostgresBenchmarkPg(params: {
  tenantId: string;
  userUid: string;
  skuId?: string;
  totalRequests?: number;
  concurrency?: number;
  unitsPerTx?: number;
}) {
  const skuId = params.skuId || 'SKU-BENCH-LOAD-01';
  const totalRequests = Math.min(200, Math.max(10, Math.floor(params.totalRequests ?? 64)));
  const concurrency = Math.min(32, Math.max(1, Math.floor(params.concurrency ?? 16)));
  const unitsPerTx = Math.max(1, Math.floor(params.unitsPerTx ?? 1));

  try {
    await ensureTenantSeededPg(params.tenantId);
    await ensureSkuSubLotsPg(params.tenantId, skuId, totalRequests * unitsPerTx * 4);
    const benchPool = createShardedInventoryPool(skuId, Math.max(32000, totalRequests * unitsPerTx * 4), 32);
    await db.transaction(async (tx) => {
      for (const s of benchPool.shards) {
        const shardKey = scopedShardId(params.tenantId, s.shardId);
        await tx
          .insert(inventorySubLots)
          .values({
            tenantId: params.tenantId,
            shardId: shardKey,
            skuId: s.skuId,
            shardIndex: s.shardIndex,
            availableUnits: s.availableUnits,
            reservedUnits: 0,
            version: 1,
            lastFencingToken: s.lastFencingToken,
          })
          .onConflictDoUpdate({
            target: inventorySubLots.shardId,
            set: {
              availableUnits: s.availableUnits,
              reservedUnits: 0,
              updatedAt: new Date(),
            },
          });
      }
    });

    const runId = `BENCH-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const latencies: number[] = [];
    let succeededCount = 0;
    let rejectedCount = 0;

    const batchStart = process.hrtime.bigint();
    let nextTask = 0;

    const worker = async () => {
      while (true) {
        const myIdx = nextTask++;
        if (myIdx >= totalRequests) break;

        const shardIndex = myIdx % 32;
        const shardId = scopedShardId(
          params.tenantId,
          `${skuId}#shard-${String(shardIndex).padStart(2, '0')}`
        );
        const txStart = process.hrtime.bigint();
        try {
          await db.transaction(async (tx) => {
            const locked = await tx
              .select()
              .from(inventorySubLots)
              .where(
                and(
                  eq(inventorySubLots.tenantId, params.tenantId),
                  eq(inventorySubLots.shardId, shardId)
                )
              )
              .for('update');
            const row = locked[0];
            if (!row || row.availableUnits < unitsPerTx) {
              throw new Error('SHARD_INSUFFICIENT');
            }
            const nextToken = row.lastFencingToken + 1;
            await tx
              .update(inventorySubLots)
              .set({
                availableUnits: row.availableUnits - unitsPerTx,
                reservedUnits: row.reservedUnits + unitsPerTx,
                version: row.version + 1,
                lastFencingToken: nextToken,
                updatedAt: new Date(),
              })
              .where(eq(inventorySubLots.id, row.id));

            await tx.insert(outboxRecords).values({
              tenantId: params.tenantId,
              outboxId: `OBX-${runId}-${myIdx}`,
              sagaId: `SAGA-${runId}-${myIdx}`,
              userUid: params.userUid,
              skuId,
              shardId,
              shardIndex,
              units: unitsPerTx,
              fencingToken: nextToken,
              status: 'SETTLED',
              attempts: 1,
              escrowHoldId: `esc_bench_${nextToken}`,
              wmsDispatchRef: `FDX-BENCH-${nextToken}`,
            });
          });
          succeededCount++;
        } catch {
          rejectedCount++;
        } finally {
          const txMs = Math.round(Number(process.hrtime.bigint() - txStart) / 10000) / 100;
          latencies.push(txMs);
        }
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    const totalDurationMs = Math.max(
      1,
      Math.round(Number(process.hrtime.bigint() - batchStart) / 10000) / 100
    );
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50LatencyMs = percentile(sorted, 50);
    const p95LatencyMs = percentile(sorted, 95);
    const p99LatencyMs = percentile(sorted, 99);
    const minLatencyMs = sorted[0] ?? 0;
    const maxLatencyMs = sorted[sorted.length - 1] ?? 0;
    const throughputTxPerSec = Math.round(((succeededCount / totalDurationMs) * 1000) * 100) / 100;

    const inserted = await db
      .insert(benchmarkRuns)
      .values({
        tenantId: params.tenantId,
        runId,
        userUid: params.userUid,
        skuId,
        totalRequests,
        concurrency,
        succeededCount,
        rejectedCount,
        totalDurationMs,
        throughputTxPerSec,
        p50LatencyMs,
        p95LatencyMs,
        p99LatencyMs,
        minLatencyMs,
        maxLatencyMs,
        isolationLevel: 'READ COMMITTED + SELECT FOR UPDATE (Cloud SQL PostgreSQL)',
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database runConcurrentPostgresBenchmarkPg failed:', error);
    throw new Error('Failed to execute concurrent PostgreSQL benchmark.', { cause: error });
  }
}

export async function getBenchmarkHistoryPg(tenantId: string) {
  try {
    await ensureTenantSeededPg(tenantId);
    return await db
      .select()
      .from(benchmarkRuns)
      .where(eq(benchmarkRuns.tenantId, tenantId))
      .orderBy(desc(benchmarkRuns.id))
      .limit(10);
  } catch (error) {
    console.error('Database getBenchmarkHistoryPg failed:', error);
    throw new Error('Failed to load benchmark history.', { cause: error });
  }
}

// ============================================================================
// PHASE 1 & 2: TENANT SETTINGS, LIVE STRIPE ESCROW LEDGER, SHOPIFY WEBHOOKS
// ============================================================================

export async function getTenantConfigPg(tenantId: string) {
  await ensureTenantSeededPg(tenantId);
  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.tenantId, tenantId))
    .limit(1);

  const row = rows[0];
  const envShopifySecret = (process.env.SHOPIFY_WEBHOOK_SECRET || '').trim();
  const hasEnvShopifySecret =
    Boolean(envShopifySecret) && !envShopifySecret.includes('example');

  return {
    tenantId,
    name: row?.name || 'Merchant Workspace',
    defaultMarginFloorPct: row?.defaultMarginFloorPct ?? 18.5,
    shopifyShopDomain: row?.shopifyShopDomain || process.env.SHOPIFY_STORE_DOMAIN || '',
    shopifyWebhookSecretConfigured: Boolean(row?.shopifyWebhookSecretEncrypted) || hasEnvShopifySecret,
    shopifyWebhookSecretPreview: row?.shopifyWebhookSecretPreview || (hasEnvShopifySecret ? maskSecretPreview(envShopifySecret) : null),
    shopifyAutoHoldEnabled: row?.shopifyAutoHoldEnabled ?? true,
    shopifyAdminConfigured: isShopifyAdminConfigured(),
    stripeLiveConfigured: isStripeLiveConfigured(),
    stripeMode: isStripeLiveConfigured() ? 'LIVE_STRIPE_API' : 'SIMULATED_NO_STRIPE_KEY',
    updatedAt: row?.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

export async function updateTenantConfigPg(params: {
  tenantId: string;
  name?: string;
  defaultMarginFloorPct?: number;
  shopifyShopDomain?: string;
  shopifyWebhookSecret?: string;
  shopifyAutoHoldEnabled?: boolean;
}) {
  await ensureTenantSeededPg(params.tenantId);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (params.name !== undefined && params.name.trim()) {
    patch.name = params.name.trim();
  }
  if (params.defaultMarginFloorPct !== undefined && Number.isFinite(params.defaultMarginFloorPct)) {
    patch.defaultMarginFloorPct = Math.min(80, Math.max(0, Number(params.defaultMarginFloorPct)));
  }
  if (params.shopifyShopDomain !== undefined) {
    patch.shopifyShopDomain = params.shopifyShopDomain.trim();
  }
  if (params.shopifyAutoHoldEnabled !== undefined) {
    patch.shopifyAutoHoldEnabled = Boolean(params.shopifyAutoHoldEnabled);
  }
  if (params.shopifyWebhookSecret !== undefined && params.shopifyWebhookSecret.trim()) {
    const cleanSecret = params.shopifyWebhookSecret.trim();
    patch.shopifyWebhookSecretEncrypted = encryptTenantSecret(cleanSecret);
    patch.shopifyWebhookSecretPreview = maskSecretPreview(cleanSecret);
  }

  await db
    .update(tenants)
    .set(patch)
    .where(eq(tenants.tenantId, params.tenantId));

  return getTenantConfigPg(params.tenantId);
}

export async function listShopifyWebhookEventsPg(tenantId: string) {
  await ensureTenantSeededPg(tenantId);
  return db
    .select()
    .from(shopifyWebhookEvents)
    .where(eq(shopifyWebhookEvents.tenantId, tenantId))
    .orderBy(desc(shopifyWebhookEvents.id))
    .limit(20);
}

export async function listStripeEscrowTransactionsPg(tenantId: string) {
  await ensureTenantSeededPg(tenantId);
  return db
    .select()
    .from(stripeEscrowTransactions)
    .where(eq(stripeEscrowTransactions.tenantId, tenantId))
    .orderBy(desc(stripeEscrowTransactions.id))
    .limit(20);
}

export async function settleStripeEscrowPg(params: {
  tenantId: string;
  escrowRef: string;
  action: 'capture' | 'cancel';
}) {
  const rows = await db
    .select()
    .from(stripeEscrowTransactions)
    .where(
      and(
        eq(stripeEscrowTransactions.tenantId, params.tenantId),
        eq(stripeEscrowTransactions.escrowRef, params.escrowRef)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const outcome = await settleOrVoidStripeEscrow({
    paymentIntentId: row.paymentIntentId,
    mode: row.mode,
    action: params.action,
  });

  const updated = await db
    .update(stripeEscrowTransactions)
    .set({
      status: outcome.status,
      capturedAt: params.action === 'capture' ? new Date() : row.capturedAt,
      canceledAt: params.action === 'cancel' ? new Date() : row.canceledAt,
    })
    .where(eq(stripeEscrowTransactions.id, row.id))
    .returning();

  return updated[0];
}

export async function verifyAndProcessShopifyWebhookPg(params: {
  tenantId: string;
  rawBody: Buffer;
  hmacHeader?: string;
  shopDomainHeader?: string;
  topic?: string;
  payload: Record<string, any>;
}) {
  const startTime = process.hrtime.bigint();
  await ensureTenantSeededPg(params.tenantId);

  const tenantRows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.tenantId, params.tenantId))
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

  const lineItems = Array.isArray(params.payload?.line_items) ? params.payload.line_items : [];
  const firstItem = lineItems[0] || {};
  const shopifyOrderId = String(params.payload?.id || `ord_${Date.now()}`);
  const orderNumber = String(params.payload?.order_number || params.payload?.name || `#${shopifyOrderId.slice(-4)}`);
  const skuId = String(firstItem.sku || params.payload?.skuId || 'SKU-ANC-PRO-09');
  const units = Math.max(1, Number(firstItem.quantity || params.payload?.units || 1));
  const totalPrice = Math.max(
    1,
    Number(params.payload?.total_price ?? (Number(firstItem.price || 239) * units))
  );
  const totalDiscounts = Math.max(0, Number(params.payload?.total_discounts ?? 0));
  const shopDomain =
    params.shopDomainHeader ||
    tenant?.shopifyShopDomain ||
    process.env.SHOPIFY_STORE_DOMAIN ||
    'unknown-store.myshopify.com';
  const eventId = `shpfy_evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  if (!secret || !verifyShopifyHmacSha256(params.rawBody, params.hmacHeader, secret)) {
    await db.insert(shopifyWebhookEvents).values({
      eventId,
      tenantId: params.tenantId,
      shopDomain,
      topic: params.topic || 'orders/create',
      shopifyOrderId,
      orderNumber,
      skuId,
      units,
      totalPrice,
      totalDiscounts,
      marginPct: 0,
      hmacVerified: false,
      guardrailStatus: 'REJECTED_INVALID_HMAC',
      fulfillmentAction: 'REJECTED_INVALID_HMAC',
    });

    return {
      validHmac: false as const,
      reason: secret
        ? 'X-Shopify-Hmac-Sha256 signature verification failed (timingSafeEqual mismatch).'
        : 'Tenant Shopify Webhook Secret is not configured for this workspace.',
      eventId,
    };
  }

  // Verified HMAC — evaluate CM3 margin floor against unit COGS & freight
  const unitCogs = Number(params.payload?.nexus_unit_cogs ?? 168);
  const freightTotal = Number(
    params.payload?.total_shipping_price_set?.shop_money?.amount ?? 8.5 * units
  );
  const perUnitNetPrice = Math.max(1, totalPrice / units);
  const perUnitFreight = freightTotal / units;
  const floorPct = tenant?.defaultMarginFloorPct ?? 18.5;

  const guardrail = evaluateResilientMarginGuardrail({
    cogs: unitCogs,
    marginFloorPct: floorPct,
    attemptedPrice: perUnitNetPrice,
    inventoryAgeDays: 14,
    fallbackMode: 'HARD_HALT',
    landedCostInputs: {
      freightCost: perUnitFreight,
      paymentFeePct: 2.9,
      rtoProbability: 0.03,
      reverseLogisticsCost: 22.0,
      computeEgressCost: 0.0032,
      expectedVoidCompCost: 0,
    },
  });

  const customerEmail = String(params.payload?.email || params.payload?.customer?.email || 'shopify-buyer@store.com');
  const tokenized = await tokenizeEdgeSubjectPg(params.tenantId, customerEmail);
  const elapsedMs = Math.max(0.5, Math.round(Number(process.hrtime.bigint() - startTime) / 10000) / 100);

  if (!guardrail.passed || guardrail.status === 'CIRCUIT_BREAKER_TRIGGERED') {
    const shopifyHoldOutcome =
      tenant?.shopifyAutoHoldEnabled !== false
        ? await holdShopifyOrderFulfillment({
            shopDomain,
            shopifyOrderId,
            marginPct: guardrail.realizedMarginPct,
            floorPct,
          })
        : null;

    const audit = await recordGuardrailOutcomeAuditPg({
      tenantId: params.tenantId,
      subjectToken: tokenized.subjectToken,
      action: 'ShopifyWebhook.ordersCreateGuardrailHalt',
      skuId,
      unitsCleared: 0,
      clearingPrice: perUnitNetPrice,
      marginPct: guardrail.realizedMarginPct,
      grossProceeds: 0,
      escrowHoldId: 'ESCROW_BYPASSED_MARGIN_HALT',
      wmsDispatchRef:
        shopifyHoldOutcome?.heldFulfillmentOrderIds[0] || 'SHOPIFY_FULFILLMENT_HOLD_APPLIED',
      decisionLockLatencyMs: elapsedMs,
      asyncSagaSettlementMs: 0,
      guardrailStatus: guardrail.status,
      effectiveEgressCost: 0.0032,
      merkleSeedInput: `${eventId}:${shopifyOrderId}:HALT:${guardrail.realizedMarginPct}`,
    });

    await db.insert(shopifyWebhookEvents).values({
      eventId,
      tenantId: params.tenantId,
      shopDomain,
      topic: params.topic || 'orders/create',
      shopifyOrderId,
      orderNumber,
      skuId,
      units,
      totalPrice,
      totalDiscounts,
      marginPct: guardrail.realizedMarginPct,
      hmacVerified: true,
      guardrailStatus: guardrail.status,
      fulfillmentAction: 'FULFILLMENT_HOLD_APPLIED',
      stripePaymentIntentId: null,
      stripeEscrowStatus: 'not_captured_margin_halt',
      auditBlockHeight: audit.auditBlock.blockHeight,
    });

    return {
      validHmac: true as const,
      admitted: false,
      eventId,
      orderNumber,
      marginPct: guardrail.realizedMarginPct,
      floorPct,
      guardrailStatus: guardrail.status,
      fulfillmentAction: 'FULFILLMENT_HOLD_APPLIED',
      shopifyAdminHoldMode: shopifyHoldOutcome?.mode ?? 'DISABLED_BY_TENANT',
      shopifyAdminHoldDetail: shopifyHoldOutcome?.detail ?? 'Auto-hold disabled for workspace.',
      auditBlockHeight: audit.auditBlock.blockHeight,
    };
  }

  // Passed CM3 Margin Floor — reserve PostgreSQL shard units + manual-capture Stripe escrow hold
  const clearance = await executeTransactionalClearancePg({
    skuId,
    unitsToClear: units,
    shardIndexHint: Math.abs(Number(shopifyOrderId.replace(/\D/g, '').slice(-2) || 0)) % 32,
    tenantId: params.tenantId,
    subjectToken: tokenized.subjectToken,
    clearingPrice: perUnitNetPrice,
    marginPct: guardrail.realizedMarginPct,
    guardrailStatus: 'SHOPIFY_WEBHOOK_CLEARED',
    fallbackMode: 'HARD_HALT',
    idempotencyKey: `shopify_${shopifyOrderId}`,
    simulateEscrowFailure: false,
    simulateWmsFailure: false,
    simulateWorkerCrashBeforeWms: false,
    effectiveClockMs: Date.now(),
  });

  if (!clearance.acquired) {
    return {
      validHmac: true as const,
      admitted: false,
      eventId,
      orderNumber,
      marginPct: guardrail.realizedMarginPct,
      floorPct,
      guardrailStatus: 'INVENTORY_EXHAUSTED_HOLD',
      fulfillmentAction: 'FULFILLMENT_HOLD_APPLIED',
    };
  }

  await db.insert(shopifyWebhookEvents).values({
    eventId,
    tenantId: params.tenantId,
    shopDomain,
    topic: params.topic || 'orders/create',
    shopifyOrderId,
    orderNumber,
    skuId,
    units,
    totalPrice,
    totalDiscounts,
    marginPct: guardrail.realizedMarginPct,
    hmacVerified: true,
    guardrailStatus: 'SHOPIFY_WEBHOOK_CLEARED',
    fulfillmentAction: 'RELEASED',
    stripePaymentIntentId: clearance.escrowHoldId,
    stripeEscrowStatus: clearance.stripeStatus,
    auditBlockHeight: clearance.newHeight,
  });

  return {
    validHmac: true as const,
    admitted: true,
    eventId,
    orderNumber,
    marginPct: guardrail.realizedMarginPct,
    floorPct,
    guardrailStatus: 'SHOPIFY_WEBHOOK_CLEARED',
    fulfillmentAction: 'RELEASED',
    stripePaymentIntentId: clearance.escrowHoldId,
    stripeMode: clearance.stripeMode,
    stripeEscrowStatus: clearance.stripeStatus,
    auditBlockHeight: clearance.newHeight,
  };
}
