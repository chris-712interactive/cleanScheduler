import type { VercelDomainVerificationRecord } from '@/lib/portal/vercelProjectDomains';

export interface CustomerPortalDnsInstruction {
  id: string;
  type: string;
  hostLabel: string;
  value: string;
  purpose: string;
  detail?: string;
}

function dnsHostLabel(recordHost: string, portalHostname: string): string {
  const host = recordHost.trim().toLowerCase();
  const portal = portalHostname.trim().toLowerCase();

  if (host === portal) return '@ or root (apex) — use your registrar’s apex/root field';
  if (host.endsWith(`.${portal}`)) {
    const prefix = host.slice(0, -(portal.length + 1));
    return prefix || '@';
  }

  return recordHost;
}

function purposeForRecord(type: string, reason: string | undefined): string {
  const normalized = type.toUpperCase();
  if (normalized === 'TXT') {
    return reason?.trim() || 'Prove you control this domain';
  }
  if (normalized === 'CNAME') {
    return 'Route customer portal traffic to cleanScheduler';
  }
  if (normalized === 'A' || normalized === 'AAAA') {
    return 'Route customer portal traffic to cleanScheduler';
  }
  return reason?.trim() || 'Required for domain setup';
}

export function buildDnsInstructionsFromVercel(
  portalHostname: string,
  records: VercelDomainVerificationRecord[],
): CustomerPortalDnsInstruction[] {
  return records.map((record, index) => ({
    id: `${record.type}-${record.domain}-${index}`,
    type: record.type.toUpperCase(),
    hostLabel: dnsHostLabel(record.domain, portalHostname),
    value: record.value,
    purpose: purposeForRecord(record.type, record.reason),
    detail: record.reason?.trim() || undefined,
  }));
}

export function buildLocalDevTxtInstruction(
  portalHostname: string,
  verificationToken: string,
  txtRecordName: string,
): CustomerPortalDnsInstruction {
  return {
    id: 'local-txt',
    type: 'TXT',
    hostLabel: txtRecordName,
    value: verificationToken,
    purpose: `Prove you control ${portalHostname} (local dev)`,
  };
}

export function buildFallbackDnsInstructions(portalHostname: string): CustomerPortalDnsInstruction[] {
  return [
    {
      id: 'fallback-txt',
      type: 'TXT',
      hostLabel: `_vercel.${portalHostname}`,
      value: '(provided after registration — click Refresh instructions if empty)',
      purpose: 'Prove you control this domain',
      detail:
        'Your registrar may show the host as _vercel or _vercel.portal depending on the provider.',
    },
    {
      id: 'fallback-cname',
      type: 'CNAME',
      hostLabel: portalHostname.includes('.') ? portalHostname.split('.')[0]! : portalHostname,
      value: 'cname.vercel-dns.com',
      purpose: 'Route customer portal traffic to cleanScheduler',
      detail: 'Some providers want only the subdomain label (e.g. portal) in the host field.',
    },
  ];
}
