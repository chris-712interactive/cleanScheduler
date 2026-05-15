import sharp from 'sharp';

/** Matches Supabase `employee_avatars` bucket `file_size_limit`. */
export const AVATAR_MAX_STORAGE_BYTES = 2 * 1024 * 1024;

/**
 * Max raw upload size before resize. Keep below `serverActions.bodySizeLimit`
 * in `next.config.ts` (multipart bodies are larger than file bytes).
 */
export const AVATAR_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const AVATAR_ALLOWED_INPUT_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const LONG_EDGE_START_PX = 1024;

/**
 * Resize, strip EXIF rotation, and encode as WebP so the result fits the storage bucket limit.
 */
export async function prepareEmployeeAvatar(
  input: Buffer,
): Promise<
  | { ok: true; buffer: Buffer; contentType: 'image/webp'; fileExtension: 'webp' }
  | { ok: false; error: string }
> {
  try {
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) {
      return { ok: false, error: 'Could not read image dimensions.' };
    }

    let edge = LONG_EDGE_START_PX;
    let quality = 84;
    const maxSteps = 18;

    for (let step = 0; step < maxSteps; step++) {
      const buf = await sharp(input)
        .rotate()
        .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4, smartSubsample: true })
        .toBuffer();

      if (buf.length <= AVATAR_MAX_STORAGE_BYTES) {
        return { ok: true, buffer: buf, contentType: 'image/webp', fileExtension: 'webp' };
      }

      if (quality > 52) {
        quality -= 7;
      } else {
        edge = Math.max(160, Math.round(edge * 0.8));
        quality = 80;
      }
    }

    return { ok: false, error: 'Image could not be reduced under 2MB. Try a different photo.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid image file.';
    return { ok: false, error: msg };
  }
}
