import type { WorkoutItem, Segment, Effort, RideType } from '../types/workout';

export const EFFORT_COLORS: Record<Effort, string> = {
  easy:       '#818cf8', // indigo
  tempo:      '#facc15', // yellow
  threshold:  '#fb923c', // orange
  vo2:        '#f87171', // red
  free_speed: '#4ade80', // green
};

export const RIDE_TYPE_COLORS: Record<RideType, string> = {
  dual_file:         '#a855f7', // purple
  team_time_trial:   '#06b6d4', // cyan
  belgian_chain:     '#ec4899', // pink
  all_out:           '#dc2626', // strong red
};

/** Primary display color: ride type when set, effort otherwise. */
export function segmentColor(seg: Segment): string {
  if (seg.rideType) return RIDE_TYPE_COLORS[seg.rideType];
  return EFFORT_COLORS[seg.effort];
}

/** Returns a map of segment id → color for the whole workout. */
export function buildColorMap(items: WorkoutItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    if (item.kind === 'segment') {
      map.set(item.id, segmentColor(item));
    } else {
      for (const seg of item.items) {
        map.set(seg.id, segmentColor(seg));
      }
    }
  }
  return map;
}
