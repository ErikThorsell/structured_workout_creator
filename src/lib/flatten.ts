import type { WorkoutItem, Segment } from '../types/workout';

export interface FitStep {
  messageIndex: number;
  name: string;
  notes: string;
  durationType: number;
  durationValue: number;
  targetType: number;
  targetValue: number;
  customTargetLow: number;
  customTargetHigh: number;
  intensity: number;
}

const DURATION_TYPE = { time: 0, distance: 1, lap_button: 5, repeat: 6 } as const;
const TARGET_TYPE = { heart_rate: 1, open: 2, power: 4 } as const;
// FIT intensity: 0=active, 1=rest, 2=warmup, 3=cooldown
const EFFORT_TO_FIT_INTENSITY = { easy: 1, tempo: 0, threshold: 0, vo2: 0, free_speed: 0 } as const;

function segmentToFitStep(seg: Segment, index: number): FitStep {
  let durationValue = 0;
  if (seg.endCondition.type === 'time' && seg.endCondition.value != null) {
    durationValue = seg.endCondition.value * 1000; // milliseconds
  } else if (seg.endCondition.type === 'distance' && seg.endCondition.value != null) {
    durationValue = seg.endCondition.value * 100; // centimeters
  }

  const targetType = TARGET_TYPE[seg.target.type];
  const hasTarget = seg.target.type !== 'open';

  return {
    messageIndex: index,
    name: seg.name.slice(0, 16),
    notes: seg.notes.slice(0, 63),
    durationType: DURATION_TYPE[seg.endCondition.type],
    durationValue,
    targetType,
    targetValue: 0,
    customTargetLow: hasTarget ? seg.target.low : 0,
    customTargetHigh: hasTarget ? seg.target.high : 0,
    intensity: EFFORT_TO_FIT_INTENSITY[seg.effort],
  };
}

export function flattenItems(items: WorkoutItem[]): FitStep[] {
  const steps: FitStep[] = [];
  for (const item of items) {
    if (item.kind === 'segment') {
      steps.push(segmentToFitStep(item, steps.length));
    } else {
      const blockStartIdx = steps.length;
      for (const seg of item.items) {
        steps.push(segmentToFitStep(seg, steps.length));
      }
      steps.push({
        messageIndex: steps.length,
        name: '',
        notes: '',
        durationType: DURATION_TYPE.repeat,
        durationValue: item.iterations,
        targetType: TARGET_TYPE.open,
        targetValue: blockStartIdx,
        customTargetLow: 0,
        customTargetHigh: 0,
        intensity: 0, // repeat steps are always "active" in FIT
      });
    }
  }
  return steps;
}
