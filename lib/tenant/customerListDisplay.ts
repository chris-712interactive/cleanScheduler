import type { StatusTone } from '@/components/ui/StatusPill';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';

type PropertyAddressPick = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  is_primary: boolean;
};

export function customerListInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const firstPart = parts[0] ?? '';
  if (parts.length === 1) return firstPart.slice(0, 2).toUpperCase();
  const lastPart = parts[parts.length - 1] ?? '';
  const first = firstPart[0] ?? '';
  const last = lastPart[0] ?? '';
  return `${first}${last}`.toUpperCase();
}

export function formatCustomerListPhone(phone: string | null | undefined): string | null {
  const raw = phone?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

export function customerListStatusLabel(status: string): string {
  return status === 'inactive' ? 'Inactive' : 'Active';
}

export function customerListStatusTone(status: string): StatusTone {
  return status === 'inactive' ? 'neutral' : 'success';
}

export function primaryCustomerAddressLine(
  properties: PropertyAddressPick[] | null | undefined,
): string | null {
  const list = properties ?? [];
  if (!list.length) return null;
  const primary = list.find((p) => p.is_primary) ?? list[0];
  const line = formatPropertyAddressLine(primary);
  return line || null;
}
