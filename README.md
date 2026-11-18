# NEXUS Autonomous Commerce Clearing OS

Multi-tenant commerce clearing and margin-protection engine backed by **Cloud SQL for PostgreSQL**, **Firebase Auth**, **Stripe Manual-Capture Escrow**, and **Shopify HMAC + Admin GraphQL Fulfillment Hold** integrations.

---

## Core Architecture

- **ACID Sub-Lot Clearing (`src/db/ledgerRepository.ts`, `src/db/schema.ts`)**
  - Uses Drizzle ORM + `pg` against PostgreSQL with `SELECT ... FOR UPDATE` row locking across `K=32` striped sub-lot shards (`inventory_sub_lots`) and SQL `CHECK (available_units >= 0 AND reserved_units >= 0)` invariants.
  - Deterministic CM3 net landed margin evaluation with 30s half-life EMA smoothing (`src/utils/commerceLogic.ts`).
- **Tamper-Evident Audit & Edge PII Crypto-Shredding**
  - SHA-256 hash-chained `audit_blocks` and sealed `merkle_epochs` persisted in PostgreSQL alongside edge key destruction (`edge_pii_vault`).
- **Outbox SAGA Recovery & Live Benchmark**
  - Durable `outbox_records` with Reaper backoff retries, DLQ sensitivity sweep, and live concurrent PostgreSQL throughput/latency benchmarking (`POST /api/agentforce/benchmark/run`).
- **Multi-Tenant RBAC & Encrypted Connector Vault (`src/middleware/auth.ts`, `src/services/`)**
  - Server-verified Firebase ID tokens with `admin` / `operator` / `viewer` roles scoped by `tenant_id`.
  - AES-256-GCM encrypted per-tenant Shopify webhook secrets (`tenantCrypto.ts`) with constant-time HMAC-SHA256 verification.
  - Stripe `PaymentIntent` manual-capture escrow (`stripeEscrow.ts`) and Shopify Admin GraphQL `fulfillmentOrderHold` (`shopifyAdmin.ts`), with explicit fallback modes when live 3P API keys are unset.

---

## Local Verification & Development

```bash
npm ci
npm run lint        # TypeScript check (tsc --noEmit)
npm test            # Vitest suite (73 tests across 7 files)
npm run build       # Vite SPA + esbuild CJS server bundle (dist/server.cjs)
npm run dev         # Runs Express + Vite dev server on port 3000
```

---

## Deployment & Buyer Documentation

- **[TECHNICAL_DOSSIER.md](./TECHNICAL_DOSSIER.md)** — Full architecture, 12-table PostgreSQL schema, transactional lifecycle, and connector verification matrix (GitHub-native Markdown).
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Environment variables, Drizzle schema push, and Google Cloud Run (`asia-southeast1`) deployment commands.
- **[BUYER_HANDOFF.md](./BUYER_HANDOFF.md)** — Active module inventory, live-vs-fallback connector boundaries, and ownership transfer / key rotation checklist.
- **PDF Download (Live App):** Served at `/Nexus_Enterprise_Technical_Dossier.pdf` when the app is running.
