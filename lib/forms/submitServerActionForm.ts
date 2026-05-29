'use client';

import { startTransition, type FormEvent } from 'react';

/** Submit a server action without suspending the route segment (avoids loading.tsx flash). */
export function submitServerActionForm(
  event: FormEvent<HTMLFormElement>,
  action: (formData: FormData) => void,
) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  startTransition(() => {
    action(formData);
  });
}
