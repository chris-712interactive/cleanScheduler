import { describe, expect, it } from 'vitest';
import {
  parseBrandColor,
  parseWorkDaySchedulesFromForm,
  tenantBusinessSnapshotFromRow,
} from '@/lib/tenant/tenantBusinessSettings';

describe('business hours and brand color', () => {
  it('accepts a hex code or an rgb value for the brand color', () => {
    expect(parseBrandColor('#0d9488')).toBe('#0D9488');
    expect(parseBrandColor('rgb(13, 148, 136)')).toBe('#0D9488');
    expect(parseBrandColor('teal')).toBeNull();
  });

  it('keeps a different start and end for each open day', () => {
    const form = new FormData();
    form.set('work_day_mon', 'on');
    form.set('work_day_mon_start', '08:00');
    form.set('work_day_mon_end', '17:00');
    form.set('work_day_fri', 'on');
    form.set('work_day_fri_start', '08:00');
    form.set('work_day_fri_end', '12:00');

    const parsed = parseWorkDaySchedulesFromForm(form);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.days.find((day) => day.weekday === 'mon')).toMatchObject({
      enabled: true,
      end: '17:00',
    });
    expect(parsed.days.find((day) => day.weekday === 'fri')).toMatchObject({
      enabled: true,
      end: '12:00',
    });
    expect(parsed.days.find((day) => day.weekday === 'sat')?.enabled).toBe(false);
  });

  it('restores saved per-day hours', () => {
    const snapshot = tenantBusinessSnapshotFromRow({
      name: 'Sparkle',
      timezone: 'America/New_York',
      business_email: null,
      business_phone: null,
      brand_color: null,
      logo_url: null,
      address_line1: null,
      city: null,
      state: null,
      postal_code: null,
      country: 'US',
      work_week_days: ['mon', 'fri'],
      work_day_start: '08:00',
      work_day_end: '17:00',
      work_day_hours: {
        mon: { start: '08:00', end: '17:00' },
        fri: { start: '08:00', end: '12:00' },
      },
    });

    expect(snapshot.workDays.find((day) => day.weekday === 'fri')).toMatchObject({
      enabled: true,
      end: '12:00',
    });
    expect(snapshot.workDays.find((day) => day.weekday === 'tue')?.enabled).toBe(false);
  });
});
