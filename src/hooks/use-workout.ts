import { createContext, useContext, useEffect, useReducer, type Dispatch } from 'react';
import type { Workout, WorkoutItem, Segment, RepeatBlock, GpxRoute, Effort, RideType, EndConditionType, TargetType } from '../types/workout';

function uuid(): string {
  return crypto.randomUUID();
}

export function createDefaultSegment(overrides?: Partial<Segment>): Segment {
  return {
    kind: 'segment',
    id: uuid(),
    name: '',
    notes: '',
    endCondition: { type: 'distance', value: 1000 },
    gpsAnchor: null,
    target: { type: 'power', low: 150, high: 200 },
    effort: 'tempo',
    rideType: null,
    ...overrides,
  };
}

export function createDefaultWorkout(): Workout {
  return {
    id: uuid(),
    name: 'New Workout',
    description: '',
    route: null,
    items: [
      createDefaultSegment({
        name: 'Warm Up',
        effort: 'easy',
        rideType: null,
        endCondition: { type: 'distance', value: 1000 },
        target: { type: 'power', low: 100, high: 150 },
        notes: 'Easy spin to get the legs going.',
      }),
    ],
  };
}

export type WorkoutAction =
  | { type: 'SET_WORKOUT'; workout: Workout }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_DESCRIPTION'; description: string }
  | { type: 'SET_ROUTE'; route: GpxRoute | null }
  | { type: 'ADD_SEGMENT'; segment?: Partial<Segment> }
  | { type: 'ADD_SEGMENT_TO_REPEAT'; repeatId: string; segment?: Partial<Segment> }
  | { type: 'UPDATE_SEGMENT'; segmentId: string; changes: Partial<Segment> }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'REMOVE_SEGMENT_FROM_REPEAT'; repeatId: string; segmentId: string }
  | { type: 'WRAP_IN_REPEAT'; itemIds: string[] }
  | { type: 'UNWRAP_REPEAT'; repeatId: string }
  | { type: 'UPDATE_REPEAT'; repeatId: string; iterations: number }
  | { type: 'MOVE_ITEM'; fromIndex: number; toIndex: number }
  | { type: 'ADD_REPEAT_BLOCK' }
  | { type: 'UPDATE_SEGMENT_END_CONDITION'; segmentId: string; endType: EndConditionType; value: number | null }
  | { type: 'UPDATE_SEGMENT_TARGET'; segmentId: string; targetType: TargetType; low: number; high: number }
  | { type: 'UPDATE_SEGMENT_EFFORT'; segmentId: string; effort: Effort }
  | { type: 'UPDATE_SEGMENT_RIDE_TYPE'; segmentId: string; rideType: RideType | null };

function findAndUpdateSegment(items: WorkoutItem[], segmentId: string, updater: (seg: Segment) => Segment): WorkoutItem[] {
  return items.map((item) => {
    if (item.kind === 'segment' && item.id === segmentId) {
      return updater(item);
    }
    if (item.kind === 'repeat') {
      return {
        ...item,
        items: item.items.map((seg) => (seg.id === segmentId ? updater(seg) : seg)),
      };
    }
    return item;
  });
}

