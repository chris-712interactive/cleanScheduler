'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Camera, X } from 'lucide-react';
import styles from './VisitProofPhotos.module.scss';

export function VisitProofPhotos({
  photos,
  title = 'Proof of service',
  description,
}: {
  photos: Array<{ id: string; public_url: string; created_at: string }>;
  title?: string;
  description?: string;
}) {
  const [activePhoto, setActivePhoto] = useState<(typeof photos)[number] | null>(null);

  if (photos.length === 0) return null;

  const countLabel = photos.length === 1 ? '1 photo' : `${photos.length} photos`;

  return (
    <>
      <section className={styles.wrap}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <Camera size={18} aria-hidden className={styles.titleIcon} />
            <h3 className={styles.title}>{title}</h3>
            <span className={styles.count}>{countLabel}</span>
          </div>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <ul className={styles.grid}>
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                className={styles.photoButton}
                aria-label={`View proof photo ${index + 1}`}
                onClick={() => setActivePhoto(photo)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.public_url} alt="" className={styles.photo} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Dialog.Root open={activePhoto != null} onOpenChange={(open) => !open && setActivePhoto(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.lightboxOverlay} />
          <Dialog.Content className={styles.lightboxContent} aria-describedby={undefined}>
            <Dialog.Title className={styles.srOnly}>Proof photo preview</Dialog.Title>
            <button
              type="button"
              className={styles.lightboxClose}
              aria-label="Close photo preview"
              onClick={() => setActivePhoto(null)}
            >
              <X size={20} aria-hidden />
            </button>
            {activePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activePhoto.public_url} alt="" className={styles.lightboxImage} />
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
