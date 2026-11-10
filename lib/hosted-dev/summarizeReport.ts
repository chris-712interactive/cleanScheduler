import { mutationGate } from './mutationGate';

export type SectionStatus = 'pass' | 'fail' | 'blocked';

export type ReportSection = {
  id: string;
  status: SectionStatus;
  detail: string;
};

type PwSuite = {
  title?: string;
  suites?: PwSuite[];
  specs?: {
    title?: string;
    ok?: boolean;
    tests?: {
      results?: { status?: string; error?: { message?: string } }[];
    }[];
  }[];
};

export type HostedDevReport = {
  overall: 'pass' | 'fail';
  target: string;
  sections: ReportSection[];
  blockedNotPassed: ReportSection[];
};

function walk(suite: PwSuite, into: ReportSection[]): void {
  for (const spec of suite.specs ?? []) {
    const result = spec.tests?.[0]?.results?.at(-1);
    const message = result?.error?.message ?? '';
    const status: SectionStatus = spec.ok
      ? 'pass'
      : message.includes('BLOCKED:')
        ? 'blocked'
        : 'fail';
    into.push({
      id: spec.title ?? 'untitled',
      status,
      detail: status === 'pass' ? 'executed' : message.split('\n')[0]?.slice(0, 400) || status,
    });
  }
  for (const child of suite.suites ?? []) walk(child, into);
}

export function sectionsFromPlaywright(report: { suites?: PwSuite[] } | null): ReportSection[] {
  const sections: ReportSection[] = [];
  for (const suite of report?.suites ?? []) walk(suite, sections);
  return sections;
}

export function catalogBlocked(env: Record<string, string | undefined>): ReportSection[] {
  const blocked: ReportSection[] = [];
  if (!env.HOSTED_DEV_BOOKING_URL?.trim()) {
    blocked.push({
      id: 'public booking read',
      status: 'blocked',
      detail: 'HOSTED_DEV_BOOKING_URL is not set. The booking page was not opened.',
    });
  }
  if (env.HOSTED_DEV_ISOLATED !== '1') {
    blocked.push({
      id: 'authenticated tenant, admin, and customer reads',
      status: 'blocked',
      detail: 'HOSTED_DEV_ISOLATED is not 1. Dedicated QA logins were not used.',
    });
    blocked.push({
      id: 'cross-tenant RLS',
      status: 'blocked',
      detail: 'HOSTED_DEV_ISOLATED is not 1. RLS was not queried.',
    });
  }
  if (!env.QA_DEV_DATABASE_URL?.trim()) {
    blocked.push({
      id: 'direct SQL RLS',
      status: 'blocked',
      detail: 'QA_DEV_DATABASE_URL is not set. Direct SQL RLS did not run.',
    });
  }
  if (env.HOSTED_DEV_MUTATIONS !== '1') {
    blocked.push({
      id: 'mutations, payments, refunds, bank links, sends, and cron',
      status: 'blocked',
      detail: mutationGate().reason,
    });
  }
  return blocked;
}

export function buildHostedDevReport(input: {
  target: string;
  playwright: { suites?: PwSuite[] } | null;
  env: Record<string, string | undefined>;
  identityNote: string;
}): HostedDevReport {
  const executed = sectionsFromPlaywright(input.playwright);
  const blockedNotPassed = [
    ...executed.filter((section) => section.status === 'blocked'),
    ...catalogBlocked(input.env),
  ];
  const failed = executed.some(
    (section) => section.status === 'fail' || section.status === 'blocked',
  );
  const sections: ReportSection[] = [
    {
      id: 'deployment identity',
      status: input.identityNote.startsWith('ok')
        ? 'pass'
        : input.identityNote.startsWith('missing')
          ? 'fail'
          : 'fail',
      detail: input.identityNote,
    },
    ...executed.filter((section) => section.id !== 'deployment identity is hosted dev'),
    ...catalogBlocked(input.env),
  ];
  return {
    overall: failed || sections.some((section) => section.status === 'fail') ? 'fail' : 'pass',
    target: input.target,
    sections,
    blockedNotPassed,
  };
}

export function renderHostedDevReport(report: HostedDevReport): string {
  const lines = [
    `# Hosted dev results: ${report.overall}`,
    '',
    `Target: ${report.target}`,
    '',
    'Blocked items were not treated as passed.',
    '',
    '| Section | Status | Detail |',
    '| --- | --- | --- |',
    ...report.sections.map(
      (section) =>
        `| ${section.id.replaceAll('|', '/')} | ${section.status} | ${section.detail.replaceAll('|', '/')} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
