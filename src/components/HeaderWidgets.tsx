const pillClass =
  "items-center gap-2 rounded-full border border-cyan-300/14 bg-sky-400/[0.05] px-4 py-2 text-[10px] text-sky-100/75 font-medium transition-all duration-300 hover:border-cyan-300/25 hover:bg-sky-400/[0.08]";

export function HumidityWidget({ humidity = 62 }: { humidity?: number }) {
  return (
    <div className={`hidden 2xl:flex ${pillClass}`}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-cyan-200/75">
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
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-cyan-200/75">
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
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
      : aqi <= 100
        ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]"
        : "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)]";

  const labelColor =
    aqi <= 50
      ? "text-emerald-300/80"
      : aqi <= 100
        ? "text-amber-300/80"
        : "text-red-300/80";

  return (
    <div className={`hidden xl:flex ${pillClass}`}>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-cyan-200/75">
        <path
          d="M8 1v2M8 13v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1 8h2M13 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <span className="tabular-nums">AQI {aqi}</span>
      <span className="text-sky-300/20">·</span>
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
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-cyan-200/75">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 4.5V8.5L10.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <span>{shift}</span>
      <span className="text-sky-300/20">·</span>
      <span className="text-sky-100/50 tabular-nums">{timeRange}</span>
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
      className={`hidden xl:flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-medium transition-all duration-300 ${
        operational
          ? "border border-emerald-400/12 bg-emerald-400/[0.04] text-emerald-200/75 hover:border-emerald-400/22 hover:bg-emerald-400/[0.07]"
          : "border border-amber-400/12 bg-amber-400/[0.04] text-amber-200/75 hover:border-amber-400/22 hover:bg-amber-400/[0.07]"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full animate-pulse-glow ${
          operational
            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
            : "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]"
        }`}
        style={{ color: operational ? "#6ee7b7" : "#fbbf24" }}
      ></span>
      <span>{operational ? "All Systems Operational" : "Partial Outage"}</span>
    </div>
  );
}
