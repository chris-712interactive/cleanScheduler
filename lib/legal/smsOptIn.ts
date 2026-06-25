import { PRODUCT_NAME } from '@/lib/legal/site';

/** Sent/TCR-compliant disclosure for optional SMS opt-in checkboxes. */
export const SMS_OPT_IN_MOBILE_DATA_DISCLOSURE =
  'No mobile information will be sold or shared with third parties for promotional or marketing purposes.';

/** Full disclosure shown beside the SMS consent checkbox (links rendered separately). */
export const SMS_OPT_IN_CHECKBOX_DISCLOSURE = [
  `You are opting in to receive booking and account notification text messages from ${PRODUCT_NAME}.`,
  'Message and data rates may apply.',
  'Message frequency varies based on your bookings.',
  'Reply HELP for help.',
  'Reply STOP to opt out.',
  SMS_OPT_IN_MOBILE_DATA_DISCLOSURE,
].join(' ');
