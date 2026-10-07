# Matte essentials finish review

## 1. Disposition

**SHIP the latest scoped refinement.** No material visual defect in the required captures calls for a fix, rebuild, or recapture. This is a fresh assessment of the current images against the latest request, not an inherited verdict.

The simplified rail, textured matte floor, muted machine paint, and closer overview address the rejected congested rail and plain black slab. The result remains an authored process simulation, not a calibrated or photoreal factory replica.

## 2. Quality against the brief

- **Essentials only:** workspace launchers show a consistent icon, name, and launch arrow. Metric cards show name, reading, unit, and change. Removing the small diagrams, chart captions, and descriptions makes the rail substantially easier to scan than the supplied rejection image. The explicit Sample data disclosure remains next to Plant KPIs.
- **Matte twin and floor:** broad painted surfaces now read as softer industrial finishes. Machine categories remain distinguishable without taking over the dark-cyan interface. Concrete aggregate is visible across the floor instead of the former uniform black fill; there is no broad mirror-like floor reflection.
- **Twin a little bigger:** the scene has greater visual ownership below the short rail. At 1440 and 1170 CSS widths, the intake, forming, filling, cooling, inspection, packaging, and dispatch stations all remain visible. Some surrounding slab/wall reaches the scene edge, which is an acceptable trade for focusing the framing on the equipment.
- **Responsive composition:** both mobile captures retain a legible first card, a partial next card, and a separate right-scroll affordance. The twin remains below the rail with all seven station labels visible; telemetry continues below the scene. The partial card is expected horizontal-rail behavior, not page overflow.

## 3. Material findings and evidence

No blocking findings were observed in this pass.

| Finding | Visual evidence | Supporting source |
| --- | --- | --- |
| The rail is genuinely simpler, rather than the same dense content compressed further. | `matte-essential-workspaces1440.jpg`, `matte-essential-user1170.jpg`, and `matte-essential-mobile390.jpg` show one-line launchers. The metrics captures have a clear name/value hierarchy without miniature charts. | `src/components/KpiCard.tsx:92` renders the identity/status row; line 115 confines the reading body to metric cards. `src/components/KPIBar.tsx:369` preserves launcher handlers and LoRaWAN while moving descriptions to native title text. `src/kpi-workspace.css:76` sets 80px metrics; line 170 sets 64px launchers. |
| The floor has a quiet physical finish and the machine paint is matte. | Aggregate variation is visible in all desktop captures, especially the open floor to the right of the forming station. No glare patch dominates the slab. Paint retains identifiable muted blue, red, teal, green, ochre, orange, and violet categories. | `src/components/factory3d/FactoryFloor.tsx:7` authors deterministic color/bump textures; line 56 uses roughness 1, metalness 0, and environment intensity 0; lines 59–60 add low-contrast joints. `src/components/factory3d/industrialPrimitives.tsx:8` defines the muted palette; lines 15–18 and 27 use standard matte paint materials without clearcoat. `IndustrialMachines.tsx:16` applies the same finish to the large intake cylinders. |
| The closer overview preserves the production line. | All seven labels are visible in each of the five current captures. The 1170 view avoids clipping the foreground intake or rear dispatch, and mobile maintains the entire station set. | `src/components/factory3d/CameraController.tsx:11` defines the closer position; line 12 targets `[-2, 0.5, 2]`; lines 15–22 compensate for narrow scene aspect ratios. `ProductionPlant.tsx:112` supplies matte station pads, and line 119 keeps the station controls. |

The 14 detector results in `matte-essential-detector.json` are all advisory design-system color/type documentation mismatches. There are no non-advisory findings in that file. They do not contradict the accepted dark-cyan and muted-machine direction, and this review does not propose broad token cleanup.

## 4. Craft floor and functional limits

The scoped rail uses a 12px radius, a single border without shadow, an orderly type hierarchy, tabular numbers, cyan focus outlines, and a themed scrollbar. Static contrast calculations for the inspected default metric-card surface (`#17232d`) give 12.50:1 for labels, 14.48:1 for values, 8.04:1 for units/secondary text, and at least 7.67:1 for the listed trend colors. These are source-color checks, not a complete rendered accessibility certification. Focus rules, selected states, hover states, reduced-motion handling, native button semantics, and keyboard tab navigation are present in the inspected source.

The author reports 24 passing KPI/process/twin tests, focused lint, TypeScript build, and Vite build. The author also reports actual DOM verification at 1170×835: all 13 workspace actions present, 64px launcher height, no internal card overflow, and page width 1170; at mobile CSS width 390, page width is 385 without page overflow. Those runtime facts support this disposition but were not independently rerun by this reviewer.

Static captures do not establish animation smoothness, whole-cycle mechanics, keyboard traversal in the running app, touch behavior, live PLC connectivity, or every offscreen drawer state. Mobile station labels are necessarily compact overview controls; fine machine inspection still depends on the existing selection/zoom experience. No new functional guarantee or physical-calibration claim is made.

## 5. Scope and capture record

Reviewed the latest paragraphs of `.impeccable/direction.md`, the Impeccable craft floor, the supplied rejection image, and the following fresh captures by opening their actual image pixels:

- `matte-essential-desktop1440.jpg` — metrics, CSS viewport 1440×1000.
- `matte-essential-workspaces1440.jpg` — workspace launchers, CSS width 1440.
- `matte-essential-user1170.jpg` — workspace launchers, CSS viewport 1170×835.
- `matte-essential-mobile390.jpg` — workspace launchers, CSS width 390.
- `matte-essential-mobile-metrics390.jpg` — metrics, CSS width 390.

The known Windows/provider image-size versus CSS-viewport differences were not treated as malformed captures. The reference rejection image was used to identify the actual complaint, not as the required final viewport size.

Source review was restricted to the latest rail, material, and framing changes in `src/kpi-workspace.css`, `KPIBar.tsx`, `KpiCard.tsx`, `FactoryFloor.tsx`, `industrialPrimitives.tsx`, `IndustrialMachines.tsx`, `MachineDetails.tsx`, `ProductionPlant.tsx`, and `CameraController.tsx`. No browser operation, UI edit, broad application audit, or extra capture round was performed. This report is the only authored review artifact.
