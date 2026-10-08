export type LatLng = {
  lat: number;
  lng: number;
};

/** Minutes from local midnight on the plan day. */
export type MinuteInterval = {
  startMin: number;
  endMin: number;
};

export type ExperienceLevel = 'new' | 'standard' | 'lead';

export type OptimizerExistingJob = {
  id: string;
  startMin: number;
  endMin: number;
  location: LatLng | null;
  zoneId: string | null;
  postalCode: string | null;
  buildingKey: string | null;
};

/**
 * One person the optimizer may place on a job.
 * Empty lists mean "no restriction recorded" and matching factors skip instead of failing.
 */
export type OptimizerCrewMember = {
  userId: string;
  home: LatLng | null;
  office: LatLng | null;
  availableStartMin: number;
  availableEndMin: number;
  timeOff: MinuteInterval[];
  existingJobs: OptimizerExistingJob[];
  skillTags: string[];
  certificationTags: string[];
  equipmentTags: string[];
  /** Who may enter a home: for example female, non-smoker, bonded. */
  attributeTags: string[];
  languageCodes: string[];
  /** Empty means every property kind is allowed. */
  propertyKinds: string[];
  handlesPets: boolean;
  handlesChemicalSensitivity: boolean;
  maxJobsPerDay: number | null;
  maxMinutesPerDay: number | null;
  maxDriveMinutesBetweenStops: number | null;
  preferredZoneIds: string[];
  preferredPartnerIds: string[];
  avoidPartnerIds: string[];
  experienceLevel: ExperienceLevel;
  priorWeekendJobs: number;
  isWeekend: boolean;
};

export type OptimizerJob = {
  id: string;
  durationMinutes: number;
  location: LatLng | null;
  zoneId: string | null;
  postalCode: string | null;
  /** Same key batches units in one building or office suite. */
  buildingKey: string | null;
  propertyKind: string;
  preferredUserIds: string[];
  /** When the required-cleaners factor is on, every id here must be on the crew. */
  requiredUserIds: string[];
  blockedUserIds: string[];
  requiredSkillTags: string[];
  requiredCertificationTags: string[];
  requiredEquipmentTags: string[];
  requiredAttributeTags: string[];
  languageCodes: string[];
  petInHome: boolean;
  chemicalSensitivity: boolean;
  requiredCrewSize: number;
  arrivalWindow: MinuteInterval | null;
  /** Commercial open hours, gate hours, or other site access limits. */
  accessWindow: MinuteInterval | null;
  /** 1 = standard, 5 = drop-everything priority. */
  priority: number;
  revenueCents: number;
  recurringAnchorUserId: string | null;
  /** Standing local start the customer expects, when they have one. */
  standingStartMin: number | null;
  isFirstVisit: boolean;
  requiresKeyPickup: boolean;
  /** Already-published assignee set. Stability prefers to keep it. */
  lockedAssigneeIds: string[] | null;
  lockedStartMin: number | null;
};

export type FactorMode = 'hard' | 'soft';

export type FactorSetting = {
  enabled: boolean;
  /** 0–100. Hard factors still reject failures when the weight is 0. */
  weight: number;
  mode: FactorMode;
};

export type ScheduleOptimizerAssumptions = {
  /** Used to turn straight-line miles into drive minutes. */
  travelSpeedMph: number;
  /** Paid transition time kept between back-to-back jobs. */
  bufferMinutes: number;
  /** Drive length that scores as a zero on travel factors. */
  maxDriveMinutes: number;
};

export type ScheduleOptimizerPolicy = {
  factors: Record<string, FactorSetting>;
  assumptions: ScheduleOptimizerAssumptions;
};

export type FactorContribution = {
  factorId: string;
  score: number;
  weight: number;
  note: string;
};

export type PlannedAssignment = {
  jobId: string;
  userIds: string[];
  startMin: number;
  endMin: number;
  travelMinutesBefore: number;
  /** Weighted soft score from 0 to 1. Hard failures never produce an assignment. */
  score: number;
  contributions: FactorContribution[];
};

export type UnassignedJob = {
  jobId: string;
  reasons: string[];
};

export type OptimizedDayPlan = {
  assignments: PlannedAssignment[];
  unassigned: UnassignedJob[];
};

export type PlanDayInput = {
  jobs: OptimizerJob[];
  crew: OptimizerCrewMember[];
  policy: ScheduleOptimizerPolicy;
};
