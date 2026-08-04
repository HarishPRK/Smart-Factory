import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { ThemeProvider } from "../integrations/ui/Theme";

interface IntegrationModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the modal header strip. */
  title: string;
  /** Immersive uses a near-full-width frame for spatial experiences. */
  layout?: "standard" | "immersive";
  /** Shows a native fullscreen toggle in the header. */
  enableFullscreen?: boolean;
  /** Optional content element to fullscreen instead of the modal shell. */
  fullscreenTargetRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

interface FullscreenStyleSnapshot {
  element: HTMLElement;
  position: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  margin: string;
  borderRadius: string;
  zIndex: string;
  overflow: string;
}

/**
 * Full-screen overlay modal that hosts an integration page (Dynamic Path
 * Selection / Video Analytics). The body is wrapped in `.integration-scope`
 * + `<ThemeProvider>` so the integration's design tokens, `.card`/`.grid`
 * styles, and `useThemeColors()` hook resolve correctly inside.
 */
const IntegrationModal: React.FC<IntegrationModalProps> = ({
  open,
  onClose,
  title,
  layout = "standard",
  enableFullscreen = false,
  fullscreenTargetRef,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenStyleRef = useRef<FullscreenStyleSnapshot | null>(null);

  const getFullscreenTarget = useCallback(
    () => fullscreenTargetRef?.current ?? dialogRef.current,
    [fullscreenTargetRef],
  );

  const applyFullscreenPresentation = useCallback((element: HTMLElement) => {
    if (!fullscreenStyleRef.current) {
      fullscreenStyleRef.current = {
        element,
        position: element.style.position,
        top: element.style.top,
        right: element.style.right,
        bottom: element.style.bottom,
        left: element.style.left,
        width: element.style.width,
        height: element.style.height,
        maxWidth: element.style.maxWidth,
        maxHeight: element.style.maxHeight,
        margin: element.style.margin,
        borderRadius: element.style.borderRadius,
        zIndex: element.style.zIndex,
        overflow: element.style.overflow,
      };
    }

    element.style.position = "fixed";
    element.style.top = "0";
    element.style.right = "0";
    element.style.bottom = "0";
    element.style.left = "0";
    element.style.width = "100vw";
    element.style.height = "100vh";
    element.style.maxWidth = "none";
    element.style.maxHeight = "none";
    element.style.margin = "0";
    element.style.borderRadius = "0";
    element.style.zIndex = "9999";
    element.style.overflow = "hidden";
  }, []);

  const restoreFullscreenPresentation = useCallback(() => {
    const snapshot = fullscreenStyleRef.current;
    if (!snapshot) return;

    const { element } = snapshot;
    element.style.position = snapshot.position;
    element.style.top = snapshot.top;
    element.style.right = snapshot.right;
    element.style.bottom = snapshot.bottom;
    element.style.left = snapshot.left;
    element.style.width = snapshot.width;
    element.style.height = snapshot.height;
    element.style.maxWidth = snapshot.maxWidth;
    element.style.maxHeight = snapshot.maxHeight;
    element.style.margin = snapshot.margin;
    element.style.borderRadius = snapshot.borderRadius;
    element.style.zIndex = snapshot.zIndex;
    element.style.overflow = snapshot.overflow;
    fullscreenStyleRef.current = null;
  }, []);

  const closeModal = useCallback(() => {
    const target = getFullscreenTarget();
    if (document.fullscreenElement === target) {
      void document.exitFullscreen();
    }
    restoreFullscreenPresentation();
    setIsFullscreen(false);
    onClose();
  }, [getFullscreenTarget, onClose, restoreFullscreenPresentation]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      // Escape should leave fullscreen first, then close the modal on a
      // second press. This also covers the CSS fallback below.
      const target = getFullscreenTarget();
      if (isFullscreen || document.fullscreenElement === target) {
        if (document.fullscreenElement === target) {
          void document.exitFullscreen();
        }
        restoreFullscreenPresentation();
        setIsFullscreen(false);
        return;
      }

      closeModal();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal, getFullscreenTarget, isFullscreen, open, restoreFullscreenPresentation]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const target = getFullscreenTarget();
      const active = document.fullscreenElement === target;
      if (!active) restoreFullscreenPresentation();
      setIsFullscreen(active);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [getFullscreenTarget, restoreFullscreenPresentation]);

  useEffect(() => {
    if (open) return;

    if (document.fullscreenElement === getFullscreenTarget()) {
      void document.exitFullscreen();
    }
    restoreFullscreenPresentation();
  }, [getFullscreenTarget, open, restoreFullscreenPresentation]);

  const toggleFullscreen = async () => {
    const target = getFullscreenTarget();
    if (!target) return;

    if (isFullscreen) {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
      }
      restoreFullscreenPresentation();
      setIsFullscreen(false);
      return;
    }

    // The dashboard is also served over plain HTTP on some EC2 setups. Keep
    // the maximize behavior useful there with a viewport-filling fallback.
    applyFullscreenPresentation(target);
    if (!document.fullscreenEnabled || !target.requestFullscreen) {
      setIsFullscreen(true);
      return;
    }

    try {
      await target.requestFullscreen();
    } catch {
      setIsFullscreen(true);
    }
  };

  if (!open) return null;

  const immersive = layout === "immersive";
  const dialogFullscreen = isFullscreen && !fullscreenTargetRef;

  return ReactDOM.createPortal(
    <div
      role="presentation"
      onClick={closeModal}
      className="fixed inset-0 z-[9985] animate-[fadeIn_0.2s_ease]"
      /* No backdrop-filter here: a full-screen blur composited over the WebGL
         scene is extremely slow on integrated GPUs — a darker flat overlay
         reads the same and opens instantly. */
      style={{ background: "rgba(2, 6, 14, 0.8)" }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-layout={layout}
        onClick={(e) => e.stopPropagation()}
        className={`${dialogFullscreen ? "fixed inset-0 rounded-none" : "absolute top-6 bottom-6 rounded-2xl"} mx-auto overflow-hidden flex flex-col ${
          dialogFullscreen ? "max-w-none" : immersive ? "" : "inset-x-6 max-w-[1500px]"
        }`}
        style={{
          left: dialogFullscreen ? 0 : immersive ? "clamp(24px, 3vw, 56px)" : undefined,
          right: dialogFullscreen ? 0 : immersive ? "clamp(24px, 3vw, 56px)" : undefined,
          maxWidth: dialogFullscreen || immersive ? "none" : undefined,
          background: "linear-gradient(180deg, rgba(16, 12, 38, 0.96), rgba(10, 8, 24, 0.98))",
          border: "1px solid rgba(124, 255, 212, 0.18)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 92, 185, 0.15)",
        }}
      >
        {/* Header strip with Pepsi tri-color top accent */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{
            borderColor: "rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, rgba(0, 92, 185, 0.10), transparent)",
          }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200/70">
              Integration
            </span>
            <span className="text-[15px] font-semibold text-slate-100 leading-tight">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {enableFullscreen && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                aria-pressed={isFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                style={{
                  borderColor: isFullscreen ? "rgba(124, 255, 212, 0.45)" : "rgba(124, 255, 212, 0.25)",
                  background: isFullscreen ? "rgba(124, 255, 212, 0.12)" : "rgba(124, 255, 212, 0.06)",
                  color: "#cbd5e1",
                }}
              >
                {isFullscreen ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M5.5 2.5v3h-3M10.5 13.5v-3h3M2.5 5.5h3v-3M13.5 10.5h-3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M5.5 2.5h-3v3M10.5 13.5h3v-3M2.5 10.5v3h3M13.5 5.5v-3h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              style={{
                borderColor: "rgba(124, 255, 212, 0.25)",
                background: "rgba(124, 255, 212, 0.06)",
                color: "#cbd5e1",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body — scrollable, scoped to integration tokens */}
        <div className="flex-1 overflow-y-auto">
          <ThemeProvider initialTheme="dark">
            <div className="integration-scope" data-theme="dark" style={{ padding: "20px 24px" }}>
              <div className="page-transition">{children}</div>
            </div>
          </ThemeProvider>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default IntegrationModal;
