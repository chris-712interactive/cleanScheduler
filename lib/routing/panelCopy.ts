export const NO_CLEANER_VISITS_MESSAGE = 'No visits for this cleaner on this day.';
export const STOP_ORDER_UNAVAILABLE_MESSAGE = 'Stop order is not available yet.';
export const ALL_STOPS_MAPPED_MESSAGE = "Every stop on this cleaner's day has a map point.";

export function describeStopOrderPanel(
  proposal: {
    ordered: readonly unknown[];
    unrouted: readonly unknown[];
    sequenceAvailable: boolean;
  } | null,
): {
  kind: 'choose-cleaner' | 'empty' | 'ready';
  emptyMessage: string | null;
  unavailableMessage: string | null;
  allMappedMessage: string | null;
  applyEnabled: boolean;
  showMiles: boolean;
} {
  if (!proposal) {
    return {
      kind: 'choose-cleaner',
      emptyMessage: null,
      unavailableMessage: null,
      allMappedMessage: null,
      applyEnabled: false,
      showMiles: false,
    };
  }
  const empty = proposal.ordered.length + proposal.unrouted.length === 0;
  return {
    kind: empty ? 'empty' : 'ready',
    emptyMessage: empty ? NO_CLEANER_VISITS_MESSAGE : null,
    unavailableMessage: proposal.sequenceAvailable ? null : STOP_ORDER_UNAVAILABLE_MESSAGE,
    allMappedMessage: !empty && proposal.unrouted.length === 0 ? ALL_STOPS_MAPPED_MESSAGE : null,
    applyEnabled: proposal.sequenceAvailable && proposal.ordered.length > 0,
    showMiles: !empty,
  };
}
