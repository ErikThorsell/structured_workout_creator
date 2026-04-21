import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GpxRoute, WorkoutItem, Segment } from '../types/workout';
import { buildColorMap } from '../lib/segment-colors';

interface SegmentSlot {
  seg: Segment;
  startDist: number;
  color: string;
}

function buildSegmentSlots(items: WorkoutItem[]): SegmentSlot[] {
  const colorMap = buildColorMap(items);
  const slots: SegmentSlot[] = [];
  let cumDist = 0;

  for (const item of items) {
    if (item.kind === 'segment') {
      slots.push({ seg: item, startDist: cumDist, color: colorMap.get(item.id) ?? '#22c55e' });
      if (item.endCondition.type === 'distance' && item.endCondition.value != null) {
        cumDist += item.endCondition.value;
      }
    } else {
      const blockStartDist = cumDist;
      let iterDist = blockStartDist;
      for (let iter = 0; iter < item.iterations; iter++) {
        for (const seg of item.items) {
          slots.push({ seg, startDist: iterDist, color: colorMap.get(seg.id) ?? '#22c55e' });
          if (seg.endCondition.type === 'distance' && seg.endCondition.value != null) {
            iterDist += seg.endCondition.value;
          }
        }
      }
      cumDist = iterDist;
    }
  }

  return slots;
}

interface MapViewProps {
  route: GpxRoute | null;
  items: WorkoutItem[];
  onRouteClick?: (pointIndex: number) => void;
  pendingMarkerIndices?: number[];
}

export function MapView({ route, items, onRouteClick, pendingMarkerIndices = [] }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const segmentLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const markerLayerRef = useRef<L.LayerGroup>(L.layerGroup());

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([59.33, 18.07], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    routeLayerRef.current.addTo(map);
    segmentLayerRef.current.addTo(map);
    markerLayerRef.current.addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redraw route + segment overlays when route or items change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    routeLayerRef.current.clearLayers();
    segmentLayerRef.current.clearLayers();

    if (!route || route.points.length === 0) return;

    // Base route: bold orange
    const latLngs = route.points.map((p) => [p.lat, p.lon] as [number, number]);
    const routeLine = L.polyline(latLngs, { color: '#f97316', weight: 5, opacity: 0.85 });
    routeLayerRef.current.addLayer(routeLine);

    // Segment overlays
    const slots = buildSegmentSlots(items);
    for (const { seg, startDist, color } of slots) {
      if (seg.endCondition.type !== 'distance' || seg.endCondition.value == null) continue;

      const endDist = startDist + seg.endCondition.value;
      const segPoints: [number, number][] = [];

      for (const pt of route.points) {
        if (pt.cumDist >= startDist && pt.cumDist <= endDist) {
          segPoints.push([pt.lat, pt.lon]);
        }
      }
      if (segPoints.length < 2) continue;

      const overlay = L.polyline(segPoints, { color, weight: 8, opacity: 0.9 });
      const targetStr =
        seg.target.type === 'open' ? 'Open' : `${seg.target.low}–${seg.target.high}${seg.target.type === 'power' ? 'W' : 'bpm'}`;
      overlay.bindTooltip(`<b>${seg.name || 'Segment'}</b><br>${targetStr}`, { sticky: true });
      segmentLayerRef.current.addLayer(overlay);
    }

    // Fit map to route
    map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

    // Click to place segment boundaries
    if (onRouteClick) {
      routeLine.on('click', (e: L.LeafletMouseEvent) => {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < route.points.length; i++) {
          const dx = route.points[i].lat - e.latlng.lat;
          const dy = route.points[i].lon - e.latlng.lng;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        onRouteClick(bestIdx);
      });
    }
  }, [route, items, onRouteClick]);

  // Redraw pending click markers independently (no fitBounds side-effect)
  useEffect(() => {
    markerLayerRef.current.clearLayers();
    if (!route || pendingMarkerIndices.length === 0) return;

    pendingMarkerIndices.forEach((idx) => {
      const pt = route.points[idx];
      if (!pt) return;

      const marker = L.circleMarker([pt.lat, pt.lon], {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: '#16a34a',
        fillOpacity: 1,
      });
      marker.bindTooltip('Next segment starts here -- click ahead to define end', { permanent: false });
      markerLayerRef.current.addLayer(marker);
    });
  }, [route, pendingMarkerIndices]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[400px] rounded-lg border border-gray-200 z-0"
    />
  );
}
