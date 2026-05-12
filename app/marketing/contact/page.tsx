import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { submitMarketingInquiryAction } from './actions';
import styles from './contact.module.scss';

export const metadata = {
  title: 'Contact sales · cleanScheduler',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function MarketingContactPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sent = firstParam(sp.sent) === '1';
  const err = firstParam(sp.error) === '1';

  return (
    <main className={styles.page}>
      <Container size="sm">
        <PageHeader
          title="Talk to us"
          description="Questions, demos, or partnership ideas for residential and commercial cleaning teams."
        />

        {sent ? (
          <p className={styles.bannerOk} role="status">
            Thanks — we received your message and will follow up by email.
          </p>
        ) : null}
        {err ? (
          <p className={styles.bannerErr} role="alert">
            Please fill in name, email, and a short message, then try again.
          </p>
        ) : null}

        <Card title="Send a message">
          <form action={submitMarketingInquiryAction} className={styles.form}>
            <Stack gap={4} as="div">
              <label className={styles.field}>
                <span>Name</span>
                <input name="name" type="text" required className={styles.input} autoComplete="name" />
              </label>
              <label className={styles.field}>
                <span>Email</span>
                <input name="email" type="email" required className={styles.input} autoComplete="email" />
              </label>
              <label className={styles.field}>
                <span>Company (optional)</span>
                <input name="company" type="text" className={styles.input} autoComplete="organization" />
              </label>
              <label className={styles.field}>
                <span>Message</span>
                <textarea name="message" required className={styles.textarea} rows={5} />
              </label>
              <Button type="submit" variant="primary">
                Submit
              </Button>
            </Stack>
          </form>
        </Card>
      </Container>
    </main>
  );
}
