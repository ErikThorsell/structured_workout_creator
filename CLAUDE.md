# Structured Outdoor Workout Builder

## Project overview

A web-based tool for building structured cycling workouts tied to real-world routes. The user imports a GPX file,
divides the route into segments on a map, attaches power targets and riding instructions to each segment, and exports
files that Garmin Edge bike computers and watches can execute.

The tool serves a specific use case: a group ride leader plans a structured workout along a known route and shares both
the route and the workout with other riders before the event, so everyone knows what happens where.

## Garmin ecosystem constraints (critical -- read before implementing)

Garmin treats **courses** and **workouts** as separate, unlinked concepts. This is the single most important
architectural constraint.

### FIT Workout files

A FIT workout is a sequence of steps. Each step has:

- A **duration type**: `time` (seconds), `distance` (meters), `open` (lap button press), or HR/power threshold triggers.
- A **target type**: `power`, `heart_rate`, `cadence`, `speed`, or `open` (no target).
- For power/HR targets: a low and high value defining the target range.
- A **step name** (max ~16 characters, shown on screen during execution).
- A **notes** field (longer text, shown on Edge 530+ and Forerunner 255+ era devices).
- An **intensity** category: `warmup`, `active`, `recovery`, or `cooldown`.

FIT workout steps **do not support GPS coordinates**. There is no "until you reach lat/lon X" duration type. This means
GPS-anchored segment transitions are impossible in the native workout engine.

### FIT/GPX Course files

A course is a GPS track with optional course points (named waypoints that trigger on-screen alerts when the rider
approaches). Course points carry a name and description but **no structured power targets** and **no workout step
advancement logic**.

### How they work together

On Edge 530/830/1030/1040/1050 and equivalent-era watches, the rider can load a course for navigation AND execute a
workout simultaneously. They run side by side but do not interact -- course point alerts pop up independently of workout
step transitions.

### The practical solution

Export **two files** from a single workout definition:

1. **FIT workout** -- structured steps with power targets and duration types. GPS-anchored segments export as `distance`
   (calculated along the route between the two GPS points) or `open` (rider presses lap at the landmark). The `open`
   type is the correct primitive for "ride to the roundabout, then press lap."
2. **GPX course** -- the original route with waypoints injected at segment boundaries. Each waypoint carries the segment
   name and riding instructions in its `<name>`, `<cmt>`, and `<desc>` fields. This gives the rider a visual heads-up on
   the map as they approach a segment transition.

A future Connect IQ data field could read GPS-anchored segments directly and auto-transition, but that is out of scope
for the initial build.

## Data model

```
Workout
  id: string (uuid)
  name: string
  description: string
  route: GpxRoute | null                 // null for pure time-based workouts
  items: WorkoutItem[]                   // ordered, contiguous

WorkoutItem = Segment | RepeatBlock      // discriminated union on a `kind` field

RepeatBlock
  kind: 'repeat'
  id: string (uuid)
  iterations: number                     // ≥2; total executions, not "extra" repeats
  items: Segment[]                       // the segments inside the loop (no nested repeats)

Segment
  kind: 'segment'
  id: string (uuid)
  name: string                           // short, ≤16 chars -- maps to FIT wkt_step_name
  notes: string                          // longer riding instructions -- maps to FIT notes field
  endCondition:
    type: 'distance' | 'time' | 'lap_button'
    value: number | null                 // meters (distance), seconds (time), null (lap_button)
  gpsAnchor: GpsAnchor | null            // tool-side only, not exported to FIT
  target:
    type: 'power' | 'heart_rate' | 'open'
    low: number                          // watts or bpm
    high: number                         // watts or bpm
  effort: 'easy' | 'tempo' | 'threshold' | 'vo2' | 'free_speed'  // maps to FIT intensity; drives fallback color
  rideType: 'dual_file' | 'team_time_trial' | 'belgian_chain' | 'all_out' | null  // optional; overrides effort color

GpxRoute
  rawXml: string                         // original GPX XML for re-export
  points: TrackPoint[]
  totalDistance: number                   // meters

TrackPoint
  lat: number
  lon: number
  ele: number
  cumDist: number                        // cumulative distance from start, meters

GpsAnchor
  startPointIdx: number                  // index into GpxRoute.points
  endPointIdx: number                    // index into GpxRoute.points
  startCoord: {lat, lon}
  endCoord: {lat, lon}
  calculatedDistance: number             // meters along route between start and end
```

### Repeat blocks

A `RepeatBlock` groups one or more segments that the rider executes multiple times. FIT natively supports this via a
special workout step with `duration_type=6` (repeat).

