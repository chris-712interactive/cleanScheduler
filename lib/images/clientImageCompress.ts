import { PROOF_PHOTO_MAX_BYTES } from '@/lib/visits/proofPhotoLimits';

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.82;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this photo. Try taking a new one with the camera.'));
    };
    img.src = url;
  });
}

function scaleDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

/**
 * Resize and compress a photo in the browser so field uploads stay fast on mobile data.
 */
export async function compressImageFileForUpload(
  file: File,
  options?: { maxEdge?: number; maxBytes?: number },
): Promise<File | { error: string }> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Photos must be JPG, PNG, or WebP.' };
  }

  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
  const maxBytes = options?.maxBytes ?? PROOF_PHOTO_MAX_BYTES;

  let image: HTMLImageElement;
  try {
    image = await loadImageFromFile(file);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not read this photo.' };
  }

  const { width, height } = scaleDimensions(image.naturalWidth, image.naturalHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { error: 'Could not prepare this photo for upload.' };

  ctx.drawImage(image, 0, 0, width, height);

  let quality = DEFAULT_QUALITY;
  let edge = maxEdge;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    blob = await canvasToJpegBlob(canvas, quality);
    if (!blob) return { error: 'Could not compress this photo.' };
    if (blob.size <= maxBytes) break;

    if (quality > 0.55) {
      quality -= 0.08;
      continue;
    }

    edge = Math.max(960, Math.round(edge * 0.85));
    const next = scaleDimensions(image.naturalWidth, image.naturalHeight, edge);
    canvas.width = next.width;
    canvas.height = next.height;
    ctx.drawImage(image, 0, 0, next.width, next.height);
    quality = DEFAULT_QUALITY;
  }

  if (!blob || blob.size > maxBytes) {
    return { error: 'Photo is too large after compression. Try a closer shot or fewer details.' };
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'proof';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
