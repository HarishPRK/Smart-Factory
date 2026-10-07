---
name: "Smart Factory — Cyan Operations"
description: "Dark cyan instruments and workspaces around a colorful, coordinated factory simulation."
colors:
  primary: "#43d8f1"
  primary-hover: "#7deafb"
  selection-ink: "#08212a"
  page: "#0d151c"
  rail: "#0a1117"
  panel: "#17232d"
  metric-panel: "#14242e"
  panel-raised: "#1d2d38"
  edge: "#2e4553"
  edge-strong: "#497080"
  text: "#eef5f7"
  text-secondary: "#a7bbc6"
  text-dim: "#90aab7"
  success: "#6ed6a2"
  warning: "#e9bd70"
  danger: "#f18b82"
  scene: "#162a35"
  floor-charcoal: "#343d40"
  floor-joint: "#293134"
  service-wall: "#adb3ae"
  slab-edge: "#20292d"
  stage-pad: "#374347"
  stage-pad-selected: "#435b63"
  metal-shell: "#e4e9e8"
  metal-steel: "#c1c9cc"
  metal-edge: "#87999f"
  metal-dark: "#26353d"
  intake-paint: "#3b759b"
  forming-paint: "#a14b4a"
  filling-paint: "#438a8b"
  cooling-paint: "#527d61"
  inspection-paint: "#b89b4f"
  robot-paint: "#c18046"
  dispatch-paint: "#837093"
  sensor-voltage: "#f2ad67"
  sensor-current: "#43d8f1"
  sensor-ph: "#c7a4ed"
  sensor-pressure: "#82b5f6"
  sensor-mq-gas: "#ef9eaa"
  sensor-turbidity: "#56cbbb"
  sensor-light: "#e5d476"
  sensor-orp: "#a0d891"
typography:
  headline:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "29px"
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 620
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "11px"
    lineHeight: 1.55
  label:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 550
    letterSpacing: "0"
  metric:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  metric-label:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "0.01em"
  measurement:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.025em"
  inspector-reading:
    fontFamily: "'Geist Mono', 'JetBrains Mono', monospace"
    fontSize: "14px"
    fontWeight: 500
rounded:
  small: "4px"
  control: "5px"
  tool-group: "6px"
  group: "7px"
  grid: "8px"
  meter: "9px"
  card: "12px"
  dialog: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  compact: "10px"
  md: "12px"
  lg: "16px"
  panel: "18px"
  xl: "24px"
components:
  button-view:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.small}"
    padding: "0 9px"
    height: "28px"
  button-view-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.selection-ink}"
  button-view-selected-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.selection-ink}"
  field-select:
    backgroundColor: "{colors.panel-raised}"
    textColor: "#d7e6ed"
    rounded: "{rounded.control}"
    padding: "7px"
    width: "100%"
  chip-source:
    textColor: "#acd5df"
    rounded: "{rounded.control}"
    padding: "6px 9px"
  chip-source-sample:
    textColor: "{colors.warning}"
  navigation-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.grid}"
    width: "57px"
    height: "59px"
  navigation-item-current:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.selection-ink}"
  card-metric:
    backgroundColor: "{colors.metric-panel}"
    rounded: "{rounded.card}"
    padding: "10px 12px"
    height: "86px"
    width: "192px"
  card-metric-hover:
    backgroundColor: "#1d303c"
  card-metric-selected:
    backgroundColor: "#17353f"
  card-launcher:
    backgroundColor: "{colors.metric-panel}"
    rounded: "{rounded.card}"
    padding: "10px 12px"
    height: "86px"
    width: "192px"
  sensor-monitor:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
  sensor-monitor-row:
    backgroundColor: "transparent"
    padding: "5px"
    width: "100%"
  button-sensor-monitor:
    backgroundColor: "#1b303a"
    textColor: "#b8eaf2"
    rounded: "{rounded.control}"
    padding: "0 9px"
  sensor-face:
    backgroundColor: "transparent"
    padding: "9px 10px 6px"
  button-langgraph:
    backgroundColor: "#18333e"
    textColor: "{colors.primary-hover}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "36px"
  analytics-range:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  analytics-range-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.selection-ink}"
  inspector:
    backgroundColor: "#17232dfa"
    textColor: "#d7e6ed"
    rounded: "{rounded.card}"
    padding: "19px 16px"
    width: "100%"
