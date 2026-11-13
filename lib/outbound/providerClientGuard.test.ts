import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const skip = new Set([
  'node_modules',
  '.next',
  'coverage',
  'out',
  'dist',
  'build',
  'hosted-dev-results',
]);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (/\.(?:ts|tsx|mts|js|mjs)$/.test(entry)) found.push(full);
  }
  return found;
}

const rules: { label: string; pattern: RegExp; allow: Set<string> }[] = [
  {
    label: 'new Stripe',
    pattern: /new\s+Stripe\s*\(/,
    allow: new Set(['lib/stripe/server.ts']),
  },
  {
    label: 'new Resend',
    pattern: /new\s+Resend\s*\(/,
    allow: new Set(['lib/email/resendClient.ts']),
  },
  {
    label: 'new PlaidApi',
    pattern: /new\s+PlaidApi\s*\(/,
    allow: new Set(['lib/plaid/server.ts']),
  },
  {
    label: 'new SentDm',
    pattern: /new\s+SentDm\s*\(/,
    allow: new Set(['lib/sms/sentDmServer.ts']),
  },
  {
    label: 'provider host',
    pattern:
      /https?:\/\/(?:api\.stripe\.com|api\.resend\.com|(?:sandbox|development|production)\.plaid\.com|api\.sent\.dm)/,
    allow: new Set(),
  },
];

describe('provider client guard', () => {
  it('fails when a provider client is constructed outside its wrapper', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(root)) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      const text = readFileSync(file, 'utf8');
      for (const rule of rules) {
        if (rule.pattern.test(text) && !rule.allow.has(rel)) {
          violations.push(`${rel}: ${rule.label}`);
        }
      }
      const start = text.replace(/^\uFEFF/, '').trimStart();
      const clientFile = start.startsWith("'use client'") || start.startsWith('"use client"');
      if (
        clientFile &&
        (text.includes('lib/outbound/suppression') || text.includes('OUTBOUND_SUPPRESSED'))
      ) {
        violations.push(`${rel}: client file references outbound suppression`);
      }
    }
    expect(violations).toEqual([]);
  });
});
