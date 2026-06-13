import Image from 'next/image';
import type { HelpGuideFigure as HelpGuideFigureType } from '@/lib/marketing/seoContent/types';
import styles from './HelpGuideArticle.module.scss';

function isSvgAsset(src: string): boolean {
  return src.toLowerCase().endsWith('.svg');
}

export function HelpGuideFigure({ figure }: { figure: HelpGuideFigureType }) {
  const caption = figure.caption ? (
    <figcaption className={styles.figureCaption}>{figure.caption}</figcaption>
  ) : null;

  if (isSvgAsset(figure.src)) {
    return (
      <figure className={styles.figure}>
        {/* Static SVG wireframes live in /public and must not go through next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={figure.src}
          alt={figure.alt}
          width={720}
          height={420}
          loading="lazy"
          decoding="async"
          className={styles.figureImage}
        />
        {caption}
      </figure>
    );
  }

  return (
    <figure className={styles.figure}>
      <Image
        src={figure.src}
        alt={figure.alt}
        width={720}
        height={420}
        className={styles.figureImage}
      />
      {caption}
    </figure>
  );
}
