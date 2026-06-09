import { useLayoutEffect } from "react";

/**
 * Scales the whole app to fit the available viewport width against a fixed
 * design width, using CSS `zoom` on the root <html> element.
 *
 * Why: the dashboard is laid out with mostly fixed pixel sizes tuned for a
 * ~1920px-wide viewport. Windows display scaling (e.g. 125%) shrinks the CSS
 * viewport (1920 physical → ~1536 CSS px), so the fixed-size header, badges,
 * and PLC sidebar no longer fit and truncate. Applying `zoom = viewport /
 * design` gives the layout back its full design width, so 125% renders the
 * same proportions as a clean 100% display — just slightly smaller.
 *
 * `zoom` (not `transform: scale`) is used deliberately: it reflows layout and
 * cascades to body-level portals (modals), so fixed positioning and the 3D
 * canvas keep working without blur or coordinate offsets.
 *
 * Only ever scales DOWN (capped at 1) — wider screens keep native size and let
 * the existing responsive flex/grid fill the extra space.
 *
 * Height caveat: a `100dvh` element under `zoom: z` renders at only `z × 100dvh`
 * of the real screen, leaving an empty band at the bottom. To compensate we
 * publish `--fit-vh = innerHeight / z` (the logical viewport height) and the
 * `.h-dvh` / `.min-h-dvh` / `.max-h-dvh` utilities read it (see index.css), so
 * the full-height layout fills the screen exactly after zooming.
 */
const DESIGN_WIDTH = 1920;
const MIN_ZOOM = 0.5;

export function useFitToWidth(designWidth: number = DESIGN_WIDTH) {
  useLayoutEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const zoom = Math.min(1, Math.max(MIN_ZOOM, window.innerWidth / designWidth));
      // `zoom: 1` is the browser default — clear the overrides so nothing is
      // pinned when no scaling is needed (utilities fall back to 100dvh).
      if (zoom >= 1) {
        root.style.removeProperty("zoom");
        root.style.removeProperty("--fit-vh");
      } else {
        root.style.setProperty("zoom", String(zoom));
        // Logical viewport height: dividing by zoom makes the zoomed result
        // equal the real innerHeight, so the full-height layout fills the screen.
        root.style.setProperty("--fit-vh", `${window.innerHeight / zoom}px`);
      }
    };

    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.style.removeProperty("zoom");
      root.style.removeProperty("--fit-vh");
    };
  }, [designWidth]);
}
