const pillClass =
  "items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 text-[10px] text-white/65 font-medium transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]";

export function HumidityWidget({ humidity = 62 }: { humidity?: number }) {
  return (
    <div className={`hidden 2xl:flex ${pillClass}`}>
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="text-white/55">
        <path
          d="M8 2C8 2 4 7 4 10a4 4 0 108 0c0-3-4-8-4-8z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span className="tabular-nums">{humidity}%</span>
    </div>
  );
}

export function WindSpeedWidget({ speed = 12 }: { speed?: number }) {
  return (
    <div className={`hidden 2xl:flex ${pillClass}`}>
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="text-white/55">
        <path
          d="M2 8h7a2.5 2.5 0 10-1.5-4.5M2 11h5a2 2 0 110 4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="tabular-nums">{speed} km/h</span>
    </div>
  );
}

export function AqiWidget({
  aqi = 42,
  label = "Good",
}: {
  aqi?: number;
  label?: string;
}) {
  const dotColor =
    aqi <= 50
      ? "bg-emerald-400 shadow-[0_0_6px_rgba(74,186,120,0.6)]"
      : aqi <= 100
        ? "bg-amber-400 shadow-[0_0_6px_rgba(232,160,32,0.6)]"
        : "bg-red-400 shadow-[0_0_6px_rgba(238,48,64,0.6)]";

  const labelColor =
    aqi <= 50
      ? "text-emerald-300/75"
      : aqi <= 100
        ? "text-amber-300/75"
        : "text-red-300/75";

  return (
    <div className={`hidden xl:flex ${pillClass}`}>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-white/55">
        <path
          d="M8 1v2M8 13v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1 8h2M13 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <span className="tabular-nums">AQI {aqi}</span>
      <span className="text-white/15">·</span>
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
        <span className={labelColor}>{label}</span>
      </span>
    </div>
  );
}

export function ShiftIndicator({ currentHour }: { currentHour?: number }) {
  const hour = currentHour ?? new Date().getHours();
  let shift: string;
  let timeRange: string;

  if (hour >= 6 && hour < 14) {
    shift = "Shift A";
    timeRange = "06:00–14:00";
  } else if (hour >= 14 && hour < 22) {
    shift = "Shift B";
    timeRange = "14:00–22:00";
  } else {
    shift = "Shift C";
    timeRange = "22:00–06:00";
  }

  return (
    <div className={`hidden lg:flex ${pillClass}`}>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-white/55">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 4.5V8.5L10.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <span>{shift}</span>
      <span className="text-white/15">·</span>
      <span className="text-white/45 tabular-nums">{timeRange}</span>
    </div>
  );
}

export function SystemStatus({
  operational = true,
}: {
  operational?: boolean;
}) {
  return (
    <div
      className={`hidden xl:flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-[10px] font-medium transition-all duration-300 ${
        operational
          ? "border border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-300/75 hover:border-emerald-400/25"
          : "border border-amber-400/15 bg-amber-400/[0.04] text-amber-300/75 hover:border-amber-400/25"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full animate-pulse-glow ${
          operational
            ? "bg-emerald-400 shadow-[0_0_6px_rgba(74,186,120,0.6)]"
            : "bg-amber-400 shadow-[0_0_6px_rgba(232,160,32,0.6)]"
        }`}
        style={{ color: operational ? "#4aba78" : "#e8a020" }}
      ></span>
      <span>{operational ? "All Systems Operational" : "Partial Outage"}</span>
    </div>
  );
}
