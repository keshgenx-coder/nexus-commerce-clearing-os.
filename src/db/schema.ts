import {
  boolean,
  check,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('admin'),
  tenantId: text('tenant_id').notNull().default('tenant-default'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().unique(),
  name: text('name').notNull(),
  ownerUid: text('owner_uid').notNull(),
  defaultMarginFloorPct: doublePrecision('default_margin_floor_pct').notNull().default(18.5),
  shopifyShopDomain: text('shopify_shop_domain'),
  shopifyWebhookSecretEncrypted: text('shopify_webhook_secret_encrypted'),
  shopifyWebhookSecretPreview: text('shopify_webhook_secret_preview'),
  shopifyAutoHoldEnabled: boolean('shopify_auto_hold_enabled').notNull().default(true),
  stripeMode: text('stripe_mode').notNull().default('MANUAL_CAPTURE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const inventorySubLots = pgTable(
  'inventory_sub_lots',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().default('tenant-default'),
    shardId: text('shard_id').notNull().unique(),
    skuId: text('sku_id').notNull(),
    shardIndex: integer('shard_index').notNull(),
    availableUnits: integer('available_units').notNull(),
    reservedUnits: integer('reserved_units').notNull().default(0),
    version: integer('version').notNull().default(1),
    lastFencingToken: integer('last_fencing_token').notNull().default(1000),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    check('available_units_non_negative', sql`${table.availableUnits} >= 0`),
    check('reserved_units_non_negative', sql`${table.reservedUnits} >= 0`),
  ]
);

export const outboxRecords = pgTable('outbox_records', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('tenant-default'),
  outboxId: text('outbox_id').notNull().unique(),
  sagaId: text('saga_id').notNull(),
  userUid: text('user_uid').references(() => users.uid),
  skuId: text('sku_id').notNull(),
  shardId: text('shard_id').notNull(),
  shardIndex: integer('shard_index').notNull(),
  units: integer('units').notNull(),
  fencingToken: integer('fencing_token').notNull(),
  status: text('status').notNull(),
  attempts: integer('attempts').notNull().default(0),
  escrowHoldId: text('escrow_hold_id'),
  wmsDispatchRef: text('wms_dispatch_ref'),
  idempotencyKey: text('idempotency_key'),
  nextRetryAt: timestamp('next_retry_at'),
  lastError: text('last_error'),
  reconciliationDisposition: text('reconciliation_disposition'),
  providerTruthJson: jsonb('provider_truth_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditBlocks = pgTable('audit_blocks', {
  id: serial('id').primaryKey(),
  blockHeight: integer('block_height').notNull().unique(),
  blockHash: text('block_hash').notNull(),
  previousHash: text('previous_hash').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  tenantId: text('tenant_id').notNull(),
  userUid: text('user_uid').references(() => users.uid),
  subjectToken: text('subject_token').notNull(),
  action: text('action').notNull(),
  skuId: text('sku_id').notNull(),
  unitsCleared: integer('units_cleared').notNull(),
  clearingPrice: doublePrecision('clearing_price').notNull(),
  marginPct: doublePrecision('margin_pct').notNull(),
  grossProceeds: doublePrecision('gross_proceeds').notNull(),
  escrowHoldId: text('escrow_hold_id').notNull(),
  wmsDispatchRef: text('wms_dispatch_ref').notNull(),
  decisionLockLatencyMs: doublePrecision('decision_lock_latency_ms').notNull(),
  asyncSagaSettlementMs: doublePrecision('async_saga_settlement_ms').notNull(),
  fencingToken: integer('fencing_token'),
  sagaState: text('saga_state'),
  shardId: text('shard_id'),
  outboxId: text('outbox_id'),
  merkleEpochId: text('merkle_epoch_id'),
  merkleRoot: text('merkle_root'),
  effectiveEgressCost: doublePrecision('effective_egress_cost'),
  guardrailStatus: text('guardrail_status').notNull(),
  shaSignature: text('sha_signature').notNull(),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('tenant-default'),
  idemKey: text('idem_key').notNull().unique(),
  statusCode: integer('status_code').notNull(),
  responseBody: jsonb('response_body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const edgePiiVault = pgTable('edge_pii_vault', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('tenant-default'),
  subjectId: text('subject_id').notNull().unique(),
  subjectToken: text('subject_token').notNull().unique(),
  kmsKeyId: text('kms_key_id').notNull(),
  encryptedPiiRef: text('encrypted_pii_ref').notNull(),
  shredded: boolean('shredded').notNull().default(false),
  shreddedAt: timestamp('shredded_at'),
});

export const merkleEpochs = pgTable('merkle_epochs', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('tenant-default'),
  epochId: text('epoch_id').notNull().unique(),
  leafCount: integer('leaf_count').notNull(),
  merkleRoot: text('merkle_root').notNull(),
  previousEpochRoot: text('previous_epoch_root').notNull(),
  batchLatencyMs: doublePrecision('batch_latency_ms').notNull(),
  sealedAt: timestamp('sealed_at').defaultNow().notNull(),
});

export const emaState = pgTable('ema_state', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('tenant-default'),
  trackerKey: text('tracker_key').notNull().unique(),
  baseEgressCost: doublePrecision('base_egress_cost').notNull(),
  emaRetryRate: doublePrecision('ema_retry_rate').notNull(),
  emaCompensationRate: doublePrecision('ema_compensation_rate').notNull(),
  expectedVoidCompCost: doublePrecision('expected_void_comp_cost').notNull(),
  effectiveEgressCost: doublePrecision('effective_egress_cost').notNull(),
  lastUpdatedAtMs: doublePrecision('last_updated_at_ms').notNull(),
  shedCount: integer('shed_count').notNull().default(0),
});

