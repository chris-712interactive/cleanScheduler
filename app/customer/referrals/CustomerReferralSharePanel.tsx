'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './referrals.module.scss';

export function CustomerReferralSharePanel({
  shareUrl,
  shareHeadline,
}: {
  shareUrl: string;
  shareHeadline: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('qrcode').then((QRCode) =>
      QRCode.toDataURL(shareUrl, { margin: 1, width: 200 }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  async function handleShare() {
    setShareError(null);
    const payload = {
      title: shareHeadline,
      text: 'Use my referral link to get started:',
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      setShareError('Sharing is not available on this device. Copy the link instead.');
    }
  }

  return (
    <section className={styles.sharePanel} aria-labelledby="referral-share-title">
      <h3 id="referral-share-title" className={styles.cardTitle}>
        Share options
      </h3>
      <div className={styles.shareRow}>
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic QR data URL
          <img src={qrDataUrl} alt="QR code for your referral link" className={styles.qrImage} />
        ) : (
          <div className={styles.qrPlaceholder} aria-hidden />
        )}
        <div className={styles.shareCopy}>
          <p className={styles.shareHint}>
            Scan the QR code in person or use your device&apos;s share sheet to text or email your
            link.
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={() => void handleShare()}>
            Share link
          </Button>
          {shareError ? (
            <p className={styles.shareError} role="alert">
              {shareError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
