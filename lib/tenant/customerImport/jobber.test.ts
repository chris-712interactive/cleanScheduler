import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsvTable } from '@/lib/csv/parseCsv';
import { disposeCustomerImportDrafts } from '@/lib/tenant/customerImport/matchExisting';
import { parseCustomerImportCsv } from '@/lib/tenant/customerImport/parseCustomerImportCsv';
import { mapJobberRows } from '@/lib/tenant/customerImport/profiles/jobber';
import {
  buildCustomerImportPreview,
  customerImportExceedsPlan,
} from '@/lib/tenant/customerImport/preview';

const fixturePath = path.join(
  process.cwd(),
  'lib/tenant/customerImport/fixtures/jobber.sample.csv',
);

function jobberDrafts(csv: string) {
  const table = parseCsvTable(csv);
  return mapJobberRows(table.headers, table.rows, { includeUnmatchedCustomFields: false });
}

describe('Jobber customer CSV', () => {
  const csv = readFileSync(fixturePath, 'utf8');
  const drafts = jobberDrafts(csv);

  it('detects a Jobber client export from J-ID and service street', () => {
    const parsed = parseCustomerImportCsv(csv, { includeUnmatchedCustomFields: false });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.parsed.source).toBe('jobber');
  });

  it('collapses two property rows for the same client', () => {
    const agnas = drafts.find((draft) => draft.externalRef === 'jobber:100');
    expect(agnas?.properties).toHaveLength(2);
    expect(agnas?.properties[0]?.isPrimary).toBe(true);
    expect(agnas?.properties[1]?.isPrimary).toBe(false);
    expect(agnas?.properties[0]?.addressLine1).toBe('10 Palm St');
    expect(agnas?.properties[1]?.addressLine1).toBe('20 Gulf Dr');
    expect(agnas?.firstName).toBe('Agnas Gura');
    expect(agnas?.email).toBe('a@example.com');
    expect(agnas?.internalNotes).toContain('b@example.com');
    expect(agnas?.internalNotes).toContain('c@example.com');
    expect(agnas?.phone).toBe('+12395550100');
    expect(agnas?.properties[0]?.state).toBe('FL');
    expect(agnas?.properties[1]?.state).toBe('FL');
    expect(agnas?.properties[0]?.postalCode).toBe('33957');
    expect(agnas?.properties[0]?.siteNotes).toContain('Gulfside Place');
    expect(agnas?.properties[0]?.siteNotes ?? '').not.toContain('01137/2016');
    expect(agnas?.properties[1]?.siteNotes).toContain('Gate (Trade Win) code 1789');
    expect(agnas?.properties[0]?.addressLine2).toBe('Apt 2');
  });

  it('uses a company display name when first and last are empty', () => {
    const corp = drafts.find((draft) => draft.externalRef === 'jobber:200');
    expect(corp?.firstName).toBe('Hajoca Corp');
    expect(corp?.companyName).toBe('Hajoca Corp');
    expect(corp?.properties[0]?.kind).toBe('commercial');
  });

  it('keeps junk company names as site notes', () => {
    const pat = drafts.find((draft) => draft.externalRef === 'jobber:300');
    expect(pat?.companyName).toBeNull();
    expect(pat?.properties[0]?.siteNotes).toContain('Garage 1553');
    expect(pat?.properties[0]?.siteNotes).toContain('gate code 4412');
    expect(pat?.properties[0]?.addressLine2).toBeNull();
    expect(pat?.internalNotes).toContain('Billing: 9 Billing Rd');
    expect(pat?.properties[0]?.siteNotes ?? '').not.toContain('01137/2016');
  });

  it('skips rows with no name and marks archived clients inactive', () => {
    const missing = drafts.find((draft) => draft.externalRef === 'jobber:400');
    expect(missing?.skipReason).toBe('missing_name');
    const archived = drafts.find((draft) => draft.externalRef === 'jobber:500');
    expect(archived?.status).toBe('inactive');
    expect(archived?.firstName).toBe('Archived');
  });

  it('normalizes a parenthetical state', () => {
    const draftsFromState = jobberDrafts(
      [
        'J-ID,First Name,Last Name,Service Street 1,Service State,E-mails',
        '9_1,Sam,Lee,1 Main St,Florida (Pelican Preserve),sam@example.com',
      ].join('\n'),
    );
    expect(draftsFromState[0]?.properties[0]?.state).toBe('FL');
    expect(draftsFromState[0]?.properties[0]?.siteNotes).toContain('Pelican Preserve');
  });
});

