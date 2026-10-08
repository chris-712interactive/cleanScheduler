import { scheduleFactorDefinition, type ScheduleFactorId } from '@/lib/schedule/optimizer/factors';
import { clamp01, travelMinutesBetween } from '@/lib/schedule/optimizer/geo';
import { factorIsActive } from '@/lib/schedule/optimizer/policy';
import type {
  FactorContribution,
  LatLng,
  OptimizerCrewMember,
  OptimizerJob,
  OptimizedDayPlan,
  PlanDayInput,
  PlannedAssignment,
  ScheduleOptimizerPolicy,
} from '@/lib/schedule/optimizer/types';

const DAY_END_MIN = 24 * 60;

type PlacedBlock = {
  jobId: string;
  startMin: number;
  endMin: number;
  location: LatLng | null;
  zoneId: string | null;
  postalCode: string | null;
  buildingKey: string | null;
};

type SlotChoice = {
  team: OptimizerCrewMember[];
  startMin: number;
  endMin: number;
  travelMinutesBefore: number;
  score: number;
  contributions: FactorContribution[];
  prev: PlacedBlock | null;
};

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function tagSet(values: string[]): Set<string> {
  return new Set(values.map(normalizeTag).filter(Boolean));
}

function coversTags(required: string[], available: string[]): boolean {
  if (required.length === 0) return true;
  const have = tagSet(available);
  return required.every((tag) => have.has(normalizeTag(tag)));
}

function coveredFraction(required: string[], available: string[]): number | null {
  const needed = required.map(normalizeTag).filter(Boolean);
  if (needed.length === 0) return null;
  const have = tagSet(available);
  const hit = needed.filter((tag) => have.has(tag)).length;
  return hit / needed.length;
}

function unionTags(
  members: OptimizerCrewMember[],
  pick: (member: OptimizerCrewMember) => string[],
): string[] {
  const tags = new Set<string>();
  for (const member of members) {
    for (const tag of pick(member)) {
      const normalized = normalizeTag(tag);
      if (normalized) tags.add(normalized);
    }
  }
  return [...tags];
}

function isHard(policy: ScheduleOptimizerPolicy, id: ScheduleFactorId): boolean {
  const setting = factorIsActive(policy, id);
  return setting?.mode === 'hard';
}

function shiftBounds(
  member: OptimizerCrewMember,
  policy: ScheduleOptimizerPolicy,
): {
  startMin: number;
  endMin: number;
} {
  if (!factorIsActive(policy, 'crew_availability')) {
    return { startMin: 0, endMin: DAY_END_MIN };
  }
  return {
    startMin: member.availableStartMin,
    endMin: member.availableEndMin,
  };
}

function memberJobBlocks(member: OptimizerCrewMember, extra: PlacedBlock[]): PlacedBlock[] {
  const existing: PlacedBlock[] = member.existingJobs.map((job) => ({
    jobId: job.id,
    startMin: job.startMin,
    endMin: job.endMin,
    location: job.location,
    zoneId: job.zoneId,
    postalCode: job.postalCode,
    buildingKey: job.buildingKey,
  }));
  return [...existing, ...extra].sort(
    (a, b) => a.startMin - b.startMin || a.jobId.localeCompare(b.jobId),
  );
}

type Occupied = { startMin: number; endMin: number };

function occupiedIntervals(
  member: OptimizerCrewMember,
  extra: PlacedBlock[],
  policy: ScheduleOptimizerPolicy,
): Occupied[] {
  const intervals: Occupied[] = [];
  if (factorIsActive(policy, 'no_double_booking')) {
    for (const block of memberJobBlocks(member, extra)) {
      intervals.push({ startMin: block.startMin, endMin: block.endMin });
    }
  }
  if (factorIsActive(policy, 'time_off')) {
    for (const span of member.timeOff) {
      intervals.push(span);
    }
  }
  return intervals
    .filter((interval) => interval.endMin > interval.startMin)
    .sort((a, b) => a.startMin - b.startMin);
}

function freeGaps(
  bounds: { startMin: number; endMin: number },
  occupied: Occupied[],
): Array<{ lo: number; hi: number }> {
  if (bounds.endMin <= bounds.startMin) return [];
  const gaps: Array<{ lo: number; hi: number }> = [];
  let cursor = bounds.startMin;
  for (const interval of occupied) {
    const lo = Math.max(interval.startMin, bounds.startMin);
    const hi = Math.min(interval.endMin, bounds.endMin);
    if (hi <= lo) continue;
    if (lo > cursor) gaps.push({ lo: cursor, hi: lo });
    cursor = Math.max(cursor, hi);
  }
  if (cursor < bounds.endMin) gaps.push({ lo: cursor, hi: bounds.endMin });
  return gaps;
}

