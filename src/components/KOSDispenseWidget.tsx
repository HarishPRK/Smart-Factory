import React, { useState } from "react";
import { useKOSDispenses } from "../hooks/useKOSDispenses";
import KOSDetailDrawer from "./KOSDetailDrawer";

/**
 * KOS dispenser widget — sits in the KPI bar next to PREDICT / TWIN.
 *
 * Subscribes to AWS-IoT-forwarded `kos/dispenser/{id}/pour` and
 * `kos/dispenser/{id}/recommendations` events via subscribeKOSMessage,
 * shows the most recent pour + running totals + the freshest
 * personalised recommendation as a compact card. Click the card to open
 * the side drawer with the full feed (recommendation copy, recent pours
 * table, revenue totals, top drinks).
 */
const KOSDispenseWidget: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { latestPour, latestRecommendation, totalPours, totalMl, topDrinks } =
    useKOSDispenses();

  const hasData = latestPour !== null;
  const drinkLabel = latestPour?.drink ?? latestRecommendation?.suggestedDrink ?? "Awaiting pour";
  const memberLabel = latestPour?.memberName ?? latestRecommendation?.memberName;
  const volumeLabel = latestPour?.pouredMl ? `${latestPour.pouredMl.toFixed(0)} ml` : "—";
  const totalsLabel =
    totalPours > 0 ? `${totalPours} pour${totalPours === 1 ? "" : "s"} · ${(totalMl / 1000).toFixed(2)} L` : "0 pours";

  return (
    <>
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      className="card shimmer-border hover:border-rose-400/30 p-3.5 flex flex-col justify-between h-[96px] min-w-[200px] max-w-[300px] flex-1 basis-[200px] relative overflow-hidden cursor-pointer transition-all duration-300 text-left"
      aria-label="Open KOS dispenser detail"
      title={
        latestRecommendation?.body
          ? `${latestRecommendation.headline ?? ""}\n${latestRecommendation.body}\n\nClick for full feed →`
          : "Click for full KOS dispenser feed"
      }
    >
      {/* Subtle Coke-red accent gradient — KOS is the dispenser brand */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.08] to-rose-500/[0.02] pointer-events-none" />

      {/* Decorative cup glyph */}
      <div className="absolute bottom-2 right-3 z-0 opacity-55">
        <svg width="42" height="22" viewBox="0 0 42 22" fill="none">
          <path
            d="M6 4 H30 L27 18 H9 Z"
            stroke="#fb7185"
            strokeWidth="1.4"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M9 8 H27" stroke="#fb7185" strokeWidth="1" opacity="0.6" />
          <circle cx="34" cy="6" r="1.6" fill="#fda4af" />
          <circle cx="36" cy="11" r="1.2" fill="#fda4af" opacity="0.7" />
          <circle cx="33" cy="13" r="1" fill="#fda4af" opacity="0.5" />
        </svg>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-500/[0.14] rounded-lg flex items-center justify-center border border-red-400/[0.18] shadow-[0_0_10px_rgba(244,63,94,0.14)]">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="text-red-200">
              <path
                d="M5 3 H15 L13.5 17 H6.5 Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
                fill="none"
              />
              <path d="M7 7 H13" stroke="currentColor" strokeWidth="1" opacity="0.6" />
            </svg>
          </div>
          <span className="text-[11px] text-red-100/90 uppercase tracking-[0.12em] font-semibold">
            Dispenser
          </span>
        </div>
        {hasData && (
          <span
            className={`text-[9px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-md border ${
              latestPour?.memberTier === "Gold"
                ? "text-amber-200 bg-amber-500/[0.08] border-amber-400/30"
                : "text-rose-200 bg-rose-500/[0.08] border-rose-400/25"
            }`}
          >
            {latestPour?.memberTier ?? "LIVE"}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="relative z-10 flex flex-col gap-0.5 mt-auto">
        <div
          className="text-[13px] font-semibold text-rose-50 leading-none tracking-tight overflow-hidden whitespace-nowrap text-ellipsis"
          style={{ maxWidth: "150px" }}
        >
          {drinkLabel}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-rose-200/70 font-medium">
            {hasData ? volumeLabel : totalsLabel}
          </span>
          {hasData && memberLabel && (
            <span
              className="text-[9px] text-rose-300/50 truncate"
              style={{ maxWidth: "90px" }}
            >
              · {memberLabel}
            </span>
          )}
        </div>
      </div>

      {/* Top-drinks micro-bars (only once we have at least 2 distinct drinks) */}
      {topDrinks.length >= 2 && (
        <div className="absolute top-2 right-3 z-10 flex items-end gap-0.5 h-3 opacity-70">
          {topDrinks.slice(0, 4).map((d) => {
            const max = topDrinks[0].count || 1;
            const h = Math.max(2, Math.round((d.count / max) * 12));
            return (
              <div
                key={d.drink}
                title={`${d.drink} · ${d.count}`}
                style={{
                  width: "3px",
                  height: `${h}px`,
                  background: "#fb7185",
                  borderRadius: "1px",
                }}
              />
            );
          })}
        </div>
      )}
    </button>
    <KOSDetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default KOSDispenseWidget;
