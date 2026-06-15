'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { SeoPageSection } from '@/lib/marketing/seoContent/types';
import styles from './website-settings.module.scss';

function emptySection(): SeoPageSection {
  return { title: '', paragraphs: [''], bullets: [] };
}

export function WebsiteSectionsEditor({
  sections,
  onChange,
}: {
  sections: SeoPageSection[];
  onChange: (sections: SeoPageSection[]) => void;
}) {
  const updateSection = (index: number, patch: Partial<SeoPageSection>) => {
    onChange(sections.map((section, i) => (i === index ? { ...section, ...patch } : section)));
  };

  const removeSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const updateParagraph = (sectionIndex: number, paragraphIndex: number, value: string) => {
    const section = sections[sectionIndex];
    if (!section) return;
    const paragraphs = [...(section.paragraphs ?? [])];
    paragraphs[paragraphIndex] = value;
    updateSection(sectionIndex, { paragraphs });
  };

  const addParagraph = (sectionIndex: number) => {
    const section = sections[sectionIndex];
    if (!section) return;
    updateSection(sectionIndex, { paragraphs: [...(section.paragraphs ?? []), ''] });
  };

  const removeParagraph = (sectionIndex: number, paragraphIndex: number) => {
    const section = sections[sectionIndex];
    if (!section) return;
    const paragraphs = (section.paragraphs ?? []).filter((_, i) => i !== paragraphIndex);
    updateSection(sectionIndex, { paragraphs });
  };

  const updateBullet = (sectionIndex: number, bulletIndex: number, value: string) => {
    const section = sections[sectionIndex];
    if (!section) return;
    const bullets = [...(section.bullets ?? [])];
    bullets[bulletIndex] = value;
    updateSection(sectionIndex, { bullets });
  };

  const addBullet = (sectionIndex: number) => {
    const section = sections[sectionIndex];
    if (!section) return;
    updateSection(sectionIndex, { bullets: [...(section.bullets ?? []), ''] });
  };

  const removeBullet = (sectionIndex: number, bulletIndex: number) => {
    const section = sections[sectionIndex];
    if (!section) return;
    const bullets = (section.bullets ?? []).filter((_, i) => i !== bulletIndex);
    updateSection(sectionIndex, { bullets });
  };

  return (
    <div className={styles.segmentList}>
      {sections.length === 0 ? (
        <p className={styles.segmentEmpty}>
          No content sections yet. Add one to build out this page.
        </p>
      ) : null}

      {sections.map((section, sectionIndex) => (
        <article key={sectionIndex} className={styles.segmentCard}>
          <div className={styles.segmentCardHeader}>
            <h3 className={styles.segmentCardTitle}>Section {sectionIndex + 1}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconLeft={<Trash2 size={16} aria-hidden />}
              onClick={() => removeSection(sectionIndex)}
            >
              Remove section
            </Button>
          </div>

          <label className={styles.fieldLabel}>
            Section title
            <input
              className={styles.fieldInput}
              value={section.title}
              onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}
              placeholder="Why homeowners choose us"
            />
          </label>

          <div className={styles.segmentSublist}>
            <div className={styles.segmentSublistHeader}>
              <p className={styles.segmentSublistLabel}>Paragraphs</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={<Plus size={16} aria-hidden />}
                onClick={() => addParagraph(sectionIndex)}
              >
                Add paragraph
              </Button>
            </div>
            {(section.paragraphs ?? []).map((paragraph, paragraphIndex) => (
              <div key={paragraphIndex} className={styles.segmentRow}>
                <label className={styles.fieldLabel}>
                  Paragraph {paragraphIndex + 1}
                  <textarea
                    className={styles.fieldInput}
                    rows={3}
                    value={paragraph}
                    onChange={(event) =>
                      updateParagraph(sectionIndex, paragraphIndex, event.target.value)
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconLeft={<Trash2 size={16} aria-hidden />}
                  onClick={() => removeParagraph(sectionIndex, paragraphIndex)}
                  aria-label={`Remove paragraph ${paragraphIndex + 1}`}
                />
              </div>
            ))}
          </div>

          <div className={styles.segmentSublist}>
            <div className={styles.segmentSublistHeader}>
              <p className={styles.segmentSublistLabel}>Bullet points</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={<Plus size={16} aria-hidden />}
                onClick={() => addBullet(sectionIndex)}
              >
                Add bullet
              </Button>
            </div>
            {(section.bullets ?? []).length === 0 ? (
              <p className={styles.segmentHint}>Optional checklist items for this section.</p>
            ) : null}
            {(section.bullets ?? []).map((bullet, bulletIndex) => (
              <div key={bulletIndex} className={styles.segmentRow}>
                <label className={styles.fieldLabel}>
                  Bullet {bulletIndex + 1}
                  <input
                    className={styles.fieldInput}
                    value={bullet}
                    onChange={(event) =>
                      updateBullet(sectionIndex, bulletIndex, event.target.value)
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconLeft={<Trash2 size={16} aria-hidden />}
                  onClick={() => removeBullet(sectionIndex, bulletIndex)}
                  aria-label={`Remove bullet ${bulletIndex + 1}`}
                />
              </div>
            ))}
          </div>
        </article>
      ))}

      <Button
        type="button"
        variant="secondary"
        iconLeft={<Plus size={16} aria-hidden />}
        onClick={() => onChange([...sections, emptySection()])}
      >
        Add section
      </Button>
    </div>
  );
}
