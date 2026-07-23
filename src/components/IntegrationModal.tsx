import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { ThemeProvider } from "../integrations/ui/Theme";

interface IntegrationModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the modal header strip. */
  title: string;
  children: React.ReactNode;
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
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[9985] animate-[fadeIn_0.2s_ease]"
      /* No backdrop-filter here: a full-screen blur composited over the WebGL
         scene is extremely slow on integrated GPUs — a darker flat overlay
         reads the same and opens instantly. */
      style={{ background: "rgba(2, 6, 14, 0.8)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-6 top-6 bottom-6 max-w-[1500px] mx-auto rounded-2xl overflow-hidden flex flex-col"
        style={{
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
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all"
            style={{
              borderColor: "rgba(124, 255, 212, 0.25)",
              background: "rgba(124, 255, 212, 0.06)",
              color: "#cbd5e1",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
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
