import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { useKOSDispenses, type KOSPourEvent } from "../hooks/useKOSDispenses";

interface KOSDetailDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Side drawer that shows the full KOS dispenser feed:
 *   - Latest personalised recommendation (headline + body + suggested drink)
 *   - Last 12 pours table (drink, size, ml, price, member tier, time)
 *   - Session totals: pours, volume, revenue
 *   - Top 4 drinks with counts
 *
 * The compact KOSDispenseWidget in the KPI bar opens this on click.
 */
const KOSDetailDrawer: React.FC<KOSDetailDrawerProps> = ({ open, onClose }) => {
  const { latestRecommendation, recent, totalPours, totalMl, totalRevenue, topDrinks } =
    useKOSDispenses();

  // ESC closes the drawer.
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(4, 6, 12, 0.55)",
        backdropFilter: "blur(3px)",
        animation: "kos-drawer-fade 160ms ease-out",
      }}
    >
      <style>
        {`@keyframes kos-drawer-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes kos-drawer-slide {
            from { transform: translateX(40px); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }`}
      </style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="KOS dispenser detail"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(560px, 92vw)",
          background: "rgba(10, 14, 22, 0.97)",
          borderLeft: "1px solid rgba(244, 63, 94, 0.28)",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          color: "#e5e7eb",
          animation: "kos-drawer-slide 220ms ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(244, 63, 94, 0.18)",
            background:
              "linear-gradient(180deg, rgba(159, 18, 57, 0.22), rgba(76, 5, 25, 0.0))",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#fda4af",
                textTransform: "uppercase",
              }}
            >
              KOS Dispenser
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#fff5f5",
                marginTop: "2px",
              }}
            >
              Live feed · AWS IoT
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: "1px solid rgba(244, 63, 94, 0.28)",
              background: "rgba(244, 63, 94, 0.08)",
              color: "#fecaca",
              cursor: "pointer",
              fontSize: "14px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* Recommendation card */}
          <Section title="Latest recommendation">
            {latestRecommendation ? (
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.07)",
                  border: "1px solid rgba(244, 63, 94, 0.24)",
                  borderRadius: "12px",
                  padding: "14px 16px",
                }}
              >
                {latestRecommendation.suggestedDrink && (
                  <div
                    style={{
                      display: "inline-block",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: "#fecdd3",
                      background: "rgba(244, 63, 94, 0.15)",
                      border: "1px solid rgba(244, 63, 94, 0.35)",
                      padding: "3px 8px",
                      borderRadius: "999px",
                      marginBottom: "10px",
                      textTransform: "uppercase",
                    }}
                  >
                    Suggested · {latestRecommendation.suggestedDrink}
                  </div>
                )}
                {latestRecommendation.headline && (
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "#fff5f5",
                      lineHeight: 1.4,
                      marginBottom: "6px",
                    }}
                  >
                    {latestRecommendation.headline}
                  </div>
                )}
                {latestRecommendation.body && (
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "#cbd5e1",
                      lineHeight: 1.55,
                    }}
                  >
                    {latestRecommendation.body}
                  </div>
                )}
                {latestRecommendation.memberName && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#9ca3af",
                      marginTop: "10px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    For {latestRecommendation.memberName}
                  </div>
                )}
              </div>
            ) : (
              <EmptyHint label="Waiting for first recommendation event…" />
            )}
          </Section>

          {/* Totals row */}
          <Section title="Session totals">
            <div style={{ display: "flex", gap: "10px" }}>
              <Stat label="Pours" value={String(totalPours)} accent="#34d399" />
              <Stat
                label="Volume"
                value={`${(totalMl / 1000).toFixed(2)} L`}
                accent="#60a5fa"
              />
              <Stat
                label="Revenue"
                value={`$${totalRevenue.toFixed(2)}`}
                accent="#fbbf24"
              />
            </div>
          </Section>

          {/* Top drinks */}
          {topDrinks.length > 0 && (
            <Section title="Top drinks">
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {topDrinks.map((d) => {
                  const max = topDrinks[0].count || 1;
                  const pct = (d.count / max) * 100;
                  return (
                    <div
                      key={d.drink}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "12px",
                      }}
                    >
                      <span
                        style={{
                          flex: "0 0 160px",
                          color: "#e5e7eb",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={d.drink}
                      >
                        {d.drink}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          background: "rgba(148, 163, 184, 0.1)",
                          borderRadius: "999px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #fb7185, #fda4af)",
                            borderRadius: "999px",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          flex: "0 0 28px",
                          color: "#cbd5e1",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 600,
                          textAlign: "right",
                        }}
                      >
                        {d.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Recent pours table */}
          <Section title={`Recent pours (${recent.length})`}>
            {recent.length === 0 ? (
              <EmptyHint label="Waiting for first pour event…" />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 60px 60px 50px",
                    gap: "8px",
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "#7fa2c7",
                    textTransform: "uppercase",
                    padding: "0 8px 4px",
                    borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
                  }}
                >
                  <div>Drink · Member</div>
                  <div>Size</div>
                  <div style={{ textAlign: "right" }}>ml</div>
                  <div style={{ textAlign: "right" }}>$</div>
                  <div style={{ textAlign: "right" }}>Time</div>
                </div>
                {recent.map((p, i) => (
                  <PourRow key={`${p.sessionId ?? i}-${p.receivedAt}`} pour={p} />
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default KOSDetailDrawer;

/* ── Sub-components ────────────────────────────────────── */

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <div
      style={{
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "#7fa2c7",
        textTransform: "uppercase",
        marginBottom: "8px",
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <div
    style={{
      flex: 1,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(148, 163, 184, 0.12)",
      borderRadius: "10px",
      padding: "10px 12px",
    }}
  >
    <div
      style={{
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: "#94a3b8",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: "18px",
        fontWeight: 700,
        color: accent,
        fontVariantNumeric: "tabular-nums",
        marginTop: "2px",
      }}
    >
      {value}
    </div>
  </div>
);

const EmptyHint: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      fontSize: "12px",
      color: "#64748b",
      fontStyle: "italic",
      padding: "12px 14px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed rgba(148, 163, 184, 0.18)",
      borderRadius: "10px",
    }}
  >
    {label}
  </div>
);

function tierColor(tier?: string): string {
  if (tier === "Gold") return "#fbbf24";
  if (tier === "Silver") return "#cbd5e1";
  if (tier === "Bronze") return "#fb923c";
  return "#94a3b8";
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const PourRow: React.FC<{ pour: KOSPourEvent }> = ({ pour }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 80px 60px 60px 50px",
      gap: "8px",
      fontSize: "11.5px",
      padding: "7px 8px",
      borderRadius: "6px",
      background: "rgba(255,255,255,0.015)",
      alignItems: "center",
    }}
    title={pour.sessionId}
  >
    <div style={{ minWidth: 0, overflow: "hidden" }}>
      <div
        style={{
          color: "#e5e7eb",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {pour.drink ?? "—"}
      </div>
      {(pour.memberName || pour.memberTier) && (
        <div
          style={{
            fontSize: "10px",
            color: "#9ca3af",
            marginTop: "1px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {pour.memberName}
          {pour.memberTier && (
            <span
              style={{
                marginLeft: "6px",
                color: tierColor(pour.memberTier),
                fontWeight: 700,
              }}
            >
              · {pour.memberTier}
            </span>
          )}
        </div>
      )}
    </div>
    <div style={{ color: "#cbd5e1", fontSize: "10.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {pour.size ?? "—"}
    </div>
    <div style={{ textAlign: "right", color: "#a7f3d0", fontVariantNumeric: "tabular-nums" }}>
      {pour.pouredMl?.toFixed(0) ?? "—"}
    </div>
    <div style={{ textAlign: "right", color: "#fde68a", fontVariantNumeric: "tabular-nums" }}>
      {pour.price !== undefined ? pour.price.toFixed(2) : "—"}
    </div>
    <div style={{ textAlign: "right", color: "#94a3b8", fontVariantNumeric: "tabular-nums", fontSize: "10px" }}>
      {formatTime(pour.receivedAt)}
    </div>
  </div>
);
