import crypto from 'crypto';

function deriveVaultKey(): Buffer {
  const material =
    process.env.ENCRYPTION_MASTER_KEY ||
    process.env.SQL_PASSWORD ||
    process.env.FIREBASE_PROJECT_ID ||
    'nexus-commerce-tenant-vault-dev-key';
  return crypto.createHash('sha256').update(material).digest();
}

export function encryptTenantSecret(plaintext: string): string {
  const key = deriveVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptTenantSecret(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted tenant secret payload');
  }
  const [ivHex, authTagHex, encHex] = parts;
  const key = deriveVaultKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function maskSecretPreview(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 6)}****${trimmed.slice(-4)}`;
}

export function computeShopifyHmacSha256(rawBody: Buffer | string, secret: string): string {
  const buf = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  return crypto.createHmac('sha256', secret).update(buf).digest('base64');
}

export function verifyShopifyHmacSha256(
  rawBody: Buffer | string,
  hmacHeader: string | undefined,
  secret: string
): boolean {
  if (!hmacHeader || !secret) return false;
  const computed = computeShopifyHmacSha256(rawBody, secret);
  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(hmacHeader.trim(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
