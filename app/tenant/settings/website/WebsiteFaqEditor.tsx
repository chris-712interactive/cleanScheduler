'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';
import styles from './website-settings.module.scss';

function emptyFaqItem(): MarketingFaqItem {
  return { question: '', answer: '' };
}

export function WebsiteFaqEditor({
  items,
  onChange,
}: {
  items: MarketingFaqItem[];
  onChange: (items: MarketingFaqItem[]) => void;
}) {
  const updateItem = (index: number, patch: Partial<MarketingFaqItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.segmentList}>
      {items.length === 0 ? (
        <p className={styles.segmentEmpty}>No FAQ items yet. Add questions customers often ask.</p>
      ) : null}

      {items.map((item, index) => (
        <article key={index} className={styles.segmentCard}>
          <div className={styles.segmentCardHeader}>
            <h3 className={styles.segmentCardTitle}>Question {index + 1}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconLeft={<Trash2 size={16} aria-hidden />}
              onClick={() => removeItem(index)}
            >
              Remove
            </Button>
          </div>

          <label className={styles.fieldLabel}>
            Question
            <input
              className={styles.fieldInput}
              value={item.question}
              onChange={(event) => updateItem(index, { question: event.target.value })}
            />
          </label>

          <label className={styles.fieldLabel}>
            Answer
            <textarea
              className={styles.fieldInput}
              rows={3}
              value={item.answer}
              onChange={(event) => updateItem(index, { answer: event.target.value })}
            />
          </label>
        </article>
      ))}

      <Button
        type="button"
        variant="secondary"
        iconLeft={<Plus size={16} aria-hidden />}
        onClick={() => onChange([...items, emptyFaqItem()])}
      >
        Add FAQ item
      </Button>
    </div>
  );
}
