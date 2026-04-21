import { describe, it, expect } from 'vitest';
import { haversineDistance, snapToRoute, interpolatePoint, computeCumulativeDistances } from './route-utils';
import type { TrackPoint } from '../types/workout';

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(59.33, 18.07, 59.33, 18.07)).toBe(0);
  });

  it('calculates distance between Stockholm and Gothenburg (~400km)', () => {
    const dist = haversineDistance(59.33, 18.07, 57.71, 11.97);
    expect(dist).toBeGreaterThan(390_000);
    expect(dist).toBeLessThan(420_000);
  });
});

describe('computeCumulativeDistances', () => {
  it('sets first point cumDist to 0', () => {
    const points: TrackPoint[] = [
      { lat: 59.33, lon: 18.07, ele: 0, cumDist: 0 },
    ];
    computeCumulativeDistances(points);
    expect(points[0].cumDist).toBe(0);
  });

  it('computes cumulative distances for multiple points', () => {
    const points: TrackPoint[] = [
      { lat: 59.33, lon: 18.07, ele: 0, cumDist: 0 },
      { lat: 59.34, lon: 18.07, ele: 0, cumDist: 0 },
      { lat: 59.35, lon: 18.07, ele: 0, cumDist: 0 },
    ];
    computeCumulativeDistances(points);
    expect(points[0].cumDist).toBe(0);
    expect(points[1].cumDist).toBeGreaterThan(0);
    expect(points[2].cumDist).toBeGreaterThan(points[1].cumDist);
  });
});

describe('snapToRoute', () => {
  it('returns index of nearest point', () => {
    const points: TrackPoint[] = [
      { lat: 59.33, lon: 18.07, ele: 0, cumDist: 0 },
      { lat: 59.34, lon: 18.07, ele: 0, cumDist: 1000 },
      { lat: 59.35, lon: 18.07, ele: 0, cumDist: 2000 },
    ];
    expect(snapToRoute(59.341, 18.07, points)).toBe(1);
  });
});

describe('interpolatePoint', () => {
  it('returns first point for distance 0', () => {
    const points: TrackPoint[] = [
      { lat: 10, lon: 20, ele: 0, cumDist: 0 },
      { lat: 11, lon: 21, ele: 0, cumDist: 1000 },
    ];
    const result = interpolatePoint(points, 0);
    expect(result.lat).toBe(10);
    expect(result.lon).toBe(20);
  });

  it('returns last point for distance beyond route', () => {
    const points: TrackPoint[] = [
      { lat: 10, lon: 20, ele: 0, cumDist: 0 },
      { lat: 11, lon: 21, ele: 0, cumDist: 1000 },
    ];
    const result = interpolatePoint(points, 5000);
    expect(result.lat).toBe(11);
    expect(result.lon).toBe(21);
  });

  it('interpolates midpoint correctly', () => {
    const points: TrackPoint[] = [
      { lat: 10, lon: 20, ele: 0, cumDist: 0 },
      { lat: 12, lon: 22, ele: 0, cumDist: 1000 },
    ];
    const result = interpolatePoint(points, 500);
    expect(result.lat).toBeCloseTo(11, 5);
    expect(result.lon).toBeCloseTo(21, 5);
  });
});
