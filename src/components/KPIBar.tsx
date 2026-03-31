import React from "react";
import { useFilters } from "../context/FilterContext";
import { kpis, getKpiForZone } from "../data/mockData";

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
      className="opacity-50 group-hover:opacity-75 transition-opacity duration-500"
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
  const { state, dispatch } = useFilters();

  return (
    <div className="grid grid-cols-4 gap-3 w-full">
      {kpis.map((kpi, i) => {
        const isSelected = state.selectedKpi === kpi.id;
        const zoneData = getKpiForZone(kpi, state.selectedZone);

        return (
          <div
            key={kpi.id}
            onClick={() => dispatch({ type: "SET_KPI", kpi: kpi.id })}
            className={`card shimmer-border ${kpi.hoverBorder} p-3.5 flex flex-col justify-between h-[96px] relative overflow-hidden animate-fade-in delay-${i + 1} group cursor-pointer transition-all duration-300 ${
              isSelected
                ? "ring-1 ring-white/20 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.02]"
                : ""
            }`}
          >
            {/* Subtle accent gradient */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${kpi.accent} ${
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              } transition-opacity duration-500 pointer-events-none`}
            ></div>

            {/* Sparkline background */}
            <div className="absolute bottom-2 right-3 z-0">
              <MiniSparkline data={zoneData.sparkData} color={kpi.sparkColor} />
            </div>

            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 ${kpi.iconBg} rounded-lg flex items-center justify-center border ${kpi.iconBorder} ${kpi.iconGlow} transition-all duration-300 group-hover:scale-105`}
                >
                  <img
                    src={kpi.icon}
                    alt={kpi.label}
                    className="w-3.5 h-3.5 opacity-75 invert"
                  />
                </div>
                <span className="text-[11px] text-blue-100/85 uppercase tracking-[0.12em] font-semibold">
                  {kpi.label}
                </span>
              </div>
              {/* Trend indicator */}
              <div
                className={`flex items-center gap-0.5 text-[10px] font-semibold ${kpi.trendColor} bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.04]`}
              >
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 8 8"
                  fill="currentColor"
                  className={zoneData.trendUp ? "" : "rotate-180"}
                >
                  <path d="M4 1L7 5H1L4 1Z" />
                </svg>
                {zoneData.trend}
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 mt-auto relative z-10">
              <span className="text-[26px] font-semibold gradient-number leading-none tracking-tight">
                {zoneData.value}
              </span>
              <span className="text-[11px] text-blue-200/70 font-medium">
                {kpi.unit}
              </span>
            </div>

            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.6)] z-20"></div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default KPIBar;
