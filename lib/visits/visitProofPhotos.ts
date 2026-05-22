import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

const BUCKET = 'visit_proof_photos';
const MAX_PHOTOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Admin = SupabaseClient<Database>;

export interface VisitProofPhotoRow {
  id: string;
  public_url: string;
  created_at: string;
}

function extensionForMime(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function saveVisitProofPhotosFromForm(
  admin: Admin,
  input: {
    tenantId: string;
    visitId: string;
    uploadedByUserId: string;
    formData: FormData;
  },
): Promise<{ saved: number; error?: string }> {
  const files = input.formData
    .getAll('proof_photos')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) return { saved: 0 };
  if (files.length > MAX_PHOTOS) {
    return { saved: 0, error: `Upload up to ${MAX_PHOTOS} photos.` };
  }

  let saved = 0;
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return { saved, error: 'Photos must be JPG, PNG, or WebP.' };
    }
    if (file.size > MAX_BYTES) {
      return { saved, error: 'Each photo must be 5MB or smaller.' };
    }

    const extension = extensionForMime(file.type);
    const storagePath = `${input.tenantId}/${input.visitId}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return { saved, error: uploadError.message };
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
    const { error: insertError } = await admin.from('tenant_visit_proof_photos').insert({
      tenant_id: input.tenantId,
      visit_id: input.visitId,
      storage_path: storagePath,
      public_url: pub.publicUrl,
      uploaded_by_user_id: input.uploadedByUserId,
    });

    if (insertError) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      return { saved, error: insertError.message };
    }

    saved += 1;
  }

  return { saved };
}

export async function listVisitProofPhotos(
  admin: Admin,
  visitId: string,
): Promise<VisitProofPhotoRow[]> {
  const { data, error } = await admin
    .from('tenant_visit_proof_photos')
    .select('id, public_url, created_at')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
