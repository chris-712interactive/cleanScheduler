import { Building2, Calendar, Hash, Mail, MapPin, MessageSquareText, Phone } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import type { CustomerDetailEmbedRow } from '@/lib/tenant/customerEmbedTypes';
import styles from './customers.module.scss';

const CONTACT_METHOD_LABEL: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  sms: 'SMS',
};

function formatPreferredContact(raw: string | null | undefined): string {
  if (!raw) return 'Not set';
  return CONTACT_METHOD_LABEL[raw] ?? raw;
}

type Profile = CustomerDetailEmbedRow['tenant_customer_profiles'];
type Identity = NonNullable<CustomerDetailEmbedRow['customer_identities']>;
type Property = NonNullable<CustomerDetailEmbedRow['tenant_customer_properties']>[number];

export interface CustomerProfileSummaryProps {
  customerId: string;
  createdAt: string;
  status: string;
  identity: Identity;
  profile: Profile | null | undefined;
  primaryProperty: Property | undefined;
}

export function CustomerProfileSummary({
  customerId,
  createdAt,
  status,
  identity,
  profile,
  primaryProperty,
}: CustomerProfileSummaryProps) {
  const email = identity.email?.trim() ?? '';
  const phone = identity.phone?.trim() ?? '';
  const company = profile?.company_name?.trim() ?? '';
  const internalNotes = profile?.internal_notes?.trim() ?? '';
  const preferred = formatPreferredContact(profile?.preferred_contact_method);
  const primaryLine = formatPropertyAddressLine(primaryProperty);
  const primaryLabel = primaryProperty?.label?.trim();
  const isActive = status === 'active';

  return (
    <div className={styles.profileSummary}>
      <div className={styles.profileSummaryTop}>
        <div className={styles.profileSummaryIdentity}>
          {company ? (
            <p className={styles.profileSummaryCompany}>
              <Building2 size={18} aria-hidden />
              <span>{company}</span>
            </p>
          ) : (
            <p className={styles.profileSummaryTagline}>
              <span className={styles.profileSummaryPersonName}>
                {formatCustomerDisplayName(identity)}
              </span>
              <span className={styles.profileSummaryTaglineRest}> · Primary contact on file</span>
            </p>
          )}
        </div>
        <StatusPill tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Active' : status}</StatusPill>
      </div>

      <div className={styles.profileSummaryContactGrid}>
        <div className={styles.profileSummaryContactCard}>
          <span className={styles.profileSummaryContactLabel}>
            <Mail size={14} aria-hidden />
            Email
          </span>
          {email ? (
            <a href={`mailto:${encodeURIComponent(email)}`} className={styles.profileSummaryContactValue}>
              {email}
            </a>
          ) : (
            <span className={styles.profileSummaryContactEmpty}>—</span>
          )}
        </div>
        <div className={styles.profileSummaryContactCard}>
          <span className={styles.profileSummaryContactLabel}>
            <Phone size={14} aria-hidden />
            Phone
          </span>
          {phone ? (
            <a href={`tel:${phone.replace(/\s/g, '')}`} className={styles.profileSummaryContactValue}>
              {phone}
            </a>
          ) : (
            <span className={styles.profileSummaryContactEmpty}>—</span>
          )}
        </div>
        <div className={styles.profileSummaryContactCard}>
          <span className={styles.profileSummaryContactLabel}>Preferred contact</span>
          <span className={styles.profileSummaryContactValue}>{preferred}</span>
        </div>
      </div>

      <div className={styles.profileSummaryLocation}>
        <div className={styles.profileSummaryLocationHeader}>
          <MapPin size={16} aria-hidden />
          <span>Primary service location</span>
        </div>
        {primaryLabel ? <p className={styles.profileSummaryLocationLabel}>{primaryLabel}</p> : null}
        <p className={styles.profileSummaryLocationAddress}>{primaryLine || 'No address on file'}</p>
      </div>

      {internalNotes ? (
        <div className={styles.profileSummaryNotes}>
          <div className={styles.profileSummaryNotesHeader}>
            <MessageSquareText size={16} aria-hidden />
            <span>Internal notes</span>
          </div>
          <p className={styles.profileSummaryNotesBody}>{internalNotes}</p>
        </div>
      ) : null}

      <dl className={styles.profileSummaryMeta}>
        <div className={styles.profileSummaryMetaItem}>
          <dt>
            <Hash size={12} aria-hidden /> Customer ID
          </dt>
          <dd className={styles.profileSummaryMetaId} title={customerId}>
            {customerId}
          </dd>
        </div>
        <div className={styles.profileSummaryMetaItem}>
          <dt>
            <Calendar size={12} aria-hidden /> Added
          </dt>
          <dd>{new Date(createdAt).toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  );
}
