'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { compressImageFileForUpload } from '@/lib/images/clientImageCompress';
import { PROOF_PHOTO_ACCEPT, PROOF_PHOTO_MAX_COUNT } from '@/lib/visits/proofPhotoLimits';
import styles from './ProofPhotoCapture.module.scss';

export interface ProofPhotoCaptureItem {
  id: string;
  file: File;
  previewUrl: string;
}

interface ProofPhotoCaptureProps {
  photos: ProofPhotoCaptureItem[];
  onPhotosChange: (photos: ProofPhotoCaptureItem[]) => void;
  sharedWithCustomers?: boolean;
  disabled?: boolean;
  maxCount?: number;
}

function createItem(file: File): ProofPhotoCaptureItem {
  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export function ProofPhotoCapture({
  photos,
  onPhotosChange,
  sharedWithCustomers = false,
  disabled = false,
  maxCount = PROOF_PHOTO_MAX_COUNT,
}: ProofPhotoCaptureProps) {
  const cameraInputId = useId();
  const libraryInputId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = maxCount - photos.length;
  const atLimit = remaining <= 0;

  const addFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length || disabled || atLimit) return;

      setError(null);
      setProcessing(true);

      const slots = maxCount - photos.length;
      const incoming = Array.from(fileList).slice(0, slots);
      const next: ProofPhotoCaptureItem[] = [...photos];

      for (const raw of incoming) {
        const compressed = await compressImageFileForUpload(raw);
        if ('error' in compressed) {
          setError(compressed.error);
          continue;
        }
        next.push(createItem(compressed));
      }

      onPhotosChange(next.slice(0, maxCount));
      setProcessing(false);

      if (cameraRef.current) cameraRef.current.value = '';
      if (libraryRef.current) libraryRef.current.value = '';
    },
    [atLimit, disabled, maxCount, onPhotosChange, photos],
  );

  function removePhoto(id: string) {
    if (disabled) return;
    const target = photos.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onPhotosChange(photos.filter((photo) => photo.id !== id));
    setError(null);
  }

  return (
    <section className={styles.wrap} aria-labelledby={`${cameraInputId}-heading`}>
      <div className={styles.header}>
        <h3 id={`${cameraInputId}-heading`} className={styles.title}>
          Proof of service
        </h3>
        <p className={styles.subtitle}>
          Snap a few shots before you wrap up — kitchen, baths, or anything the customer asked for.
          {sharedWithCustomers ? ' They can view these in their portal.' : null}
        </p>
      </div>

      <div className={styles.actions}>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          iconLeft={
            processing ? <Loader2 size={18} className={styles.spinner} /> : <Camera size={18} />
          }
          disabled={disabled || processing || atLimit}
          onClick={() => cameraRef.current?.click()}
        >
          {processing ? 'Processing…' : atLimit ? 'Photo limit reached' : 'Take photo'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          iconLeft={<ImagePlus size={18} />}
          disabled={disabled || processing || atLimit}
          onClick={() => libraryRef.current?.click()}
        >
          Choose from library
        </Button>
      </div>

      <input
        ref={cameraRef}
        id={cameraInputId}
        type="file"
        accept={PROOF_PHOTO_ACCEPT}
        capture="environment"
        className={styles.hiddenInput}
        disabled={disabled || processing || atLimit}
        onChange={(event) => void addFiles(event.target.files)}
      />
      <input
        ref={libraryRef}
        id={libraryInputId}
        type="file"
        accept={PROOF_PHOTO_ACCEPT}
        multiple={remaining > 1}
        className={styles.hiddenInput}
        disabled={disabled || processing || atLimit}
        onChange={(event) => void addFiles(event.target.files)}
      />

      <p className={styles.meta}>
        {photos.length}/{maxCount} photos · optional
      </p>

      {photos.length > 0 ? (
        <ul className={styles.previewGrid}>
          {photos.map((photo, index) => (
            <li key={photo.id} className={styles.previewItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={`Proof photo ${index + 1}`}
                className={styles.previewImage}
              />
              <button
                type="button"
                className={styles.removeBtn}
                aria-label={`Remove photo ${index + 1}`}
                disabled={disabled || processing}
                onClick={() => removePhoto(photo.id)}
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyHint}>No photos yet — tap Take photo when the job looks ready.</p>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** Revoke preview URLs when clearing the capture list (e.g. modal close). */
export function revokeProofPhotoPreviews(photos: ProofPhotoCaptureItem[]): void {
  for (const photo of photos) {
    URL.revokeObjectURL(photo.previewUrl);
  }
}
