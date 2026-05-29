'use client';

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import { PROPERTY_KIND_OPTIONS } from '@/lib/tenant/propertyKindLabels';
import {
  QUOTE_ADDON_LIBRARY,
  QUOTE_SCOPE_TEMPLATES,
  type QuoteScopeTemplateId,
} from '@/lib/tenant/quoteScopeTemplates';
import { quoteLineDraftsForTotalsPreview } from '@/lib/tenant/parseQuoteLineDrafts';
import { createTenantQuote, type QuoteFormState } from './actions';
import {
  QuoteLineItemsEditor,
  createEmptyQuoteLineDraft,
  type QuoteLineItemDraft,
} from './QuoteLineItemsEditorLoadable';
import {
  QuoteHeaderPricingFields,
  defaultQuoteHeaderPricingValues,
  type QuoteHeaderPricingValues,
} from './QuoteHeaderPricingFields';
import { QuoteLiveTotalSidebar } from './QuoteLiveTotalSidebar';
import type { CustomerPropertyGroup, QuoteCustomerOption } from './quoteFormTypes';
import styles from './quotes.module.scss';

const initial: QuoteFormState = {};

const STEPS = [
  { id: 'who', label: 'Who & where' },
  { id: 'property', label: 'Property' },
  { id: 'scope', label: 'Scope' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'terms', label: 'Terms & send' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function stepIndexFor(id: StepId): number {
  return STEPS.findIndex((s) => s.id === id);
}

export function QuoteCreateWizard({
  tenantSlug,
  customerOptions,
  customerPropertyGroups,
}: {
  tenantSlug: string;
  customerOptions: QuoteCustomerOption[];
  customerPropertyGroups: CustomerPropertyGroup[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createTenantQuote, initial);
  const navigatedToQuoteRef = useRef(false);

  useEffect(() => {
    if (!state.quoteId || navigatedToQuoteRef.current) return;
    navigatedToQuoteRef.current = true;
    router.replace(`/quotes/${state.quoteId}`);
  }, [state.quoteId, router]);

  const [step, setStep] = useState<StepId>('who');
  const [stepError, setStepError] = useState<string | null>(null);
  /** Prevents the Pricing → Terms Continue click from landing on Save draft. */
  const [termsActionsReady, setTermsActionsReady] = useState(false);
  const blockSubmitRef = useRef(false);

  useEffect(() => {
    if (step !== 'terms') {
      setTermsActionsReady(false);
      return;
    }
    blockSubmitRef.current = true;
    const timer = window.setTimeout(() => {
      blockSubmitRef.current = false;
      setTermsActionsReady(true);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [step]);

  const [customerSource, setCustomerSource] = useState<'existing' | 'new'>('existing');
  const [propertySource, setPropertySource] = useState<'existing' | 'new'>('existing');
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const saveIntentRef = useRef<'draft' | 'send'>('draft');
  const saveIntentInputRef = useRef<HTMLInputElement>(null);
  const [pendingIntent, setPendingIntent] = useState<'draft' | 'send' | null>(null);

  const [inlineFirstName, setInlineFirstName] = useState('');
  const [inlineEmail, setInlineEmail] = useState('');
  const [inlineAddress, setInlineAddress] = useState('');
  const [inlineCity, setInlineCity] = useState('');
  const [inlineState, setInlineState] = useState('');
  const [inlinePostal, setInlinePostal] = useState('');
  const [inlinePropertyKind, setInlinePropertyKind] = useState('residential');

  const [quotePropertyType, setQuotePropertyType] = useState('residential');
  const [quotePropertySqft, setQuotePropertySqft] = useState('');
  const [quotePropertyBedrooms, setQuotePropertyBedrooms] = useState('');
  const [quotePropertyBathrooms, setQuotePropertyBathrooms] = useState('');
  const [quotePropertyStories, setQuotePropertyStories] = useState('');
  const [accessNotes, setAccessNotes] = useState('');

  const [scopeTemplateId, setScopeTemplateId] =
    useState<QuoteScopeTemplateId>('residential_standard');
  const [scopeInclusions, setScopeInclusions] = useState<string[]>(
    () => QUOTE_SCOPE_TEMPLATES[0]?.inclusions ?? [],
  );
  const [scopeExclusions, setScopeExclusions] = useState(
    () => QUOTE_SCOPE_TEMPLATES[0]?.defaultExclusions ?? '',
  );

  const [lineRows, setLineRows] = useState<QuoteLineItemDraft[]>(() => [
    createEmptyQuoteLineDraft(),
  ]);
  const [pricing, setPricing] = useState<QuoteHeaderPricingValues>(() =>
    defaultQuoteHeaderPricingValues(),
  );

  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [officeNotes, setOfficeNotes] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const propertyOptions = useMemo(() => {
    return customerPropertyGroups.find((g) => g.customerId === customerId)?.options ?? [];
  }, [customerPropertyGroups, customerId]);

  useEffect(() => {
    if (customerSource !== 'existing' || !customerId) return;
    if (propertyOptions.length === 0) {
      setPropertySource('new');
      setPropertyId('');
    }
  }, [customerId, customerSource, propertyOptions.length]);

  useEffect(() => {
    if (!pending) {
      setPendingIntent(null);
    }
  }, [pending]);

  const effectiveCustomerId = customerSource === 'existing' ? customerId : '';
  const hasServiceAddress =
    customerSource === 'new'
      ? Boolean(inlineAddress.trim())
      : propertySource === 'new'
        ? Boolean(inlineAddress.trim())
        : propertyOptions.length === 0
          ? Boolean(inlineAddress.trim())
          : Boolean(propertyId);

  const applyScopeTemplate = useCallback((id: QuoteScopeTemplateId) => {
    const template = QUOTE_SCOPE_TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    setScopeTemplateId(id);
    setScopeInclusions(template.inclusions);
    setScopeExclusions(template.defaultExclusions);
  }, []);

  const toggleInclusion = useCallback((item: string) => {
    setScopeInclusions((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  }, []);

  const addAddonLine = useCallback((addon: (typeof QUOTE_ADDON_LIBRARY)[number]) => {
    setLineRows((prev) => [
      ...prev,
      {
        ...createEmptyQuoteLineDraft(),
        service_label: addon.service_label,
        frequency: addon.frequency,
        frequency_detail: addon.frequency_detail ?? '',
        amount_dollars: addon.amount_dollars,
      },
    ]);
  }, []);

  const pricedLineCount = quoteLineDraftsForTotalsPreview(lineRows).length;

  const completeness = useMemo(
    () => [
      {
        id: 'customer',
        label: 'Customer & service address',
        done:
          customerSource === 'existing'
            ? Boolean(customerId) && hasServiceAddress
            : Boolean(inlineFirstName.trim() && inlineEmail.trim() && inlineAddress.trim()),
      },
      {
        id: 'lines',
        label: 'At least one priced service line',
        done: pricedLineCount > 0,
      },
      {
        id: 'scope',
        label: 'Scope inclusions documented',
        done: scopeInclusions.length > 0 || scopeExclusions.trim().length > 0,
      },
      {
        id: 'access',
        label: 'Access / pets captured or marked N/A',
        done: accessNotes.trim().length > 0,
      },
      {
        id: 'valid',
        label: 'Valid until set',
        done: Boolean(validUntil.trim()),
      },
    ],
    [
      accessNotes,
      customerId,
      customerSource,
      hasServiceAddress,
      inlineAddress,
      inlineEmail,
      inlineFirstName,
      pricedLineCount,
      scopeExclusions,
      scopeInclusions.length,
      validUntil,
    ],
  );

  const validateStep = (current: StepId): string | null => {
    if (current === 'who') {
      if (!title.trim()) return 'Enter a quote title before continuing.';
      if (customerSource === 'existing' && !customerId) {
        return 'Select a customer or switch to new customer.';
      }
      if (customerSource === 'existing') {
        if (propertySource === 'existing' && propertyOptions.length > 0 && !propertyId) {
          return 'Select a saved service location or choose to add a new one.';
        }
        if ((propertySource === 'new' || propertyOptions.length === 0) && !inlineAddress.trim()) {
          return 'Enter the street address for the service location.';
        }
      }
      if (customerSource === 'new') {
        if (!inlineFirstName.trim()) return 'First name is required for a new customer.';
        if (!inlineEmail.trim()) return 'Email is required so we can send quote notifications.';
        if (!inlineAddress.trim()) return 'Service address is required for a new customer.';
      }
    }
    return null;
  };

  const validateBeforeSave = (): string | null => {
    for (const s of STEPS) {
      const err = validateStep(s.id);
      if (err) return err;
    }
    return null;
  };

  const validateBeforeSend = (): string | null => {
    const base = validateBeforeSave();
    if (base) return base;
    if (pricedLineCount === 0) {
      return 'Add at least one priced service line before sending to the customer.';
    }
    if (!validUntil.trim()) {
      return 'Set a valid-until date before sending to the customer.';
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    const idx = stepIndexFor(step);
    if (idx < STEPS.length - 1) {
      // Defer step change so the Continue click cannot fall through onto a
      // submit button rendered in the same spot on the final step.
      window.setTimeout(() => {
        setStep(STEPS[idx + 1]!.id);
      }, 0);
    }
  };

  const goBack = () => {
    setStepError(null);
    const idx = stepIndexFor(step);
    if (idx > 0) {
      setStep(STEPS[idx - 1]!.id);
    }
  };

  const submitQuote = (intent: 'draft' | 'send') => {
    if (blockSubmitRef.current || !termsActionsReady) return;
    const err = intent === 'send' ? validateBeforeSend() : validateBeforeSave();
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    saveIntentRef.current = intent;
    setPendingIntent(intent);
    if (saveIntentInputRef.current) {
      saveIntentInputRef.current.value = intent;
    }
    formRef.current?.requestSubmit();
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (blockSubmitRef.current || step !== 'terms') {
      event.preventDefault();
      return;
    }
    const err = validateBeforeSave();
    if (err) {
      event.preventDefault();
      setStepError(err);
    }
  };

  const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter') return;
    if (event.target instanceof HTMLTextAreaElement) return;
    if (step !== 'terms' || !termsActionsReady) {
      event.preventDefault();
    }
  };

  const renderInlinePropertyFields = (idPrefix: string) => (
    <>
      <label className={styles.label} htmlFor={`${idPrefix}_inline_property_address_line1`}>
        Service address
      </label>
      <input
        id={`${idPrefix}_inline_property_address_line1`}
        name="inline_property_address_line1"
        className={styles.input}
        value={inlineAddress}
        onChange={(e) => setInlineAddress(e.target.value)}
        placeholder="Street address"
      />
      <div className={styles.wizardGridThree}>
        <div>
          <label className={styles.label} htmlFor={`${idPrefix}_inline_property_city`}>
            City
          </label>
          <input
            id={`${idPrefix}_inline_property_city`}
            name="inline_property_city"
            className={styles.input}
            value={inlineCity}
            onChange={(e) => setInlineCity(e.target.value)}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor={`${idPrefix}_inline_property_state`}>
            State
          </label>
          <input
            id={`${idPrefix}_inline_property_state`}
            name="inline_property_state"
            className={styles.input}
            value={inlineState}
            onChange={(e) => setInlineState(e.target.value)}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor={`${idPrefix}_inline_property_postal_code`}>
            ZIP
          </label>
          <input
            id={`${idPrefix}_inline_property_postal_code`}
            name="inline_property_postal_code"
            className={styles.input}
            value={inlinePostal}
            onChange={(e) => setInlinePostal(e.target.value)}
          />
        </div>
      </div>
      <label className={styles.label} htmlFor={`${idPrefix}_inline_property_kind`}>
        Property type
      </label>
      <select
        id={`${idPrefix}_inline_property_kind`}
        name="inline_property_kind"
        className={styles.select}
        value={inlinePropertyKind}
        onChange={(e) => setInlinePropertyKind(e.target.value)}
      >
        {PROPERTY_KIND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className={styles.wizardForm}
      onSubmit={handleFormSubmit}
      onKeyDown={handleFormKeyDown}
    >
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="customer_source" value={customerSource} />
      <input type="hidden" name="property_source" value={propertySource} />
      <input ref={saveIntentInputRef} type="hidden" name="save_intent" defaultValue="draft" />
      <input type="hidden" name="scope_inclusions" value={JSON.stringify(scopeInclusions)} />
      <input type="hidden" name="scope_template_id" value={scopeTemplateId} />
      <input type="hidden" name="quote_property_kind" value={quotePropertyType} />

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {stepError ? (
        <p className={styles.error} role="alert">
          {stepError}
        </p>
      ) : null}

      <nav className={styles.wizardNav} aria-label="Quote steps">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const past = stepIndexFor(step) > i;
          return (
            <button
              key={s.id}
              type="button"
              className={[
                styles.wizardNavStep,
                active ? styles.wizardNavStepActive : '',
                past ? styles.wizardNavStepPast : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                setStepError(null);
                setStep(s.id);
              }}
            >
              <span className={styles.wizardNavBadge}>{i + 1}</span>
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className={styles.wizardLayout}>
        <div className={styles.wizardMain}>
          <section
            className={step === 'who' ? styles.wizardStep : styles.wizardStepHidden}
            aria-hidden={step !== 'who'}
          >
            <h2 className={styles.wizardStepTitle}>Who is this quote for?</h2>
            <p className={styles.hint}>
              Customer is required before sending. Search your CRM or create a profile with service
              address in one pass.
            </p>

            <div className={styles.customerSourceRow}>
              <label className={styles.customerSourceOption}>
                <input
                  type="radio"
                  name="customer_source_radio"
                  checked={customerSource === 'existing'}
                  onChange={() => {
                    setCustomerSource('existing');
                    setStepError(null);
                  }}
                />
                <span>Existing customer</span>
              </label>
              <label className={styles.customerSourceOption}>
                <input
                  type="radio"
                  name="customer_source_radio"
                  checked={customerSource === 'new'}
                  onChange={() => {
                    setCustomerSource('new');
                    setCustomerId('');
                    setPropertyId('');
                    setPropertySource('new');
                    setStepError(null);
                  }}
                />
                <span>New customer</span>
              </label>
            </div>

            <label className={styles.label} htmlFor="quote_title">
              Quote title
            </label>
            <input
              id="quote_title"
              name="title"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bi-weekly maintenance — Chen residence"
            />

            {customerSource === 'existing' ? (
              <>
                <SearchableSelect
                  id="quote_customer_search"
                  name="customer_id"
                  label="Customer"
                  options={customerOptions.map((c) => ({ value: c.id, label: c.label }))}
                  value={customerId}
                  onValueChange={(v) => {
                    setCustomerId(v);
                    setPropertyId('');
                    setPropertySource('existing');
                  }}
                  placeholder="Search by name, email, phone…"
                  emptyText="No customers match"
                />
                {effectiveCustomerId ? (
                  <>
                    <fieldset className={styles.propertySourceFieldset}>
                      <legend className={styles.label}>Service location</legend>
                      <div className={styles.customerSourceRow}>
                        <label className={styles.customerSourceOption}>
                          <input
                            type="radio"
                            name="property_source_radio"
                            checked={propertySource === 'existing'}
                            disabled={propertyOptions.length === 0}
                            onChange={() => {
                              setPropertySource('existing');
                              setStepError(null);
                            }}
                          />
                          <span>Use saved location</span>
                        </label>
                        <label className={styles.customerSourceOption}>
                          <input
                            type="radio"
                            name="property_source_radio"
                            checked={propertySource === 'new'}
                            onChange={() => {
                              setPropertySource('new');
                              setPropertyId('');
                              setStepError(null);
                            }}
                          />
                          <span>Add new location</span>
                        </label>
                      </div>
                    </fieldset>
                    {propertySource === 'existing' && propertyOptions.length > 0 ? (
                      <>
                        <label className={styles.label} htmlFor="quote_property">
                          Saved locations
                        </label>
                        <select
                          key={`prop_${effectiveCustomerId}`}
                          id="quote_property"
                          name="property_id"
                          className={styles.select}
                          value={propertyId}
                          onChange={(e) => setPropertyId(e.target.value)}
                        >
                          <option value="">— Select location —</option>
                          {propertyOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <input type="hidden" name="property_id" value="" />
                        {renderInlinePropertyFields('existing')}
                      </>
                    )}
                  </>
                ) : null}
              </>
            ) : (
              <>
                <input type="hidden" name="customer_id" value="" />
                <div className={styles.wizardGridTwo}>
                  <div>
                    <label className={styles.label} htmlFor="inline_customer_first_name">
                      First name
                    </label>
                    <input
                      id="inline_customer_first_name"
                      name="inline_customer_first_name"
                      className={styles.input}
                      value={inlineFirstName}
                      onChange={(e) => setInlineFirstName(e.target.value)}
                      autoComplete="given-name"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label className={styles.label} htmlFor="inline_customer_last_name">
                      Last name (optional)
                    </label>
                    <input
                      id="inline_customer_last_name"
                      name="inline_customer_last_name"
                      className={styles.input}
                      autoComplete="family-name"
                      placeholder="Customer"
                    />
                  </div>
                </div>
                <div className={styles.wizardGridTwo}>
                  <div>
                    <label className={styles.label} htmlFor="inline_customer_email">
                      Email
                    </label>
                    <input
                      id="inline_customer_email"
                      name="inline_customer_email"
                      type="email"
                      className={styles.input}
                      value={inlineEmail}
                      onChange={(e) => setInlineEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="jane@email.com"
                    />
                  </div>
                  <div>
                    <label className={styles.label} htmlFor="inline_customer_phone">
                      Phone (optional)
                    </label>
                    <input
                      id="inline_customer_phone"
                      name="inline_customer_phone"
                      type="tel"
                      className={styles.input}
                      autoComplete="tel"
                      placeholder="555-0100"
                    />
                  </div>
                </div>
                {renderInlinePropertyFields('new')}
              </>
            )}
          </section>

          <section
            className={step === 'property' ? styles.wizardStep : styles.wizardStepHidden}
            aria-hidden={step !== 'property'}
          >
            <h2 className={styles.wizardStepTitle}>Property details</h2>
            <p className={styles.hint}>
              Pricing inputs for this quote. Stored on the quote notes until dedicated property
              snapshot fields ship.
            </p>
            <div className={styles.wizardGridFour}>
              <div>
                <label className={styles.label} htmlFor="quote_property_type_select">
                  Property type
                </label>
                <select
                  id="quote_property_type_select"
                  className={styles.select}
                  value={quotePropertyType}
                  onChange={(e) => setQuotePropertyType(e.target.value)}
                >
                  {PROPERTY_KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.label} htmlFor="quote_property_sqft">
                  Sq ft (cleanable)
                </label>
                <input
                  id="quote_property_sqft"
                  name="quote_property_sqft"
                  className={styles.input}
                  inputMode="numeric"
                  value={quotePropertySqft}
                  onChange={(e) => setQuotePropertySqft(e.target.value)}
                  placeholder="2400"
                />
              </div>
              <div>
                <label className={styles.label} htmlFor="quote_property_bedrooms">
                  Bedrooms
                </label>
                <input
                  id="quote_property_bedrooms"
                  name="quote_property_bedrooms"
                  className={styles.input}
                  inputMode="numeric"
                  value={quotePropertyBedrooms}
                  onChange={(e) => setQuotePropertyBedrooms(e.target.value)}
                  placeholder="3"
                />
              </div>
              <div>
                <label className={styles.label} htmlFor="quote_property_bathrooms">
                  Bathrooms
                </label>
                <input
                  id="quote_property_bathrooms"
                  name="quote_property_bathrooms"
                  className={styles.input}
                  inputMode="decimal"
                  value={quotePropertyBathrooms}
                  onChange={(e) => setQuotePropertyBathrooms(e.target.value)}
                  placeholder="2.5"
                />
              </div>
              <div>
                <label className={styles.label} htmlFor="quote_property_stories">
                  Stories
                </label>
                <input
                  id="quote_property_stories"
                  name="quote_property_stories"
                  className={styles.input}
                  inputMode="numeric"
                  value={quotePropertyStories}
                  onChange={(e) => setQuotePropertyStories(e.target.value)}
                  placeholder="2"
                />
              </div>
            </div>
            <label className={styles.label} htmlFor="access_notes">
              Access, parking, pets, alarm, supplies
            </label>
            <textarea
              id="access_notes"
              name="access_notes"
              className={styles.textarea}
              rows={4}
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              placeholder="Keypad entry, friendly dogs in laundry room, supplies under sink…"
            />
          </section>

          <section
            className={step === 'scope' ? styles.wizardStep : styles.wizardStepHidden}
            aria-hidden={step !== 'scope'}
          >
            <h2 className={styles.wizardStepTitle}>Scope of work</h2>
            <p className={styles.hint}>
              Start from a template, then adjust inclusions and exclusions. Saved on the quote for
              the customer to review.
            </p>
            <div className={styles.scopeTemplateRow}>
              {QUOTE_SCOPE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={[
                    styles.scopeTemplatePill,
                    scopeTemplateId === template.id ? styles.scopeTemplatePillActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => applyScopeTemplate(template.id)}
                >
                  {template.label}
                </button>
              ))}
            </div>
            <div className={styles.wizardGridTwo}>
              <div>
                <h3 className={styles.wizardSubheading}>Inclusions</h3>
                {scopeTemplateId === 'custom' ? (
                  <textarea
                    className={styles.textarea}
                    rows={8}
                    value={scopeInclusions.join('\n')}
                    onChange={(e) =>
                      setScopeInclusions(
                        e.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="One inclusion per line"
                  />
                ) : (
                  <ul className={styles.scopeChecklist}>
                    {QUOTE_SCOPE_TEMPLATES.find((t) => t.id === scopeTemplateId)?.inclusions.map(
                      (item) => (
                        <li key={item}>
                          <label className={styles.scopeCheckItem}>
                            <input
                              type="checkbox"
                              checked={scopeInclusions.includes(item)}
                              onChange={() => toggleInclusion(item)}
                            />
                            <span>{item}</span>
                          </label>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
              <div>
                <h3 className={styles.wizardSubheading}>Exclusions (customer-visible)</h3>
                <textarea
                  name="scope_exclusions"
                  className={styles.textarea}
                  rows={8}
                  value={scopeExclusions}
                  onChange={(e) => setScopeExclusions(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section
            className={step === 'pricing' ? styles.wizardStep : styles.wizardStepHidden}
            aria-hidden={step !== 'pricing'}
          >
            <h2 className={styles.wizardStepTitle}>Services &amp; pricing</h2>
            <p className={styles.hint}>
              Add priced service lines. Field employees receive amounts from scheduled visits — set
              prices here, not in the field.
            </p>
            <QuoteLineItemsEditor
              layout="cards"
              rows={lineRows}
              onRowsChange={setLineRows}
              hideLegend
            />
            <h3 className={styles.wizardSubheading}>Add from library</h3>
            <div className={styles.addonLibraryRow}>
              {QUOTE_ADDON_LIBRARY.map((addon) => (
                <Button
                  key={addon.service_label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => addAddonLine(addon)}
                >
                  + {addon.service_label} (${addon.amount_dollars.replace('.00', '')})
                </Button>
              ))}
            </div>
            <details className={styles.wizardDetails}>
              <summary>Tax &amp; quote-level discount</summary>
              <QuoteHeaderPricingFields
                compact
                values={pricing}
                onValuesChange={(patch) => setPricing((prev) => ({ ...prev, ...patch }))}
              />
            </details>
          </section>

          <section
            className={step === 'terms' ? styles.wizardStep : styles.wizardStepHidden}
            aria-hidden={step !== 'terms'}
          >
            <h2 className={styles.wizardStepTitle}>Terms &amp; send</h2>
            <p className={styles.hint}>
              Set validity and office-only notes. Save as a draft to finish later, or send now to
              email the customer a link to review and accept.
            </p>
            <div className={styles.wizardGridTwo}>
              <div>
                <label className={styles.label} htmlFor="quote_valid">
                  Valid until
                </label>
                <input
                  id="quote_valid"
                  name="valid_until"
                  className={styles.input}
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
            <label className={styles.label} htmlFor="office_notes">
              Internal notes (office only)
            </label>
            <textarea
              id="office_notes"
              name="office_notes"
              className={styles.textarea}
              rows={4}
              value={officeNotes}
              onChange={(e) => setOfficeNotes(e.target.value)}
              placeholder="Walkthrough notes, margin targets, follow-up reminders…"
            />
            <h3 className={styles.wizardSubheading}>Ready to save or send?</h3>
            <ul className={styles.completenessList}>
              {completeness.map((item) => (
                <li
                  key={item.id}
                  className={item.done ? styles.completenessDone : styles.completenessPending}
                >
                  {item.done ? '✓' : '○'} {item.label}
                </li>
              ))}
            </ul>
          </section>

          <div className={styles.wizardActions}>
            <Button type="button" variant="ghost" disabled={step === 'who'} onClick={goBack}>
              Back
            </Button>
            <div className={styles.wizardActionsEnd}>
              {step !== 'terms' || !termsActionsReady ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={step === 'terms'}
                  onClick={goNext}
                >
                  Continue
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={pending && pendingIntent === 'draft'}
                    disabled={pending}
                    onClick={() => submitQuote('draft')}
                  >
                    {pending && pendingIntent === 'draft' ? 'Saving…' : 'Save as draft'}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    loading={pending && pendingIntent === 'send'}
                    disabled={pending}
                    onClick={() => submitQuote('send')}
                  >
                    {pending && pendingIntent === 'send' ? 'Sending…' : 'Send to customer'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <QuoteLiveTotalSidebar lineRows={lineRows} pricing={pricing} />
      </div>
    </form>
  );
}
