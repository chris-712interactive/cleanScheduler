'use server';

import { confirmHiringToken, declineHiringToken, withdrawHiringToken } from '@/lib/hiring/engine';
import { createAdminClient } from '@/lib/supabase/server';

export interface RespondState {
  error?: string;
  success?: string;
}

export async function confirmRespondAction(
  _prev: RespondState,
  formData: FormData,
): Promise<RespondState> {
  const token = String(formData.get('token') ?? '');
  const admin = createAdminClient();
  const result = await confirmHiringToken(admin, token, new Date());
  if (!result.ok) return { error: result.error };
  return { success: 'You are confirmed. A copy is in your email.' };
}

export async function declineRespondAction(
  _prev: RespondState,
  formData: FormData,
): Promise<RespondState> {
  const token = String(formData.get('token') ?? '');
  const admin = createAdminClient();
  const result = await declineHiringToken(admin, token, new Date());
  if (!result.ok) return { error: result.error };
  return { success: 'You declined this time. The company may offer another one later.' };
}

export async function withdrawRespondAction(
  _prev: RespondState,
  formData: FormData,
): Promise<RespondState> {
  const token = String(formData.get('token') ?? '');
  const admin = createAdminClient();
  const result = await withdrawHiringToken(admin, token, new Date());
  if (!result.ok) return { error: result.error };
  return { success: 'Your application was withdrawn and your contact details were removed.' };
}
