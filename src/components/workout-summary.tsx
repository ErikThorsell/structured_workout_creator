import type { WorkoutItem, Segment } from '../types/workout';
import { EFFORT_COLORS, RIDE_TYPE_COLORS, segmentColor } from '../lib/segment-colors';
import { totalDistance } from '../lib/text-export';

const EFFORT_LABELS: Record<string, string> = {
  easy: 'Easy', tempo: 'Tempo', threshold: 'Threshold', vo2: 'VO2', free_speed: 'Free Speed',
};
const RIDE_TYPE_LABELS: Record<string, string> = {
  dual_file: 'Dual File', team_time_trial: 'Team Time Trial', belgian_chain: 'Belgian Chain', all_out: 'All-out',
};

interface WorkoutSummaryProps {
  items: WorkoutItem[];
}

export function WorkoutSummary({ items }: WorkoutSummaryProps) {
  const dist = totalDistance(items);

  // Expand repeats into execution order: 2×[A, B] → A, B, A, B
  const slots: Segment[] = [];
  for (const item of items) {
    if (item.kind === 'segment') {
      slots.push(item);
    } else {
      for (let iter = 0; iter < item.iterations; iter++) {
        for (const seg of item.items) {
          slots.push(seg);
        }
      }
    }
  }

  if (slots.length === 0) return null;

  let totalVal = 0;
  for (const seg of slots) {
    totalVal += seg.endCondition.value ?? 300;
  }

  // Build legend: unique (color, label) pairs in order of first appearance
  const legendSeen = new Set<string>();
  const legendItems: { color: string; label: string }[] = [];
  for (const seg of slots) {
    const key = seg.rideType ?? seg.effort;
    if (!legendSeen.has(key)) {
      legendSeen.add(key);
      const color = seg.rideType ? RIDE_TYPE_COLORS[seg.rideType] : EFFORT_COLORS[seg.effort];
      const label = seg.rideType ? (RIDE_TYPE_LABELS[seg.rideType] ?? seg.rideType) : (EFFORT_LABELS[seg.effort] ?? seg.effort);
      legendItems.push({ color, label });
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {legendItems.map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
        {dist > 0 && <span className="shrink-0 ml-3">{(dist / 1000).toFixed(1)} km total</span>}
      </div>
      <div className="flex h-5 rounded overflow-hidden">
        {slots.map((seg, i) => {
          const v = seg.endCondition.value ?? 300;
          const pct = totalVal > 0 ? (v / totalVal) * 100 : 100 / slots.length;
          return (
            <div
              key={`${seg.id}-${i}`}
              className="hover:opacity-80 transition-opacity"
              style={{ width: `${pct}%`, minWidth: '3px', backgroundColor: segmentColor(seg) }}
              title={seg.name || 'Segment'}
            />
          );
        })}
      </div>
    </div>
  );
}
