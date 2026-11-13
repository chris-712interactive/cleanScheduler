import { mutationGate } from './mutationGate';

export type SectionStatus = 'pass' | 'fail' | 'blocked';

export type ReportSection = {
  id: string;
  status: SectionStatus;
  detail: string;
};

type PwResult = { status?: string; error?: { message?: string } };

type PwSuite = {
  title?: string;
  suites?: PwSuite[];
  specs?: {
    title?: string;
    ok?: boolean;
    tests?: {
      status?: string;
      results?: PwResult[];
    }[];
  }[];
};

export type HostedDevReport = {
  overall: 'pass' | 'fail';
  target: string;
  sections: ReportSection[];
  blockedNotPassed: ReportSection[];
};

const IDENTITY_SPEC = 'deployment identity is hosted dev';
const MUTATION_SPEC = 'mutation and payment coverage is refused';
const MUTATION_ROW = 'mutations, payments, refunds, bank links, sends, and cron';

function skipped(spec: NonNullable<PwSuite['specs']>[number]): boolean {
  return (spec.tests ?? []).some(
    (test) =>
      test.status === 'skipped' ||
      (test.results ?? []).some((result) => result.status === 'skipped'),
  );
}

function walk(suite: PwSuite, into: ReportSection[]): void {
  for (const spec of suite.specs ?? []) {
    const result = spec.tests?.[0]?.results?.at(-1);
    const message = result?.error?.message ?? '';
    const status: SectionStatus = skipped(spec)
      ? 'fail'
      : spec.ok
        ? 'pass'
        : message.includes('BLOCKED:')
          ? 'blocked'
          : 'fail';
    into.push({
      id: spec.title ?? 'untitled',
      status,
      detail:
        status === 'pass'
          ? 'executed'
          : skipped(spec)
            ? 'Skipped. Not a pass.'
            : message.split('\n')[0]?.slice(0, 400) || status,
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
      detail:
        'QA_DEV_DATABASE_URL is not set. Direct SQL RLS did not run. Automatic GitHub runs do not receive this URL.',
    });
  }
  return blocked;
}

function missingIsolatedRows(
  executed: ReportSection[],
  env: Record<string, string | undefined>,
): ReportSection[] {
  if (env.HOSTED_DEV_ISOLATED !== '1') return [];
  const titles = executed.map((section) => section.id).join('\n');
  const required: { id: string; present: RegExp }[] = [
    {
      id: 'authenticated tenant, admin, and customer reads',
      present: /residential workspace|commercial workspace|platform admin|customer portal/i,
    },
    { id: 'cross-tenant RLS', present: /cross-tenant quote/i },
  ];
  return required
    .filter((row) => !row.present.test(titles))
    .map((row) => ({
      id: row.id,
      status: 'fail' as const,
      detail: 'Not executed. Setup failed or the result file has no row. Not a pass.',
    }));
}

const MUTATION_TEST_PREFIX = 'mutation:';

function mutationSpecs(playwright: { suites?: PwSuite[] } | null): ReportSection[] {
  return sectionsFromPlaywright(playwright).filter(
    (section) => section.id.startsWith(MUTATION_TEST_PREFIX) || section.id === MUTATION_SPEC,
  );
}

function mutationSection(input: {
  env: Record<string, string | undefined>;
  playwright: { suites?: PwSuite[] } | null;
  outboundSuppressed: boolean;
}): ReportSection {
  const confirmed = input.outboundSuppressed === true && input.env.HOSTED_DEV_MUTATIONS === '1';
  if (!confirmed) {
    const gate = mutationGate({ outboundSuppressed: false });
    return {
      id: MUTATION_ROW,
      status: 'blocked',
      detail: gate.status === 'blocked' ? gate.reason : 'Outbound suppression is not confirmed.',
    };
  }
  const specs = mutationSpecs(input.playwright).filter((section) => section.id !== MUTATION_SPEC);
  if (specs.length === 0) {
    return {
      id: MUTATION_ROW,
      status: 'fail',
      detail: 'Suppression is confirmed but no mutation tests executed. Not a pass.',
    };
  }
  const blocked = specs.find((section) => section.status === 'blocked');
  if (blocked) {
    return { id: MUTATION_ROW, status: 'blocked', detail: blocked.detail };
  }
  const failed = specs.find((section) => section.status !== 'pass');
  if (failed) {
    return { id: MUTATION_ROW, status: 'fail', detail: failed.detail };
  }
  return {
    id: MUTATION_ROW,
    status: 'pass',
    detail:
      'Deployment confirmed outbound suppression. QA-tenant mutation checks ran. Blocked items were not marked passed.',
  };
}

export function buildHostedDevReport(input: {
  target: string;
  playwright: { suites?: PwSuite[] } | null;
  env: Record<string, string | undefined>;
  identityNote: string;
  outboundSuppressed?: boolean;
}): HostedDevReport {
  const executed = sectionsFromPlaywright(input.playwright).filter(
    (section) => section.id !== MUTATION_SPEC && !section.id.startsWith(MUTATION_TEST_PREFIX),
  );
  const identity: ReportSection = {
    id: 'deployment identity',
    status: input.identityNote.startsWith('ok') ? 'pass' : 'fail',
    detail: input.identityNote,
  };
  const mutations = mutationSection({
    env: input.env,
    playwright: input.playwright,
    outboundSuppressed: input.outboundSuppressed === true,
  });
  const gaps = missingIsolatedRows(executed, input.env);
  const sections: ReportSection[] = [
    identity,
    ...executed.filter((section) => section.id !== IDENTITY_SPEC),
    ...gaps,
    ...catalogBlocked(input.env),
    mutations,
  ];
  const blockedNotPassed = sections.filter((section) => section.status !== 'pass');
  const mutationsRequestedWhileBlocked =
    input.env.HOSTED_DEV_MUTATIONS === '1' && mutations.status === 'blocked';
  const executedProblem = executed.some((section) => section.status !== 'pass');
  const failed = sections.some((section) => section.status === 'fail');
  return {
    overall:
      executedProblem || failed || gaps.length > 0 || mutationsRequestedWhileBlocked
        ? 'fail'
        : 'pass',
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
    'Blocked and failed items were not treated as passed.',
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