function previousBlock(blocks: PlacedBlock[], atMin: number): PlacedBlock | null {
  let previous: PlacedBlock | null = null;
  for (const block of blocks) {
    if (block.endMin <= atMin) previous = block;
    else break;
  }
  return previous;
}

function nextBlock(blocks: PlacedBlock[], afterMin: number): PlacedBlock | null {
  for (const block of blocks) {
    if (block.startMin >= afterMin) return block;
  }
  return null;
}

function blockBefore(blocks: PlacedBlock[], block: PlacedBlock | null): PlacedBlock | null {
  if (!block) return null;
  let previous: PlacedBlock | null = null;
  for (const candidate of blocks) {
    if (candidate.jobId === block.jobId) break;
    previous = candidate;
  }
  return previous;
}

function hardWindow(
  job: OptimizerJob,
  policy: ScheduleOptimizerPolicy,
): {
  startMin: number;
  endMin: number;
} {
  let startMin = Number.NEGATIVE_INFINITY;
  let endMin = Number.POSITIVE_INFINITY;
  if (isHard(policy, 'customer_arrival_window') && job.arrivalWindow) {
    startMin = Math.max(startMin, job.arrivalWindow.startMin);
    endMin = Math.min(endMin, job.arrivalWindow.endMin);
  }
  if (isHard(policy, 'site_access_hours') && job.accessWindow) {
    startMin = Math.max(startMin, job.accessWindow.startMin);
    endMin = Math.min(endMin, job.accessWindow.endMin);
  }
  return { startMin, endMin };
}

function personStaticFailure(
  member: OptimizerCrewMember,
  job: OptimizerJob,
  policy: ScheduleOptimizerPolicy,
): string | null {
  if (isHard(policy, 'customer_blocked_crew') && job.blockedUserIds.includes(member.userId)) {
    return 'A blocked cleaner was the only option.';
  }
  if (
    isHard(policy, 'property_kind_fit') &&
    member.propertyKinds.length > 0 &&
    !member.propertyKinds.map(normalizeTag).includes(normalizeTag(job.propertyKind))
  ) {
    return 'No cleaner is allowed to take this property type.';
  }
  if (
    isHard(policy, 'language_match') &&
    job.languageCodes.length > 0 &&
    !job.languageCodes.some((code) =>
      member.languageCodes.map(normalizeTag).includes(normalizeTag(code)),
    )
  ) {
    return 'No cleaner speaks a requested language.';
  }
  if (isHard(policy, 'pet_comfort') && job.petInHome && !member.handlesPets) {
    return 'No cleaner is marked as comfortable with pets.';
  }
  if (
    isHard(policy, 'chemical_sensitivity') &&
    job.chemicalSensitivity &&
    !member.handlesChemicalSensitivity
  ) {
    return 'No cleaner is marked for fragrance-free or sensitive cleans.';
  }
  if (
    isHard(policy, 'attribute_match') &&
    job.requiredAttributeTags.length > 0 &&
    !coversTags(job.requiredAttributeTags, member.attributeTags)
  ) {
    return 'No cleaner matches who the customer will allow in.';
  }
  return null;
}

function eligiblePeople(
  job: OptimizerJob,
  crew: OptimizerCrewMember[],
  policy: ScheduleOptimizerPolicy,
): { people: OptimizerCrewMember[]; failure: string | null } {
  const people: OptimizerCrewMember[] = [];
  const failures = new Set<string>();
  for (const member of crew) {
    const failure = personStaticFailure(member, job, policy);
    if (failure) failures.add(failure);
    else people.push(member);
  }
  if (people.length === 0) {
    return { people, failure: [...failures][0] ?? 'No cleaner is eligible.' };
  }
  return { people, failure: null };
}

function requiredTeamSize(job: OptimizerJob): number {
  return Math.max(1, job.requiredCrewSize, job.requiredUserIds.length);
}