---

# Design System: Smart Factory — Cyan Operations

## Overview

**Creative North Star: "The Cyan Control Workspace"**

Smart Factory combines an ink-charcoal shell, layered slate instruments, bright cyan interaction, and near-white text. Inter Variable carries the interface and most tabular measurements. Muted, matte-painted machines remain legible against a dark blue-gray studio and textured charcoal floor; their physical actions explain the process.

This is the current user-approved dark cyan replacement. The final shared palette lives in `application-cyan.css`; the legacy filename `plant-daylight.css` now also contains dark values. `kpi-workspace.css`, `plc-instruments.css`, and `components/workspace-details.css` supply the finished instrument, launcher, Analytics, and LoRaWAN patterns. Shared portal styling extends the cyan theme to existing workspaces without claiming every integration interior has been rebuilt.

**Key Characteristics:**

- Charcoal and slate surfaces with bright cyan selection.
- A shared compact card frame for KPI sample sparklines and workspace destination diagrams.
- Tabular Inter readings with explicit units and data sources.
- A 34-sensor monitor across seven stages, eight PLC faces, and honest unavailable states.
- Muted machinery on a textured matte charcoal floor, coordinated by one simulation clock.
- Responsive inspection beside the model or below it on phones.

## Colors

Cyan indicates interaction; neutral slate supports dense information; status and machine identity retain separate color roles.

### Primary

- **Instrument Cyan / Hover Cyan** (`primary`, `primary-hover`): selected navigation, view controls, time ranges, primary actions, and keyboard focus.
- **Selection Ink** (`selection-ink`): dark text on filled cyan controls.

### Secondary

- **Success Mint / Warning Amber / Fault Coral** (`success`, `warning`, `danger`): meaningful connection, process, and alert states, paired with words. Individual instrument variants use brighter state tints where needed.
- **Muted Blue Intake, Brick Forming, Teal Filling, Sage Cooling, Ochre Inspection, Copper Cobot, Dusty Violet Dispatch** (`*-paint`): actual machine identity from `MACHINE_PAINT`. These categorical colors are not alarm states.
- **Neutral Shell / Stainless Steel / Brushed Edge / Dark Structure** (`metal-shell`, `metal-steel`, `metal-edge`, `metal-dark`): reusable structural materials.
- **Sensor channel accents** (`sensor-*`): voltage peach, current cyan, pH lavender, pressure blue, MQ gas rose, turbidity teal, light yellow, and ORP green. Labels, swatches, and range tracks retain identity offline; warning and critical states have separate colors.

### Neutral

- **Textured Charcoal Floor / Slab Edge / Stage Pad / Selected Stage Pad** (`floor-charcoal`, `slab-edge`, `stage-pad`, `stage-pad-selected`): nonreflective concrete and machinery pads. Low-contrast joints use `floor-joint`; the rear service wall uses `service-wall`.

- **Ink Page / Deeper Rail** (`page`, `rail`): the application canvas and navigation.
- **Slate Panel / Raised Slate / KPI Panel** (`panel`, `panel-raised`, `metric-panel`): instrument surfaces, nested regions, and the slightly deeper compact KPI and workspace cards.
- **Panel Edge / Strong Edge** (`edge`, `edge-strong`): one-pixel separation and stronger interactive boundaries.
- **Cool White / Secondary Blue Gray / Dim Blue Gray** (`text`, `text-secondary`, `text-dim`): text hierarchy.
- **Studio Blue Gray** (`scene`): the rendered scene background.

**The Cyan Means Interaction Rule.** Reserve filled cyan controls for current or selected interaction states; use dark ink inside them.

**The Source Has a Name Rule.** Distinguish Sample data, Modeled process, estimated quality, actual PLC availability, and LoRaWAN packet-wait states.

**The Machine Color Rule.** Let paint distinguish equipment without treating its hue as operational status.

## Typography