export const benchmarkRuns = pgTable('benchmark_runs', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('tenant-default'),
  runId: text('run_id').notNull().unique(),
  userUid: text('user_uid').references(() => users.uid),
  skuId: text('sku_id').notNull(),
  totalRequests: integer('total_requests').notNull(),
  concurrency: integer('concurrency').notNull(),
  succeededCount: integer('succeeded_count').notNull(),
  rejectedCount: integer('rejected_count').notNull(),
  totalDurationMs: doublePrecision('total_duration_ms').notNull(),
  throughputTxPerSec: doublePrecision('throughput_tx_per_sec').notNull(),
  p50LatencyMs: doublePrecision('p50_latency_ms').notNull(),
  p95LatencyMs: doublePrecision('p95_latency_ms').notNull(),
  p99LatencyMs: doublePrecision('p99_latency_ms').notNull(),
  minLatencyMs: doublePrecision('min_latency_ms').notNull(),
  maxLatencyMs: doublePrecision('max_latency_ms').notNull(),
  isolationLevel: text('isolation_level').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stripeEscrowTransactions = pgTable('stripe_escrow_transactions', {
  id: serial('id').primaryKey(),
  escrowRef: text('escrow_ref').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  sagaId: text('saga_id').notNull(),
  paymentIntentId: text('payment_intent_id').notNull(),
  mode: text('mode').notNull(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('usd'),
  captureMethod: text('capture_method').notNull().default('manual'),
  status: text('status').notNull(),
  capturedAt: timestamp('captured_at'),
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shopifyWebhookEvents = pgTable('shopify_webhook_events', {
  id: serial('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  shopDomain: text('shop_domain').notNull(),
  topic: text('topic').notNull().default('orders/create'),
  shopifyOrderId: text('shopify_order_id').notNull(),
  orderNumber: text('order_number').notNull(),
  skuId: text('sku_id').notNull(),
  units: integer('units').notNull(),
  totalPrice: doublePrecision('total_price').notNull(),
  totalDiscounts: doublePrecision('total_discounts').notNull(),
  marginPct: doublePrecision('margin_pct').notNull(),
  hmacVerified: boolean('hmac_verified').notNull(),
  guardrailStatus: text('guardrail_status').notNull(),
  fulfillmentAction: text('fulfillment_action').notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeEscrowStatus: text('stripe_escrow_status'),
  auditBlockHeight: integer('audit_block_height'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  outboxRecords: many(outboxRecords),
  auditBlocks: many(auditBlocks),
  benchmarkRuns: many(benchmarkRuns),
}));

export const outboxRelations = relations(outboxRecords, ({ one }) => ({
  user: one(users, {
    fields: [outboxRecords.userUid],
    references: [users.uid],
  }),
}));

export const auditBlocksRelations = relations(auditBlocks, ({ one }) => ({
  user: one(users, {
    fields: [auditBlocks.userUid],
    references: [users.uid],
  }),
}));

export const benchmarkRunsRelations = relations(benchmarkRuns, ({ one }) => ({
  user: one(users, {
    fields: [benchmarkRuns.userUid],
    references: [users.uid],
  }),
}));
