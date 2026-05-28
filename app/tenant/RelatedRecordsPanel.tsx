import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { RelatedRecordsSnapshot } from '@/lib/tenant/relatedRecordsTypes';
import styles from './relatedRecordsPanel.module.scss';

export function RelatedRecordsPanel({ snapshot }: { snapshot: RelatedRecordsSnapshot }) {
  if (snapshot.links.length === 0) return null;

  return (
    <Card
      title="Related"
      description="Jump to linked customer, quote, visit, or billing workflows."
    >
      <ul className={styles.list}>
        {snapshot.links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link href={link.href} className={styles.row}>
              <span className={styles.label}>{link.label}</span>
              {link.detail ? <span className={styles.detail}>{link.detail}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
