export type QuoteScopeTemplateId =
  | 'residential_standard'
  | 'commercial_office'
  | 'move_out_deep'
  | 'custom';

export interface QuoteScopeTemplate {
  id: QuoteScopeTemplateId;
  label: string;
  inclusions: string[];
  defaultExclusions: string;
}

export const QUOTE_SCOPE_TEMPLATES: QuoteScopeTemplate[] = [
  {
    id: 'residential_standard',
    label: 'Residential — standard clean',
    inclusions: [
      'Kitchen counters and appliances (exterior)',
      'Bathrooms — disinfect and detail',
      'Dusting — all reachable surfaces',
      'Floors — vacuum and mop',
      'Trash removal — common areas',
    ],
    defaultExclusions:
      'Exterior windows, inside cabinets, hoarding-level clutter, mold remediation, moving furniture over 25 lbs.',
  },
  {
    id: 'commercial_office',
    label: 'Commercial — office lite',
    inclusions: [
      'Desks and work surfaces',
      'Break room counters and sink',
      'Restrooms — disinfect',
      'Floors — vacuum and mop open areas',
      'Trash and recycling',
    ],
    defaultExclusions:
      'Server rooms, exterior windows, after-hours alarm disarm (customer must provide), biohazard cleanup.',
  },
  {
    id: 'move_out_deep',
    label: 'Move-out deep clean',
    inclusions: [
      'Inside oven and refrigerator',
      'Inside cabinets and drawers',
      'Baseboards and door frames',
      'Bathrooms — full detail',
      'All floors — vacuum and mop',
    ],
    defaultExclusions: 'Carpet steam extraction, exterior windows, paint touch-up, junk removal.',
  },
  {
    id: 'custom',
    label: 'Custom',
    inclusions: [],
    defaultExclusions: '',
  },
];

export interface QuoteAddonTemplate {
  service_label: string;
  amount_dollars: string;
  frequency: 'one_time' | 'weekly' | 'biweekly' | 'monthly';
  frequency_detail?: string;
}

export const QUOTE_ADDON_LIBRARY: QuoteAddonTemplate[] = [
  { service_label: 'Inside oven', amount_dollars: '45.00', frequency: 'one_time' },
  { service_label: 'Inside fridge', amount_dollars: '35.00', frequency: 'one_time' },
  { service_label: 'Garage sweep', amount_dollars: '60.00', frequency: 'one_time' },
  { service_label: 'Laundry — fold only', amount_dollars: '25.00', frequency: 'weekly' },
  { service_label: 'Pet hair surcharge', amount_dollars: '20.00', frequency: 'biweekly' },
];
