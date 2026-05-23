'use client';

import { useActionState, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { Button } from '@/components/ui/Button';
import {
  ProofPhotoCapture,
  revokeProofPhotoPreviews,
  type ProofPhotoCaptureItem,
} from '@/components/visits/ProofPhotoCapture';
import {
  formatCustomerPreferredBilling,
  isElectronicPreferredBilling,
  isInPersonPreferredBilling,
} from '@/lib/tenant/customerBillingPreference';
import type { TenantPaymentMethod } from '@/lib/tenant/operationalSettings';
import { formatCentsAsDollars, parseCentsFromDollars } from '@/lib/billing/parseMoney';
import { completeVisitWithPaymentAction, type VisitFieldActionState } from './visitFieldActions';
import styles from './completeVisitModal.module.scss';

const initial: VisitFieldActionState = {};

type CollectedChoice = 'yes' | 'no';
type OnSiteMethod = 'cash' | 'check';

type StepId =
  | 'collected'
  | 'payment-method'
  | 'cash-amount'
  | 'check-details'
  | 'invoice-amount'
  | 'send-invoice';

const STEP_LABELS: Record<StepId, string> = {
  collected: 'Payment collected?',
  'payment-method': 'Payment type',
  'cash-amount': 'Cash amount',
  'check-details': 'Check details',
  'invoice-amount': 'Invoice amount',
  'send-invoice': 'Send invoice',
};

function stepSequence(
  collected: CollectedChoice | null,
  method: OnSiteMethod | null,
  needsAmountInput: boolean,
): StepId[] {
  if (!collected) return ['collected'];
  if (collected === 'no') {
    return needsAmountInput ? ['collected', 'invoice-amount', 'send-invoice'] : ['collected', 'send-invoice'];
  }
  if (!method) return ['collected', 'payment-method'];
  if (method === 'cash') {
    return needsAmountInput
      ? ['collected', 'payment-method', 'cash-amount']
      : ['collected', 'payment-method'];
  }
  return ['collected', 'payment-method', 'check-details'];
}

export function CompleteVisitPaymentModal({
  tenantSlug,
  visitId,
  preferredPaymentMethod,
  defaultAmountCents,
  customerHasEmail,
  canAttachProofPhotos,
  proofPhotosSharedWithCustomers,
  isFieldEmployee = false,
}: {
  tenantSlug: string;
  visitId: string;
  preferredPaymentMethod: TenantPaymentMethod | null;
  defaultAmountCents: number | null;
  customerHasEmail: boolean;
  canAttachProofPhotos: boolean;
  proofPhotosSharedWithCustomers: boolean;
  isFieldEmployee?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [collected, setCollected] = useState<CollectedChoice | null>(null);
  const [onSiteMethod, setOnSiteMethod] = useState<OnSiteMethod | null>(null);
  const [checkNumber, setCheckNumber] = useState('');
  const [checkAmountDollars, setCheckAmountDollars] = useState('');
  const [cashAmountDollars, setCashAmountDollars] = useState('');
  const [invoiceAmountDollars, setInvoiceAmountDollars] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);
  const [proofPhotos, setProofPhotos] = useState<ProofPhotoCaptureItem[]>([]);

  const [state, formAction, pending] = useActionState(completeVisitWithPaymentAction, initial);
  useRefreshOnServerActionSuccess(state.success);

  const defaultAmountDollars =
    defaultAmountCents != null && defaultAmountCents > 0
      ? formatCentsAsDollars(defaultAmountCents)
      : '';
  const needsAmountInput = !isFieldEmployee && !defaultAmountDollars;
  const preferredLabel = formatCustomerPreferredBilling(preferredPaymentMethod);
  const electronicHint = isElectronicPreferredBilling(preferredPaymentMethod);
  const inPersonHint = isInPersonPreferredBilling(preferredPaymentMethod);

  const steps = useMemo(
    () => stepSequence(collected, onSiteMethod, needsAmountInput),
    [collected, onSiteMethod, needsAmountInput],
  );
  const currentStep = steps[stepIndex] ?? 'collected';
  const isLastStep = stepIndex === steps.length - 1;
  const totalSteps = steps.length;

  const resetFlow = useCallback(() => {
    setStepIndex(0);
    setCollected(null);
    setOnSiteMethod(null);
    setCheckNumber('');
    setCheckAmountDollars(defaultAmountDollars);
    setCashAmountDollars('');
    setInvoiceAmountDollars('');
    setStepError(null);
    setProofPhotos((current) => {
      revokeProofPhotoPreviews(current);
      return [];
    });
  }, [defaultAmountDollars]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetFlow();
    else setCheckAmountDollars(defaultAmountDollars);
  }

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      resetFlow();
    }
  }, [state.success, resetFlow]);

  function resolveBillingAmountDollars(): string {
    if (collected === 'no') {
      return needsAmountInput ? invoiceAmountDollars : defaultAmountDollars;
    }
    if (onSiteMethod === 'check') return checkAmountDollars;
    if (onSiteMethod === 'cash') {
      return needsAmountInput ? cashAmountDollars : defaultAmountDollars;
    }
    return defaultAmountDollars;
  }

  function validateCurrentStep(): string | null {
    if (currentStep === 'collected') {
      if (!collected) return 'Select whether payment was collected.';
      if (collected === 'no' && !customerHasEmail) {
        return 'This customer has no email on file. Add an email before sending an invoice.';
      }
      return null;
    }
    if (currentStep === 'payment-method') {
      if (!onSiteMethod) return 'Select cash or check.';
      return null;
    }
    if (currentStep === 'cash-amount') {
      const cents = parseCentsFromDollars(cashAmountDollars);
      if (cents == null || cents <= 0) return 'Enter the cash amount collected.';
      return null;
    }
    if (currentStep === 'check-details') {
      if (!checkNumber.trim()) return 'Enter the check number.';
      const cents = parseCentsFromDollars(checkAmountDollars);
      if (cents == null || cents <= 0) return 'Enter the dollar amount on the check.';
      return null;
    }
    if (currentStep === 'invoice-amount') {
      const cents = parseCentsFromDollars(invoiceAmountDollars);
      if (cents == null || cents <= 0) return 'Enter the amount to invoice.';
      return null;
    }
    return null;
  }

  function goNext() {
    const err = validateCurrentStep();
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    if (isLastStep) return;
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goBack() {
    setStepError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const err = validateCurrentStep();
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);

    const formData = new FormData();
    formData.set('tenant_slug', tenantSlug);
    formData.set('visit_id', visitId);
    formData.set('payment_collected', collected ?? '');
    formData.set('collected_method', onSiteMethod ?? '');
    formData.set('check_number', checkNumber);
    formData.set('amount_dollars', resolveBillingAmountDollars());

    if (canAttachProofPhotos) {
      for (const photo of proofPhotos) {
        formData.append('proof_photos', photo.file);
      }
    }

    formAction(formData);
  }

  const billingAmountDollars = resolveBillingAmountDollars();

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="secondary" className={styles.completeTrigger}>
          Complete job
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <Dialog.Title className={styles.title}>Complete job</Dialog.Title>

          <div className={styles.stepHeader}>
            <p className={styles.stepIndicator}>
              Step {stepIndex + 1} of {totalSteps}
            </p>
            <p className={styles.stepTitle}>{STEP_LABELS[currentStep]}</p>
          </div>

          {canAttachProofPhotos ? (
            <ProofPhotoCapture
              photos={proofPhotos}
              onPhotosChange={setProofPhotos}
              sharedWithCustomers={proofPhotosSharedWithCustomers}
              disabled={pending}
            />
          ) : null}

          {defaultAmountDollars && (isFieldEmployee || !needsAmountInput) ? (
            <p className={styles.preferenceHint}>
              Job amount: <strong>${defaultAmountDollars}</strong>
              {isFieldEmployee ? ' — set by your office.' : null}
            </p>
          ) : null}

          {preferredPaymentMethod && stepIndex === 0 ? (
            <p className={styles.preferenceHint}>
              Customer billing preference: <strong>{preferredLabel}</strong>
              {electronicHint ? ' — expect to invoice online after service.' : null}
              {inPersonHint ? ' — usually pays on site with cash or check.' : null}
            </p>
          ) : null}

          <form action={formAction} className={styles.form} onSubmit={handleSubmit}>
            {currentStep === 'collected' ? (
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Did you collect payment from the customer?</legend>
                <div className={styles.choiceRow}>
                  <button
                    type="button"
                    className={collected === 'yes' ? styles.choiceActive : styles.choice}
                    onClick={() => {
                      setCollected('yes');
                      setOnSiteMethod(null);
                      setStepError(null);
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={collected === 'no' ? styles.choiceActive : styles.choice}
                    onClick={() => {
                      setCollected('no');
                      setOnSiteMethod(null);
                      setStepError(null);
                    }}
                  >
                    No
                  </button>
                </div>
              </fieldset>
            ) : null}

            {currentStep === 'payment-method' ? (
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>How did the customer pay?</legend>
                {!needsAmountInput ? (
                  <p className={styles.fieldHint}>
                    Expected job amount: <strong>${defaultAmountDollars}</strong>
                  </p>
                ) : null}
                <div className={styles.choiceRow}>
                  <button
                    type="button"
                    className={onSiteMethod === 'cash' ? styles.choiceActive : styles.choice}
                    onClick={() => {
                      setOnSiteMethod('cash');
                      setStepError(null);
                    }}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    className={onSiteMethod === 'check' ? styles.choiceActive : styles.choice}
                    onClick={() => {
                      setOnSiteMethod('check');
                      setCheckAmountDollars(defaultAmountDollars);
                      setStepError(null);
                    }}
                  >
                    Check
                  </button>
                </div>
              </fieldset>
            ) : null}

            {currentStep === 'cash-amount' ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="cash_amount_dollars">
                  Cash collected (USD)
                </label>
                <input
                  id="cash_amount_dollars"
                  type="number"
                  className={styles.input}
                  min="0"
                  step="0.01"
                  value={cashAmountDollars}
                  onChange={(e) => setCashAmountDollars(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
                <p className={styles.fieldHint}>Enter the amount of cash you received from the customer.</p>
              </div>
            ) : null}

            {currentStep === 'check-details' ? (
              <div className={styles.stepFields}>
                {!needsAmountInput ? (
                  <p className={styles.fieldHint}>
                    Expected job amount: <strong>${defaultAmountDollars}</strong> — confirm the amount written on
                    the check matches.
                  </p>
                ) : null}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="check_number_input">
                    Check number
                  </label>
                  <input
                    id="check_number_input"
                    className={styles.input}
                    value={checkNumber}
                    onChange={(e) => setCheckNumber(e.target.value)}
                    autoComplete="off"
                    placeholder="1234"
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="check_amount_dollars">
                    Check amount (USD)
                  </label>
                  <input
                    id="check_amount_dollars"
                    type="number"
                    className={styles.input}
                    min="0"
                    step="0.01"
                    value={checkAmountDollars}
                    onChange={(e) => setCheckAmountDollars(e.target.value)}
                    placeholder={defaultAmountDollars || '0.00'}
                    readOnly={isFieldEmployee && Boolean(defaultAmountDollars)}
                    autoFocus={!(isFieldEmployee && defaultAmountDollars)}
                  />
                  <p className={styles.fieldHint}>
                    Enter the dollar amount printed on the check to verify before completing.
                  </p>
                  {defaultAmountCents != null &&
                  parseCentsFromDollars(checkAmountDollars) != null &&
                  parseCentsFromDollars(checkAmountDollars) !== defaultAmountCents ? (
                    <p className={styles.warning} role="status">
                      This differs from the expected ${defaultAmountDollars}. Double-check the check before
                      completing.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {currentStep === 'invoice-amount' ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="invoice_amount_dollars">
                  Invoice amount (USD)
                </label>
                <input
                  id="invoice_amount_dollars"
                  type="number"
                  className={styles.input}
                  min="0"
                  step="0.01"
                  value={invoiceAmountDollars}
                  onChange={(e) => setInvoiceAmountDollars(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
                <p className={styles.fieldHint}>
                  No quote amount on file — enter the amount to include on the invoice.
                </p>
              </div>
            ) : null}

            {currentStep === 'send-invoice' ? (
              <div className={styles.reviewBlock}>
                <p className={styles.reviewLine}>
                  Amount to invoice: <strong>${billingAmountDollars}</strong>
                </p>
                <p className={styles.invoiceHint}>
                  An invoice will be emailed immediately so the customer can pay online via Stripe.
                </p>
              </div>
            ) : null}

            {stepError ? (
              <p className={styles.error} role="alert">
                {stepError}
              </p>
            ) : null}
            {state.error ? (
              <p className={styles.error} role="alert">
                {state.error}
              </p>
            ) : null}

            <div className={styles.actions}>
              {stepIndex > 0 ? (
                <Button type="button" variant="ghost" disabled={pending} onClick={goBack}>
                  Back
                </Button>
              ) : (
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost" disabled={pending}>
                    Cancel
                  </Button>
                </Dialog.Close>
              )}
              {isLastStep ? (
                <Button type="submit" variant="primary" disabled={pending} onClick={() => setStepError(null)}>
                  {pending
                    ? proofPhotos.length > 0
                      ? 'Uploading photos…'
                      : 'Completing…'
                    : 'Mark complete'}
                </Button>
              ) : (
                <Button type="button" variant="primary" onClick={goNext}>
                  Continue
                </Button>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
