import { useEffect, useRef, useState } from 'react';
import type { Segment, EndConditionType, TargetType, Effort, RideType } from '../types/workout';
import { useWorkout } from '../hooks/use-workout';
import { segmentColor, RIDE_TYPE_COLORS } from '../lib/segment-colors';

function isValidPositiveInt(s: string): boolean {
  return /^\d+$/.test(s.trim()) && Number(s) > 0;
}

function NumericInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [raw, setRaw] = useState(String(value));
  const invalid = !isValidPositiveInt(raw);

  // Sync when the value is changed externally (e.g. clamped by parent)
  const prevValue = useRef(value);
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setRaw(String(value));
    }
  }, [value]);

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => {
          const s = e.target.value;
          setRaw(s);
          if (isValidPositiveInt(s)) onChange(Number(s));
        }}
        onBlur={() => {
          if (!isValidPositiveInt(raw)) setRaw(String(value));
        }}
        className={`w-full border rounded px-2 py-1 text-sm ${invalid ? 'border-red-500 bg-red-50' : ''}`}
      />
    </div>
  );
}

const EFFORTS: { value: Effort; label: string }[] = [
  { value: 'easy',       label: 'Easy' },
  { value: 'tempo',      label: 'Tempo' },
  { value: 'threshold',  label: 'Threshold' },
  { value: 'vo2',        label: 'VO2' },
  { value: 'free_speed', label: 'Free Speed' },
];

const RIDE_TYPES: { value: RideType; label: string }[] = [
  { value: 'dual_file',       label: 'Dual File' },
  { value: 'team_time_trial', label: 'Team Time Trial' },
  { value: 'belgian_chain',   label: 'Belgian Chain' },
  { value: 'all_out',         label: 'All-out' },
];

