# NEXUS Commerce Clearing OS — Technical Diligence & Acquisition Handoff

## 1. Repository Inventory (Pruned & Production-Focused)
Legacy `mockData` views and unused prototype portals have been removed. Every file remaining in `src/` and `server.ts` is directly reachable and actively compiled/tested:

- **HTTP Server & Security (`server.ts`)**:
  - Express + Helmet CSP/security headers, API rate limiting (`express-rate-limit`), raw-body preservation for webhook HMAC signatures, JSON `404` handler for `/api/*`, graceful `SIGTERM`/`SIGINT` pool shutdown, and `SELECT 1` DB probe in `GET /api/health`.
- **Authentication & Multi-Tenant RBAC (`src/middleware/auth.ts`, `src/db/users.ts`, `src/lib/firebase-admin.ts`, `src/context/AuthContext.tsx`)**:
  - Server-side Firebase ID token verification on protected endpoints (`401` when absent/invalid).
  - Tenant-scoped user profiles with `admin` / `operator` / `viewer` role checks (`requireRole`).
- **Cloud SQL PostgreSQL Ledger (`src/db/schema.ts`, `src/db/index.ts`, `src/db/ledgerRepository.ts`)**:
  - Drizzle ORM schema with SQL `CHECK (available_units >= 0 AND reserved_units >= 0)` constraints and `SELECT ... FOR UPDATE` striped sub-lot allocation (`K=32` shards).
  - Tables: `tenants`, `users`, `inventory_sub_lots`, `outbox_records`, `audit_blocks`, `idempotency_keys`, `edge_pii_vault`, `merkle_epochs`, `ema_state`, `benchmark_runs`, `stripe_escrow_transactions`, `shopify_webhook_events`.
  - All ledger queries, benchmarks, Reaper retries, DLQ sweeps, crypto-shredding, and webhook logs are scoped by `tenant_id`.
- **Connectors & Cryptography (`src/services/`)**:
  - `tenantCrypto.ts`: AES-256-GCM encryption/decryption for per-tenant Shopify webhook secrets (`ENCRYPTION_MASTER_KEY`) and constant-time `verifyShopifyHmacSha256`.
  - `stripeEscrow.ts`: Stripe `PaymentIntent` manual-capture escrow (`createManualCaptureEscrowHold`, `settleManualCaptureEscrow`, `verifyStripeWebhookSignature`) with explicit `SIMULATED_NO_STRIPE_KEY` fallback when `STRIPE_SECRET_KEY` is unset.
  - `shopifyAdmin.ts`: Shopify Admin GraphQL (`order.fulfillmentOrders` + `fulfillmentOrderHold`) when `SHOPIFY_ADMIN_API_TOKEN` is set, with explicit `LOCAL_POLICY_NO_ADMIN_TOKEN` fallback when unset.
- **Economics Engine (`src/utils/commerceLogic.ts`)**:
  - Deterministic CM3 net landed cost margin math, 30s half-life EMA guardrails, and analytical recovery scoring.
- **Control Plane UI (`src/components/NexusV4/NexusV4Master.tsx`, `src/components/NexusV4/Views/FlagshipHeroFlowView.tsx`)**:
  - 6 synchronized workspace tabs (desktop top nav, inner workspace tabs, mobile drawer, and mobile bottom bar):
    1. Control Plane (ACID clearance execution, Reaper/DLQ recovery, live PostgreSQL concurrency benchmark)
    2. Lifecycle Architecture
    3. Agentforce OpenAPI Spec
    4. Security Baseline & SHA-256 Ledger + Crypto-Shredding
    5. Technical Dossier (`/Nexus_Enterprise_Technical_Dossier.pdf`)
    6. Live Connectors & RBAC (Tenant Shopify secret vault, webhook guardrail tests, manual-capture Stripe escrow table, tenant members)

## 2. Verification Baseline
- `npm run lint` (`tsc --noEmit`): 0 errors
- `npm test`: 7 suites / 73 unit tests passing (`tests/*.test.ts`)
- `npm run build`: clean Vite SPA + esbuild CJS server bundle (`dist/server.cjs`)

## 3. Ownership Transfer & Credential Rotation Checklist
1. **GCP / Cloud SQL**: Transfer billing & IAM ownership of the GCP project hosting Cloud SQL PostgreSQL (`asia-southeast1`), or export via `pg_dump` and push Drizzle schema (`npx drizzle-kit push --config=src/db/drizzle.config.ts`) to buyer's instance.
2. **Firebase Project**: Transfer Firebase project ownership in Firebase Console and update Authorized Domains for the production Cloud Run domain.
3. **Secrets & Key Rotation**:
   - Generate a fresh 32+ byte random `ENCRYPTION_MASTER_KEY` before onboarding buyer merchants (re-enter tenant Shopify webhook secrets in Tab 6 after rotating master key).
   - Inject buyer's `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `SHOPIFY_ADMIN_API_TOKEN` in Cloud Run secret manager / environment config.
   - Replace placeholder contact or seller accounts in Cloud SQL `users` table and seed buyer admin user.
