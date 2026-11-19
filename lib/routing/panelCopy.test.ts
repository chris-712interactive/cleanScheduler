import { describe, expect, it } from 'vitest';
import { describeStopOrderPanel } from '@/lib/routing/panelCopy';

describe('stop order panel copy', () => {
  it('uses an empty state when the cleaner has no visits that day', () => {
    const state = describeStopOrderPanel({
      ordered: [],
      unrouted: [],
      sequenceAvailable: true,
    });
    expect(state.kind).toBe('empty');
    expect(state.emptyMessage).toBe('No visits for this cleaner on this day.');
    expect(state.showMiles).toBe(false);
    expect(state.applyEnabled).toBe(false);
    expect(state.allMappedMessage).toBeNull();
    expect(state.unavailableMessage).toBeNull();
  });

  it('keeps the mapped-stops note only when there are stops and every one has a point', () => {
    const state = describeStopOrderPanel({
      ordered: [{ id: 'a' }],
      unrouted: [],
      sequenceAvailable: true,
    });
    expect(state.kind).toBe('ready');
    expect(state.showMiles).toBe(true);
    expect(state.applyEnabled).toBe(true);
    expect(state.allMappedMessage).toBe("Every stop on this cleaner's day has a map point.");
  });

  it('says stop order is not available yet and keeps apply off when the column is missing', () => {
    const state = describeStopOrderPanel({
      ordered: [{ id: 'a' }],
      unrouted: [{ id: 'b' }],
      sequenceAvailable: false,
    });
    expect(state.unavailableMessage).toBe('Stop order is not available yet.');
    expect(state.applyEnabled).toBe(false);
    expect(state.showMiles).toBe(true);
    expect(state.emptyMessage).toBeNull();
  });
});
