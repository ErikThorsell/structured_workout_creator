import type { RepeatBlock as RepeatBlockType } from '../types/workout';
import { useWorkout } from '../hooks/use-workout';
import { SegmentEditor } from './segment-editor';

export function RepeatBlock({
  block,
  onRemove,
  mode = 'route',
  colorMap = new Map(),
  routeMaxDistances,
}: {
  block: RepeatBlockType;
  onRemove: () => void;
  mode?: 'route' | 'free';
  colorMap?: Map<string, string>;
  routeMaxDistances?: Map<string, number>;
}) {
  const { dispatch } = useWorkout();

  return (
    <div className="border-2 border-dashed border-indigo-300 rounded-lg p-3 bg-indigo-50/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-indigo-700">Repeat</span>
        <input
          type="number"
          value={block.iterations}
          onChange={(e) =>
            dispatch({ type: 'UPDATE_REPEAT', repeatId: block.id, iterations: Math.max(2, Number(e.target.value)) })
          }
          min={2}
          className="w-16 border rounded px-2 py-0.5 text-sm text-center"
        />
        <span className="text-sm text-indigo-600">times</span>
        <div className="flex-1" />
        <button
          onClick={() => dispatch({ type: 'UNWRAP_REPEAT', repeatId: block.id })}
          className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-0.5 border border-indigo-300 rounded"
          title="Unwrap: promote segments back to top level"
        >
          Unwrap
        </button>
        <button
          onClick={onRemove}
          className="text-red-400 hover:text-red-600 text-sm px-1"
          title="Remove repeat block"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 ml-2">
        {block.items.map((seg) => (
          <SegmentEditor
            key={seg.id}
            segment={seg}
            mode={mode}
            color={colorMap.get(seg.id)}
            routeMaxDistance={routeMaxDistances?.get(seg.id)}
            onRemove={() =>
              dispatch({ type: 'REMOVE_SEGMENT_FROM_REPEAT', repeatId: block.id, segmentId: seg.id })
            }
          />
        ))}
      </div>

      <button
        onClick={() =>
          dispatch({
            type: 'ADD_SEGMENT_TO_REPEAT',
            repeatId: block.id,
            segment: mode === 'free' ? { endCondition: { type: 'time' as const, value: 300 } } : undefined,
          })
        }
        className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
      >
        + Add segment
      </button>
    </div>
  );
}
