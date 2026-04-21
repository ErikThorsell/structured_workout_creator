import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkoutContext, useWorkoutReducer, createDefaultWorkout } from './hooks/use-workout';
import { WelcomeModal, hasSeenWelcome } from './components/welcome-modal';
import { parseGpx } from './lib/gpx-parser';
import { MapView } from './components/map-view';
import { SegmentList } from './components/segment-list';
import { WorkoutSummary } from './components/workout-summary';
import { ExportPanel } from './components/export-panel';
import { coveredRouteDistance } from './lib/text-export';
import type { GpxRoute } from './types/workout';

type Mode = 'route' | 'free';

function AppContent() {
  const [workout, dispatch] = useWorkoutReducer();
  const [mode, setMode] = useState<Mode>(() => {
    return (localStorage.getItem('swb-mode') as Mode) ?? 'route';
  });
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());

  useEffect(() => {
    localStorage.setItem('swb-mode', mode);
  }, [mode]);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGpxUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setGpxError(null);
      try {
        const xml = await file.text();
        const route: GpxRoute = parseGpx(xml);
        dispatch({ type: 'SET_ROUTE', route });
      } catch (err) {
        setGpxError(err instanceof Error ? err.message : 'Failed to parse GPX file');
      }
    },
    [dispatch],
  );

  const handleRouteClick = useCallback(
    (pointIndex: number) => {
      if (!workout.route) return;
      const route = workout.route;

      // Frontier = end of last segment on the route (single-pass distance)
      const covered = coveredRouteDistance(workout.items);
      let frontierIdx = 0;
      for (let i = 0; i < route.points.length; i++) {
        if (route.points[i].cumDist <= covered) frontierIdx = i;
        else break;
      }

      const clickedDist = route.points[pointIndex].cumDist;
      const frontierDist = route.points[frontierIdx].cumDist;

      // Ignore clicks at or behind the frontier (require at least 10 m ahead)
      if (clickedDist <= frontierDist + 10) return;

      const distance = Math.round(clickedDist - frontierDist);
      dispatch({
        type: 'ADD_SEGMENT',
        segment: {
          endCondition: { type: 'distance', value: distance },
          gpsAnchor: {
            startPointIdx: frontierIdx,
            endPointIdx: pointIndex,
            startCoord: { lat: route.points[frontierIdx].lat, lon: route.points[frontierIdx].lon },
            endCoord: { lat: route.points[pointIndex].lat, lon: route.points[pointIndex].lon },
            calculatedDistance: distance,
          },
        },
      });
    },
    [workout.route, workout.items, dispatch],
  );

  // Frontier marker: the point where the next clicked segment would start.
  // Hidden once the route is fully covered (< 50 m remaining).
  function frontierMarkerIndices(): number[] {
    if (!workout.route) return [];
    const covered = coveredRouteDistance(workout.items);
    const remaining = workout.route.totalDistance - covered;
    if (remaining < 50) return [];
    let idx = 0;
    for (let i = 0; i < workout.route.points.length; i++) {
      if (workout.route.points[i].cumDist <= covered) idx = i;
      else break;
    }
    return [idx];
  }

  return (
    <WorkoutContext value={{ workout, dispatch }}>
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b px-4 py-3">
          <div className="max-w-6xl mx-auto space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-gray-800">Structured Workout Builder</h1>
                <button
                  onClick={() => {
                    if (confirm('Start a new workout? Current workout will be lost.')) {
                      dispatch({ type: 'SET_WORKOUT', workout: createDefaultWorkout() });
                    }
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  New workout
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setMode('route'); setShowModeInfo(false); }}
                  className={`px-3 py-1 text-sm rounded ${
                    mode === 'route' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Route
                </button>
                <button
                  onClick={() => { setMode('free'); setShowModeInfo(false); }}
                  className={`px-3 py-1 text-sm rounded ${
                    mode === 'free' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Free
                </button>
                <button
                  onClick={() => setShowModeInfo((v) => !v)}
                  className="w-6 h-6 rounded-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
                  title="About this mode"
                >
                  ⓘ
                </button>
                <button
                  onClick={() => setShowWelcome(true)}
                  className="w-6 h-6 rounded-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
                  title="How to use this tool"
                >
                  ?
                </button>
              </div>
            </div>
            {showModeInfo && (
              <p className="text-xs text-gray-500 text-right">
                {mode === 'route'
                  ? 'Route: Segment a GPX route and assign power targets. Exports a FIT workout and a GPX course with waypoints.'
                  : 'Free: Build a FIT workout without a route -- any mix of distance, time, or lap-button segments.'}
              </p>
            )}
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 space-y-4">
          {/* Workout name + description */}
          <div className="bg-white rounded-lg border p-4 space-y-2">
            <input
              type="text"
              value={workout.name}
              onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })}
              className="text-xl font-bold w-full border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none pb-1"
              placeholder="Workout name"
            />
            <input
              type="text"
              value={workout.description}
              onChange={(e) => dispatch({ type: 'SET_DESCRIPTION', description: e.target.value })}
              className="text-sm text-gray-500 w-full border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none pb-1"
              placeholder="Description (optional)"
            />
          </div>

          {/* Map (route mode) */}
          {mode === 'route' && (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Import GPX
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".gpx"
                  onChange={handleGpxUpload}
                  className="hidden"
                />
                {workout.route && (
                  <span className="text-sm text-gray-500">
                    {workout.route.points.length} points, {(workout.route.totalDistance / 1000).toFixed(1)} km
                  </span>
                )}
                {gpxError && <span className="text-sm text-red-500">{gpxError}</span>}
              </div>

              {workout.route && (
                <>
                  <MapView
                    route={workout.route}
                    items={workout.items}
                    onRouteClick={handleRouteClick}
                    pendingMarkerIndices={frontierMarkerIndices()}
                  />
                  {(() => {
                    const covered = coveredRouteDistance(workout.items);
                    const remaining = workout.route.totalDistance - covered;
                    if (remaining < 50) return null;
                    return (
                      <button
                        onClick={() =>
                          dispatch({
                            type: 'ADD_SEGMENT',
                            segment: { endCondition: { type: 'distance', value: Math.round(remaining) } },
                          })
                        }
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        + Segment to end of route ({(remaining / 1000).toFixed(1)} km remaining)
                      </button>
                    );
                  })()}
                </>
              )}

              {!workout.route && (
                <div className="h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
                  Upload a GPX file to see the route map
                </div>
              )}
            </div>
          )}

          {/* Workout summary bar */}
          {workout.items.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <WorkoutSummary items={workout.items} />
            </div>
          )}

          {/* Segment list */}
          <div className="bg-white rounded-lg border p-4">
            <SegmentList mode={mode} />
          </div>

          {/* Export */}
          <div className="bg-white rounded-lg border p-4">
            <ExportPanel workout={workout} mode={mode} />
          </div>
        </main>
      </div>
    </WorkoutContext>
  );
}

export default function App() {
  return <AppContent />;
}