**Nesting constraint:** repeat blocks cannot contain other repeat blocks. This matches the FIT format, which only
supports one level of repeat references (a repeat step points back to an earlier step index in a flat list). The UI
should enforce this -- the "wrap in repeat" action is only available for top-level segments, and you cannot drag a
repeat block inside another repeat block.

**FIT export flattening:** when exporting to FIT, a `RepeatBlock` with N segments becomes N+1 workout steps:

1. Steps 0..N-1: the contained segments as normal `workout_step` messages.
2. Step N: a repeat step with `duration_type=6`, `duration_value=iterations`, and `target_value=<index of step 0 in the
   flat list>`.

Example -- a workout with warmup, 3×(threshold + recovery), cooldown becomes 6 FIT steps:

```
Step 0: Warmup           (time, 10 min, 180W)
Step 1: Threshold         (distance, 1 km, 280W)       ← repeat block start
Step 2: Recovery          (time, 2 min, 130W)
Step 3: Repeat            (repeat, 3×, back to step 1) ← repeat block end
Step 4: Cooldown          (time, 10 min, 150W)
```

**`iterations` is the total execution count**, not "additional" repeats. 3 iterations means the block runs 3 times
total. This matches Garmin's interpretation of the FIT repeat value and avoids off-by-one confusion.

**GPS anchoring inside repeat blocks:** when a repeat block has GPS-anchored segments, the anchor only applies to the
first iteration on the map visualization. Subsequent iterations re-traverse the same route section. The map overlay
should show the repeated section with a visual indicator (e.g., a loop arrow or iteration count badge). For GPX course
export, waypoints are placed once at the physical locations -- the rider will pass them on each lap.

### Key design decisions in this model

- **`gpsAnchor` is metadata, not an export field.** It tells the tool where to draw the segment overlay on the map and
  where to place waypoints in the GPX. The FIT workout uses `endCondition.type` and `endCondition.value` only.
- **`endCondition` separates "what" from "where."** Click two roundabouts on the map (GPS anchor), the tool calculates
  1,200m between them along the route. It stores both the GPS anchor (visualization) and the distance (export). If the
  rider chooses `lap_button`, the distance is informational only.
- **Segments are ordered and contiguous.** No gaps, no overlaps. Each segment starts where the previous one ends. This
  matches FIT workout semantics.
- **Separate `name` and `notes`.** Name is the short label visible on all devices. Notes are longer instructions visible
  on newer devices. The UI should enforce the 16-char name limit.
- **Single-level repeat blocks.** Keeps the data model, UI, and FIT export simple. Covers the vast majority of
  real-world structured workouts (intervals with rest). Deeply nested repeats are rare enough to not justify the
  complexity.

## User workflow

1. **Choose mode**: route-based (upload GPX) or time-based (no route needed).
2. **Import route** (route-based only): upload a GPX file. The route appears on a map.
3. **Create segments**: either click points on the route to define GPS-anchored boundaries, or add segments manually
   with distance/time/lap-button duration.
4. **Configure each segment**: name, notes, power target range, effort level, ride type (optional), end condition type.
   If GPS-anchored, the distance is auto-calculated but can be overridden. The user can switch any segment to
   `lap_button` to handle variable-distance approaches.
5. **Group into repeats** (optional): select adjacent segments and wrap them in a repeat block. Set the iteration count.
   Useful for interval sets like 4×(threshold + recovery).
6. **Visualize**: segments appear as colored overlays on the route, with a summary bar and table below the map. Repeat
   blocks are visually indicated with nesting and iteration badges.
7. **Export**:
   - FIT workout file (works on Garmin, Wahoo, Hammerhead).
   - GPX course file with waypoints at segment boundaries (route-based only).
   - Plain text summary (markdown or plain text) for sharing via chat/email.
8. **Share**: other riders import the FIT workout and GPX course to their devices.

## Segment creation UX (route-based mode)

### Click-on-map creation

- After loading a GPX, a green marker shows the **frontier** -- the end of the last segment, or the route start if no
  segments exist yet. This is always the implicit start of the next segment.
- The user clicks one point ahead of the frontier to define the end of the new segment. A single click creates the
  segment immediately; there is no separate "pick start" step.
- Clicks at or behind the frontier (within 10 m) are ignored -- this enforces strict sequential, non-overlapping
  segments.
- The segment appears as a colored overlay on the route polyline from the frontier to the clicked point.

### Sequential creation

- An "add segment" button appends a new segment starting where the previous one ended.
- The user specifies distance or time, and the tool auto-calculates the GPS anchor (end point along the route).

### Drag handles

- Segment boundaries appear as draggable markers on the route polyline.
- Dragging a boundary adjusts both adjacent segments and recalculates distances.

