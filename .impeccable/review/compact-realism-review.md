# Compact cards and physical factory finish review

## 1. Disposition

**Ship within the requested refinement scope.** No material visual defect requiring a fix, rebuild, or recapture was found in this bounded review. This is a review of the authored interactive production simulation, not a claim of a photorealistic or calibrated factory replica.

## 2. Quality against the user scope

- **Short horizontal KPI and workspace cards:** achieved. The desktop KPI row is visibly shallower, with values and compact plots sharing the same horizontal band. The workspace cards are substantially wider than tall, with descriptions and schematics side by side. The twin begins immediately below this compact rail and remains the dominant working surface. At CSS 1170 × 835 the rail begins around y=206 and the twin around y=325; the twin extends to the bottom of the working viewport. The mobile composition retains the same short-card treatment.
- **Centered 5/13 badges:** achieved in all relevant new captures. Both numerals sit in centered compact boxes on the tab baseline; neither repeats the obvious top alignment in the user rejection crop.
- **Distinct machine colors, including red:** achieved. Cobalt intake, red molding, teal filling, green cooling, gold inspection, orange cobot, and violet dispatch are individually recognizable. The red molding enclosure is immediately findable in the overview and clearly developed in the close-up.
- **Black floor without obscuring glare:** achieved. The floor reads as matte charcoal-black under scene lighting, with equipment and neutral metal edges remaining separable. No broad reflected light patch obscures any machine in the reviewed views.
- **More physical realism:** achieved at the appropriate level for this simulation. The molding close-up shows a layered painted enclosure, guard extrusions, service panels, louvers, fasteners, hoses, feet, and a restrained distinction between painted material and bare metal. The process internals remain visible. This is a meaningful increase in physical specificity, without treating added detail as real engineering certification.
- **Distinct sensor colors:** achieved. All eight channel labels, swatches, and range tracks retain distinct identities in the offline desktop and mobile views. Missing readings remain neutral dashes, with “Offline,” “Awaiting payload,” and “0 / 8 received” preserving their meaning.

## 3. Material findings with location and evidence

**No blocking or material findings.** The source agrees with the saved visual evidence:

| Requirement | Source location | Evidence |
| --- | --- | --- |
| Compact cards and centered count badges | `src/kpi-workspace.css:37`, `:72`, `:175`, `:269`, `:275` | Explicit centered inline-flex badges; 96px cards, 100px at wide screens; workspace minimum width 278px. `compact-realism-desktop1440.jpg`, `compact-realism-user1170.jpg`, `compact-realism-workspaces1170.jpg`, and `compact-realism-mobile390.jpg` show the intended geometry. |
| Black matte floor | `src/components/factory3d/ProductionPlant.tsx:34`, `:36`, `:113` | Black floor/slab colors with zero metalness, roughness 1, and environment intensity 0. Both desktop overview captures show clear equipment without floor glare. |
| Machine identity and material detail | `src/components/factory3d/industrialPrimitives.tsx:8`, `:15`; `src/components/factory3d/MachineDetails.tsx:33`, `:57`, `:87`, `:94`, `:107`, `:114`; `src/components/factory3d/IndustrialMachines.tsx:50` | Seven explicit paints, scoped clearcoat, and authored hardware. `compact-realism-molder1170.jpg` provides direct close-up evidence. |
| Stable sensor identity and honest absence | `src/plc-instruments.css:45`, `:59`, `:65`, `:68`; `src/components/PLCParametersWidget.tsx:74` | Channel styling is separate from signal status; unavailable values are dashes and have no filled reading bar. `compact-realism-mobile-plc390.jpg` verifies all eight channel faces. |

The live-value change flash remains a short 850ms change cue; label and track identity stay available. This does not materially undermine the channel distinction. The compact rail intentionally reveals part of the next card at narrower widths and includes a scroll affordance; this is not page overflow or a clipped fixed layout.

## 4. Craft-floor and functional review, with limits

The dark cyan application identity is retained. Hierarchy, grouping, tabular measurements, themed rail scrollbar, and declared focus/hover styles are coherent with an operating interface. Card borders use restrained depth without added halo shadows. The reduced card height does not introduce text overlap in the supplied views. The scene labels remain legible, although overview-scale machine details naturally become small on mobile; inspection is the appropriate route to detail.

Source-color contrast calculations for the eight sensor labels against their declared `#11212a` surface range from **7.76:1 to 10.99:1**; the shared secondary text `#a7bbc6` against `#17232d` is **8.04:1**. These support readable channel distinctions; they are not a whole-application accessibility audit. The detector file was independently counted: **95 advisory token/type findings, zero non-advisory findings**. These advisories do not establish a visible failure against the latest direction.

The main agent reports 62 scoped frontend/process/control tests, focused lint, application TypeScript, and the production build passing. Those commands were not rerun in this review. The main agent also confirms CSS 1170px document width at its restored desktop viewport and no horizontal page overflow at mobile; the known provider raster/CSS viewport difference does not require recapture. Reported browser errors are existing offline Mosquitto retry failures, consistent with the visible unavailable PLC state.

This review used saved images and relevant source only. It did not operate the browser, exercise keyboard navigation, observe the animation timeline, connect hardware, or independently verify runtime performance. Preserved behavior therefore relies on the reported scoped tests and the unchanged control paths rather than screenshot inference.

## 5. Scope of verdict

Reviewed the latest paragraphs of `.impeccable/direction.md`, both supplied user rejection images, and all six required `compact-realism-*` captures: desktop 1440, user 1170, workspaces 1170, molding close-up, mobile 390, and scrolled mobile PLC. Each saved image was opened directly. Source inspection was limited to the specified card, PLC, and factory presentation targets. The latest black-floor and short-card request supersedes the earlier slate-floor and tall-card decisions.

The verdict covers only the requested visual refinement and its directly related presentation states. It does not certify unrelated modified backend/deployment files, all workspaces, connected PLC behavior, device calibration, or real machinery safety. No application source was changed during this single bounded review.
