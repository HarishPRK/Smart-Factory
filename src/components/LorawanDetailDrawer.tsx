import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import {
  useLorawanSensors,
  syntheticSeries,
  type LorawanDevice,
  type SimMetric,
} from "../hooks/useLorawanSensors";

interface LorawanDetailDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Side drawer showing the full LoRaWAN soil/irrigation sensor feed:
 *   - Summary stats (devices, avg moisture, avg temp, lowest battery)
 *   - Per-device cards with current temp / moisture / conductivity / battery
 *     and a sparkline for each metric.
 */
const LorawanDetailDrawer: React.FC<LorawanDetailDrawerProps> = ({ open, onClose }) => {
  const { list, totalReadings, avgMoisture, avgTemp, minBattery, lastReading } =
    useLorawanSensors();

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
        animation: "lora-drawer-fade 160ms ease-out",
      }}
    >
      <style>
        {`@keyframes lora-drawer-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes lora-drawer-slide {
            from { transform: translateX(40px); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }`}
      </style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="LoRaWAN sensor detail"
        className="lorawan-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(640px, 94vw)",
          background: "var(--ind-bg-1)",
          borderLeft: "1px solid var(--ind-edge)",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "var(--font-sans)",
          color: "var(--ind-text)",
          animation: "lora-drawer-slide 220ms ease-out",
        }}
      >
        <header className="lorawan-header">
          <div>
            <div className="lorawan-heading"><SoilGlyph /><div><h2>LoRaWAN sensors</h2><p>Soil and irrigation telemetry</p></div></div>
            <p className="lorawan-feed-note">{lastReading ? "Latest packet · " + formatRelative(lastReading.receivedAt) : "Waiting for gateway packets"}</p>
          </div>
          <button className="workspace-close" onClick={onClose} aria-label="Close LoRaWAN sensors"><svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>
        </header>
        <div className="lorawan-content">
          {/* Summary stats */}
          <Section title="Summary">
            <div className="lorawan-summary">
              <Stat label="Devices" value={String(list.length)} accent="#65aeeb" />
              <Stat
                label="Readings"
                value={String(totalReadings)}
                accent="#43d8f1"
              />
              <Stat
                label="Avg moisture"
                value={avgMoisture != null ? `${avgMoisture.toFixed(1)}%` : "—"}
                accent="#6ed6a2"
              />
              <Stat
                label="Avg temp"
                value={avgTemp != null ? `${avgTemp.toFixed(1)}°C` : "—"}
                accent="#e9bd70"
              />
              <Stat
                label="Min battery"
                value={minBattery != null ? `${minBattery.toFixed(2)} V` : "—"}
                accent={
                  minBattery != null && minBattery < 3.3 ? "#f18b82" : "#bacbd4"
                }
              />
            </div>
          </Section>

          {/* Device cards */}
          <Section title={`Devices (${list.length})`}>
            {list.length === 0 ? (
              <EmptyHint label="Waiting for first LoRaWAN packet…" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {list.map((d) => (
                  <DeviceCard key={d.devEui} device={d} />
                ))}
              </div>
            )}
          </Section>

          {lastReading && (
            <Section title="Last packet">
              <div
                style={{
                  fontSize: "11px",
                  color: "#a7bbc6",
                  fontFamily: "var(--font-sans)",
                  fontVariantNumeric: "tabular-nums",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(148, 163, 184, 0.10)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  lineHeight: 1.5,
                }}
              >
                <div>device_name: {lastReading.deviceName}</div>
                <div>dev_eui: {lastReading.devEui}</div>
                {lastReading.sourceTs && <div>timestamp: {lastReading.sourceTs}</div>}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default LorawanDetailDrawer;

/* ── Sub-components ────────────────────────────────────── */

const SoilGlyph: React.FC = () => (
  <div className="lorawan-glyph"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6M9 8c1 2 2 4 3 6 1-2 2-4 3-6M3 14h18M5 14v6h14v-6" /></svg></div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section><h3 className="lorawan-section-title">{title}</h3>{children}</section>
);

const Stat: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div className="lorawan-stat"><span>{label}</span><strong style={{ color: accent }}>{value}</strong></div>
);

const EmptyHint: React.FC<{ label: string }> = ({ label }) => (
  <div className="lorawan-empty">{label}</div>
);

const Sparkline: React.FC<{
  values: number[];
  color: string;
  min?: number;
  max?: number;
  /** Draw dashed to mark the series as a stand-in, not measured history. */
  dashed?: boolean;
}> = ({ values, color, min, max, dashed }) => {
  if (values.length < 2) {
    return (
      <div
        style={{
          height: "20px",
          fontSize: "9px",
          color: "#90aab7",
          fontStyle: "italic",
          display: "flex",
          alignItems: "center",
        }}
      >
        gathering…
      </div>
    );
  }
  const W = 90;
  const H = 20;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const range = hi - lo || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - lo) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={W} height={H} style={{ display: "block", opacity: dashed ? 0.5 : 1 }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "3 2" : undefined}
        points={pts.join(" ")}
      />
      <circle
        cx={W}
        cy={H - ((values[values.length - 1] - lo) / range) * H}
        r="2"
        fill={color}
      />
    </svg>
  );
};