### End condition switching

- Each segment has a dropdown: distance / time / lap button.
- Switching to `lap_button` keeps the GPS anchor and calculated distance visible as a hint ("~1.2 km based on route")
  but the FIT export uses the `open` duration type.
- Switching from `lap_button` to `distance` uses the GPS-anchored calculated distance as the default.

### Repeat block creation

Two ways to create a repeat block:

1. **Select and wrap.** Select one or more adjacent top-level segments in the segment list, then click "Wrap in repeat."
   The selected segments become children of a new `RepeatBlock` with a default iteration count of 3. Only top-level
   segments can be selected -- segments already inside a repeat block cannot be wrapped again.
2. **Add empty repeat block.** Click "Add repeat block" to append an empty `RepeatBlock`, then add segments inside it.
   This is useful when building a workout from scratch.

The segment list UI should visually nest repeated segments (indentation + a bracket or border on the left). The
iteration count is editable inline. An "unwrap" action dissolves the repeat block and promotes its children back to
top-level items.

## Export specifications

### FIT Workout file

Binary FIT format. The file contains three message types:

1. **file_id** (global message 0): `type=workout`, `manufacturer=development`, timestamp.
2. **workout** (global message 26): name, `sport=cycling`, `num_valid_steps`. Note: `num_valid_steps` counts the total
   flattened steps including repeat steps.
3. **workout_step** (global message 27, one per flattened step):
   - `message_index`: sequential 0-based across the entire flattened workout.
   - `wkt_step_name`: segment name (null-terminated string, ≤16 chars).
   - `duration_type`: 0=time, 1=distance, 5=open, **6=repeat**.
   - `duration_value`: milliseconds (time), centimeters (distance), 0 (open), or **iteration count (repeat)**.
   - `target_type`: 4=power, 1=heart_rate, 2=open. For repeat steps: 2=open.
   - `target_value`: 0 (signals custom range). **For repeat steps: the `message_index` of the first step in the block to
     loop back to.**
   - `custom_target_value_low`: lower bound in watts or bpm. Unused for repeat steps (set to 0).
   - `custom_target_value_high`: upper bound in watts or bpm. Unused for repeat steps (set to 0).
   - `intensity`: 0=active, 1=rest, 2=warmup, 3=cooldown. For repeat steps: 0=active.
   - `notes`: riding instructions (null-terminated string, ≤63 chars).

**Flattening repeat blocks for FIT export:**

The `Workout.items` tree must be flattened into a linear list of `workout_step` records. Walk the items array in order.
For each `Segment`, emit a normal workout step. For each `RepeatBlock`, emit its contained segments as normal steps,
then emit one repeat step that references back to the first step in the block. Track the running `message_index` to
calculate the back-reference correctly.

```typescript
// Pseudocode for flattening
function flattenItems(items: WorkoutItem[]): FitStep[] {
  const steps: FitStep[] = [];
  for (const item of items) {
    if (item.kind === 'segment') {
      steps.push(segmentToFitStep(item, steps.length));
    } else {
      const blockStartIdx = steps.length;
      for (const seg of item.items) {
        steps.push(segmentToFitStep(seg, steps.length));
      }
      steps.push({
        messageIndex: steps.length,
        durationType: 6,                // repeat
        durationValue: item.iterations, // total execution count
        targetType: 2,                  // open
        targetValue: blockStartIdx,     // loop back to here
      });
    }
  }
  return steps;
}
```

The FIT binary format uses little-endian encoding, CRC-16 checksums, and a 14-byte file header. Write a focused encoder
(~250 lines) rather than pulling in a full FIT SDK.

### GPX Course file

Standard GPX 1.1 XML. Take the original uploaded GPX track and inject `<wpt>` elements at segment boundary positions:

```xml
<wpt lat="59.12345" lon="17.54321">
  <name>▶ Threshold Block</name>
  <cmt>280W | 1.2 km | Stay aero, 95+ rpm</cmt>
  <desc>280W | 1.2 km | Stay aero, 95+ rpm</desc>
  <sym>Generic</sym>
</wpt>
```

Segment boundary lat/lon is calculated by interpolating along the track points at the cumulative distance of the segment
start.

### Text summary

Plain text or markdown formatted workout description. Example:

```
Outdoor Workout: Kungsängen Tempo Loops
Total distance: 42.3 km

1. Warmup           175-200W   10 min (lap)    Easy spin, find your rhythm
── Repeat 3× ──────────────────────────────────────────────────────────
│ 2. Threshold      270-290W    1.2 km          Full gas, 95+ rpm
│ 3. Recovery       130-150W    2 min           Drink, eat, reset
────────────────────────────────────────────────────────────────────────
4. Cooldown         150-170W   10 min (lap)     Easy spin home
```

