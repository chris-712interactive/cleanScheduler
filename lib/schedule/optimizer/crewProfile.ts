import type { Database } from '@/lib/supabase/database.types';

export type CrewSchedulingProfile = {
  skillTags: string[];
  certificationTags: string[];
  equipmentTags: string[];
  attributeTags: string[];
  languageCodes: string[];
  propertyKinds: string[];
  handlesPets: boolean;
  handlesChemicalSensitivity: boolean;
  experienceLevel: string;
  maxJobsPerDay: number | null;
  maxMinutesPerDay: number | null;
  maxDriveMinutes: number | null;
  preferredZoneIds: string[];
  preferredPartnerIds: string[];
  avoidPartnerIds: string[];
  homeAddressLine1: string;
  homeCity: string;
  homeState: string;
  homePostalCode: string;
};

type Row = Database['public']['Tables']['tenant_member_scheduling_profiles']['Row'];

export function emptyCrewSchedulingProfile(): CrewSchedulingProfile {
  return {
    skillTags: [],
    certificationTags: [],
    equipmentTags: [],
    attributeTags: [],
    languageCodes: [],
    propertyKinds: [],
    handlesPets: true,
    handlesChemicalSensitivity: true,
    experienceLevel: 'standard',
    maxJobsPerDay: null,
    maxMinutesPerDay: null,
    maxDriveMinutes: null,
    preferredZoneIds: [],
    preferredPartnerIds: [],
    avoidPartnerIds: [],
    homeAddressLine1: '',
    homeCity: '',
    homeState: '',
    homePostalCode: '',
  };
}

export function crewSchedulingProfileFromRow(row: Row | null): CrewSchedulingProfile {
  if (!row) return emptyCrewSchedulingProfile();
  return {
    skillTags: row.skill_tags,
    certificationTags: row.certification_tags,
    equipmentTags: row.equipment_tags,
    attributeTags: row.attribute_tags,
    languageCodes: row.language_codes,
    propertyKinds: row.property_kinds,
    handlesPets: row.handles_pets,
    handlesChemicalSensitivity: row.handles_chemical_sensitivity,
    experienceLevel: row.experience_level,
    maxJobsPerDay: row.max_jobs_per_day,
    maxMinutesPerDay: row.max_minutes_per_day,
    maxDriveMinutes: row.max_drive_minutes,
    preferredZoneIds: row.preferred_zone_ids,
    preferredPartnerIds: row.preferred_partner_ids,
    avoidPartnerIds: row.avoid_partner_ids,
    homeAddressLine1: row.home_address_line1 ?? '',
    homeCity: row.home_city ?? '',
    homeState: row.home_state ?? '',
    homePostalCode: row.home_postal_code ?? '',
  };
}
