import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import styles from './not-found.module.scss';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <Container size="sm">
        <Stack gap={4} align="start">
          <span className={styles.eyebrow}>404</span>
          <h1 className={styles.title}>We can&apos;t find that page.</h1>
          <p className={styles.copy}>
            The page you were looking for has moved, was removed, or never existed. Try heading home
            and starting again.
          </p>
          <Button as={Link} href="/">
            Take me home
          </Button>
        </Stack>
      </Container>
    </main>
  );
}
