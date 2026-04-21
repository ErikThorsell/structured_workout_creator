import type { Workout, Segment, WorkoutItem } from '../types/workout';
import { interpolatePoint } from './route-utils';

function formatTarget(seg: Segment): string {
  if (seg.target.type === 'open') return 'Open';
  const unit = seg.target.type === 'power' ? 'W' : 'bpm';
  return `${seg.target.low}-${seg.target.high}${unit}`;
}

function formatEndCondition(seg: Segment): string {
  if (seg.endCondition.type === 'lap_button') return 'Lap';
  if (seg.endCondition.type === 'distance' && seg.endCondition.value != null) {
    return `${(seg.endCondition.value / 1000).toFixed(1)} km`;
  }
  if (seg.endCondition.type === 'time' && seg.endCondition.value != null) {
    const mins = Math.floor(seg.endCondition.value / 60);
    const secs = seg.endCondition.value % 60;
    return secs > 0 ? `${mins}:${String(secs).padStart(2, '0')} min` : `${mins} min`;
  }
  return '';
}

function collectSegments(items: WorkoutItem[]): Segment[] {
  const segments: Segment[] = [];
  for (const item of items) {
    if (item.kind === 'segment') {
      segments.push(item);
    } else {
      for (const seg of item.items) {
        segments.push(seg);
      }
    }
  }
  return segments;
}

export function exportGpxCourse(workout: Workout): string {
  if (!workout.route) {
    throw new Error('Cannot export GPX course without a route');
  }

  const route = workout.route;
  const segments = collectSegments(workout.items);

  const waypoints: string[] = [];
  let cumDist = 0;

  for (const seg of segments) {
    const coord = interpolatePoint(route.points, cumDist);
    const target = formatTarget(seg);
    const endCond = formatEndCondition(seg);
    const desc = [target, endCond, seg.notes].filter(Boolean).join(' | ');

    waypoints.push(
      `  <wpt lat="${coord.lat.toFixed(6)}" lon="${coord.lon.toFixed(6)}">` +
        `\n    <name>▶ ${escapeXml(seg.name)}</name>` +
        `\n    <cmt>${escapeXml(desc)}</cmt>` +
        `\n    <desc>${escapeXml(desc)}</desc>` +
        `\n    <sym>Generic</sym>` +
        `\n  </wpt>`,
    );

    if (seg.endCondition.type === 'distance' && seg.endCondition.value != null) {
      cumDist += seg.endCondition.value;
    }
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(route.rawXml, 'application/xml');
  const serializer = new XMLSerializer();
  const gpxString = serializer.serializeToString(doc);

  const closingTag = '</gpx>';
  const insertIdx = gpxString.lastIndexOf(closingTag);
  if (insertIdx === -1) {
    throw new Error('Invalid GPX: missing </gpx> closing tag');
  }

  return (
    gpxString.slice(0, insertIdx) +
    waypoints.join('\n') +
    '\n' +
    closingTag
  );
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function downloadGpxCourse(workout: Workout): void {
  const xml = exportGpxCourse(workout);
  const blob = new Blob([xml], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${workout.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_course.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}
