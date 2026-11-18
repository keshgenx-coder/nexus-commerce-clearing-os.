# NEXUS Commerce Clearing OS — Production Deployment Runbook

## 1. Prerequisites
- Google Cloud Run (or any Node 22 container runtime)
- PostgreSQL 15+ / Cloud SQL PostgreSQL (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`)
- Firebase project (`firebase-applet-config.json` + Firebase Admin SDK via Google Cloud ADC)
- Required encryption key:
  - `ENCRYPTION_MASTER_KEY` (32+ char secret for AES-256-GCM encryption of per-tenant Shopify webhook secrets in PostgreSQL)
- Optional live 3P integration credentials:
  - `STRIPE_SECRET_KEY` (`sk_test_...` / `sk_live_...`) for real manual-capture `PaymentIntent` escrow holds
  - `STRIPE_WEBHOOK_SECRET` (`whsec_...`) for verifying `POST /api/webhooks/stripe`
  - `SHOPIFY_ADMIN_API_TOKEN` (`shpat_...`) for outbound Shopify Admin GraphQL `fulfillmentOrderHold` calls on margin-floor breaches
  - `SHOPIFY_WEBHOOK_SECRET` & `SHOPIFY_STORE_DOMAIN` (fallback defaults when a tenant has not stored its own encrypted secret in Cloud SQL)

## 2. Database Schema Push
```bash
npx drizzle-kit push --config=src/db/drizzle.config.ts
```

## 3. Verify & Build Locally
```bash
npm ci
npm run lint
npm test
npm run build
NODE_ENV=production npm start
```

## 4. Deploy to Google Cloud Run
```bash
gcloud builds submit --tag gcr.io/<PROJECT_ID>/nexus-clearing-os
gcloud run deploy nexus-clearing-os \
  --image gcr.io/<PROJECT_ID>/nexus-clearing-os \
  --platform managed \
  --region asia-southeast1 \
  --port 3000 \
  --allow-unauthenticated
```

Add the deployed Cloud Run hostname to **Firebase Authentication -> Settings -> Authorized Domains** so Google Sign-In (`signInWithPopup`) succeeds.

## 5. Multi-Tenant Shopify & Stripe Webhooks
- **Shopify `orders/create` webhook URL**: `https://<YOUR_DOMAIN>/api/webhooks/shopify/<TENANT_ID>`
  - Requests are verified via `HMAC-SHA256` (`X-Shopify-Hmac-Sha256`) using `timingSafeEqual`. Unsigned or invalid requests return `HTTP 401`.
  - When realized CM3 margin falls below the tenant's floor and `SHOPIFY_ADMIN_API_TOKEN` is configured, NEXUS issues a live Shopify Admin GraphQL `fulfillmentOrderHold` mutation; otherwise it records `LOCAL_POLICY_NO_ADMIN_TOKEN` in `shopify_webhook_events`.
- **Stripe webhook URL**: `https://<YOUR_DOMAIN>/api/webhooks/stripe`
  - Verified with `STRIPE_WEBHOOK_SECRET` when configured.
