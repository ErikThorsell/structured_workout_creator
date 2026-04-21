import { describe, it, expect } from 'vitest';
import { flattenItems } from './flatten';
import type { Segment, RepeatBlock } from '../types/workout';

function seg(overrides?: Partial<Segment>): Segment {
  return {
    kind: 'segment',
    id: crypto.randomUUID(),
    name: 'Test',
    notes: '',
    endCondition: { type: 'distance', value: 1000 },
    gpsAnchor: null,
    target: { type: 'power', low: 200, high: 250 },
    effort: 'tempo',
    rideType: null,
    ...overrides,
  };
}

describe('flattenItems', () => {
  it('flattens a single segment', () => {
    const steps = flattenItems([seg({ name: 'Warmup' })]);
    expect(steps).toHaveLength(1);
    expect(steps[0].messageIndex).toBe(0);
    expect(steps[0].name).toBe('Warmup');
    expect(steps[0].durationType).toBe(1); // distance
    expect(steps[0].durationValue).toBe(100000); // 1000m * 100 = cm
    expect(steps[0].targetType).toBe(4); // power
    expect(steps[0].customTargetLow).toBe(200);
    expect(steps[0].customTargetHigh).toBe(250);
  });

  it('flattens time-based segment', () => {
    const steps = flattenItems([seg({ endCondition: { type: 'time', value: 300 } })]);
    expect(steps[0].durationType).toBe(0); // time
    expect(steps[0].durationValue).toBe(300000); // 300s * 1000 = ms
  });

  it('flattens lap button segment', () => {
    const steps = flattenItems([seg({ endCondition: { type: 'lap_button', value: null } })]);
    expect(steps[0].durationType).toBe(5); // open
    expect(steps[0].durationValue).toBe(0);
  });

  it('flattens repeat block correctly', () => {
    const block: RepeatBlock = {
      kind: 'repeat',
      id: 'r1',
      iterations: 3,
      items: [
        seg({ name: 'Threshold' }),
        seg({ name: 'Recovery', effort: 'easy' as const }),
      ],
    };

    const steps = flattenItems([
      seg({ name: 'Warmup', effort: 'easy' as const }),
      block,
      seg({ name: 'Cooldown', effort: 'easy' as const }),
    ]);

    // Warmup + 2 segments + repeat step + Cooldown = 5 steps
    expect(steps).toHaveLength(5);
    expect(steps[0].name).toBe('Warmup');
    expect(steps[1].name).toBe('Threshold');
    expect(steps[2].name).toBe('Recovery');

    // Repeat step
    expect(steps[3].durationType).toBe(6); // repeat
    expect(steps[3].durationValue).toBe(3); // iterations
    expect(steps[3].targetValue).toBe(1); // back to step 1

    expect(steps[4].name).toBe('Cooldown');
  });

  it('handles open target', () => {
    const steps = flattenItems([seg({ target: { type: 'open', low: 0, high: 0 } })]);
    expect(steps[0].targetType).toBe(2); // open
    expect(steps[0].customTargetLow).toBe(0);
    expect(steps[0].customTargetHigh).toBe(0);
  });
});
