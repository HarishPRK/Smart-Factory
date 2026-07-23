import React, { useState } from "react";
import { useKOSDispenses } from "../hooks/useKOSDispenses";
import KOSDetailDrawer from "./KOSDetailDrawer";
import PepsiLogo from "./PepsiLogo";

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
      className="card hover:border-blue-400/25 px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden cursor-pointer transition-all duration-300 text-left rounded-2xl"
      aria-label="Open Pepsi dispenser detail"
      title={
        latestRecommendation?.body
          ? `${latestRecommendation.headline ?? ""}\n${latestRecommendation.body}\n\nClick for full feed →`
          : "Click for full Pepsi dispenser feed"
      }
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/[0.08] to-transparent pointer-events-none" />

      {/* Row 1: Icon + Label + Badge */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <PepsiLogo size={32} style={{ filter: "drop-shadow(0 0 4px rgba(0,75,147,0.3))" }} />
          <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">
            Pepsi Dispenser
          </span>
        </div>
        {hasData && (
          <span
            className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md border ${
              latestPour?.memberTier === "Gold"
                ? "text-amber-300 bg-amber-500/[0.08] border-amber-400/25"
                : "text-blue-300 bg-blue-500/[0.06] border-blue-400/20"
            }`}
          >
            {latestPour?.memberTier ?? "LIVE"}
          </span>
        )}
      </div>

      {/* Row 2: Value + Illustration */}
      <div className="flex items-end justify-between mt-auto relative z-10">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[13px] font-medium text-blue-300/80 leading-none overflow-hidden whitespace-nowrap text-ellipsis"
            style={{ maxWidth: "140px" }}
          >
            {drinkLabel}
          </span>
          <span className="text-[10px] text-white/30">
            {hasData ? volumeLabel : totalsLabel}
          </span>
        </div>
        <svg width="42" height="22" viewBox="0 0 42 22" fill="none" className="opacity-50">
          <path d="M6 4 H30 L27 18 H9 Z" stroke="#60a5fa" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
          <path d="M9 8 H27" stroke="#60a5fa" strokeWidth="1" opacity="0.6" />
          <circle cx="34" cy="6" r="1.6" fill="#93c5fd" />
          <circle cx="36" cy="11" r="1.2" fill="#93c5fd" opacity="0.7" />
        </svg>
      </div>
    </button>
    <KOSDetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default KOSDispenseWidget;
