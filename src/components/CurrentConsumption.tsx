import React from "react";
import energyIcon from "../assets/icons/energy_bolt.svg";
import waterIcon from "../assets/icons/water_drop.svg";

interface CurrentConsumptionProps {
  className?: string;
}

const CircularProgress: React.FC<{
  value: number;
  max: number;
  color: string;
  size?: number;
}> = ({ value, max, color, size = 38 }) => {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / max) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <defs>
        <linearGradient
          id={`progress-${color.replace(/[^a-zA-Z0-9]/g, "")}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(80, 140, 255, 0.06)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#progress-${color.replace(/[^a-zA-Z0-9]/g, "")})`}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
        style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}
      />
    </svg>
  );
};

const CurrentConsumption: React.FC<CurrentConsumptionProps> = ({
  className = "",
}) => {
  return (
    <div
      className={`card p-4 flex flex-col gap-3 animate-fade-in delay-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 flex-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500/[0.12] to-blue-600/[0.06] rounded-lg flex items-center justify-center border border-blue-400/[0.12] shadow-[0_0_10px_rgba(59,130,246,0.08)]">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="opacity-55"
            >
              <path
                d="M8 1v6l4 2M8 1a7 7 0 100 14 7 7 0 000-14z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-[0.15em]">
              Current Consumption
            </h3>
            <div className="text-[9px] text-blue-300/40 mt-1">
              Compared against the previous hour
            </div>
          </div>
        </div>
        <span className="text-[9px] text-blue-200/55 bg-blue-500/[0.04] px-2.5 py-1 rounded-lg border border-blue-400/[0.08] uppercase tracking-[0.12em] font-semibold whitespace-nowrap">
          Hourly View
        </span>
      </div>
      <div className="flex gap-3 flex-grow min-h-0">
        {/* Energy Card */}
        <div className="flex-1 card-inner p-3.5 flex flex-col justify-between group/energy relative overflow-hidden">
          <div className="flex justify-between items-start z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500/[0.12] to-blue-600/[0.06] rounded-md flex items-center justify-center border border-blue-400/[0.10]">
                <img
                  src={energyIcon}
                  alt="Energy"
                  className="w-3 h-3 opacity-55 invert"
                />
              </div>
              <div className="text-blue-200/60 text-[10px] uppercase tracking-[0.12em] font-semibold">
                Energy
              </div>
            </div>
            <CircularProgress value={200} max={350} color="#3b82f6" />
          </div>
          <div className="z-10 mt-2">
            <div className="flex items-baseline gap-1">
              <div className="text-[24px] font-semibold gradient-number leading-none">
                200
              </div>
              <div className="text-[9px] text-blue-300/45 font-medium">
                kW/h
              </div>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="currentColor"
                className="text-emerald-400"
              >
                <path d="M4 1L7 5H1L4 1Z" />
              </svg>
              <span className="text-[9px] text-emerald-400 font-semibold">
                12% less
              </span>
              <span className="text-[8px] text-blue-400/25 font-medium ml-0.5">
                vs last hr
              </span>
            </div>
          </div>
          <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-blue-500/[0.05] blur-[35px] rounded-full pointer-events-none group-hover/energy:bg-blue-500/[0.09] transition-all duration-500"></div>
        </div>

        {/* Water Card */}
        <div className="flex-1 card-inner p-3.5 flex flex-col justify-between group/water relative overflow-hidden">
          <div className="flex justify-between items-start z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-cyan-500/[0.12] to-cyan-600/[0.06] rounded-md flex items-center justify-center border border-cyan-400/[0.10]">
                <img
                  src={waterIcon}
                  alt="Water"
                  className="w-3 h-3 opacity-55 invert"
                />
              </div>
              <div className="text-blue-200/60 text-[10px] uppercase tracking-[0.12em] font-semibold">
                Water
              </div>
            </div>
            <CircularProgress value={128.1} max={200} color="#06b6d4" />
          </div>
          <div className="z-10 mt-2">
            <div className="flex items-baseline gap-1">
              <div className="text-[24px] font-semibold gradient-number leading-none">
                128.1
              </div>
              <div className="text-[9px] text-blue-300/30 font-medium">m³</div>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="currentColor"
                className="text-red-400 rotate-180"
              >
                <path d="M4 1L7 5H1L4 1Z" />
              </svg>
              <span className="text-[9px] text-red-400 font-semibold">
                5% more
              </span>
              <span className="text-[8px] text-blue-400/25 font-medium ml-0.5">
                vs last hr
              </span>
            </div>
          </div>
          <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-cyan-500/[0.05] blur-[35px] rounded-full pointer-events-none group-hover/water:bg-cyan-500/[0.09] transition-all duration-500"></div>
        </div>
      </div>
    </div>
  );
};

export default CurrentConsumption;