function buildTeam(
  lead: OptimizerCrewMember,
  job: OptimizerJob,
  people: OptimizerCrewMember[],
): OptimizerCrewMember[] | null {
  const size = requiredTeamSize(job);
  const byId = new Map(people.map((person) => [person.userId, person]));
  if (!byId.has(lead.userId)) return null;

  const required = job.requiredUserIds
    .map((id) => byId.get(id))
    .filter((person): person is OptimizerCrewMember => Boolean(person));
  if (required.length !== job.requiredUserIds.length) return null;
  if (job.requiredUserIds.length > 0 && !job.requiredUserIds.includes(lead.userId) && size === 1) {
    return null;
  }

  const team: OptimizerCrewMember[] = [];
  const push = (person: OptimizerCrewMember) => {
    if (!team.some((member) => member.userId === person.userId)) team.push(person);
  };
  push(lead);
  for (const person of required) push(person);

  const missing = (tags: string[], pick: (member: OptimizerCrewMember) => string[]) =>
    tags.filter((tag) => !coversTags([tag], unionTags(team, pick)));

  const pool = people
    .filter((person) => !team.some((member) => member.userId === person.userId))
    .sort((a, b) => a.userId.localeCompare(b.userId));

  while (team.length < size && pool.length > 0) {
    const skillGaps = missing(job.requiredSkillTags, (member) => member.skillTags);
    const certGaps = missing(job.requiredCertificationTags, (member) => member.certificationTags);
    const gearGaps = missing(job.requiredEquipmentTags, (member) => member.equipmentTags);
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    pool.forEach((person, index) => {
      const covers =
        skillGaps.filter((tag) => coversTags([tag], person.skillTags)).length +
        certGaps.filter((tag) => coversTags([tag], person.certificationTags)).length +
        gearGaps.filter((tag) => coversTags([tag], person.equipmentTags)).length;
      const pairing = lead.preferredPartnerIds.includes(person.userId)
        ? 2
        : lead.avoidPartnerIds.includes(person.userId)
          ? -2
          : 0;
      const score = covers * 10 + pairing;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    const [next] = pool.splice(bestIndex, 1);
    if (next) push(next);
  }

  if (team.length < size) return null;
  if (job.requiredUserIds.some((id) => !team.some((member) => member.userId === id))) return null;
  return team.slice(0, Math.max(size, required.length));
}

function candidateTeams(job: OptimizerJob, people: OptimizerCrewMember[]): OptimizerCrewMember[][] {
  const leads =
    job.requiredUserIds.length > 0
      ? people.filter((person) => job.requiredUserIds.includes(person.userId))
      : people;
  const teams: OptimizerCrewMember[][] = [];
  const seen = new Set<string>();
  for (const lead of leads) {
    const team = buildTeam(lead, job, people);
    if (!team) continue;
    const key = team
      .map((member) => member.userId)
      .sort()
      .join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    teams.push(team);
  }
  return teams;
}

function travelInto(
  member: OptimizerCrewMember,
  blocks: PlacedBlock[],
  job: OptimizerJob,
  gapLo: number,
  bufferMinutes: number,
  travelSpeedMph: number,
): { earliest: number; travel: number | null; prev: PlacedBlock | null } {
  const prev = previousBlock(blocks, gapLo + 0.001);
  const from = prev?.location ?? member.home;
  const travel = travelMinutesBetween(from, job.location, travelSpeedMph);
  const travelMinutes = travel ?? 0;
  const earliest = prev
    ? Math.max(gapLo, prev.endMin + bufferMinutes + travelMinutes)
    : Math.max(gapLo, member.availableStartMin + travelMinutes);
  return { earliest, travel, prev };
}

function memberCanHost(
  member: OptimizerCrewMember,
  extra: PlacedBlock[],
  job: OptimizerJob,
  startMin: number,
  endMin: number,
  policy: ScheduleOptimizerPolicy,
): { ok: boolean; travel: number | null; prev: PlacedBlock | null; reason: string | null } {
  const bounds = shiftBounds(member, policy);
  if (startMin < bounds.startMin || endMin > bounds.endMin) {
    return { ok: false, travel: null, prev: null, reason: 'Outside working hours.' };
  }
  const blocks = factorIsActive(policy, 'no_double_booking') ? memberJobBlocks(member, extra) : [];
  const occupied = occupiedIntervals(member, extra, policy);
  const overlaps = occupied.some(
    (interval) => startMin < interval.endMin && endMin > interval.startMin,
  );
  if (overlaps) {
    return { ok: false, travel: null, prev: null, reason: 'Overlaps another job or time off.' };
  }

  const { assumptions } = policy;
  const prev = previousBlock(blocks, startMin + 0.001);
  const from = prev?.location ?? member.home;
  const travel = travelMinutesBetween(from, job.location, assumptions.travelSpeedMph);
  const departFloor = prev
    ? prev.endMin + assumptions.bufferMinutes + (travel ?? 0)
    : member.availableStartMin + (travel ?? 0);
  if (startMin + 0.001 < departFloor) {
    return { ok: false, travel, prev, reason: 'Not enough drive time before this stop.' };
  }

  const next = nextBlock(blocks, endMin - 0.001);
  if (next) {
    const onward =
      travelMinutesBetween(job.location, next.location, assumptions.travelSpeedMph) ?? 0;
    if (endMin + assumptions.bufferMinutes + onward > next.startMin + 0.001) {
      return { ok: false, travel, prev, reason: 'Not enough drive time to the next pinned job.' };
    }
  }

  return { ok: true, travel, prev, reason: null };
}

function loadMinutes(member: OptimizerCrewMember, extra: PlacedBlock[]): number {
  const jobs = memberJobBlocks(member, extra);
  return jobs.reduce((sum, block) => sum + (block.endMin - block.startMin), 0);
}

function jobCount(member: OptimizerCrewMember, extra: PlacedBlock[]): number {
  return memberJobBlocks(member, extra).length;
}

type ScoreContext = {
  job: OptimizerJob;
  team: OptimizerCrewMember[];
  lead: OptimizerCrewMember;
  startMin: number;
  endMin: number;
  travelMinutes: number | null;
  prev: PlacedBlock | null;
  earlier: PlacedBlock | null;
  idleMinutes: number | null;
  crewLoadMinutes: number;
  busiestLoadMinutes: number;
  extras: Map<string, PlacedBlock[]>;
  policy: ScheduleOptimizerPolicy;
};

function scoreTravel(ctx: ScoreContext): number | null {
  if (ctx.travelMinutes == null) return null;
  return clamp01(1 - ctx.travelMinutes / ctx.policy.assumptions.maxDriveMinutes);
}

function windowFit(
  startMin: number,
  endMin: number,
  window: { startMin: number; endMin: number } | null,
): number | null {
  if (!window) return null;
  const inside = startMin >= window.startMin && endMin <= window.endMin;
  return inside ? 1 : 0;
}

function directionScore(
  earlier: PlacedBlock | null,
  prev: PlacedBlock | null,
  job: OptimizerJob,
): number | null {
  if (!earlier?.location || !prev?.location || !job.location) return null;
  const inboundLng = prev.location.lng - earlier.location.lng;
  const inboundLat = prev.location.lat - earlier.location.lat;
  const outboundLng = job.location.lng - prev.location.lng;
  const outboundLat = job.location.lat - prev.location.lat;
  const inbound = Math.hypot(inboundLng, inboundLat);
  const outbound = Math.hypot(outboundLng, outboundLat);
  if (inbound === 0 || outbound === 0) return null;
  const dot = (inboundLng * outboundLng + inboundLat * outboundLat) / (inbound * outbound);
  return clamp01((dot + 1) / 2);
}

function evaluateFactors(ctx: ScoreContext): {
  hardFailure: string | null;
  contributions: FactorContribution[];
} {
  const { job, team, lead, policy } = ctx;
  const contributions: FactorContribution[] = [];
  const unionSkills = unionTags(team, (member) => member.skillTags);
  const unionCerts = unionTags(team, (member) => member.certificationTags);
  const unionGear = unionTags(team, (member) => member.equipmentTags);

  const consider = (
    id: ScheduleFactorId,
    score: number | null,
    hardFailure: string | null,
    note: string,
  ) => {
    const setting = factorIsActive(policy, id);
    if (!setting || score == null) return;
    if (hardFailure && setting.mode === 'hard') {
      contributions.push({ factorId: id, score: 0, weight: setting.weight, note: hardFailure });
      return;
    }
    contributions.push({
      factorId: id,
      score: clamp01(score),
      weight: setting.weight,
      note: hardFailure && score < 1 ? hardFailure : note,
    });
  };

  const skillScore = coveredFraction(job.requiredSkillTags, unionSkills);
  consider(
    'skill_match',
    skillScore,
    skillScore != null && skillScore < 1 ? 'The crew is missing a required skill.' : null,
    'Required skills covered by the crew.',
  );
  const certScore = coveredFraction(job.requiredCertificationTags, unionCerts);
  consider(
    'certification_match',
    certScore,
    certScore != null && certScore < 1 ? 'The crew is missing a required certification.' : null,
    'Required certifications covered by the crew.',
  );
  const gearScore = coveredFraction(job.requiredEquipmentTags, unionGear);
  consider(
    'equipment_match',
    gearScore,
    gearScore != null && gearScore < 1 ? 'The crew is missing required equipment.' : null,
    'Required equipment covered by the crew.',
  );

  const propertyOk = team.every(
    (member) =>
      member.propertyKinds.length === 0 ||
      member.propertyKinds.map(normalizeTag).includes(normalizeTag(job.propertyKind)),
  );
  consider(
    'property_kind_fit',
    team.some((member) => member.propertyKinds.length > 0) ? (propertyOk ? 1 : 0) : null,
    propertyOk ? null : 'A cleaner cannot take this property type.',
    'Crew can work this property type.',
  );

  consider('crew_size', 1, null, 'Crew is large enough.');
  consider('crew_availability', 1, null, 'Inside working hours.');
  consider('time_off', 1, null, 'Clear of time off.');
  consider('no_double_booking', 1, null, 'No overlapping job.');

  const overJobCap = team.some((member) => {
    if (member.maxJobsPerDay == null) return false;
    return jobCount(member, ctx.extras.get(member.userId) ?? []) + 1 > member.maxJobsPerDay;
  });
  consider(
    'max_jobs_per_day',
    team.some((member) => member.maxJobsPerDay != null) ? (overJobCap ? 0 : 1) : null,
    overJobCap ? 'A cleaner is already at their job cap.' : null,
    'Under the daily job cap.',
  );

  const overHourCap = team.some((member) => {
    if (member.maxMinutesPerDay == null) return false;
    return (
      loadMinutes(member, ctx.extras.get(member.userId) ?? []) + job.durationMinutes >
      member.maxMinutesPerDay
    );
  });
  consider(
    'max_hours_per_day',
    team.some((member) => member.maxMinutesPerDay != null) ? (overHourCap ? 0 : 1) : null,
    overHourCap ? 'A cleaner would go over their daily hour cap.' : null,
    'Under the daily hour cap.',
  );

  const blocked = team.some((member) => job.blockedUserIds.includes(member.userId));
  consider(
    'customer_blocked_crew',
    job.blockedUserIds.length > 0 ? (blocked ? 0 : 1) : null,
    blocked ? 'This customer blocked someone on the crew.' : null,
    'No blocked cleaner on the crew.',
  );

  const missingRequired =
    job.requiredUserIds.length > 0 &&
    job.requiredUserIds.some((id) => !team.some((member) => member.userId === id));
  consider(
    'required_cleaners',
    job.requiredUserIds.length > 0 ? (missingRequired ? 0 : 1) : null,
    missingRequired ? 'A required cleaner is not on the crew.' : null,
    'Required cleaners are on the crew.',
  );

  const preferredHit =
    job.preferredUserIds.length > 0 &&
    job.preferredUserIds.some((id) => team.some((member) => member.userId === id));
  consider(
    'preferred_cleaner',
    job.preferredUserIds.length > 0 ? (preferredHit ? 1 : 0) : null,
    null,
    preferredHit ? 'Includes a preferred cleaner.' : 'Does not include a preferred cleaner.',
  );

  consider(
    'recurring_continuity',
    job.recurringAnchorUserId
      ? team.some((member) => member.userId === job.recurringAnchorUserId)
        ? 1
        : 0
      : null,
    null,
    'Usual recurring cleaner.',
  );

  const languageHit =
    job.languageCodes.length === 0
      ? null
      : team.some((member) =>
            job.languageCodes.some((code) =>
              member.languageCodes.map(normalizeTag).includes(normalizeTag(code)),
            ),
          )
        ? 1
        : 0;
  consider(
    'language_match',
    languageHit,
    languageHit === 0 ? 'Nobody speaks a requested language.' : null,
    'Language match.',
  );

  consider(
    'pet_comfort',
    job.petInHome ? (team.every((member) => member.handlesPets) ? 1 : 0) : null,
    job.petInHome && team.some((member) => !member.handlesPets)
      ? 'Someone on the crew is not marked for homes with pets.'
      : null,
    'Comfortable with pets.',
  );
  consider(
    'chemical_sensitivity',
    job.chemicalSensitivity
      ? team.every((member) => member.handlesChemicalSensitivity)
        ? 1
        : 0
      : null,
    job.chemicalSensitivity && team.some((member) => !member.handlesChemicalSensitivity)
      ? 'Someone on the crew is not marked for sensitive cleans.'
      : null,
    'Can run a sensitive clean.',
  );

  const attributeScore =
    job.requiredAttributeTags.length === 0
      ? null
      : team.every((member) => coversTags(job.requiredAttributeTags, member.attributeTags))
        ? 1
        : 0;
  consider(
    'attribute_match',
    attributeScore,
    attributeScore === 0 ? 'Someone on the crew does not match who may enter.' : null,
    'Entry requirements match.',
  );

  if (job.isFirstVisit) {
    const experience = Math.max(
      ...team.map((member) =>
        member.experienceLevel === 'lead' ? 1 : member.experienceLevel === 'standard' ? 0.65 : 0.25,
      ),
    );
    consider('first_visit_experience', experience, null, 'Experience on a first visit.');
  }

  if (team.length > 1) {
    const partnerScores = team.slice(1).map((partner) => {
      if (lead.avoidPartnerIds.includes(partner.userId)) return 0;
      if (lead.preferredPartnerIds.includes(partner.userId)) return 1;
      return 0.5;
    });
    const pairing =
      partnerScores.reduce<number>((sum, score) => sum + score, 0) / partnerScores.length;
    consider('team_pairing', pairing, null, 'How well this pair works together.');
  }

  consider(
    'customer_arrival_window',
    windowFit(ctx.startMin, ctx.endMin, job.arrivalWindow),
    null,
    'Customer arrival window.',
  );
  consider(
    'site_access_hours',
    windowFit(ctx.startMin, ctx.endMin, job.accessWindow),
    null,
    'Site access hours.',
  );

  if (job.standingStartMin != null) {
    consider(
      'standing_appointment',
      clamp01(1 - Math.abs(ctx.startMin - job.standingStartMin) / 90),
      null,
      'Closeness to the standing start time.',
    );
  }

  if (job.lockedAssigneeIds || job.lockedStartMin != null) {
    const parts: number[] = [];
    if (job.lockedAssigneeIds) {
      const kept = job.lockedAssigneeIds.every((id) => team.some((member) => member.userId === id));
      parts.push(kept ? 1 : 0);
    }
    if (job.lockedStartMin != null) {
      parts.push(clamp01(1 - Math.abs(ctx.startMin - job.lockedStartMin) / 60));
    }
    consider(
      'schedule_stability',
      parts.reduce((sum, score) => sum + score, 0) / parts.length,
      null,
      'Keeps the published crew and time.',
    );
  }

  const priority = clamp01(job.priority / 5);
  const travelScore = scoreTravel(ctx);
  consider(
    'customer_priority',
    travelScore == null ? priority : clamp01(1 - (1 - travelScore) * priority),
    null,
    'Priority accounts pull toward shorter drives.',
  );

  consider('travel_distance', travelScore, null, 'Shorter drive into this stop.');

  const driveLimit = lead.maxDriveMinutesBetweenStops ?? policy.assumptions.maxDriveMinutes;
  if (ctx.travelMinutes != null && factorIsActive(policy, 'max_drive_between_stops')) {
    const within = ctx.travelMinutes <= driveLimit + 0.001;
    consider(
      'max_drive_between_stops',
      within ? 1 : 0,
      within ? null : 'The drive between stops is over the limit.',
      'Drive is within the stop-to-stop limit.',
    );
  }

  consider(
    'route_efficiency',
    directionScore(ctx.earlier, ctx.prev, job),
    null,
    'Continues in the same direction.',
  );

  if (ctx.prev && (job.zoneId || job.postalCode)) {
    const sameZone = Boolean(job.zoneId && ctx.prev.zoneId && job.zoneId === ctx.prev.zoneId);
    const samePostal = Boolean(
      job.postalCode &&
      ctx.prev.postalCode &&
      normalizeTag(job.postalCode) === normalizeTag(ctx.prev.postalCode),
    );
    const zonePreferred =
      lead.preferredZoneIds.length === 0 ||
      (job.zoneId != null && lead.preferredZoneIds.includes(job.zoneId));
    const cluster = sameZone ? 1 : samePostal ? 0.7 : 0.15;
    consider(
      'zone_clustering',
      zonePreferred ? cluster : cluster * 0.4,
      null,
      sameZone ? 'Same service zone as the previous stop.' : 'Neighborhood match.',
    );
  }

  if (ctx.prev?.buildingKey && job.buildingKey) {
    consider(
      'same_building_batch',
      ctx.prev.buildingKey === job.buildingKey ? 1 : 0,
      null,
      'Same building as the previous stop.',
    );
  }

  if (!ctx.prev) {
    consider('start_of_day_from_home', travelScore, null, 'First stop relative to home.');
  }

  if (ctx.idleMinutes != null) {
    consider(
      'gap_compaction',
      clamp01(1 - ctx.idleMinutes / 120),
      null,
      'Idle time before this job.',
    );
  }

  if (ctx.travelMinutes != null && job.durationMinutes > 0) {
    consider(
      'drive_vs_job_length',
      clamp01(1 - ctx.travelMinutes / job.durationMinutes),
      null,
      'Drive time compared with job length.',
    );
  }

  if (job.requiresKeyPickup) {
    const startsAtOffice = !ctx.prev;
    consider('key_pickup', startsAtOffice ? 1 : 0.35, null, 'Key pickup before a routed day.');
  }

  const busiest = Math.max(ctx.busiestLoadMinutes, 1);
  consider(
    'workload_balance',
    clamp01(1 - ctx.crewLoadMinutes / busiest),
    null,
    'Leaves room compared with the busiest cleaner.',
  );

  if (lead.maxMinutesPerDay != null && lead.maxMinutesPerDay > 0) {
    const used = (ctx.crewLoadMinutes + job.durationMinutes) / lead.maxMinutesPerDay;
    consider(
      'overtime_avoidance',
      clamp01(1 - Math.max(0, used - 0.85) / 0.15),
      null,
      'Room under the daily target.',
    );
  }

  if (lead.isWeekend) {
    consider(
      'weekend_fairness',
      clamp01(1 - lead.priorWeekendJobs / 4),
      null,
      'Fewer recent weekend shifts.',
    );
  }

  consider(
    'job_value_placement',
    travelScore == null ? null : travelScore * priority,
    null,
    'Valuable work on a short hop.',
  );

  const hardHit = contributions.find((entry) => {
    const setting = factorIsActive(policy, entry.factorId as ScheduleFactorId);
    return setting?.mode === 'hard' && entry.score < 1;
  });
  return { hardFailure: hardHit?.note ?? null, contributions };
}

function leadSlots(
  lead: OptimizerCrewMember,
  extra: PlacedBlock[],
  job: OptimizerJob,
  policy: ScheduleOptimizerPolicy,
): Array<{ startMin: number; endMin: number; travel: number | null; prev: PlacedBlock | null }> {
  const bounds = shiftBounds(lead, policy);
  const blocks = memberJobBlocks(lead, extra);
  const gaps = freeGaps(bounds, occupiedIntervals(lead, extra, policy));
  const window = hardWindow(job, policy);
  const slots: Array<{
    startMin: number;
    endMin: number;
    travel: number | null;
    prev: PlacedBlock | null;
  }> = [];

  for (const gap of gaps) {
    const approach = travelInto(
      lead,
      blocks,
      job,
      gap.lo,
      policy.assumptions.bufferMinutes,
      policy.assumptions.travelSpeedMph,
    );
    const startMin = Math.max(
      approach.earliest,
      Number.isFinite(window.startMin) ? window.startMin : gap.lo,
    );
    const endCap = Math.min(gap.hi, Number.isFinite(window.endMin) ? window.endMin : gap.hi);
    if (startMin + job.durationMinutes > endCap + 0.001) continue;

    const next = nextBlock(blocks, startMin + job.durationMinutes);
    if (next) {
      const onward =
        travelMinutesBetween(job.location, next.location, policy.assumptions.travelSpeedMph) ?? 0;
      const latestEnd = next.startMin - policy.assumptions.bufferMinutes - onward;
      if (startMin + job.durationMinutes > latestEnd + 0.001) continue;
    }

    slots.push({
      startMin,
      endMin: startMin + job.durationMinutes,
      travel: approach.travel,
      prev: approach.prev,
    });
  }
  return slots;
}

function scoreSlot(
  job: OptimizerJob,
  team: OptimizerCrewMember[],
  slot: { startMin: number; endMin: number; travel: number | null; prev: PlacedBlock | null },
  assigned: Map<string, PlacedBlock[]>,
  policy: ScheduleOptimizerPolicy,
  busiestLoadMinutes: number,
): SlotChoice | { failure: string } {
  const lead = team[0];
  if (!lead) return { failure: 'No lead cleaner.' };

  let travelMinutes = slot.travel;
  for (const member of team) {
    const hosted = memberCanHost(
      member,
      assigned.get(member.userId) ?? [],
      job,
      slot.startMin,
      slot.endMin,
      policy,
    );
    if (!hosted.ok) return { failure: hosted.reason ?? 'Crew cannot make this time.' };
    if (hosted.travel != null) {
      travelMinutes =
        travelMinutes == null ? hosted.travel : Math.max(travelMinutes, hosted.travel);
    }
  }

  const leadBlocks = memberJobBlocks(lead, assigned.get(lead.userId) ?? []);
  const prev = slot.prev;
  const idleMinutes = prev
    ? Math.max(
        0,
        slot.startMin - (prev.endMin + policy.assumptions.bufferMinutes + (slot.travel ?? 0)),
      )
    : null;

  const crewLoadMinutes = Math.max(
    ...team.map((member) => loadMinutes(member, assigned.get(member.userId) ?? [])),
  );

  const evaluated = evaluateFactors({
    job,
    team,
    lead,
    startMin: slot.startMin,
    endMin: slot.endMin,
    travelMinutes,
    prev,
    earlier: blockBefore(leadBlocks, prev),
    idleMinutes,
    crewLoadMinutes,
    busiestLoadMinutes: Math.max(busiestLoadMinutes, crewLoadMinutes + job.durationMinutes),
    extras: assigned,
    policy,
  });
  if (evaluated.hardFailure) return { failure: evaluated.hardFailure };

  const weighted = evaluated.contributions.filter((entry) => entry.weight > 0);
  const weightSum = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const score =
    weightSum === 0
      ? 1
      : weighted.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / weightSum;

  return {
    team,
    startMin: slot.startMin,
    endMin: slot.endMin,
    travelMinutesBefore: travelMinutes ?? 0,
    score,
    contributions: evaluated.contributions.sort((a, b) => b.weight - a.weight),
    prev,
  };
}

function jobSortKey(job: OptimizerJob): [number, number, number, number, string] {
  const locked = job.lockedStartMin != null || (job.lockedAssigneeIds?.length ?? 0) > 0 ? 0 : 1;
  const windowWidth = job.arrivalWindow
    ? Math.max(0, job.arrivalWindow.endMin - job.arrivalWindow.startMin)
    : DAY_END_MIN;
  return [locked, windowWidth, -job.priority, -job.durationMinutes, job.id];
}

function compareKeys(
  a: [number, number, number, number, string],
  b: [number, number, number, number, string],
): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  if (a[2] !== b[2]) return a[2] - b[2];
  if (a[3] !== b[3]) return a[3] - b[3];
  return a[4].localeCompare(b[4]);
}

/**
 * Builds one day's crew plan.
 * Tight arrival windows and already-published visits are placed first.
 * Each open job is inserted into the feasible gap that scores highest under the company policy.
 * Existing jobs stay pinned. People without coordinates still schedule; travel factors skip those hops.
 */
export function planOptimizedDay(input: PlanDayInput): OptimizedDayPlan {
  const { policy } = input;
  const assigned = new Map<string, PlacedBlock[]>();
  for (const member of input.crew) assigned.set(member.userId, []);

  const assignments: PlannedAssignment[] = [];
  const unassigned: OptimizedDayPlan['unassigned'] = [];

  const jobs = [...input.jobs].sort((a, b) => compareKeys(jobSortKey(a), jobSortKey(b)));

  for (const job of jobs) {
    if (job.durationMinutes <= 0) {
      unassigned.push({ jobId: job.id, reasons: ['This job needs a duration longer than zero.'] });
      continue;
    }

    const { people, failure } = eligiblePeople(job, input.crew, policy);
    const teams = candidateTeams(job, people);
    if (teams.length === 0) {
      unassigned.push({
        jobId: job.id,
        reasons: [
          failure ??
            (isHard(policy, 'required_cleaners') && job.requiredUserIds.length > 0
              ? 'A required cleaner is not available.'
              : 'Not enough eligible people to fill the crew.'),
        ],
      });
      continue;
    }

    const busiestLoadMinutes = Math.max(
      1,
      ...input.crew.map((member) => loadMinutes(member, assigned.get(member.userId) ?? [])),
    );

    let best: SlotChoice | null = null;
    const failures = new Set<string>();
    for (const team of teams) {
      const lead = team[0];
      if (!lead) continue;
      const slots = leadSlots(lead, assigned.get(lead.userId) ?? [], job, policy);
      if (slots.length === 0) {
        failures.add('No open time fits this job and the drive into it.');
        continue;
      }
      for (const slot of slots) {
        const scored = scoreSlot(job, team, slot, assigned, policy, busiestLoadMinutes);
        if ('failure' in scored) {
          failures.add(scored.failure);
          continue;
        }
        if (
          !best ||
          scored.score > best.score + 1e-9 ||
          (Math.abs(scored.score - best.score) <= 1e-9 &&
            (scored.travelMinutesBefore < best.travelMinutesBefore ||
              (scored.travelMinutesBefore === best.travelMinutesBefore &&
                scored.team[0]!.userId.localeCompare(best.team[0]!.userId) < 0)))
        ) {
          best = scored;
        }
      }
    }

    if (!best) {
      unassigned.push({
        jobId: job.id,
        reasons: [...failures].slice(0, 5),
      });
      continue;
    }

    const block: PlacedBlock = {
      jobId: job.id,
      startMin: best.startMin,
      endMin: best.endMin,
      location: job.location,
      zoneId: job.zoneId,
      postalCode: job.postalCode,
      buildingKey: job.buildingKey,
    };
    for (const member of best.team) {
      const list = assigned.get(member.userId) ?? [];
      list.push(block);
      assigned.set(member.userId, list);
    }
    assignments.push({
      jobId: job.id,
      userIds: best.team.map((member) => member.userId),
      startMin: best.startMin,
      endMin: best.endMin,
      travelMinutesBefore: Math.round(best.travelMinutesBefore * 10) / 10,
      score: Math.round(best.score * 1000) / 1000,
      contributions: best.contributions,
    });
  }

  return { assignments, unassigned };
}

export function topContributions(assignment: PlannedAssignment, limit = 3): FactorContribution[] {
  return [...assignment.contributions]
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, limit);
}

export function factorLabel(id: string): string {
  try {
    return scheduleFactorDefinition(id as ScheduleFactorId).label;
  } catch {
    return id;
  }
}