**Interface and Primary Measurements:** Inter Variable, with Inter and system sans-serif fallbacks.  
**Remaining Mono Roles:** Geist Mono for inspector sensor readings and small scene identifiers, with JetBrains Mono and monospace fallbacks.

### Hierarchy

- **Headline:** the production heading uses `headline`; phones use 27px. Analytics uses a 25px heading, reducing to 22px on narrow screens.
- **Title:** the PLC heading uses `title`. The twin heading is 13px and the inspector heading 17px.
- **Body:** compact explanations and source disclosures use the `body` scale. Launcher descriptions remain in title tooltips.
- **Label:** KPI and workspace names share the 11px, weight-650 `metric-label` role. LoRaWAN readings use 12px at weight 550; state and source metadata generally uses 9–11px.
- **Metric:** KPI values use the 24px, weight-600 `metric` role at every breakpoint.
- **Measurement:** analog sensor values use `measurement`. Power monitor values use Inter at 17px for primary phase values, 11px for additional V/A/W readings, and 20px for totals.
- **Inspector reading:** the existing compact mono reading uses `inspector-reading`.

**The Stable Reading Rule.** Use tabular numerals, keep units separate, and display missing measurements as unavailable rather than zero.

## Layout

The desktop shell retains a 76px left rail, 98px left content padding, 20px right padding, a 62px header, and a 98px title region. The main grid uses a flexible model column and a 295px sidebar separated by 16px. The main stack places the instrument rail above the factory; the sidebar places the sensor monitor above PLC telemetry and hardware controls by default, with selected-machine inspection taking the monitor position.

KPI cards have a fixed 192px width and 86px height, 10px 12px padding, and 8px gaps, grouped at the left of the rail. All thirteen workspace cards share the same fixed 192px width, 86px height, 10px 12px padding, and 8px gaps, including LoRaWAN. Thirteen workspace launchers include LangGraph AI. The rail scrolls horizontally with proximity snapping instead of shrinking labels. Its reduced height gives more vertical space to the digital twin.

The twin has a 49px heading and a canvas extending to its bottom edge. Tools overlay its top; status and Fit line sit near the bottom. There is no production-sequence strip. Focus model hides the sidebar; fullscreen and focused mode use an overlay inspector. The three-quarter overview frames all seven stations from [-23.5, 23.29, 32.96] toward [-2, 0.5, 2]. Aspect compensation scales camera distance relative to that target so narrow views retain the equipment footprint.

Responsive behavior:

- At 1700px and above, the shell uses a 330px sidebar, 20px grid gap, and 106px left / 26px right padding.
- At 1200px and below, the rail becomes 68px, the sidebar 278px, and the grid gap 12px.
- At 960px and below, the primary layout stacks and the model is 650px high.
- At 700px and below, the toolbar wraps with a 66px minimum height; KPI cards retain their fixed 192px width and 86px height. Workspace cards retain the same 192px by 86px frame. Analytics and LoRaWAN layouts simplify.
- At 640px and below, the rail becomes a 56px top bar, gutters become 10px, and the model is 425px high. Inspector and telemetry follow the model.
- Short desktops allow document scrolling; the page is never scaled to fit.

Analytics is a bounded dialog up to 1220px wide, with independently scrolling content and horizontal section navigation. Its SVG charts use responsive pixel dimensions. LoRaWAN uses a drawer up to 760px wide with a compact summary and explicit empty state.

## Elevation & Depth

Ordinary instruments are flat, with surface shifts and fine borders. Hover brightens a card and its border without a lift. Floating labels, settings, dialogs, and drawers use soft black shadows; docked inspectors remove their overlay shadow.

### Shadow Vocabulary

- **Machine label:** `0 3px 10px #00000040`.
- **Floating settings / inspector:** `0 9px 28px #00000040`.
- **Analytics dialog:** `0 22px 76px #0008`.
- **Shared small / medium / large / extra-large:** `0 2px 8px #00000022`, `0 5px 18px #00000030`, `0 12px 32px #00000044`, and `0 20px 56px #00000055`.