export function workoutReducer(state: Workout, action: WorkoutAction): Workout {
  switch (action.type) {
    case 'SET_WORKOUT':
      return action.workout;

    case 'SET_NAME':
      return { ...state, name: action.name };

    case 'SET_DESCRIPTION':
      return { ...state, description: action.description };

    case 'SET_ROUTE':
      return { ...state, route: action.route };

    case 'ADD_SEGMENT':
      return {
        ...state,
        items: [...state.items, createDefaultSegment(action.segment)],
      };

    case 'ADD_SEGMENT_TO_REPEAT':
      return {
        ...state,
        items: state.items.map((item) =>
          item.kind === 'repeat' && item.id === action.repeatId
            ? { ...item, items: [...item.items, createDefaultSegment(action.segment)] }
            : item,
        ),
      };

    case 'UPDATE_SEGMENT':
      return {
        ...state,
        items: findAndUpdateSegment(state.items, action.segmentId, (seg) => ({
          ...seg,
          ...action.changes,
          kind: 'segment',
        })),
      };

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.itemId),
      };

    case 'REMOVE_SEGMENT_FROM_REPEAT':
      return {
        ...state,
        items: state.items.map((item) =>
          item.kind === 'repeat' && item.id === action.repeatId
            ? { ...item, items: item.items.filter((seg) => seg.id !== action.segmentId) }
            : item,
        ),
      };

    case 'WRAP_IN_REPEAT': {
      const indices = action.itemIds
        .map((id) => state.items.findIndex((item) => item.id === id))
        .filter((i) => i !== -1)
        .sort((a, b) => a - b);

      if (indices.length === 0) return state;

      const segments = indices
        .map((i) => state.items[i])
        .filter((item): item is Segment => item.kind === 'segment');

      if (segments.length !== indices.length) return state; // can't wrap repeat blocks

      const repeatBlock: RepeatBlock = {
        kind: 'repeat',
        id: uuid(),
        iterations: 3,
        items: segments,
      };

      const newItems = state.items.filter((_, i) => !indices.includes(i));
      newItems.splice(indices[0], 0, repeatBlock);

      return { ...state, items: newItems };
    }

    case 'UNWRAP_REPEAT': {
      const idx = state.items.findIndex((item) => item.id === action.repeatId);
      if (idx === -1) return state;
      const block = state.items[idx];
      if (block.kind !== 'repeat') return state;

      const newItems = [...state.items];
      newItems.splice(idx, 1, ...block.items);
      return { ...state, items: newItems };
    }

    case 'UPDATE_REPEAT':
      return {
        ...state,
        items: state.items.map((item) =>
          item.kind === 'repeat' && item.id === action.repeatId
            ? { ...item, iterations: action.iterations }
            : item,
        ),
      };

    case 'MOVE_ITEM': {
      const newItems = [...state.items];
      const [moved] = newItems.splice(action.fromIndex, 1);
      newItems.splice(action.toIndex, 0, moved);
      return { ...state, items: newItems };
    }

    case 'ADD_REPEAT_BLOCK': {
      const block: RepeatBlock = {
        kind: 'repeat',
        id: uuid(),
        iterations: 3,
        items: [],
      };
      return { ...state, items: [...state.items, block] };
    }

    case 'UPDATE_SEGMENT_END_CONDITION':
      return {
        ...state,
        items: findAndUpdateSegment(state.items, action.segmentId, (seg) => ({
          ...seg,
          endCondition: { type: action.endType, value: action.value },
        })),
      };

    case 'UPDATE_SEGMENT_TARGET':
      return {
        ...state,
        items: findAndUpdateSegment(state.items, action.segmentId, (seg) => ({
          ...seg,
          target: { type: action.targetType, low: action.low, high: action.high },
        })),
      };

    case 'UPDATE_SEGMENT_EFFORT':
      return {
        ...state,
        items: findAndUpdateSegment(state.items, action.segmentId, (seg) => ({
          ...seg,
          effort: action.effort,
        })),
      };

    case 'UPDATE_SEGMENT_RIDE_TYPE':
      return {
        ...state,
        items: findAndUpdateSegment(state.items, action.segmentId, (seg) => ({
          ...seg,
          rideType: action.rideType,
        })),
      };

    default:
      return state;
  }
}

export interface WorkoutContextValue {
  workout: Workout;
  dispatch: Dispatch<WorkoutAction>;
}

export const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function useWorkout(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
  return ctx;
}

const WORKOUT_STORAGE_KEY = 'swb-workout';

const LEGACY_INTENSITY_MAP: Record<string, Effort> = {
  warmup: 'easy', active: 'tempo', recovery: 'easy', cooldown: 'easy',
};

function migrateSegment(seg: Segment): Segment {
  const legacy = seg as Segment & { intensity?: string; rideType?: string };
  let effort = seg.effort;
  if (!effort && legacy.intensity) {
    effort = LEGACY_INTENSITY_MAP[legacy.intensity] ?? 'tempo';
  }
  // 'unstructured' ride type was renamed to 'all_out'
  const rawRideType = legacy.rideType as string | null | undefined;
  const rideType = rawRideType === 'unstructured' ? 'all_out' : (seg.rideType ?? null);
  return { ...seg, effort: effort ?? 'tempo', rideType };
}

function migrateWorkout(w: Workout): Workout {
  return {
    ...w,
    items: w.items.map((item) =>
      item.kind === 'segment'
        ? migrateSegment(item)
        : { ...item, items: item.items.map(migrateSegment) },
    ),
  };
}

function loadWorkout(): Workout {
  try {
    const raw = localStorage.getItem(WORKOUT_STORAGE_KEY);
    if (raw) return migrateWorkout(JSON.parse(raw) as Workout);
  } catch {}
  return createDefaultWorkout();
}

export function useWorkoutReducer() {
  const [workout, dispatch] = useReducer(workoutReducer, null, loadWorkout);

  useEffect(() => {
    try {
      localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(workout));
    } catch {}
  }, [workout]);

  return [workout, dispatch] as const;
}
