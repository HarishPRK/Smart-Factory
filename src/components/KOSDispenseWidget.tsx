import React, { useState } from "react";
import { useKOSDispenses } from "../hooks/useKOSDispenses";
import KOSDetailDrawer from "./KOSDetailDrawer";
import KpiCard from "./KpiCard";
import PepsiLogo from "./PepsiLogo";

const KOSDispenseWidget: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const {
    latestPour,
    latestRecommendation,
    totalMl,
    totalPours,
  } = useKOSDispenses();

  const hasData = latestPour !== null;
  const drinkLabel =
    latestPour?.drink ??
    latestRecommendation?.suggestedDrink ??
    "Awaiting pour";
  const volumeLabel = latestPour?.pouredMl
    ? `${latestPour.pouredMl.toFixed(0)} ml`
    : "No volume yet";
  const totalsLabel =
    totalPours > 0
      ? `${totalPours} pour${totalPours === 1 ? "" : "s"} · ${(totalMl / 1000).toFixed(2)} L`
      : "0 pours";
  const tier = latestPour?.memberTier;
  const status = hasData ? tier ?? "Live" : "Waiting";

  return (
    <>
      <KpiCard
        accent="#60a5fa"
        accentRgb="96, 165, 250"
        aria-expanded={drawerOpen}
        aria-haspopup="dialog"
        aria-label={
          hasData
            ? `Open Pepsi dispenser feed. Latest: ${drinkLabel}, ${volumeLabel}`
            : "Open Pepsi dispenser feed. Waiting for the first pour"
        }
        delayIndex={0}
        icon={<PepsiLogo size={29} />}
        label="Pepsi dispenser"
        onClick={() => setDrawerOpen(true)}
        primary={drinkLabel}
        secondary={hasData ? `${volumeLabel} · ${totalsLabel}` : totalsLabel}
        status={status}
        statusTone={
          tier === "Gold" ? "warning" : hasData ? "positive" : "neutral"
        }
        variant="live"
      />
      <KOSDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
};

export default KOSDispenseWidget;
