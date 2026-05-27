import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { HelpCardGrid } from '@/components/marketing/help/HelpCardGrid';
import { buildHelpPageMetadata } from '@/lib/help/metadata';
import { getHelpCategory } from '@/lib/help/registry';
import styles from '@/components/marketing/help/help.module.scss';

const category = getHelpCategory('customers')!;

export const metadata = buildHelpPageMetadata({
  path: category.path,
  title: category.title,
  description: category.description,
});

export default function CustomerHelpPage() {
  return (
    <main className={styles.page}>
      <Container size="md">
        <PageHeader
          title={category.title}
          description={category.description}
          backHref="/help"
          backLabel="Help Center"
          breadcrumbs={[
            { label: 'Help', href: '/help' },
            { label: 'Customers' },
          ]}
        />
        <HelpCardGrid sectionTitle={category.sectionTitle} cards={category.cards} />
      </Container>
    </main>
  );
}