The model uses cast shadows, local environment reflections on equipment, warm key light, and restrained cool fill to preserve painted colors. Floor, slab edges, and stage pads are fully matte: metalness 0, roughness 1, and environment-map intensity 0. The charcoal floor uses a deterministic 256px aggregate color-and-bump texture pair, repeated 12 by 8 with bump scale 0.018, plus flush low-contrast control joints. It has no environment reflection, while contact shadows remain. Powder-coated machine paint uses MeshStandardMaterial with metalness 0.05, roughness at least 0.72, environment intensity 0.35, and no clearcoat. Exposed neutral steel has a satin finish with roughness around 0.46–0.58. Repeated hardware and flooring retain standard materials; small hardware is instanced. High and Ultra quality add N8AO contact depth, ACES tone mapping, and SMAA. Balanced and Efficient omit that postprocessing stack. High uses half-resolution AO; Ultra uses full-resolution, higher-quality AO.

**The Physical Depth Rule.** Let lighting explain machinery, keep concrete matte, and reserve interface shadows for floating layers.

## Shapes

Major KPI cards, actuator cards, the twin, and docked inspectors use 12px corners. PLC containers and Analytics use 14px; analog grids use 8px; the power monitor uses 9px. Controls and badges use smaller 4–7px corners. Analog instruments share a bounded two-column grid, expanding to four columns between 600px and 960px, while digital I/O uses separated rows.

The factory remains a cutaway slab with machine pads, rear service wall, utility racks, safety fences, and conveyor geometry. The former floor title and header PET tag are removed. Colored equipment is authored geometry, not a raster replacement. Service panels, louvers, guard frames, bolted flanges, anchor feet, fan grilles, and hoses add physical specificity while keeping process internals visible.

## Components

### Buttons

Filled cyan identifies current navigation, selected projections, selected Analytics ranges, and the Insights action. Hover uses lighter cyan. Secondary controls use transparent or slate surfaces with fine borders. Native selects use raised slate with a strong edge.

Focus is visible: most shell and Analytics controls use a 2px cyan outline with 3px offset; KPI controls use lighter cyan with 2px offset; PLC controls use an inset outline offset of -3px. Instrument hover transitions last 160ms. Reduced-motion removes interface transitions and animations, stops the process clock, and makes camera navigation immediate.

### Chips

Analytics source badges pair a dot with source text; mock sources use amber. Plant KPI sample disclosure is quiet inline text beside the category label. The 5/13 count badges use inline-flex centering, a 19px minimum width, 18px height, 0 4px padding, and line-height 1. Avoid implying live data through a decorative status marker.

### Cards / Containers

Metric instruments pair a 24px tinted icon tile with a title and change chip, then a 24px value and separate unit beside a 60px by 28px sparkline. Sparklines show only the relative shape of supplied sample series, with a final-point marker; they imply no time or physical-unit scale and disappear when fewer than two samples exist. The Sample data disclosure remains at group level, with no crowded captions inside the cards. Selected borders are cyan.

Workspace launchers share the KPI surface, 24px tinted icon tile, and 11px title scale. Each tool places a word-free 112px by 28px destination diagram at the lower left and a 22px tinted launch affordance at the lower right. These static diagrams explain the destination without claiming counts, activity, or telemetry. Functional descriptions stay in title tooltips. All thirteen actions remain available, including LangGraph AI. LoRaWAN uses a static 40px by 28px radio drawing beside its 12px reading: reported average moisture, reported average temperature, or device count. It excludes values flagged as simulated gap fills. Before the first packet, its reading is Awaiting data and its status is Waiting; received packets use Received, while an actual battery reading below 3.3V uses Low battery. Its custom accessible label retains the full source-qualified values and units, and the card opens the full drawer.

PLC telemetry begins with a controller-link schematic and explicit connected, unavailable, awaiting-payload, or last-received wording. Operator access, analog sensors, digital I/O, and a full-width three-phase power monitor follow. Eight supported analog faces remain visible: voltage, current, pH, pressure, MQ gas, turbidity, light, and ORP. Channel-colored labels and 5px square swatches remain visible offline, and range tracks mix the channel color at 38% with #263d49. Unavailable readings show neutral #93aebb dashes; scales and nominal markers are configuration rather than samples. Warning and critical fills stay separate from channel identity. The received count and key explain availability. The power monitor includes a phase schematic and per-phase V/A/W readings. Last received values are identified when disconnected. Hardware command handlers remain intact; RFID testing stays labeled as a test override.

