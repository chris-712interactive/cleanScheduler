import Link from 'next/link';
import type { HelpCard } from '@/lib/help/types';
import styles from './help.module.scss';

export function HelpCardGrid({
  cards,
  sectionTitle,
}: {
  cards: HelpCard[];
  sectionTitle?: string;
}) {
  return (
    <section className={styles.section}>
      {sectionTitle ? <h2>{sectionTitle}</h2> : null}
      <div className={styles.grid}>
        {cards.map((card) => {
          const badges =
            card.badges && card.badges.length > 0 ? (
              <div className={styles.badgeRow}>
                {card.badges.map((badge) => (
                  <span key={badge.label} className={styles.badge}>
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null;

          if (card.href) {
            return (
              <Link
                key={card.title}
                href={card.href}
                className={[styles.card, styles.cardLink].join(' ')}
              >
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                {badges}
                <p className={styles.cardLinkText}>{card.hrefLabel ?? 'Learn more'}</p>
              </Link>
            );
          }

          return (
            <article key={card.title} className={styles.card}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              {badges}
              {card.comingSoon ? <p className={styles.cardLinkText}>Article coming soon</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