## Tech stack

- **Framework**: React (TypeScript). Single-page app, all processing client-side.
- **Map**: Leaflet with OpenStreetMap tiles. No API keys needed.
- **GPX parsing**: DOMParser (browser-native XML). Cumulative distance via Haversine formula.
- **FIT generation**: Custom binary encoder in TypeScript.
- **Build tool**: Vite.
- **Styling**: Tailwind CSS.
- **State management**: React state + context. No Redux.
- **Container runtime**: Docker. Multi-stage build producing an nginx image serving the static bundle.
- **Orchestration**: Docker Compose for initial deployment, Kubernetes-ready for later migration.

## Containerization

### Architecture

This is a purely static frontend application -- no backend, no database, no server-side logic. All GPX parsing, FIT
encoding, and state management happens in the browser. The container's only job is to serve the built static assets over
HTTP.

The container image should be as small as possible. Use a multi-stage Docker build: a Node stage for building the Vite
bundle, then copy the output into an nginx:alpine image for serving.

### Dockerfile

The Dockerfile should follow this pattern:

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:1-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

Key decisions:

- **node:22-alpine** for the build stage -- matches the LTS release, alpine keeps the builder small.
- **nginx:1-alpine** for the runtime -- ~8 MB base image. The final image should be under 15 MB total.
- **Port 8080** instead of 80 -- avoids requiring root or `NET_BIND_SERVICE` capability. Important for both rootless
  Docker and Kubernetes pod security standards.
- **Custom nginx.conf** -- needed for SPA routing (all paths → `index.html`) and sensible caching headers.

### nginx.conf

```nginx server { listen 8080; server_name _; root /usr/share/nginx/html; index index.html;

    # SPA fallback -- serve index.html for all non-file routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache hashed assets aggressively (Vite adds content hashes to filenames)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Do not cache index.html itself
    location = /index.html {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### docker-compose.yml

```yaml
services:
  workout-builder:
    build: .
    container_name: workout-builder
    ports:
      - "8080:8080"
    restart: unless-stopped
    # No volumes needed -- the app is fully static with no persistent state.
    # Workout data lives in the browser (localStorage in Phase 2).
