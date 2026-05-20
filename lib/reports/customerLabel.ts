import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';

export function customerLabelFromIdentity(
  ident: {
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  } | null,
): string {
  if (!ident || !customerHasAnyNameParts(ident)) return '—';
  const name = formatCustomerDisplayName(ident);
  return name === 'Unnamed' ? '—' : name;
}
