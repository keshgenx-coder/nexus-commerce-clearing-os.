import { describe, it, expect } from 'vitest';
import {
  computeShopifyHmacSha256,
  decryptTenantSecret,
  encryptTenantSecret,
  maskSecretPreview,
  verifyShopifyHmacSha256,
} from '../src/services/tenantCrypto';
import { isStripeLiveConfigured, createManualCaptureEscrowHold } from '../src/services/stripeEscrow';
import { isShopifyAdminConfigured, holdShopifyOrderFulfillment } from '../src/services/shopifyAdmin';

describe('Phase 1 & 2 Security & Connector Primitives', () => {
  it('encrypts and decrypts tenant webhook secrets cleanly with AES-256-GCM', () => {
    const original = 'shpss_live_9911aabbccddeeff00112233';
    const encrypted = encryptTenantSecret(original);
    expect(encrypted).not.toContain(original);
    expect(encrypted.split(':')).toHaveLength(3);
    expect(decryptTenantSecret(encrypted)).toBe(original);
  });

  it('masks secret preview without leaking full key', () => {
    const masked = maskSecretPreview('shpss_live_9911aabbccddeeff00112233');
    expect(masked).toBe('shpss_****2233');
    expect(masked).not.toContain('9911');
  });

  it('verifies valid Shopify HMAC-SHA256 headers and rejects tampered bodies/signatures', () => {
    const secret = 'shpss_test_secret_12345';
    const body = Buffer.from(JSON.stringify({ id: 901, total_price: '239.00' }), 'utf8');
    const validSig = computeShopifyHmacSha256(body, secret);

    expect(verifyShopifyHmacSha256(body, validSig, secret)).toBe(true);
    expect(verifyShopifyHmacSha256(body, `tampered_${validSig.slice(9)}`, secret)).toBe(false);
    expect(
      verifyShopifyHmacSha256(
        Buffer.from(JSON.stringify({ id: 901, total_price: '1.00' }), 'utf8'),
        validSig,
        secret
      )
    ).toBe(false);
    expect(verifyShopifyHmacSha256(body, undefined, secret)).toBe(false);
  });

  it('reports simulated escrow fallback transparently when STRIPE_SECRET_KEY is not configured', async () => {
    const live = isStripeLiveConfigured();
    if (!live) {
      const hold = await createManualCaptureEscrowHold({
        tenantId: 'tenant_test01',
        sagaId: 'SAGA-TEST-01',
        skuId: 'SKU-ANC-PRO-09',
        amountUsd: 239,
      });
      expect(hold.mode).toBe('SIMULATED_NO_STRIPE_KEY');
      expect(hold.captureMethod).toBe('manual');
      expect(hold.amountCents).toBe(23900);
      expect(hold.status).toBe('requires_capture');
    } else {
      expect(live).toBe(true);
    }
  });

  it('falls back cleanly to LOCAL_POLICY_NO_ADMIN_TOKEN when SHOPIFY_ADMIN_API_TOKEN is absent or example', async () => {
    const prev = process.env.SHOPIFY_ADMIN_API_TOKEN;
    try {
      delete process.env.SHOPIFY_ADMIN_API_TOKEN;
      expect(isShopifyAdminConfigured()).toBe(false);

      const res = await holdShopifyOrderFulfillment({
        shopDomain: 'nexus-verified-store.myshopify.com',
        shopifyOrderId: '99887766',
        marginPct: 11.4,
        floorPct: 18.5,
      });
      expect(res.executed).toBe(false);
      expect(res.mode).toBe('LOCAL_POLICY_NO_ADMIN_TOKEN');
      expect(res.heldFulfillmentOrderIds).toEqual([]);

      process.env.SHOPIFY_ADMIN_API_TOKEN = 'shpat_example_token_3.6';
      expect(isShopifyAdminConfigured()).toBe(false);
    } finally {
      if (prev === undefined) {
        delete process.env.SHOPIFY_ADMIN_API_TOKEN;
      } else {
        process.env.SHOPIFY_ADMIN_API_TOKEN = prev;
      }
    }
  });
});
