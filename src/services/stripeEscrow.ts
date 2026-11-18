import crypto from 'crypto';
import Stripe from 'stripe';

let stripeSingleton: Stripe | null = null;

export function isStripeLiveConfigured(): boolean {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) return false;
  if (key.includes('example') || key === 'MY_STRIPE_SECRET_KEY') return false;
  return key.startsWith('sk_test_') || key.startsWith('sk_live_') || key.startsWith('rk_');
}

export function getStripeClient(): Stripe | null {
  if (!isStripeLiveConfigured()) return null;
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
  }
  return stripeSingleton;
}

export interface EscrowHoldCreationResult {
  escrowRef: string;
  paymentIntentId: string;
  mode: 'LIVE_STRIPE_API' | 'SIMULATED_NO_STRIPE_KEY';
  status: string;
  captureMethod: 'manual';
  amountCents: number;
  currency: string;
  latencyMs: number;
  detail: string;
}

export async function createManualCaptureEscrowHold(params: {
  tenantId: string;
  sagaId: string;
  skuId: string;
  amountUsd: number;
  currency?: string;
  idempotencyKey?: string;
  paymentMethodId?: string;
}): Promise<EscrowHoldCreationResult> {
  const start = process.hrtime.bigint();
  const amountCents = Math.max(50, Math.round(params.amountUsd * 100));
  const currency = (params.currency || 'usd').toLowerCase();
  const client = getStripeClient();

  if (client) {
    const createPayload: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency,
      capture_method: 'manual',
      metadata: {
        tenantId: params.tenantId,
        sagaId: params.sagaId,
        skuId: params.skuId,
        engine: 'NEXUS_CM3_GUARDRAIL',
      },
      ...(params.paymentMethodId
        ? {
            payment_method: params.paymentMethodId,
            confirm: true,
            automatic_payment_methods: {
              enabled: true,
              allow_redirects: 'never',
            },
          }
        : {
            payment_method_types: ['card'],
          }),
    };

    const pi = await client.paymentIntents.create(
      createPayload,
      params.idempotencyKey ? { idempotencyKey: `nexus_${params.tenantId}_${params.idempotencyKey}` } : undefined
    );

    const latencyMs = Math.max(1, Math.round(Number(process.hrtime.bigint() - start) / 10000) / 100);
    return {
      escrowRef: pi.id,
      paymentIntentId: pi.id,
      mode: 'LIVE_STRIPE_API',
      status: pi.status,
      captureMethod: 'manual',
      amountCents,
      currency,
      latencyMs,
      detail: `Live Stripe PaymentIntent (${pi.id}) created with capture_method=manual (status: ${pi.status}).`,
    };
  }

  const simId = `pi_sim_${crypto.randomBytes(8).toString('hex')}`;
  const latencyMs = Math.max(0.4, Math.round(Number(process.hrtime.bigint() - start) / 10000) / 100);
  return {
    escrowRef: simId,
    paymentIntentId: simId,
    mode: 'SIMULATED_NO_STRIPE_KEY',
    status: 'requires_capture',
    captureMethod: 'manual',
    amountCents,
    currency,
    latencyMs,
    detail: `STRIPE_SECRET_KEY not configured; recorded local manual-capture simulation (${simId}).`,
  };
}

export async function settleOrVoidStripeEscrow(params: {
  paymentIntentId: string;
  mode: string;
  action: 'capture' | 'cancel';
}): Promise<{ status: string; mode: string }> {
  if (params.mode !== 'LIVE_STRIPE_API') {
    return {
      status: params.action === 'capture' ? 'succeeded' : 'canceled',
      mode: 'SIMULATED_NO_STRIPE_KEY',
    };
  }

  const client = getStripeClient();
  if (!client) {
    throw new Error('Stripe live key missing when settling live PaymentIntent');
  }

  if (params.action === 'capture') {
    const existing = await client.paymentIntents.retrieve(params.paymentIntentId);
    if (existing.status === 'requires_capture') {
      const captured = await client.paymentIntents.capture(params.paymentIntentId);
      return { status: captured.status, mode: 'LIVE_STRIPE_API' };
    }
    return { status: existing.status, mode: 'LIVE_STRIPE_API' };
  }

  const canceled = await client.paymentIntents.cancel(params.paymentIntentId);
  return { status: canceled.status, mode: 'LIVE_STRIPE_API' };
}

export function constructVerifiedStripeWebhookEvent(
  rawBody: Buffer,
  signatureHeader: string
): Stripe.Event {
  const client = getStripeClient();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!client || !webhookSecret || webhookSecret.includes('example')) {
    throw new Error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must both be configured.');
  }
  return client.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
}
