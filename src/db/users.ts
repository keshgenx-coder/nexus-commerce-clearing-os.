import { and, asc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { tenants, users } from './schema.ts';

export type NexusRole = 'admin' | 'operator' | 'viewer';

export function deriveTenantIdForUid(uid: string): string {
  const cleaned = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'usr';
  return `tenant_${cleaned}`;
}

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const existingRows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    const existing = existingRows[0];
    const targetTenantId =
      existing && existing.tenantId && existing.tenantId !== 'tenant-default'
        ? existing.tenantId
        : deriveTenantIdForUid(uid);

    // Ensure tenant record exists for this workspace
    await db
      .insert(tenants)
      .values({
        tenantId: targetTenantId,
        name: `${(displayName || email.split('@')[0] || 'Merchant').slice(0, 32)} Workspace`,
        ownerUid: uid,
        defaultMarginFloorPct: 18.5,
      })
      .onConflictDoNothing();

    if (!existing) {
      const inserted = await db
        .insert(users)
        .values({
          uid,
          email,
          displayName: displayName ?? null,
          role: 'admin',
          tenantId: targetTenantId,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
            displayName: displayName ?? null,
          },
        })
        .returning();
      return inserted[0];
    }

    const updated = await db
      .update(users)
      .set({
        email,
        displayName: displayName ?? null,
        tenantId: targetTenantId,
      })
      .where(eq(users.uid, uid))
      .returning();

    return updated[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function listTenantMembersPg(tenantId: string) {
  return db
    .select({
      uid: users.uid,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      tenantId: users.tenantId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(asc(users.id));
}

export async function updateMemberRolePg(params: {
  tenantId: string;
  targetUid: string;
  newRole: NexusRole;
}) {
  const updated = await db
    .update(users)
    .set({ role: params.newRole })
    .where(and(eq(users.tenantId, params.tenantId), eq(users.uid, params.targetUid)))
    .returning();
  return updated[0] ?? null;
}
