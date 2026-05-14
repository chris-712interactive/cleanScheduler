'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024;

function extForMime(m: string): string | null {
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  return null;
}

export interface ProfileActionState {
  error?: string;
  success?: string;
}

export async function updateOwnDisplayNameAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const name = String(formData.get('display_name') ?? '').trim();
  if (!slug) return { error: 'Missing workspace.' };
  if (!name || name.length > 120) {
    return { error: 'Enter a display name (max 120 characters).' };
  }

  const membership = await requireTenantPortalAccess(slug, '/settings');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_profiles')
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq('user_id', auth.user.id);
  if (error) return { error: error.message };

  await admin.auth.admin.updateUserById(auth.user.id, {
    user_metadata: { ...auth.user.user_metadata, display_name: name },
  });

  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { success: 'Display name saved.' };
}

export async function uploadOwnAvatarAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  if (!slug) return { error: 'Missing workspace.' };

  const membership = await requireTenantPortalAccess(slug, '/settings');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const file = formData.get('avatar') as File | null;
  if (!file || typeof file === 'string' || file.size < 1) {
    return { error: 'Choose an image file.' };
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Image must be 2MB or smaller.' };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: 'Use JPEG, PNG, WebP, or GIF.' };
  }
  const ext = extForMime(file.type);
  if (!ext) return { error: 'Unsupported image type.' };

  const admin = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const path = `${membership.tenantId}/${auth.user.id}.${ext}`;

  const { error: upStorage } = await admin.storage.from('employee_avatars').upload(path, buf, {
    contentType: file.type,
    upsert: true,
  });
  if (upStorage) return { error: upStorage.message };

  const { data: pub } = admin.storage.from('employee_avatars').getPublicUrl(path);
  const { error: pErr } = await admin
    .from('user_profiles')
    .update({ avatar_url: pub.publicUrl, updated_at: new Date().toISOString() })
    .eq('user_id', auth.user.id);
  if (pErr) return { error: pErr.message };

  revalidatePath('/settings');
  revalidatePath('/employees');
  revalidatePath('/', 'layout');
  return { success: 'Profile photo updated.' };
}