```

No other services are needed. No database, no Redis, no API container. If a backend is added later (e.g., for shared
workout hosting or user accounts), it would be a separate service in the compose file.

### Kubernetes migration path

The Docker Compose setup is intentionally simple enough that migrating to Kubernetes is mechanical. The mapping is:

| Docker Compose        | Kubernetes equivalent                                        |
|-----------------------|--------------------------------------------------------------|
| `services.workout-builder` | `Deployment` with 1+ replicas                          |
| `ports: "8080:8080"`  | `Service` (ClusterIP) + `Ingress` or `IngressRoute`         |
| `build: .`            | Pre-built image pushed to a container registry               |
| `restart: unless-stopped` | Default pod restart policy (`Always`)                   |

When moving to Kubernetes:

- Push the built image to a registry (GitHub Container Registry, Harbor, or a self-hosted registry).
- The Deployment spec needs no special volumes, init containers, or sidecars.
- Set resource requests/limits conservatively -- nginx serving static files uses almost no CPU or memory. Something like
  `requests: {cpu: 10m, memory: 16Mi}` and `limits: {cpu: 100m, memory: 64Mi}`.
- Liveness and readiness probes can hit `GET /` on port 8080 -- nginx returns 200 for `index.html`.
- If the cluster runs Traefik (common on self-hosted k3s/k8s), use an `IngressRoute` CRD. Otherwise a standard `Ingress`
  resource works.

Do not add Kubernetes manifests to the repository yet. The Docker Compose setup is the deployment target for Phase 1.
Add a `k8s/` directory with manifests when the migration actually happens.

## Implementation phases

### Phase 1 -- Core builder (MVP)

The minimum viable tool that is immediately useful for planning and sharing workouts.

- GPX import and map display (Leaflet).
- Segment editor: add, edit, remove, reorder segments.
- All three end condition types: distance, time, lap button.
- Click-on-map to place segment boundaries with snap-to-route.
- Segment visualization: colored polyline overlays on the route by effort/ride type.
- Repeat blocks: wrap segments, set iterations, FIT export with repeat steps.
- FIT workout file export.
- GPX course file export with waypoints at segment boundaries.
- Text summary export (copy to clipboard).
- Time-based mode (no route, segments defined by duration only).
- Dockerfile, nginx.conf, docker-compose.yml -- deployable from day one.

### Phase 2 -- Polish and sharing

- Drag-to-adjust segment boundaries on the map.
- Save/load workouts as JSON files (download/upload).
- URL-based sharing (encode workout definition in a shareable URL, or host JSON).
- Segment templates / presets for common patterns (warmup, threshold, recovery).
- FTP input with % FTP display alongside absolute watts.
- Elevation profile display with segment overlay.
- Kubernetes manifests (`k8s/` directory) if migration is happening.

Already shipped from this list: localStorage auto-save (workout and mode persist across page reloads).

### Phase 3 -- Connect IQ data field (separate project)

- Monkey C data field for Garmin devices.
- Reads a custom binary/JSON file with GPS-anchored segments.
- Auto-transitions workout steps based on GPS position.
- Custom display layout with segment name, target power, notes, and distance remaining.
- This is a distinct project with its own toolchain, device testing matrix, and CIQ store review.

## FIT binary format reference

### File structure

```
[14-byte header] [definition + data records...] [2-byte CRC]
```

### Header (14 bytes)

| Offset | Size | Field             | Value                                   |
|--------|------|-------------------|-----------------------------------------|
| 0      | 1    | header_size       | 14                                      |
| 1      | 1    | protocol_version  | 0x20 (2.0)                              |
| 2      | 2    | profile_version   | e.g. 0x0886 (2182), little-endian       |
| 4      | 4    | data_size         | total bytes of all records, little-endian |
| 8      | 4    | data_type         | ASCII '.FIT'                            |
| 12     | 2    | header_crc        | CRC-16 of bytes 0-11, or 0x0000         |

### Definition message

| Offset | Size | Field                |
|--------|------|----------------------|
| 0      | 1    | header: 0x40 bitor local_msg_type |
| 1      | 1    | reserved (0)         |
| 2      | 1    | architecture (0 = little-endian) |
| 3      | 2    | global_message_number |
| 5      | 1    | num_fields           |
| 6+     | 3×N  | fields: (def_num, size, base_type) |

### Data message

| Offset | Size | Field                |
|--------|------|----------------------|
| 0      | 1    | header: local_msg_type |
| 1+     | var  | field values in definition order |

### Base types

| Code | Type    | Size  |
|------|---------|-------|
| 0x00 | enum    | 1     |
| 0x84 | uint16  | 2     |
| 0x86 | uint32  | 4     |
| 0x8C | uint32z | 4     |
| 0x07 | string  | var   |

### CRC-16 lookup table (nibble-based)

```
[0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
 0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400]
```

Apply CRC over header bytes (for header CRC) and over header+data bytes (for file CRC). The 2-byte CRC is appended after
all data records.

## Code style and conventions

- TypeScript with strict mode.
- Textwidth 120 characters.
- Markdown follows default markdownlint rules; use `--` instead of em dashes.
- Functional React components with hooks.
- No default exports except for page-level components.
- Name files in kebab-case: `fit-encoder.ts`, `gpx-parser.ts`, `segment-editor.tsx`.
- Co-locate tests next to source files: `fit-encoder.test.ts`.
- Prefer explicit types over `any`. Use discriminated unions for the end condition and target types.

## File structure (proposed)

```
Dockerfile                       -- multi-stage build: node → nginx
docker-compose.yml               -- single-service compose for deployment
nginx.conf                       -- SPA routing + caching config
.dockerignore                    -- exclude node_modules, .git, dist, etc.
src/
  app.tsx                        -- main app shell, mode selection
  components/
    map-view.tsx                 -- Leaflet map with route + segment overlays
    segment-list.tsx             -- ordered list of items (segments + repeat blocks)
    segment-editor.tsx           -- form for editing a single segment
    repeat-block.tsx             -- repeat block wrapper with iteration controls
    workout-summary.tsx          -- visual bar chart of segments (expanded repeats)
    export-panel.tsx             -- export buttons and text preview
  lib/
    fit-encoder.ts               -- FIT binary file writer including repeat step logic
    fit-encoder.test.ts
    flatten.ts                   -- flatten WorkoutItem[] to FIT step list
    flatten.test.ts
    gpx-parser.ts                -- GPX XML parsing and distance calculation
    gpx-parser.test.ts
    gpx-exporter.ts              -- inject waypoints into GPX XML
    route-utils.ts               -- Haversine, interpolation, snap-to-route
    route-utils.test.ts
    text-export.ts               -- plain text / markdown summary generator
  types/
    workout.ts                   -- Workout, WorkoutItem, Segment, RepeatBlock, GpxRoute
  hooks/
    use-workout.ts               -- workout state management (context + reducer)
```

