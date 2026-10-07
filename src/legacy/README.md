# Classic presentation

This directory preserves the presentation immediately before the dashboard redesign, from Git commit `12e37c0`. It is a recoverable local baseline; its identity has not been verified against the deployed EC2 build.

`components/Dashboard.tsx` accepts `headerSlot` for the shared UI version switch. The recovered global `useFitToWidth` zoom is intentionally omitted: browser verification found that it scales the React Three Fiber canvas twice on narrower displays. Classic instead keeps its desktop layout and uses a viewport-height scroll container when space is limited. Mount only one dashboard and one Three.js canvas at a time.

Context, telemetry services, hooks, stores, types, data, assets, and control delivery remain shared with the current application. Switching presentations must happen inside the existing `PLCProvider`; this directory does not create a second telemetry connection or simulation engine. Changing the UI does not roll back the backend or command transport. Camera helpers stay local to the Classic factory so their module-level state cannot control the New factory accidentally.

`legacy-theme.css` aggregates the original dashboard theme. Activate its CSS only while Classic is selected, including for body-mounted portals. Tailwind utilities are emitted by the shared application entry and are deliberately absent from the legacy stylesheet. Integration stylesheet placeholders document features that did not exist in this baseline.

The Smart Meter uses the corrected shared `SmartMeterEmbed` entry document, preserving the fix that prevents the dashboard appearing recursively inside the meter modal.

The frozen source retains its existing optional scene meshes, ref-driven animation code, and older render-time calculations. Source-specific React Compiler lint exceptions cover the procedural R3F patterns rather than changing the recovered factory during a presentation migration. Older source findings such as unused optional meshes remain visible to general linting. Type checking still covers all legacy modules.
