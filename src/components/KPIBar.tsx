import React from "react";
import energyIcon from "../assets/icons/energy_bolt.svg";
import noiseIcon from "../assets/icons/noise_ear.svg";
import emissionIcon from "../assets/icons/emission_cloud.svg";
import waterIcon from "../assets/icons/water_drop.svg";

const kpis = [
  {
    label: "Energy",
    value: "2,041",
    unit: "kW",
    icon: energyIcon,
    trend: "+3.2%",
    trendUp: true,
    accent: "from-blue-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-blue-500/[0.12] to-blue-600/[0.06]",
    iconBorder: "border-blue-400/[0.14]",
    iconGlow: "shadow-[0_0_14px_rgba(59,130,246,0.12)]",
    hoverBorder: "hover:border-blue-500/20",
    trendColor: "text-emerald-400",
    sparkColor: "#3b82f6",
    sparkData: [40, 55, 35, 60, 45, 70, 65, 80, 75, 90],
  },
  {
    label: "Noise",
    value: "700",
    unit: "dB",
    icon: noiseIcon,
    trend: "-1.8%",
    trendUp: false,
    accent: "from-indigo-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-indigo-500/[0.12] to-indigo-600/[0.06]",
    iconBorder: "border-indigo-400/[0.14]",
    iconGlow: "shadow-[0_0_14px_rgba(99,102,241,0.12)]",
    hoverBorder: "hover:border-indigo-500/20",
    trendColor: "text-emerald-400",
    sparkColor: "#6366f1",
    sparkData: [70, 65, 72, 60, 55, 50, 58, 45, 48, 42],
  },
  {
    label: "Emission",
    value: "420",
    unit: "PPM",
    icon: emissionIcon,
    trend: "+5.1%",
    trendUp: true,
    accent: "from-cyan-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-cyan-500/[0.12] to-cyan-600/[0.06]",
    iconBorder: "border-cyan-400/[0.14]",
    iconGlow: "shadow-[0_0_14px_rgba(6,182,212,0.12)]",
    hoverBorder: "hover:border-cyan-500/20",
    trendColor: "text-red-400",
    sparkColor: "#06b6d4",
    sparkData: [30, 35, 28, 40, 45, 50, 42, 55, 60, 58],
  },
  {
    label: "Water",
    value: "128.1",
    unit: "m³",
    icon: waterIcon,
    trend: "-2.4%",
    trendUp: false,
    accent: "from-sky-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-sky-500/[0.12] to-sky-600/[0.06]",
    iconBorder: "border-sky-400/[0.14]",
    iconGlow: "shadow-[0_0_14px_rgba(14,165,233,0.12)]",
    hoverBorder: "hover:border-sky-500/20",
    trendColor: "text-emerald-400",
    sparkColor: "#0ea5e9",
    sparkData: [60, 55, 65, 50, 45, 48, 40, 38, 42, 35],
  },
];

const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({
  data,
  color,
}) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 24;

  // Create smooth curve path
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));

  let pathD = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.6;
    pathD += ` C${cpx1},${prev.y} ${cpx2},${curr.y} ${curr.x},${curr.y}`;
  }

  const areaD = `${pathD} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="opacity-30 group-hover:opacity-60 transition-opacity duration-500"
    >
      <defs>
        <linearGradient
          id={`spark-fill-${color.replace("#", "")}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-fill-${color.replace("#", "")})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Glow dot at end */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2"
        fill={color}
        opacity="0.8"
        className="group-hover:opacity-100 transition-opacity duration-300"
      >
        <animate
          attributeName="r"
          values="1.5;2.5;1.5"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
};

const KPIBar: React.FC = () => {
  return (
    <div className="grid grid-cols-4 gap-3 w-full">
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className={`card shimmer-border ${kpi.hoverBorder} p-3.5 flex flex-col justify-between h-[96px] relative overflow-hidden animate-fade-in delay-${i + 1} group`}
        >
          {/* Subtle accent gradient */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${kpi.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
          ></div>

          {/* Sparkline background */}
          <div className="absolute bottom-2 right-3 z-0">
            <MiniSparkline data={kpi.sparkData} color={kpi.sparkColor} />
          </div>

          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 ${kpi.iconBg} rounded-lg flex items-center justify-center border ${kpi.iconBorder} ${kpi.iconGlow} transition-all duration-300 group-hover:scale-105`}
              >
                <img
                  src={kpi.icon}
                  alt={kpi.label}
                  className="w-3.5 h-3.5 opacity-60 invert"
                />
              </div>
              <span className="text-[10px] text-blue-200/60 uppercase tracking-[0.12em] font-semibold">
                {kpi.label}
              </span>
            </div>
            {/* Trend indicator */}
            <div
              className={`flex items-center gap-0.5 text-[9px] font-semibold ${kpi.trendColor} bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.04]`}
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="currentColor"
                className={kpi.trendUp ? "" : "rotate-180"}
              >
                <path d="M4 1L7 5H1L4 1Z" />
              </svg>
              {kpi.trend}
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mt-auto relative z-10">
            <span className="text-[26px] font-semibold gradient-number leading-none tracking-tight">
              {kpi.value}
            </span>
            <span className="text-[10px] text-blue-300/45 font-medium">
              {kpi.unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPIBar;