describe('customer import matching', () => {
  const csv = readFileSync(fixturePath, 'utf8');
  const drafts = jobberDrafts(csv).filter((draft) => draft.externalRef === 'jobber:100');

  it('skips a customer that was already imported with the same properties', () => {
    const [draft] = drafts;
    const dispositions = disposeCustomerImportDrafts(
      [draft!],
      [
        {
          customerId: 'existing-1',
          externalRef: 'jobber:100',
          email: 'a@example.com',
          phone: '+12395550100',
          lastName: 'Smith',
          properties: [
            { addressLine1: '10 Palm St', postalCode: '33957' },
            { addressLine1: '20 Gulf Dr', postalCode: '33940' },
          ],
        },
      ],
      { skipArchived: true },
    );
    expect(dispositions[0]?.action).toBe('skip');
    expect(dispositions[0]?.skipReason).toBe('duplicate');
    expect(dispositions[0]?.propertiesToAdd).toHaveLength(0);
  });

  it('adds a property that is not already on the matched customer', () => {
    const [draft] = drafts;
    const dispositions = disposeCustomerImportDrafts(
      [draft!],
      [
        {
          customerId: 'existing-1',
          externalRef: 'jobber:100',
          email: null,
          phone: null,
          lastName: null,
          properties: [{ addressLine1: '10 Palm St', postalCode: '33957' }],
        },
      ],
      { skipArchived: true },
    );
    expect(dispositions[0]?.action).toBe('add_properties');
    expect(dispositions[0]?.propertiesToAdd.map((property) => property.addressLine1)).toEqual([
      '20 Gulf Dr',
    ]);
  });

  it('does not create archived clients when skip archived is on', () => {
    const archived = jobberDrafts(csv).find((draft) => draft.externalRef === 'jobber:500');
    const dispositions = disposeCustomerImportDrafts([archived!], [], { skipArchived: true });
    expect(dispositions[0]?.action).toBe('skip');
    expect(dispositions[0]?.skipReason).toBe('archived');
  });

  it('turns service address columns into a linked property', () => {
    const drafts = jobberDrafts(
      [
        'J-ID,First Name,Last Name,Service Property Name,Service Address,Service City,Service Province,Service Zip code',
        '900_1,Riley,Chen,Lake house,88 Lake Rd,Naples,FL,34102',
      ].join('\n'),
    );
    expect(drafts[0]?.properties).toEqual([
      expect.objectContaining({
        label: 'Lake house',
        addressLine1: '88 Lake Rd',
        city: 'Naples',
        state: 'FL',
        postalCode: '34102',
        isPrimary: true,
      }),
    ]);
  });
});

describe('customer import plan limit', () => {
  it('blocks a preview that would reach the active customer cap', () => {
    expect(customerImportExceedsPlan(499, 1, 500)).toBe(true);
    expect(customerImportExceedsPlan(100, 10, null)).toBe(false);
    expect(customerImportExceedsPlan(10, 0, 10)).toBe(false);

    const preview = buildCustomerImportPreview({
      source: 'jobber',
      dispositions: [
        {
          draft: {
            source: 'jobber',
            externalRef: 'jobber:1',
            firstName: 'Sam',
            lastName: 'Lee',
            email: null,
            phone: null,
            companyName: null,
            internalNotes: null,
            status: 'active',
            properties: [],
            warnings: [],
          },
          action: 'create',
          matchedCustomerId: null,
          propertiesToAdd: [],
          skipReason: null,
        },
      ],
      mappedColumns: ['J-ID'],
      ignoredColumns: [],
      usedCustomers: 499,
      customerLimit: 500,
    });
    expect(preview.plan.blocked).toBe(true);
    expect(preview.counts.newCustomers).toBe(1);
  });
});
