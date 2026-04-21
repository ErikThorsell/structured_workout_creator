export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  cumDist: number;
}

export interface GpxRoute {
  rawXml: string;
  points: TrackPoint[];
  totalDistance: number;
}

export interface GpsAnchor {
  startPointIdx: number;
  endPointIdx: number;
  startCoord: { lat: number; lon: number };
  endCoord: { lat: number; lon: number };
  calculatedDistance: number;
}

export type EndConditionType = 'distance' | 'time' | 'lap_button';

export interface EndCondition {
  type: EndConditionType;
  value: number | null;
}

export type TargetType = 'power' | 'heart_rate' | 'open';

export interface Target {
  type: TargetType;
  low: number;
  high: number;
}

/** How hard the rider is working. Maps to FIT intensity and drives fallback color. */
export type Effort = 'easy' | 'tempo' | 'threshold' | 'vo2' | 'free_speed';

/** How the group is riding. Optional -- only relevant for group rides. Drives map/summary color. */
export type RideType = 'dual_file' | 'team_time_trial' | 'belgian_chain' | 'all_out';

export interface Segment {
  kind: 'segment';
  id: string;
  name: string;
  notes: string;
  endCondition: EndCondition;
  gpsAnchor: GpsAnchor | null;
  target: Target;
  effort: Effort;
  rideType: RideType | null;
}

export interface RepeatBlock {
  kind: 'repeat';
  id: string;
  iterations: number;
  items: Segment[];
}

export type WorkoutItem = Segment | RepeatBlock;

export interface Workout {
  id: string;
  name: string;
  description: string;
  route: GpxRoute | null;
  items: WorkoutItem[];
}
