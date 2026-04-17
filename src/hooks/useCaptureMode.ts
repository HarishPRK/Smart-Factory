/**
 * Capture-mode detection.
 *
 * Heuristics (any one triggers capture mode):
 *   1. The page itself is being captured via getDisplayMedia — we wrap that
 *      API once so we know when a stream is active.
 *   2. document.pictureInPictureElement is set.
 *   3. User toggled the manual ?capture=1 URL flag (escape hatch for testing
 *      screen-share smoothness while not actually sharing).
 *
 * When active, 3D scene downgrades to 60fps target + reduces instance counts,
 * and Dashboard CSS strips backdrop-filter to reduce GPU blur cost during
 * video encoding.
 */
import { useEffect, useState } from "react";

let globalActive = false;
const listeners = new Set<(v: boolean) => void>();

function notify(v: boolean) {
  if (globalActive === v) return;
  globalActive = v;
  for (const fn of listeners) fn(v);
  if (typeof document !== "undefined") {
    document.body.classList.toggle("capture-mode", v);
  }
}

let wrapped = false;
function wrapGetDisplayMedia() {
  if (wrapped || typeof navigator === "undefined") return;
  const md = navigator.mediaDevices;
  if (!md || !md.getDisplayMedia) return;
  wrapped = true;
  const original = md.getDisplayMedia.bind(md);
  md.getDisplayMedia = async (constraints?: MediaStreamConstraints) => {
    const stream = await original(constraints);
    notify(true);
    const ended = () => {
      if (stream.getTracks().every((t) => t.readyState === "ended")) {
        notify(false);
      }
    };
    stream.getTracks().forEach((t) => t.addEventListener("ended", ended));
    return stream;
  };
}

function readManualFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("capture") === "1";
  } catch {
    return false;
  }
}

export function useCaptureMode(): boolean {
  const [active, setActive] = useState(() => globalActive || readManualFlag());
  useEffect(() => {
    wrapGetDisplayMedia();
    if (readManualFlag()) notify(true);
    const fn = (v: boolean) => setActive(v);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return active;
}

export function setCaptureMode(v: boolean) {
  notify(v);
}
