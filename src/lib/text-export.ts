import type { Workout, Segment, WorkoutItem } from '../types/workout';

function formatTarget(seg: Segment): string {
  if (seg.target.type === 'open') return 'Open';
  const unit = seg.target.type === 'power' ? 'W' : 'bpm';
  return `${seg.target.low}-${seg.target.high}${unit}`;
}

function formatEndCondition(seg: Segment): string {
  if (seg.endCondition.type === 'lap_button') return '(lap)';
  if (seg.endCondition.type === 'distance' && seg.endCondition.value != null) {
    return `${(seg.endCondition.value / 1000).toFixed(1)} km`;
  }
  if (seg.endCondition.type === 'time' && seg.endCondition.value != null) {
    const mins = Math.floor(seg.endCondition.value / 60);
    const secs = seg.endCondition.value % 60;
    return secs > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${mins} min`;
  }
  return '';
}

function pad(s: string, len: number): string {
  return s.padEnd(len);
}

export function generateTextSummary(workout: Workout): string {
  const lines: string[] = [];
  lines.push(`Outdoor Workout: ${workout.name}`);
  if (workout.description) {
    lines.push(workout.description);
  }
  if (workout.route) {
    lines.push(`Total distance: ${(workout.route.totalDistance / 1000).toFixed(1)} km`);
  }
  lines.push('');

  let stepNum = 1;

  function formatSegmentLine(seg: Segment, prefix: string): string {
    const num = `${stepNum}.`;
    stepNum++;
    const target = formatTarget(seg);
    const endCond = formatEndCondition(seg);
    return `${prefix}${pad(num, 4)} ${pad(seg.name, 18)} ${pad(target, 12)} ${pad(endCond, 14)} ${seg.notes}`;
  }

  for (const item of workout.items) {
    if (item.kind === 'segment') {
      lines.push(formatSegmentLine(item, ''));
    } else {
      lines.push(`── Repeat ${item.iterations}× ${'─'.repeat(58)}`);
      for (const seg of item.items) {
        lines.push(formatSegmentLine(seg, '│ '));
      }
      lines.push('─'.repeat(72));
    }
  }

  return lines.join('\n');
}

/** Distance covered by all segments except one, in a single pass (for max-distance clamping). */
export function coveredRouteDistanceExcluding(items: WorkoutItem[], excludeSegmentId: string): number {
  let dist = 0;
  for (const item of items) {
    if (item.kind === 'segment') {
      if (item.id !== excludeSegmentId && item.endCondition.type === 'distance' && item.endCondition.value != null) {
        dist += item.endCondition.value;
      }
    } else {
      for (const seg of item.items) {
        if (seg.id !== excludeSegmentId && seg.endCondition.type === 'distance' && seg.endCondition.value != null) {
          dist += seg.endCondition.value;
        }
      }
    }
  }
  return dist;
}

/** Distance covered in a single pass through the items (repeat iterations not multiplied). */
export function coveredRouteDistance(items: WorkoutItem[]): number {
  let dist = 0;
  for (const item of items) {
    if (item.kind === 'segment') {
      if (item.endCondition.type === 'distance' && item.endCondition.value != null) {
        dist += item.endCondition.value;
      }
    } else {
      for (const seg of item.items) {
        if (seg.endCondition.type === 'distance' && seg.endCondition.value != null) {
          dist += seg.endCondition.value;
        }
      }
    }
  }
  return dist;
}

export function totalDistance(items: WorkoutItem[]): number {
  let dist = 0;
  for (const item of items) {
    if (item.kind === 'segment') {
      if (item.endCondition.type === 'distance' && item.endCondition.value != null) {
        dist += item.endCondition.value;
      }
    } else {
      let blockDist = 0;
      for (const seg of item.items) {
        if (seg.endCondition.type === 'distance' && seg.endCondition.value != null) {
          blockDist += seg.endCondition.value;
        }
      }
      dist += blockDist * item.iterations;
    }
  }
  return dist;
}
