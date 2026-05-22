import Image from 'next/image';
import styles from './ProductScreenshot.module.scss';

export interface ProductScreenshotProps {
  src: string;
  alt: string;
  priority?: boolean;
  variant?: 'desktop' | 'mobile';
}

export function ProductScreenshot({
  src,
  alt,
  priority = false,
  variant = 'desktop',
}: ProductScreenshotProps) {
  return (
    <figure className={styles.frame} data-variant={variant}>
      <div className={styles.chrome} aria-hidden>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
      <div className={styles.imageWrap}>
        <Image
          src={src}
          alt={alt}
          width={1280}
          height={800}
          className={styles.image}
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 960px"
        />
      </div>
    </figure>
  );
}
