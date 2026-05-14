import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-7)',
      }}
    >
      <Container size="sm">
        <Stack gap={4} align="start">
          <span
            style={{
              color: 'var(--color-brand-primary)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            404
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--font-size-3xl)',
              color: 'var(--color-text)',
            }}
          >
            We can&apos;t find that page.
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
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
