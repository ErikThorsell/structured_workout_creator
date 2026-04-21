import { useState } from 'react';
import { useWorkout } from '../hooks/use-workout';
import { buildColorMap } from '../lib/segment-colors';
import { coveredRouteDistance, coveredRouteDistanceExcluding } from '../lib/text-export';
import { SegmentEditor } from './segment-editor';
import { RepeatBlock } from './repeat-block';

export function SegmentList({ mode = 'route' }: { mode?: 'route' | 'free' }) {
  const { workout, dispatch } = useWorkout();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addWarning, setAddWarning] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const colorMap = buildColorMap(workout.items);

  // Per-segment max allowed distance (route mode only)
  const routeMaxDistances: Map<string, number> | undefined =
    mode === 'route' && workout.route
      ? (() => {
          const map = new Map<string, number>();
          const total = workout.route.totalDistance;
          for (const item of workout.items) {
            const segs = item.kind === 'segment' ? [item] : item.items;
            for (const seg of segs) {
              map.set(seg.id, Math.max(1, total - coveredRouteDistanceExcluding(workout.items, seg.id)));
            }
          }
          return map;
        })()
      : undefined;

  function handleAddSegment() {
    if (mode === 'route' && workout.route) {
      const remaining = workout.route.totalDistance - coveredRouteDistance(workout.items);
      if (remaining < 50) {
        setAddWarning(`Route fully covered -- less than 50 m remaining (${remaining < 1 ? '<1' : Math.round(remaining)} m).`);
        setTimeout(() => setAddWarning(null), 5000);
        return;
      }
    }
    dispatch({
      type: 'ADD_SEGMENT',
      segment: mode === 'free' ? { endCondition: { type: 'time' as const, value: 300 } } : undefined,
    });
  }

  const canWrapInRepeat =
    selectedIds.size > 0 &&
    [...selectedIds].every((id) => {
      const item = workout.items.find((i) => i.id === id);
      return item?.kind === 'segment';
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-700">Segments</h3>
        <div className="flex gap-2">
          {canWrapInRepeat && (
            <button
              onClick={() => {
                dispatch({ type: 'WRAP_IN_REPEAT', itemIds: [...selectedIds] });
                setSelectedIds(new Set());
              }}
              className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200"
            >
              Wrap in repeat ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'ADD_REPEAT_BLOCK' })}
            className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100"
          >
            + Repeat block
          </button>
          <button
            onClick={handleAddSegment}
            className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
          >
            + Segment
          </button>
        </div>
      </div>

      {addWarning && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          {addWarning}
        </div>
      )}

      {workout.items.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">
          No segments yet. Add a segment or click on the map to define boundaries.
        </p>
      )}

      {workout.items.map((item, index) => {
        if (item.kind === 'repeat') {
          return (
            <RepeatBlock
              key={item.id}
              block={item}
              mode={mode}
              colorMap={colorMap}
              routeMaxDistances={routeMaxDistances}
              onRemove={() => dispatch({ type: 'REMOVE_ITEM', itemId: item.id })}
            />
          );
        }

        const isSelected = selectedIds.has(item.id);
        return (
          <div key={item.id} className="flex items-start gap-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(item.id)}
              className="mt-4 shrink-0"
              title="Select for repeat grouping"
            />
            <div className="flex-1 flex items-start gap-1">
              <div className="flex flex-col gap-0.5 mt-3">
                <button
                  onClick={() => {
                    if (index > 0) dispatch({ type: 'MOVE_ITEM', fromIndex: index, toIndex: index - 1 });
                  }}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => {
                    if (index < workout.items.length - 1)
                      dispatch({ type: 'MOVE_ITEM', fromIndex: index, toIndex: index + 1 });
                  }}
                  disabled={index === workout.items.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                  title="Move down"
                >
                  ▼
                </button>
              </div>
              <div className="flex-1">
                <SegmentEditor
                  segment={item}
                  mode={mode}
                  color={colorMap.get(item.id)}
                  routeMaxDistance={routeMaxDistances?.get(item.id)}
                  onRemove={() => dispatch({ type: 'REMOVE_ITEM', itemId: item.id })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