The Sensor monitor is visible by default in the existing sidebar above PLC telemetry. Its named toggle lives in the twin heading and exposes the current expanded state. The panel contains 34 sensor readings across seven stage groups, in rows at least 44px high, inside an independently scrolling area capped at 460px on desktop and 360px at 700px and below. Sim identifies modeled values and Live identifies PLC input; missing values use neutral dashes and no source badge. The 48px by 18px trends use the most recent 24 stored history samples, break across invalid values, and show a neutral rule when fewer than two valid samples exist. Process interlocks separately report Clear, Triggered, or neutral Unavailable with Sim, Live, or Mixed source qualification when known. Selecting a reading focuses its station and replaces the monitor with the stage inspector; returning to the whole line restores the monitor. Closing the monitor returns keyboard focus to its toggle. If no sidebar inspector host is available, the panel uses a bounded overlay inside the twin.

### Inputs / Fields

Display settings retain native selects, checkboxes, and a speed range with visible labels. Simulation tools remain under a disclosure and state that no equipment commands are sent. Analytics parameter controls and time ranges use pressed states. This contract does not establish a general-purpose text-input component.

### Navigation

The charcoal rail uses icon-and-label destinations with bright cyan current state and becomes horizontal on phones. Plant KPIs and Workspaces use underline tabs above the card rail. Analytics supplies its own scrolling section navigation and range controls. Shared root tokens and semantic dialog boundaries keep portal workspaces within the cyan system.

### Inspection and Process

LangGraph AI has a named in-flow header entry and a workspace launcher, separate from Ask AI. Its open entry uses cyan selection. The existing conversation remains mounted when the dialog closes, preserving chat across reopening. The dialog retains its composer, focus trap, and focus restoration. The former unlabelled floating trigger is no longer the entry pattern; current styling is in `src/components/langgraph-entry.css`.

Selecting equipment focuses the camera and opens an inspector in the sensor monitor position beside the model on desktop or below it on phones. It identifies Modeled process and estimated quality, and explains that available PLC inputs replace simulated sensor values.

The factory shows resin feed, a forming preform, bottle expansion, nozzle docking, continuous filling, eased capping, cooling, scanning, and robotic carton packing. Products, machines, gripper, and carton share a pausable speed-aware clock. Robot transfer includes vertical clearance, neck attachment, placement through the open carton center, and withdrawal before closure. Instanced pellets and rollers control rendering cost. Bulk resin traverses its feed path in 18 logical seconds with calmer tumbling and auger rotation; the discrete product timeline stays intact.

This cycle is illustrative, not calibrated physical timing. Scene selection, camera movement, render settings, and simulation controls do not issue hardware commands. There is no X-ray control or production-sequence strip.

## Do's and Don'ts

### Do:

- **Do** use charcoal/slate surfaces with bright cyan selection and dark text inside selected controls.
- **Do** use Inter tabular readings and retain mono only in the existing compact inspector and identifier roles.
- **Do** distinguish sample metrics, modeled behavior, estimated quality, PLC availability, and packet-wait states.
- **Do** use concise launcher names, meaningful status, and explicit missing-data messages.
- **Do** coordinate machine and product motion through the shared process clock.
- **Do** keep concrete textured and matte, with muted powder-coated machine paint.
- **Do** keep LangGraph AI visibly named and separate from Ask AI.
- **Do** retain responsive reflow, visible focus, and reduced-motion behavior.

### Don't:

- **Don't** restore the superseded daylight palette or global purple treatments.
- **Don't** turn missing PLC or LoRaWAN data into fabricated metric values.
- **Don't** treat machine paint as an alarm or calibrated simulation as an established capability.
- **Don't** restore X-ray or the removed production-sequence strip.
- **Don't** reintroduce reflective floors, verbose workspace descriptions, or crowded chart captions in the compact rail.
- **Don't** issue hardware commands through scene navigation or simulation settings.

Not canonized: superseded theme declarations, unused sequence selectors, and unreviewed integration-specific layout details remain outside these reusable rules. The legacy daylight filename does not describe the current palette.
