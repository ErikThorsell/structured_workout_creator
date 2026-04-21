import { describe, it, expect } from 'vitest';
import { encodeFitWorkout } from './fit-encoder';
import type { Workout, Segment } from '../types/workout';

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

describe('encodeFitWorkout', () => {
  it('produces a valid FIT file header', () => {
    const workout: Workout = {
      id: 'test',
      name: 'Test Workout',
      description: '',
      route: null,
      items: [seg()],
    };

    const data = encodeFitWorkout(workout);

    // Header checks
    expect(data[0]).toBe(14); // header_size
    expect(data[1]).toBe(0x20); // protocol version 2.0
    // '.FIT' magic
    expect(data[8]).toBe(0x2e); // '.'
    expect(data[9]).toBe(0x46); // 'F'
    expect(data[10]).toBe(0x49); // 'I'
    expect(data[11]).toBe(0x54); // 'T'
  });

  it('produces a file with correct data size', () => {
    const workout: Workout = {
      id: 'test',
      name: 'Test',
      description: '',
      route: null,
      items: [seg()],
    };

    const data = encodeFitWorkout(workout);
    // data_size is at bytes 4-7 (little-endian uint32)
    const dataSize = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
    // total file = 14 (header) + dataSize + 2 (file CRC)
    expect(data.length).toBe(14 + dataSize + 2);
  });

  it('produces output for multi-segment workout', () => {
    const workout: Workout = {
      id: 'test',
      name: 'Multi',
      description: '',
      route: null,
      items: [
        seg({ name: 'Warmup', effort: 'easy' as const }),
        seg({ name: 'Interval', effort: 'tempo' as const }),
        seg({ name: 'Cooldown', effort: 'easy' as const }),
      ],
    };

    const data = encodeFitWorkout(workout);
    expect(data.length).toBeGreaterThan(14);
  });
});
