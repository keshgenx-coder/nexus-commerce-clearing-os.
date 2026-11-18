# NEXUS Commerce Clearing OS — Technical Architecture & Diligence Dossier

> **Persistence:** Single-Region Cloud SQL for PostgreSQL (ACID `SELECT ... FOR UPDATE`, `K=32` striped sub-lots, `CHECK >= 0`)  
> **Authentication & RBAC:** Server-verified Firebase ID Tokens (`admin` / `operator` / `viewer`) scoped per `tenant_id`  
> **Connectors:** Encrypted per-tenant Shopify HMAC-SHA256 webhooks, outbound Shopify Admin GraphQL `fulfillmentOrderHold`, and Stripe Manual-Capture Escrow (`capture_method: 'manual'`)

---

## 1. System Architecture & Honest Capability Matrix

| Layer | Implementation in Codebase | Verification / Mode |
| --- | --- | --- |
| **Inventory Locking** | `K=32` striped `inventory_sub_lots` rows with `SELECT ... FOR UPDATE` and ascending-index rebalance | Live PostgreSQL ACID (`CHECK available_units >= 0`) |
| **Margin Economics** | Deterministic CM3 landed cost guardrail (`COGS + freight + fee + RTO risk`) + 30s half-life EMA (`$0.05` cap) | Verified unit tests + `HTTP 422` enforcement |
| **Multi-Tenant Security** | Every operational table scoped by `tenant_id`; role enforcement (`requireRole`) on mutations & benchmarks | `HTTP 401` unsigned / `HTTP 403` insufficient role |
| **Audit & GDPR PII** | SHA-256 hash-chained `audit_blocks`, sealed `merkle_epochs`, and `edge_pii_vault` crypto-shredding | Persisted in PostgreSQL; chain integrity verified |
| **Shopify Webhooks** | `POST /api/webhooks/shopify/:tenantId` verified with `timingSafeEqual` against AES-256-GCM encrypted secret | `HTTP 401` on missing/invalid `X-Shopify-Hmac-Sha256` |
| **Shopify Fulfillment Hold** | `holdShopifyOrderFulfillment()` via Shopify Admin GraphQL `fulfillmentOrderHold` | Live when `SHOPIFY_ADMIN_API_TOKEN` set; `LOCAL_POLICY_NO_ADMIN_TOKEN` fallback otherwise |
| **Stripe Escrow** | `createManualCaptureEscrowHold()` & `settleManualCaptureEscrow()` via Stripe SDK (`capture_method: 'manual'`) | Live when `STRIPE_SECRET_KEY` set; `SIMULATED_NO_STRIPE_KEY` fallback otherwise |
| **Throughput & Latency** | Concurrent PostgreSQL execution harness (`POST /api/agentforce/benchmark/run`) | Measured live per run (`benchmark_runs` table) |

---

## 2. Database Schema (12 Cloud SQL PostgreSQL Tables)

1. `tenants` — Workspace configuration, CM3 floor default, Shopify store domain, AES-256-GCM encrypted webhook secret, auto-hold flag
2. `users` — Firebase UID, email, `tenant_id`, RBAC `role` (`admin` / `operator` / `viewer`)
3. `inventory_sub_lots` — `K=32` striped sub-lots per `(tenant_id, sku_id)` with `CHECK (available_units >= 0 AND reserved_units >= 0)`
4. `outbox_records` — Durable SAGA execution state, retries (`maxRetries=3`), DLQ escalation, Stripe/WMS tracking refs
5. `audit_blocks` — Append-only SHA-256 hash chain (`previous_hash` -> `block_hash`)
6. `idempotency_keys` — Request deduplication per `(tenant_id, idempotency_key)`
7. `edge_pii_vault` — Tokenized buyer references with crypto-shred key destruction state
8. `merkle_epochs` — Periodic Merkle root seals over audit blocks
9. `ema_state` — Wall-clock half-life EMA volatility/void penalty tracking
10. `benchmark_runs` — Stored live concurrency benchmark telemetry (`P50`, `P95`, `P99`, TPS, errors)
11. `stripe_escrow_transactions` — Manual-capture `PaymentIntent` hold/capture/cancel records
12. `shopify_webhook_events` — Verified `orders/create` margin guardrail and fulfillment-hold audit trail

---

## 3. Transactional Lifecycle (4 Stages)

1. **Ingress & Authentication Gate**: Verifies Firebase ID Token -> resolves `tenant_id` + `role` -> checks `idempotency_keys` -> routes SKU write to deterministic/salted shard (`0..31`).
2. **CM3 Margin Guardrail & Half-Life EMA**: Computes realized contribution margin against tenant floor; breaches trigger `HTTP 422` halt (or `TIME_DECAY_FLOOR` / `HUMAN_APPROVAL_QUEUE` fallback policy) without polluting failure EMAs.
3. **PostgreSQL ACID Commit & Outbox SAGA**: Atomically decrements `available_units` (rebalancing across shards in ascending index order if needed), appends `outbox_records`, and executes escrow hold -> WMS dispatch.
4. **SHA-256 Ledger & Crypto-Shredding**: Commits linked `audit_blocks` + optional Merkle seal; buyer PII vault keys can be destroyed independently without breaking ledger hash verification.

---

## 4. Verification Summary

- **TypeScript (`tsc --noEmit`)**: 0 errors
- **Unit Tests (`npm test`)**: 73 tests passing across 7 suites (`cartCalculations`, `discountApplication`, `marginGuardrail`, `orderPlacement`, `resilientArchitecture`, `shardedOutboxArchitecture`, `connectorsAndCrypto`)
- **Production Container (`Dockerfile`)**: Multi-stage Node 22 Alpine build exposing `GET /api/health` (`SELECT 1` DB probe + connector readiness flags)
