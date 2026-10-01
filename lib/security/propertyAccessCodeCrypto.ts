import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  emptyPropertyAccessCodes,
  hasPropertyAccessCodes,
  type PropertyAccessCodes,
} from '@/lib/tenant/propertyAccessCodes';

type Admin = SupabaseClient<Database>;

export class PropertyAccessCodeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PropertyAccessCodeConfigError';
  }
}

const CONFIG_ERROR = 'Entry codes cannot be saved until access-code encryption is configured.';
const SAVE_ERROR = 'Entry codes could not be saved.';
const READ_ERROR = 'Entry codes are saved for this location but could not be read.';

function encryptionKey(): Buffer {
  const raw = process.env.PROPERTY_ACCESS_CODE_KEY?.trim() ?? '';
  if (!raw) {
    throw new PropertyAccessCodeConfigError('PROPERTY_ACCESS_CODE_KEY is not set.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new PropertyAccessCodeConfigError(
      'PROPERTY_ACCESS_CODE_KEY must be 32 bytes, base64-encoded.',
    );
  }
  return key;
}

function associatedData(tenantId: string, propertyId: string): Buffer {
  return Buffer.from(`property-access-codes:${tenantId}:${propertyId}`, 'utf8');
}

/** AES-256-GCM payload. The key stays in the app environment, not the database. */
export function encryptPropertyAccessCodes(
  tenantId: string,
  propertyId: string,
  codes: PropertyAccessCodes,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(associatedData(tenantId, propertyId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(codes), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${Buffer.concat([iv, tag, ciphertext]).toString('base64url')}`;
}

export function decryptPropertyAccessCodes(
  tenantId: string,
  propertyId: string,
  payload: string,
): PropertyAccessCodes {
  const [version, encoded] = payload.split('.');
  if (version !== 'v1' || !encoded) {
    throw new Error('Unrecognized access code payload.');
  }
  const packed = Buffer.from(encoded, 'base64url');
  if (packed.length < 12 + 16 + 1) {
    throw new Error('Access code payload is truncated.');
  }
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAAD(associatedData(tenantId, propertyId));
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(json) as Partial<PropertyAccessCodes>;
  return {
    gateCode: typeof parsed.gateCode === 'string' ? parsed.gateCode : '',
    doorCode: typeof parsed.doorCode === 'string' ? parsed.doorCode : '',
    garageCode: typeof parsed.garageCode === 'string' ? parsed.garageCode : '',
  };
}

export async function savePropertyAccessCodes(
  admin: Admin,
  tenantId: string,
  propertyId: string,
  codes: PropertyAccessCodes,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let ciphertext: string | null = null;
  if (hasPropertyAccessCodes(codes)) {
    try {
      ciphertext = encryptPropertyAccessCodes(tenantId, propertyId, codes);
    } catch (error) {
      if (error instanceof PropertyAccessCodeConfigError) {
        return { ok: false, error: CONFIG_ERROR };
      }
      return { ok: false, error: SAVE_ERROR };
    }
  }

  const { error } = await admin
    .from('tenant_customer_properties')
    .update({ access_codes_ciphertext: ciphertext })
    .eq('id', propertyId)
    .eq('tenant_id', tenantId);

  if (error) return { ok: false, error: SAVE_ERROR };
  return { ok: true };
}

export async function loadPropertyAccessCodes(
  admin: Admin,
  tenantId: string,
  propertyId: string,
): Promise<{ codes: PropertyAccessCodes; unreadable: boolean }> {
  const { data, error } = await admin
    .from('tenant_customer_properties')
    .select('access_codes_ciphertext')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data?.access_codes_ciphertext) {
    return { codes: emptyPropertyAccessCodes(), unreadable: false };
  }

  try {
    return {
      codes: decryptPropertyAccessCodes(tenantId, propertyId, data.access_codes_ciphertext),
      unreadable: false,
    };
  } catch {
    return { codes: emptyPropertyAccessCodes(), unreadable: true };
  }
}

export function propertyAccessCodeReadError(): string {
  return READ_ERROR;
}

const LEGACY_CODE_KEYS = ['gate_code', 'door_code', 'garage_code'] as const;

/** Plaintext codes saved on older quotes, before they lived on the property. */
export function plaintextAccessCodesFromSnapshot(raw: unknown): PropertyAccessCodes | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const codes = {
    gateCode: typeof record.gate_code === 'string' ? record.gate_code.trim() : '',
    doorCode: typeof record.door_code === 'string' ? record.door_code.trim() : '',
    garageCode: typeof record.garage_code === 'string' ? record.garage_code.trim() : '',
  };
  return hasPropertyAccessCodes(codes) ? codes : null;
}

export function snapshotWithoutAccessCodes(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const next = { ...(raw as Record<string, unknown>) };
  for (const key of LEGACY_CODE_KEYS) delete next[key];
  return next;
}

/**
 * Move leftover plaintext quote codes onto the encrypted property column, then
 * delete them from the quote snapshot so they are not left in the database.
 */
export async function absorbLegacyQuoteAccessCodes(
  admin: Admin,
  tenantId: string,
  propertyId: string | null,
  quoteId: string,
  propertySnapshot: unknown,
): Promise<void> {
  const legacy = plaintextAccessCodesFromSnapshot(propertySnapshot);
  if (!legacy || !propertyId) return;

  const current = await loadPropertyAccessCodes(admin, tenantId, propertyId);
  if (current.unreadable) return;

  let moved = hasPropertyAccessCodes(current.codes);
  if (!moved) {
    const saved = await savePropertyAccessCodes(admin, tenantId, propertyId, legacy);
    moved = saved.ok;
  }
  if (!moved) return;
  const stripped = snapshotWithoutAccessCodes(propertySnapshot);
  if (!stripped) return;
  await admin
    .from('tenant_quotes')
    .update({ property_snapshot: stripped as Json })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId);
}
