import type {
  AcceptedQuoteScheduleMode,
  MessagingChannel,
  TenantInvoiceExpectation,
  TenantPaymentMethod,
} from '@/lib/tenant/operationalSettings';

export type OperationalSettingsFormSnapshot = {
  accepted_quote_schedule_mode: AcceptedQuoteScheduleMode;
  invoice_expectation: TenantInvoiceExpectation;
  allowed_customer_payment_methods: TenantPaymentMethod[];
  email_notify_quote_sent: boolean;
  email_notify_quote_accepted: boolean;
  email_notify_quote_declined: boolean;
  sms_notify_quote_sent: boolean;
  sms_notify_quote_accepted: boolean;
  sms_notify_quote_declined: boolean;
  sms_notify_visit_reminder: boolean;
  email_notify_visit_reminder: boolean;
  email_notify_on_my_way: boolean;
  email_notify_review_request: boolean;
  email_notify_invoice_overdue: boolean;
  sms_notify_invoice_overdue: boolean;
  email_notify_customer_message: boolean;
  check_reminder_hold_days: number;
  check_hold_through_deposit: boolean;
  require_consultation_before_quote: boolean;
  consultation_duration_minutes: number;
  recurring_starts_after_initial: boolean;
  allow_same_day_initial_recurring: boolean;
  messaging_channels: MessagingChannel[];
};
