import type { PolicySection } from '@/lib/legal/informationSecurityPolicy';

export function PolicySections({ sections }: { sections: PolicySection[] }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.id}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          {section.bullets ? (
            <ul>
              {section.bullets.map((bullet) => (
                <li key={bullet.slice(0, 40)}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </>
  );
}
