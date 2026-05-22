import twilio from 'twilio';
import { serverEnv } from '@/lib/env';

let twilioClient: ReturnType<typeof twilio> | null = null;

export function isTwilioConfigured(): boolean {
  return Boolean(
    serverEnv.TWILIO_ACCOUNT_SID?.trim() &&
      serverEnv.TWILIO_AUTH_TOKEN?.trim() &&
      serverEnv.TWILIO_FROM_NUMBER?.trim(),
  );
}

export function getTwilioFromNumber(): string {
  const from = serverEnv.TWILIO_FROM_NUMBER?.trim();
  if (!from) {
    throw new Error('TWILIO_FROM_NUMBER is not configured.');
  }
  return from;
}

export function getTwilioClient(): ReturnType<typeof twilio> {
  if (!isTwilioConfigured()) {
    throw new Error(
      'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.',
    );
  }

  if (!twilioClient) {
    twilioClient = twilio(serverEnv.TWILIO_ACCOUNT_SID!, serverEnv.TWILIO_AUTH_TOKEN!);
  }

  return twilioClient;
}
