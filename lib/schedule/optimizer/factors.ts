import type { FactorMode, FactorSetting } from '@/lib/schedule/optimizer/types';

export type ScheduleFactorCategory =
  | 'Crew eligibility'
  | 'Customer fit'
  | 'Time windows'
  | 'Travel and route'
  | 'Workload and fairness';

export type ScheduleFactorDefinition = {
  id: string;
  label: string;
  description: string;
  category: ScheduleFactorCategory;
  defaultEnabled: boolean;
  defaultWeight: number;
  defaultMode: FactorMode;
  /** When false the factor only nudges the score and cannot reject a plan. */
  allowHard: boolean;
  /** Enabled factors in this set always reject failures. Soft mode cannot stack two jobs. */
  forceHard?: boolean;
};

export const SCHEDULE_FACTOR_CATEGORIES: ScheduleFactorCategory[] = [
  'Crew eligibility',
  'Customer fit',
  'Time windows',
  'Travel and route',
  'Workload and fairness',
];

/**
 * Every knob a cleaning company can weight. Missing source data makes a factor
 * skip that job instead of punishing the crew — a residential route with no
 * skill tags still schedules.
 */
export const SCHEDULE_FACTORS = [
  {
    id: 'crew_availability',
    label: 'Work window',
    description: 'The visit has to sit inside each person’s working hours for that weekday.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 100,
    defaultMode: 'hard',
    allowHard: true,
    forceHard: true,
  },
  {
    id: 'time_off',
    label: 'Time off',
    description: 'Approved time off blocks the person for the whole visit.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 100,
    defaultMode: 'hard',
    allowHard: true,
    forceHard: true,
  },
  {
    id: 'no_double_booking',
    label: 'No double booking',
    description: 'A person cannot be on two jobs at once, including jobs already on the calendar.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 100,
    defaultMode: 'hard',
    allowHard: true,
    forceHard: true,
  },
  {
    id: 'skill_match',
    label: 'Skills',
    description:
      'Floor care, post-construction, hoarding, green-only, and other skills required by the job.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 80,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'certification_match',
    label: 'Certifications',
    description:
      'Commercial site rules such as OSHA, insured-vendor badges, or floor-care certifications.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 70,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'equipment_match',
    label: 'Equipment',
    description:
      'The crew has to bring what the job needs: backpack vac, floor buffer, ladder, or a truck-mount.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 60,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'property_kind_fit',
    label: 'Residential or commercial fit',
    description:
      'Limit who can take houses, offices, or short-term rentals. People with no kinds listed can take every kind.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 70,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'crew_size',
    label: 'Crew size',
    description:
      'Large offices and move-out cleans can require two or more people on the same visit.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 100,
    defaultMode: 'hard',
    allowHard: true,
    forceHard: true,
  },
  {
    id: 'max_jobs_per_day',
    label: 'Max jobs per day',
    description:
      'Cap how many stops a person can take. Useful for leads, trainees, or part-time crews.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 80,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'max_hours_per_day',
    label: 'Max hours per day',
    description:
      'Cap paid job time per person so a long commercial clean does not swallow the day.',
    category: 'Crew eligibility',
    defaultEnabled: true,
    defaultWeight: 80,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'customer_blocked_crew',
    label: 'Blocked cleaners',
    description: 'Never send a cleaner this customer has asked you not to send.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 100,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'required_cleaners',
    label: 'Required cleaners',
    description: 'If the customer named specific people, those people have to be on the visit.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 90,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'preferred_cleaner',
    label: 'Preferred cleaner',
    description: 'Favor the cleaner the customer likes when several people could do the job.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 75,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'recurring_continuity',
    label: 'Same cleaner each visit',
    description: 'Keep the usual recurring cleaner so the customer sees a familiar face.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 80,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'language_match',
    label: 'Language',
    description:
      'Match a requested language for instructions, access, or commercial site contacts.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 40,
    defaultMode: 'soft',
    allowHard: true,
  },
  {
    id: 'pet_comfort',
    label: 'Pets in the home',
    description:
      'Skip cleaners who cannot work in homes with dogs or cats when the customer has pets.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 55,
    defaultMode: 'soft',
    allowHard: true,
  },
  {
    id: 'chemical_sensitivity',
    label: 'Chemical sensitivity',
    description: 'Send cleaners who can run a fragrance-free or green-only clean.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 55,
    defaultMode: 'soft',
    allowHard: true,
  },
  {
    id: 'attribute_match',
    label: 'Who can enter',
    description:
      'Honor requests such as a female cleaner, a non-smoker, or a bonded tech. Tags are yours to define.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 40,
    defaultMode: 'soft',
    allowHard: true,
  },
  {
    id: 'first_visit_experience',
    label: 'Lead on first visits',
    description: 'Put a lead or experienced cleaner on the first visit, estimate, or walkthrough.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 40,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'team_pairing',
    label: 'Team pairing',
    description:
      'Prefer people who are listed as good partners, and avoid pairs who should not ride together.',
    category: 'Customer fit',
    defaultEnabled: true,
    defaultWeight: 35,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'customer_arrival_window',
    label: 'Customer arrival window',
    description:
      'Start inside the window the customer asked for, such as morning-only or after school pickup.',
    category: 'Time windows',
    defaultEnabled: true,
    defaultWeight: 90,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'site_access_hours',
    label: 'Site access hours',
    description:
      'Offices, gated communities, and property managers often only allow crews during set hours.',
    category: 'Time windows',
    defaultEnabled: true,
    defaultWeight: 90,
    defaultMode: 'hard',
    allowHard: true,
  },
  {
    id: 'standing_appointment',
    label: 'Standing appointment time',
    description: 'Stay close to the usual clock time for a weekly or biweekly client.',
    category: 'Time windows',
    defaultEnabled: true,
    defaultWeight: 70,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'schedule_stability',
    label: 'Keep published times',
    description: 'Prefer not to move a visit that already has a cleaner and a start time.',
    category: 'Time windows',
    defaultEnabled: true,
    defaultWeight: 60,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'customer_priority',
    label: 'Customer priority',
    description: 'Higher-priority accounts get the tighter, earlier, lower-drive options first.',
    category: 'Time windows',
    defaultEnabled: true,
    defaultWeight: 45,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'travel_distance',
    label: 'Drive time',
    description: 'Shorter drives from home or from the previous stop score higher.',
    category: 'Travel and route',
    defaultEnabled: true,
    defaultWeight: 85,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'max_drive_between_stops',
    label: 'Max drive between stops',
    description: 'Reject or penalize hops longer than the person’s limit or your company limit.',
    category: 'Travel and route',
    defaultEnabled: true,
    defaultWeight: 50,
    defaultMode: 'soft',
    allowHard: true,
  },
  {
    id: 'route_efficiency',
    label: 'Route direction',
    description:
      'Prefer stops that continue in the same direction instead of bouncing back across town.',
    category: 'Travel and route',
    defaultEnabled: true,
    defaultWeight: 70,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'zone_clustering',
    label: 'Zone and neighborhood',
    description: 'Keep a person’s day inside one service zone or postal code when you can.',
    category: 'Travel and route',
    defaultEnabled: true,
    defaultWeight: 65,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'same_building_batch',
    label: 'Same building',
    description: 'Batch units in the same complex, office tower, or short-term rental building.',
    category: 'Travel and route',
    defaultEnabled: true,
    defaultWeight: 60,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'start_of_day_from_home',
    label: 'First stop near home',
    description: 'The first job of the day should be a reasonable drive from home base.',
    category: 'Travel and route',
    defaultEnabled: true,
    defaultWeight: 45,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'gap_compaction',
    label: 'Tight day',
    description: 'Avoid large unpaid gaps between the end of one job and the start of the next.',
    category: 'Travel and route',
    defaultEnabled: true,
    defaultWeight: 35,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'drive_vs_job_length',
    label: 'Drive versus job length',
    description:
      'A long drive for a short maintenance clean scores worse than the same drive for a deep clean.',
    category: 'Travel and route',
    defaultEnabled: true,
    defaultWeight: 30,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'key_pickup',
    label: 'Key or fob pickup',
    description:
      'Jobs that start with a key pickup prefer a day that begins at the office or lockbox.',
    category: 'Travel and route',
    defaultEnabled: true,
    defaultWeight: 20,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'workload_balance',
    label: 'Balance the team',
    description: 'Spread hours so one cleaner is not buried while another has an empty day.',
    category: 'Workload and fairness',
    defaultEnabled: true,
    defaultWeight: 40,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'overtime_avoidance',
    label: 'Stay under the daily target',
    description: 'Once a person nears their max hours, later jobs prefer someone with room left.',
    category: 'Workload and fairness',
    defaultEnabled: true,
    defaultWeight: 50,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'weekend_fairness',
    label: 'Weekend fairness',
    description: 'On Saturday and Sunday, prefer people who have worked fewer recent weekends.',
    category: 'Workload and fairness',
    defaultEnabled: true,
    defaultWeight: 25,
    defaultMode: 'soft',
    allowHard: false,
  },
  {
    id: 'job_value_placement',
    label: 'Valuable jobs on tight routes',
    description: 'Higher-revenue or higher-priority jobs get extra pull toward the closer crew.',
    category: 'Workload and fairness',
    defaultEnabled: true,
    defaultWeight: 30,
    defaultMode: 'soft',
    allowHard: false,
  },
] as const satisfies readonly ScheduleFactorDefinition[];

export type ScheduleFactorId = (typeof SCHEDULE_FACTORS)[number]['id'];

const FACTOR_BY_ID = new Map(SCHEDULE_FACTORS.map((factor) => [factor.id, factor]));

export function scheduleFactorDefinition(id: ScheduleFactorId): ScheduleFactorDefinition {
  const factor = FACTOR_BY_ID.get(id);
  if (!factor) {
    throw new Error(`Unknown schedule factor: ${id}`);
  }
  return factor;
}

export function factorIsForcedHard(id: ScheduleFactorId): boolean {
  return scheduleFactorDefinition(id).forceHard === true;
}

export function defaultFactorSetting(id: ScheduleFactorId): FactorSetting {
  const factor = scheduleFactorDefinition(id);
  return {
    enabled: factor.defaultEnabled,
    weight: factor.defaultWeight,
    mode: factor.allowHard ? factor.defaultMode : 'soft',
  };
}
