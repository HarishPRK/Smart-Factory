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
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(640px, 94vw)",
          background: "rgba(10, 14, 22, 0.97)",
          borderLeft: "1px solid rgba(0, 92, 185, 0.45)",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Montserrat', 'Segoe UI', system-ui, sans-serif",
          color: "#e5e7eb",
          animation: "lora-drawer-slide 220ms ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(0, 92, 185, 0.35)",
            background:
              "linear-gradient(180deg, rgba(0, 92, 185, 0.28), rgba(0, 31, 77, 0.0))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <SoilGlyph />
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "#93c5fd",
                  textTransform: "uppercase",
                }}
              >
                LoRaWAN Sensors
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#f0f9ff",
                  marginTop: "2px",
                }}
              >
                Soil & irrigation feed
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: "1px solid rgba(0, 92, 185, 0.45)",
              background: "rgba(0, 92, 185, 0.15)",
              color: "#bfdbfe",
              cursor: "pointer",
              fontSize: "14px",
              lineHeight: 1,
            }}
          >
            X
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
            gap: "16px",
          }}
        >
          {/* Summary stats */}
          <Section title="Summary">
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Stat label="Devices" value={String(list.length)} accent="#60a5fa" />
              <Stat
                label="Readings"
                value={String(totalReadings)}
                accent="#a78bfa"
              />
              <Stat
                label="Avg moisture"
                value={avgMoisture != null ? `${avgMoisture.toFixed(1)}%` : "—"}
                accent="#34d399"
              />
              <Stat
                label="Avg temp"
                value={avgTemp != null ? `${avgTemp.toFixed(1)}°C` : "—"}
                accent="#fbbf24"
              />
              <Stat
                label="Min battery"
                value={minBattery != null ? `${minBattery.toFixed(2)} V` : "—"}
                accent={
                  minBattery != null && minBattery < 3.3 ? "#ef4444" : "#cbd5e1"
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
                  color: "#94a3b8",
                  fontFamily: "ui-monospace, Consolas, monospace",
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
  <div
    style={{
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      overflow: "hidden",
      background: "linear-gradient(180deg, #34d399 0%, #065f46 100%)",
      flex: "0 0 auto",
      boxShadow: "0 0 12px rgba(52, 211, 153, 0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#ecfdf5",
    }}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6" />
      <path d="M9 8c1 2 2 4 3 6 1-2 2-4 3-6" />
      <path d="M3 14h18" />
      <path d="M5 14v6h14v-6" />
    </svg>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
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

const Stat: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div
    style={{
      flex: "1 1 100px",
      minWidth: "100px",
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

/* ── Sparkline + Device card ───────────────────────────── */

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
          color: "#64748b",
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
    <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
      <span style={{ fontSize: "10px", color: "#64748b", marginLeft: "3px" }}>{unit}</span>
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
    bat == null ? "#94a3b8" : bat < 3.3 ? "#ef4444" : bat < 3.5 ? "#f59e0b" : "#34d399";

  return (
    <div
      style={{
        background: "rgba(0, 92, 185, 0.06)",
        border: "1px solid rgba(0, 92, 185, 0.25)",
        borderRadius: "12px",
        padding: "12px 14px",
      }}
    >
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
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#f0f9ff" }}>
              {device.deviceName}
            </span>
            {anySimulated && <SimBadge />}
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "#64748b",
              fontFamily: "ui-monospace, Consolas, monospace",
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
          color="#fbbf24"
          simulated={sim.soilTempC}
        />
        <MetricRow
          label="Moisture"
          value={r.soilMoisturePct != null ? r.soilMoisturePct.toFixed(1) : "—"}
          unit="%"
          history={moistHistory}
          color="#34d399"
          min={0}
          max={100}
          simulated={sim.soilMoisturePct}
        />
        <MetricRow
          label="Conductivity"
          value={r.conductivityUsCm != null ? r.conductivityUsCm.toFixed(1) : "—"}
          unit="µS/cm"
          history={condHistory}
          color="#60a5fa"
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
          color: "#475569",
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
      color: "#c4b5fd",
      background: "rgba(167, 139, 250, 0.12)",
      border: "1px solid rgba(167, 139, 250, 0.3)",
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
            transition: "width 0.4s ease",
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
                ? "linear-gradient(90deg, #ef4444, #f97316)"
                : value > 60
                  ? "linear-gradient(90deg, #34d399, #3b82f6)"
                  : "linear-gradient(90deg, #34d399, #10b981)",
            transition: "width 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
            boxShadow: "0 0 8px rgba(52,211,153,0.4)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "8px",
          color: "#64748b",
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