export function SegmentEditor({
  segment,
  onRemove,
  mode = 'route',
  color,
  routeMaxDistance,
}: {
  segment: Segment;
  onRemove: () => void;
  mode?: 'route' | 'free';
  color?: string;
  routeMaxDistance?: number;
}) {
  const { dispatch } = useWorkout();
  const [routeWarning, setRouteWarning] = useState(false);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unit = segment.target.type === 'power' ? 'W' : 'bpm';
  const borderColor = color ?? segmentColor(segment);

  function dispatchDistance(v: number) {
    let value = v;
    if (routeMaxDistance !== undefined && v > routeMaxDistance) {
      value = Math.max(1, routeMaxDistance);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      setRouteWarning(true);
      warningTimer.current = setTimeout(() => setRouteWarning(false), 5000);
    }
    dispatch({ type: 'UPDATE_SEGMENT_END_CONDITION', segmentId: segment.id, endType: 'distance', value });
  }

  return (
    <div
      className="border-l-4 rounded p-3 bg-white shadow-sm"
      style={{ borderLeftColor: borderColor }}
    >
      {routeWarning && (
        <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Distance truncated -- segment extended past the end of the route.
        </div>
      )}
      {/* Name row */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={segment.name}
          onChange={(e) =>
            dispatch({ type: 'UPDATE_SEGMENT', segmentId: segment.id, changes: { name: e.target.value.slice(0, 16) } })
          }
          placeholder="Segment name"
          maxLength={16}
          className="font-semibold text-sm border rounded px-2 py-1 flex-1 min-w-0"
        />
        {color && (
          <span
            className="shrink-0 w-3 h-3 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: color }}
            title="Map color"
          />
        )}
        <span className="text-xs text-gray-400">{segment.name.length}/16</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm px-1" title="Remove segment">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {/* Effort */}
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Effort</label>
          <select
            value={segment.effort}
            onChange={(e) =>
              dispatch({ type: 'UPDATE_SEGMENT_EFFORT', segmentId: segment.id, effort: e.target.value as Effort })
            }
            className="w-full border rounded px-2 py-1 text-sm"
          >
            {EFFORTS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>

        {/* Route mode: distance */}
        {mode === 'route' && (
          <NumericInput
            key={`${segment.id}-dist`}
            label="Distance (m)"
            value={segment.endCondition.value ?? 1000}
            onChange={dispatchDistance}
          />
        )}

        {/* Free mode: end condition selector */}
        {mode === 'free' && (
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">End Condition</label>
            <select
              value={segment.endCondition.type}
              onChange={(e) => {
                const endType = e.target.value as EndConditionType;
                const value =
                  endType === 'lap_button' ? null
                  : endType === 'distance' ? segment.endCondition.value ?? 1000
                  : segment.endCondition.value ?? 300;
                dispatch({ type: 'UPDATE_SEGMENT_END_CONDITION', segmentId: segment.id, endType, value });
              }}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="distance">Distance</option>
              <option value="time">Time</option>
              <option value="lap_button">Lap Button</option>
            </select>
          </div>
        )}

        {mode === 'free' && segment.endCondition.type === 'distance' && (
          <NumericInput
            key={`${segment.id}-dist-free`}
            label="Distance (m)"
            value={segment.endCondition.value ?? 1000}
            onChange={dispatchDistance}
          />
        )}

        {mode === 'free' && segment.endCondition.type === 'time' && (
          <NumericInput
            key={`${segment.id}-dur`}
            label="Duration (sec)"
            value={segment.endCondition.value ?? 300}
            onChange={(v) =>
              dispatch({ type: 'UPDATE_SEGMENT_END_CONDITION', segmentId: segment.id, endType: 'time', value: v })
            }
          />
        )}

        {/* Ride type -- optional, spans both columns */}
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-0.5">Ride Type <span className="text-gray-400">(optional)</span></label>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => dispatch({ type: 'UPDATE_SEGMENT_RIDE_TYPE', segmentId: segment.id, rideType: null })}
              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                segment.rideType === null
                  ? 'bg-gray-700 text-white border-gray-700'
                  : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
              }`}
            >
              Unstructured
            </button>
            {RIDE_TYPES.map((rt) => {
              const active = segment.rideType === rt.value;
              return (
                <button
                  key={rt.value}
                  onClick={() =>
                    dispatch({
                      type: 'UPDATE_SEGMENT_RIDE_TYPE',
                      segmentId: segment.id,
                      rideType: active ? null : rt.value,
                    })
                  }
                  className="px-2 py-0.5 text-xs rounded border transition-colors"
                  style={
                    active
                      ? { backgroundColor: RIDE_TYPE_COLORS[rt.value], borderColor: RIDE_TYPE_COLORS[rt.value], color: '#fff' }
                      : { backgroundColor: '#fff', borderColor: '#d1d5db', color: '#6b7280' }
                  }
                >
                  {rt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target type -- full width so Low/High start a fresh row */}
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-0.5">Target</label>
          <select
            value={segment.target.type}
            onChange={(e) => {
              const targetType = e.target.value as TargetType;
              dispatch({
                type: 'UPDATE_SEGMENT_TARGET',
                segmentId: segment.id,
                targetType,
                low: targetType === 'open' ? 0 : segment.target.low || 150,
                high: targetType === 'open' ? 0 : segment.target.high || 200,
              });
            }}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="power">Power</option>
            <option value="heart_rate">Heart Rate</option>
            <option value="open">Open</option>
          </select>
        </div>

        {/* Low + High on the same row */}
        {segment.target.type !== 'open' && (
          <>
            <NumericInput
              key={`${segment.id}-low-${segment.target.type}`}
              label={`Low (${unit})`}
              value={segment.target.low}
              onChange={(v) =>
                dispatch({
                  type: 'UPDATE_SEGMENT_TARGET',
                  segmentId: segment.id,
                  targetType: segment.target.type,
                  low: v,
                  high: segment.target.high,
                })
              }
            />
            <NumericInput
              key={`${segment.id}-high-${segment.target.type}`}
              label={`High (${unit})`}
              value={segment.target.high}
              onChange={(v) =>
                dispatch({
                  type: 'UPDATE_SEGMENT_TARGET',
                  segmentId: segment.id,
                  targetType: segment.target.type,
                  low: segment.target.low,
                  high: v,
                })
              }
            />
          </>
        )}
      </div>

      {/* Notes */}
      <div className="mt-2">
        <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
        <input
          type="text"
          value={segment.notes}
          onChange={(e) =>
            dispatch({ type: 'UPDATE_SEGMENT', segmentId: segment.id, changes: { notes: e.target.value.slice(0, 63) } })
          }
          placeholder="Riding instructions..."
          maxLength={63}
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </div>
    </div>
  );
}
