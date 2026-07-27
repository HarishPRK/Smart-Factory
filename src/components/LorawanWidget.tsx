import React, { useState } from "react";
import { RadioTower } from "lucide-react";
import { useLorawanSensors } from "../hooks/useLorawanSensors";
import KpiCard from "./KpiCard";
import LorawanDetailDrawer from "./LorawanDetailDrawer";

const LorawanWidget: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { avgMoisture, avgTemp, list, minBattery } = useLorawanSensors();

  const hasData = list.length > 0;
  const moisture = avgMoisture != null ? `${avgMoisture.toFixed(0)}%` : "—";
  const temperature = avgTemp != null ? `${avgTemp.toFixed(1)}°C` : "—";
  const lowBattery = minBattery != null && minBattery < 3.3;
  const deviceLabel = `${list.length} device${list.length === 1 ? "" : "s"}`;

  return (
    <>
      <KpiCard
        accent={lowBattery ? "#ee3040" : "#34d399"}
        accentRgb={lowBattery ? "238, 48, 64" : "52, 211, 153"}
        aria-expanded={drawerOpen}
        aria-haspopup="dialog"
        aria-label={
          hasData
            ? `Open LoRaWAN sensor feed. ${deviceLabel}, average moisture ${moisture}, average temperature ${temperature}`
            : "Open LoRaWAN sensor feed. Waiting for the first packet"
        }
        delayIndex={1}
        icon={<RadioTower size={17} strokeWidth={1.8} />}
        label="LoRaWAN"
        onClick={() => setDrawerOpen(true)}
        primary={hasData ? `Moisture ${moisture}` : "Awaiting packets"}
        secondary={hasData ? `${deviceLabel} · ${temperature}` : "lorawan/data"}
        status={lowBattery ? "Low battery" : hasData ? "Live" : "Waiting"}
        statusTone={
          lowBattery ? "critical" : hasData ? "positive" : "neutral"
        }
        variant="live"
      />
      <LorawanDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
};

export default LorawanWidget;
