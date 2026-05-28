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
        {cards.map((card) => (
          <article key={card.title} className={styles.card}>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            {card.badges && card.badges.length > 0 ? (
              <div className={styles.badgeRow}>
                {card.badges.map((badge) => (
                  <span key={badge.label} className={styles.badge}>
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}
            {card.href ? (
              <p className={styles.cardLinkText}>
                <Link href={card.href}>{card.hrefLabel ?? 'Learn more'}</Link>
              </p>
            ) : card.comingSoon ? (
              <p className={styles.cardLinkText}>Article coming soon</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
