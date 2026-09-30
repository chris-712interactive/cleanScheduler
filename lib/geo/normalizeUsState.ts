const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

const NAME_TO_CODE: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
  ),
  'district of columbia': 'DC',
  'washington dc': 'DC',
  'washington d.c': 'DC',
};

/** Normalize free-text CSV state values to a 2-letter US code, or null. */
export function normalizeUsState(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase().replace(/\./g, '');
  if (STATE_NAMES[upper]) return upper;

  const lower = trimmed.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  if (NAME_TO_CODE[lower]) return NAME_TO_CODE[lower];

  const codePrefix = upper.match(/^([A-Z]{2})\b/);
  const maybeCode = codePrefix?.[1];
  if (maybeCode && STATE_NAMES[maybeCode]) return maybeCode;

  return null;
}

export function usStateLabel(code: string): string {
  if (code === 'unknown') return 'Unknown state';
  return STATE_NAMES[code] ?? code;
}
