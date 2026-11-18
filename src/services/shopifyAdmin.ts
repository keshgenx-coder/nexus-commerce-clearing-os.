export function isShopifyAdminConfigured(): boolean {
  const token = (process.env.SHOPIFY_ADMIN_API_TOKEN || '').trim();
  if (!token) return false;
  if (token.includes('example') || token === 'shpat_example_token_3.6') return false;
  return token.startsWith('shpat_') || token.startsWith('shpca_') || token.length >= 20;
}

export interface ShopifyHoldResult {
  executed: boolean;
  mode: 'LIVE_SHOPIFY_ADMIN_API' | 'LOCAL_POLICY_NO_ADMIN_TOKEN';
  heldFulfillmentOrderIds: string[];
  detail: string;
}

export async function holdShopifyOrderFulfillment(params: {
  shopDomain: string;
  shopifyOrderId: string;
  marginPct: number;
  floorPct: number;
}): Promise<ShopifyHoldResult> {
  const token = (process.env.SHOPIFY_ADMIN_API_TOKEN || '').trim();
  const cleanDomain = params.shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();

  if (!isShopifyAdminConfigured() || !cleanDomain || cleanDomain.includes('unknown-store')) {
    return {
      executed: false,
      mode: 'LOCAL_POLICY_NO_ADMIN_TOKEN',
      heldFulfillmentOrderIds: [],
      detail: 'SHOPIFY_ADMIN_API_TOKEN not configured; recorded fulfillment hold in Cloud SQL audit ledger.',
    };
  }

  const endpoint = `https://${cleanDomain}/admin/api/2025-01/graphql.json`;
  const orderGid = params.shopifyOrderId.startsWith('gid://')
    ? params.shopifyOrderId
    : `gid://shopify/Order/${params.shopifyOrderId}`;

  try {
    const queryResp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `query getFulfillmentOrders($id: ID!) {
          order(id: $id) {
            id
            fulfillmentOrders(first: 10) {
              nodes { id status }
            }
          }
        }`,
        variables: { id: orderGid },
      }),
    });

    if (!queryResp.ok) {
      return {
        executed: false,
        mode: 'LIVE_SHOPIFY_ADMIN_API',
        heldFulfillmentOrderIds: [],
        detail: `Shopify Admin API HTTP ${queryResp.status} querying fulfillmentOrders for ${orderGid}.`,
      };
    }

    const queryJson: any = await queryResp.json();
    const nodes: Array<{ id: string; status: string }> =
      queryJson?.data?.order?.fulfillmentOrders?.nodes || [];

    const openNodes = nodes.filter(
      (n) => n.status === 'OPEN' || n.status === 'SCHEDULED' || n.status === 'IN_PROGRESS'
    );
    const heldIds: string[] = [];

    for (const fo of openNodes) {
      const holdResp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({
          query: `mutation fulfillmentOrderHold($id: ID!, $fulfillmentHold: FulfillmentOrderHoldInput!) {
            fulfillmentOrderHold(id: $id, fulfillmentHold: $fulfillmentHold) {
              fulfillmentOrder { id status }
              userErrors { field message }
            }
          }`,
          variables: {
            id: fo.id,
            fulfillmentHold: {
              reason: 'OTHER',
              reasonNotes: `NEXUS CM3 Margin Guardrail: Realized ${params.marginPct}% < floor ${params.floorPct}%`,
              notifyMerchant: true,
            },
          },
        }),
      });
      if (holdResp.ok) {
        const holdJson: any = await holdResp.json();
        if (!holdJson?.data?.fulfillmentOrderHold?.userErrors?.length) {
          heldIds.push(fo.id);
        }
      }
    }

    return {
      executed: heldIds.length > 0,
      mode: 'LIVE_SHOPIFY_ADMIN_API',
      heldFulfillmentOrderIds: heldIds,
      detail:
        heldIds.length > 0
          ? `Placed live Shopify fulfillment hold on ${heldIds.length} fulfillment order(s).`
          : `Shopify Admin API contacted (${nodes.length} fulfillment orders found, none held).`,
    };
  } catch (error: any) {
    return {
      executed: false,
      mode: 'LIVE_SHOPIFY_ADMIN_API',
      heldFulfillmentOrderIds: [],
      detail: `Shopify Admin API hold call failed: ${error?.message || 'network error'}`,
    };
  }
}
