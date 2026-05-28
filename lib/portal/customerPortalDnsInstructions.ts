import type {
  VercelDomainDnsConfig,
  VercelDomainVerificationRecord,
} from '@/lib/portal/vercelProjectDomains';

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

  if (host === portal) return '@ (root) — some providers label this “@” or leave the name blank';
  if (host.endsWith(`.${portal}`)) {
    const prefix = host.slice(0, -(portal.length + 1));
    return prefix || '@';
  }

  return recordHost;
}

function purposeForRecord(type: string, reason: string | undefined): string {
  const normalized = type.toUpperCase();
  if (normalized === 'TXT') {
    return 'Confirms that you own this domain';
  }
  if (normalized === 'CNAME' || normalized === 'A' || normalized === 'AAAA') {
    return 'Connects your portal address to cleanScheduler';
  }
  return reason?.trim() || 'Required to finish setup';
}

export function buildDnsInstructionsFromVercel(
  portalHostname: string,
  records: VercelDomainVerificationRecord[],
): CustomerPortalDnsInstruction[] {
  return records
    .filter((record) => record.value.trim().length > 0)
    .map((record, index) => ({
      id: `${record.type}-${record.domain}-${index}`,
      type: record.type.toUpperCase(),
      hostLabel: dnsHostLabel(record.domain, portalHostname),
      value: record.value,
      purpose: purposeForRecord(record.type, record.reason),
      detail: record.reason?.trim() || undefined,
    }));
}

function subdomainHostLabel(portalHostname: string): string {
  return portalHostname.includes('.') ? portalHostname.split('.')[0]! : portalHostname;
}

function buildRoutingInstructionsFromVercelConfig(
  portalHostname: string,
  config: VercelDomainDnsConfig,
): CustomerPortalDnsInstruction[] {
  if (!config.misconfigured) return [];

  const hostLabel = subdomainHostLabel(portalHostname);

  if (config.recommendedCname) {
    return [
      {
        id: 'vercel-cname',
        type: 'CNAME',
        hostLabel,
        value: config.recommendedCname,
        purpose: 'Connects your portal address to cleanScheduler',
        detail:
          'Copy this value exactly. Some providers call this field “Target”, “Points to”, or “Alias”.',
      },
    ];
  }

  if (config.recommendedARecords.length > 0) {
    return config.recommendedARecords.map((ip, index) => ({
      id: `vercel-a-${index}`,
      type: 'A',
      hostLabel,
      value: ip,
      purpose: 'Connects your portal address to cleanScheduler',
    }));
  }

  return [];
}

/** Merge ownership TXT challenges with routing CNAME/A from Vercel domain config. */
export function buildCustomerPortalDnsInstructions(options: {
  portalHostname: string;
  vercelVerification: VercelDomainVerificationRecord[];
  vercelDnsConfig?: VercelDomainDnsConfig | null;
}): CustomerPortalDnsInstruction[] {
  const { portalHostname, vercelVerification, vercelDnsConfig } = options;
  const instructions = buildDnsInstructionsFromVercel(portalHostname, vercelVerification);

  if (vercelDnsConfig) {
    for (const record of buildRoutingInstructionsFromVercelConfig(
      portalHostname,
      vercelDnsConfig,
    )) {
      const duplicate = instructions.some(
        (existing) =>
          existing.type === record.type &&
          existing.hostLabel === record.hostLabel &&
          existing.value === record.value,
      );
      if (!duplicate) instructions.push(record);
    }
  }

  if (instructions.length > 0) return instructions;
  return buildFallbackDnsInstructions(portalHostname);
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
    purpose: `Confirms that you own ${portalHostname}`,
  };
}

export function buildFallbackDnsInstructions(
  portalHostname: string,
): CustomerPortalDnsInstruction[] {
  return [
    {
      id: 'fallback-txt',
      type: 'TXT',
      hostLabel: `_vercel.${portalHostname}`,
      value: 'Loading… click Refresh below if this stays empty',
      purpose: 'Confirms that you own this domain',
      detail:
        'Your DNS provider may show only part of the name (for example _vercel or _vercel.portal).',
    },
    {
      id: 'fallback-cname',
      type: 'CNAME',
      hostLabel: portalHostname.includes('.') ? portalHostname.split('.')[0]! : portalHostname,
      value: 'cname.vercel-dns.com',
      purpose: 'Connects your portal address to cleanScheduler',
      detail:
        'Enter only the first part of your address (for example portal, not the full domain).',
    },
  ];
}
