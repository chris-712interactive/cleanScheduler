import type {
  VercelDomainDnsConfig,
  VercelDomainVerificationRecord,
} from '@/lib/portal/vercelProjectDomains';

export type CustomerPortalDnsRecordCategory = 'ownership' | 'routing';

export interface CustomerPortalDnsInstruction {
  id: string;
  type: string;
  category: CustomerPortalDnsRecordCategory;
  hostLabel: string;
  hostHelp?: string;
  value: string;
  valueHelp?: string;
  purpose: string;
  detail?: string;
}

function dnsHostParts(
  recordHost: string,
  portalHostname: string,
): { hostLabel: string; hostHelp?: string } {
  const host = recordHost.trim().toLowerCase();
  const portal = portalHostname.trim().toLowerCase();

  if (host === portal) {
    return {
      hostLabel: '@',
      hostHelp:
        'Use @ for the root domain. Some providers leave the Name or Host field blank instead.',
    };
  }

  if (host.endsWith(`.${portal}`)) {
    const prefix = host.slice(0, -(portal.length + 1));
    if (prefix) return { hostLabel: prefix };
  }

  return { hostLabel: recordHost };
}

function categoryForRecord(type: string): CustomerPortalDnsRecordCategory {
  return type.toUpperCase() === 'TXT' ? 'ownership' : 'routing';
}

function purposeForRecord(type: string, reason: string | undefined): string {
  const normalized = type.toUpperCase();
  if (normalized === 'TXT') {
    return 'Proves you own this domain';
  }
  if (normalized === 'CNAME' || normalized === 'A' || normalized === 'AAAA') {
    return 'Routes visitors to your customer portal';
  }
  return reason?.trim() || 'Required to finish setup';
}

function valueHelpForRecord(type: string): string | undefined {
  const normalized = type.toUpperCase();
  if (normalized === 'CNAME') {
    return 'Your provider may label this Target, Points to, or Alias.';
  }
  if (normalized === 'A' || normalized === 'AAAA') {
    return 'Enter this IP address exactly as shown.';
  }
  return undefined;
}

export function buildDnsInstructionsFromVercel(
  portalHostname: string,
  records: VercelDomainVerificationRecord[],
): CustomerPortalDnsInstruction[] {
  return records
    .filter((record) => record.value.trim().length > 0)
    .map((record, index) => {
      const type = record.type.toUpperCase();
      const { hostLabel, hostHelp } = dnsHostParts(record.domain, portalHostname);
      return {
        id: `${record.type}-${record.domain}-${index}`,
        type,
        category: categoryForRecord(record.type),
        hostLabel,
        hostHelp,
        value: record.value,
        valueHelp: valueHelpForRecord(record.type),
        purpose: purposeForRecord(record.type, record.reason),
        detail: record.reason?.trim() || undefined,
      };
    });
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
        category: 'routing',
        hostLabel,
        hostHelp: 'Enter only the first part of your portal address — not the full domain.',
        value: config.recommendedCname,
        valueHelp: 'Your provider may label this Target, Points to, or Alias.',
        purpose: 'Routes visitors to your customer portal',
        detail:
          'Copy this value exactly, including any trailing dot your provider adds automatically.',
      },
    ];
  }

  if (config.recommendedARecords.length > 0) {
    return config.recommendedARecords.map((ip, index) => ({
      id: `vercel-a-${index}`,
      type: 'A',
      category: 'routing',
      hostLabel,
      hostHelp: 'Enter only the first part of your portal address — not the full domain.',
      value: ip,
      valueHelp: 'Enter this IP address exactly as shown.',
      purpose: 'Routes visitors to your customer portal',
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
    category: 'ownership',
    hostLabel: txtRecordName,
    value: verificationToken,
    purpose: `Proves you own ${portalHostname}`,
  };
}

export function buildFallbackDnsInstructions(
  portalHostname: string,
): CustomerPortalDnsInstruction[] {
  return [
    {
      id: 'fallback-txt',
      type: 'TXT',
      category: 'ownership',
      hostLabel: `_vercel.${portalHostname}`,
      hostHelp:
        'Your DNS provider may show only part of the name (for example _vercel or _vercel.portal).',
      value: 'Loading… click Refresh records if this stays empty',
      purpose: 'Proves you own this domain',
    },
    {
      id: 'fallback-cname',
      type: 'CNAME',
      category: 'routing',
      hostLabel: portalHostname.includes('.') ? portalHostname.split('.')[0]! : portalHostname,
      hostHelp: 'Enter only the first part of your portal address — not the full domain.',
      value: 'cname.vercel-dns.com',
      valueHelp: 'Your provider may label this Target, Points to, or Alias.',
      purpose: 'Routes visitors to your customer portal',
    },
  ];
}

export function groupDnsInstructionsByCategory(instructions: CustomerPortalDnsInstruction[]): {
  ownership: CustomerPortalDnsInstruction[];
  routing: CustomerPortalDnsInstruction[];
} {
  return {
    ownership: instructions.filter((record) => record.category === 'ownership'),
    routing: instructions.filter((record) => record.category === 'routing'),
  };
}
