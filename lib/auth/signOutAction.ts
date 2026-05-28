'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Ends the Supabase session and sends the user to sign-in on the current host. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
