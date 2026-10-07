import React, { useState } from "react";
import { RadioTower } from "lucide-react";
import { useLorawanSensors } from "../hooks/useLorawanSensors";
import KpiCard from "./KpiCard";
import LorawanDetailDrawer from "./LorawanDetailDrawer";

const RadioPreview = () => (
  <svg
    aria-hidden="true"
    width="40"
    height="28"
    viewBox="0 0 40 28"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 22h12M8 22l3-13 3 13M8.8 17h4.4" />
    <circle cx="11" cy="7" r="1.6" />
    <path d="M6.5 3.5a6 6 0 0 0 0 7M15.5 3.5a6 6 0 0 1 0 7" />
    <path d="M22 13h3m-5 4h5" opacity=".55" />
    <rect x="28" y="10" width="9" height="12" rx="1.5" />
    <path d="M31 14h3m-3 4h3M32.5 6v4" />
  </svg>
);

const LorawanWidget: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { list } = useLorawanSensors();

  const hasData = list.length > 0;
  // The hook also supplies modeled gap-fill values. This compact feed summary
  // only reports measurements present in received packets.
  const measuredValues = (metric: "soilMoisturePct" | "soilTempC" | "batteryV") =>
    list.flatMap(({ latest }) => {
      const value = latest[metric];
      return !latest.simulated?.[metric] && typeof value === "number" && Number.isFinite(value)
        ? [value]
        : [];
    });
  const moistureValues = measuredValues("soilMoisturePct");
  const temperatureValues = measuredValues("soilTempC");
  const measuredMoisture = moistureValues.length
    ? moistureValues.reduce((sum, value) => sum + value, 0) / moistureValues.length
    : null;
  const measuredTemperature = temperatureValues.length
    ? temperatureValues.reduce((sum, value) => sum + value, 0) / temperatureValues.length
    : null;
  const lowBattery = measuredValues("batteryV").some(value => value < 3.3);
  const deviceLabel = `${list.length} device${list.length === 1 ? "" : "s"}`;
  const reading = measuredMoisture != null
    ? `${measuredMoisture.toFixed(0)}% moisture`
    : measuredTemperature != null
      ? `${measuredTemperature.toFixed(1)}°C`
      : deviceLabel;
  const accessibleSummary = [
    deviceLabel,
    measuredMoisture != null ? `average reported moisture ${measuredMoisture.toFixed(0)} percent` : null,
    measuredTemperature != null ? `average reported temperature ${measuredTemperature.toFixed(1)} degrees Celsius` : null,
    lowBattery ? "low battery reported" : null,
  ].filter(Boolean).join(", ");

  return (
    <>
      <KpiCard
        accent={lowBattery ? "#ee3040" : "#34d399"}
        accentRgb={lowBattery ? "238, 48, 64" : "52, 211, 153"}
        aria-expanded={drawerOpen}
        aria-haspopup="dialog"
        aria-label={
          hasData
            ? `Open LoRaWAN sensor feed. ${accessibleSummary}`
            : "Open LoRaWAN sensor feed. Waiting for the first packet"
        }
        delayIndex={1}
        icon={<RadioTower size={17} strokeWidth={1.8} />}
        label="LoRaWAN"
        onClick={() => setDrawerOpen(true)}
        primary={hasData ? reading : "Awaiting data"}
        status={lowBattery ? "Low battery" : hasData ? "Received" : "Waiting"}
        statusTone={
          lowBattery ? "critical" : hasData ? "positive" : "neutral"
        }
        title={hasData ? `Received packets · ${accessibleSummary}` : "Waiting for the first LoRaWAN packet"}
        visual={<RadioPreview />}
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
