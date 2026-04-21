import { useState } from 'react';
import type { Workout } from '../types/workout';
import { downloadFitFile } from '../lib/fit-encoder';
import { downloadGpxCourse } from '../lib/gpx-exporter';
import { generateTextSummary, coveredRouteDistance } from '../lib/text-export';

const COVERAGE_TOLERANCE_M = 50;

interface ExportPanelProps {
  workout: Workout;
  mode?: 'route' | 'free';
}

export function ExportPanel({ workout, mode = 'route' }: ExportPanelProps) {
  const [showText, setShowText] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasSegments = workout.items.length > 0;
  const hasRoute = workout.route != null;
  const textSummary = hasSegments ? generateTextSummary(workout) : '';

  const routeUncovered = (() => {
    if (mode !== 'route' || !workout.route) return null;
    const covered = coveredRouteDistance(workout.items);
    const remaining = workout.route.totalDistance - covered;
    if (remaining <= COVERAGE_TOLERANCE_M) return null;
    return {
      coveredKm: (covered / 1000).toFixed(1),
      totalKm: (workout.route.totalDistance / 1000).toFixed(1),
      remainingKm: (remaining / 1000).toFixed(1),
    };
  })();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(textSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-700">Export</h3>

      {routeUncovered && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded p-3 text-sm text-amber-800">
          <span className="text-lg leading-none">⚠</span>
          <span>
            Segments cover <strong>{routeUncovered.coveredKm} km</strong> of{' '}
            <strong>{routeUncovered.totalKm} km</strong> ({routeUncovered.remainingKm} km uncovered).
            The exported FIT file will not cover the full route.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => downloadFitFile(workout)}
          disabled={!hasSegments}
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Download FIT Workout
        </button>

        {mode === 'route' && (
          <button
            onClick={() => downloadGpxCourse(workout)}
            disabled={!hasSegments || !hasRoute}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!hasRoute ? 'Load a GPX route first' : ''}
          >
            Download GPX Course
          </button>
        )}

        <button
          onClick={() => setShowText(!showText)}
          disabled={!hasSegments}
          className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {showText ? 'Hide' : 'Show'} Text Summary
        </button>
      </div>

      {showText && textSummary && (
        <div className="relative">
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto whitespace-pre font-mono">
            {textSummary}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-white border rounded shadow-sm hover:bg-gray-50"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