const MetricRow: React.FC<{
  label: string;
  value: string;
  unit: string;
  history: number[];
  color: string;
  min?: number;
  max?: number;
  /** Stand-in value — device never reports this metric. Rendered dimmed. */
  simulated?: boolean;
}> = ({ label, value, unit, history, color, min, max, simulated }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 70px 100px",
      gap: "10px",
      alignItems: "center",
      padding: "6px 0",
    }}
  >
    <div style={{ fontSize: "11px", color: "#a7bbc6", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {label}
    </div>
    <div
      style={{
        fontSize: "13px",
        fontWeight: 700,
        color,
        fontVariantNumeric: "tabular-nums",
        textAlign: "right",
        // Dimmed so a stand-in never reads as a measured value at a glance.
        opacity: simulated ? 0.55 : 1,
      }}
    >
      {value}
      <span style={{ fontSize: "10px", color: "#90aab7", marginLeft: "3px" }}>{unit}</span>
    </div>
    <Sparkline
      values={history}
      color={color}
      min={min}
      max={max}
      dashed={simulated}
    />
  </div>
);

const DeviceCard: React.FC<{ device: LorawanDevice }> = ({ device }) => {
  const r = device.latest;
  const sim = r.simulated ?? {};
  const anySimulated = Object.keys(sim).length > 0;

  /** Real series when the device reports the metric; a back-filled stand-in
   *  series otherwise, so simulated rows draw a curve instead of "gathering…". */
  const seriesFor = (metric: SimMetric, pick: (h: typeof r) => number | undefined) =>
    sim[metric]
      ? syntheticSeries(device.devEui, metric)
      : device.history.map(pick).filter((v): v is number => typeof v === "number");

  const tempHistory = seriesFor("soilTempC", (h) => h.soilTempC);
  const moistHistory = seriesFor("soilMoisturePct", (h) => h.soilMoisturePct);
  const condHistory = seriesFor("conductivityUsCm", (h) => h.conductivityUsCm);
  const batHistory = seriesFor("batteryV", (h) => h.batteryV);

  // Battery: red below 3.3V, amber 3.3-3.5, green above
  const bat = r.batteryV;
  const batColor =
    bat == null ? "#a7bbc6" : bat < 3.3 ? "#f18b82" : bat < 3.5 ? "#e9bd70" : "#6ed6a2";

  return (
    <div className="lorawan-device">
      {/* Device header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#eef5f7" }}>
              {device.deviceName}
            </span>
            {anySimulated && <SimBadge />}
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "#90aab7",
              fontFamily: "var(--font-sans)",
              fontVariantNumeric: "tabular-nums",
              marginTop: "1px",
            }}
          >
            {device.devEui}
          </div>
        </div>
        <BatteryPill voltage={bat} color={batColor} />
      </div>

      {/* Metric rows */}
      <div style={{ borderTop: "1px solid rgba(148,163,184,0.10)", paddingTop: "4px" }}>
        <MetricRow
          label="Soil temp"
          value={r.soilTempC != null ? r.soilTempC.toFixed(1) : "—"}
          unit="°C"
          history={tempHistory}
          color="#e9bd70"
          simulated={sim.soilTempC}
        />
        <MetricRow
          label="Moisture"
          value={r.soilMoisturePct != null ? r.soilMoisturePct.toFixed(1) : "—"}
          unit="%"
          history={moistHistory}
          color="#6ed6a2"
          min={0}
          max={100}
          simulated={sim.soilMoisturePct}
        />
        <MetricRow
          label="Conductivity"
          value={r.conductivityUsCm != null ? r.conductivityUsCm.toFixed(1) : "—"}
          unit="µS/cm"
          history={condHistory}
          color="#65aeeb"
          simulated={sim.conductivityUsCm}
        />
        <MetricRow
          label="Battery"
          value={bat != null ? bat.toFixed(2) : "—"}
          unit="V"
          history={batHistory}
          color={batColor}
          min={3.0}
          max={3.7}
          simulated={sim.batteryV}
        />
      </div>

      {/* Soil moisture visual indicator */}
      <SoilMoistureBar pct={r.soilMoisturePct} />

      <div
        style={{
          fontSize: "9px",
          color: "#90aab7",
          marginTop: "6px",
          textAlign: "right",
        }}
      >
        Last packet · {formatRelative(r.receivedAt)}
      </div>
    </div>
  );
};

/** Marks a card whose greyed-out rows are stand-ins, not gateway readings. */
const SimBadge: React.FC = () => (
  <span
    title="This device doesn't report soil metrics — dimmed values are simulated stand-ins"
    style={{
      fontSize: "8px",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#a9c3ce",
      background: "#243b46",
      border: "1px solid #426675",
      borderRadius: "4px",
      padding: "1px 4px",
      whiteSpace: "nowrap",
    }}
  >
    Sim
  </span>
);

const BatteryPill: React.FC<{ voltage?: number; color: string }> = ({ voltage, color }) => {
  // Map 3.0V (empty) → 3.7V (full) onto 0-100% fill
  const pct = voltage == null ? 0 : Math.max(0, Math.min(100, ((voltage - 3.0) / 0.7) * 100));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "11px",
        color,
        fontWeight: 600,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "26px",
          height: "12px",
          border: `1.5px solid ${color}`,
          borderRadius: "2px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${pct}%`,
            background: color,
            borderRadius: "1px",
          }}
        />
      </div>
      <div
        style={{
          width: "2px",
          height: "6px",
          background: color,
          borderRadius: "0 1px 1px 0",
          marginLeft: "-5px",
        }}
      />
      {voltage != null ? `${voltage.toFixed(2)}V` : "—"}
    </div>
  );
};

/** Horizontal moisture gauge — green fill, dashed wet/dry zones marked. */
const SoilMoistureBar: React.FC<{ pct?: number }> = ({ pct }) => {
  const value = pct ?? 0;
  // Wet zone shading: 0-20 dry, 20-60 healthy, 60-100 saturated
  return (
    <div style={{ marginTop: "8px" }}>
      <div
        style={{
          position: "relative",
          height: "8px",
          background:
            "linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0% 20%, rgba(52, 211, 153, 0.12) 20% 60%, rgba(59, 130, 246, 0.15) 60% 100%)",
          border: "1px solid rgba(148,163,184,0.15)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${value}%`,
            background:
              value < 20
                ? "linear-gradient(90deg, #f18b82, #f97316)"
                : value > 60
                  ? "linear-gradient(90deg, #6ed6a2, #3b82f6)"
                  : "linear-gradient(90deg, #6ed6a2, #10b981)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "8px",
          color: "#90aab7",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginTop: "3px",
        }}
      >
        <span>Dry</span>
        <span>Healthy</span>
        <span>Saturated</span>
      </div>
    </div>
  );
};

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
