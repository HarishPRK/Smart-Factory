import React from "react";
import energyIcon from "../assets/icons/energy_bolt.svg";
import waterIcon from "../assets/icons/water_drop.svg";
import { useFilters } from "../context/FilterContext";
import { consumptionByZone } from "../data/mockData";

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
  const { state } = useFilters();
  const data = consumptionByZone[state.selectedZone];
  const isEnergyHighlighted = state.selectedKpi === "energy";
  const isWaterHighlighted = state.selectedKpi === "water";

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
              className="opacity-70"
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
            <h3 className="text-[11px] font-semibold text-blue-100/85 uppercase tracking-[0.15em]">
              Current Consumption
            </h3>
            <div className="text-[10px] text-blue-200/70 mt-1">
              Compared against the previous hour
            </div>
          </div>
        </div>
        <span className="text-[10px] text-blue-200/75 bg-blue-500/[0.04] px-2.5 py-1 rounded-lg border border-blue-400/[0.08] uppercase tracking-[0.12em] font-semibold whitespace-nowrap">
          Hourly View
        </span>
      </div>
      <div className="flex gap-3 flex-grow min-h-0">
        {/* Energy Card */}
        <div className={`flex-1 card-inner p-3.5 flex flex-col justify-between group/energy relative overflow-hidden transition-all duration-300 ${
          isEnergyHighlighted ? "ring-1 ring-blue-500/20 shadow-[0_0_16px_rgba(59,130,246,0.1)]" : ""
        }`}>
          <div className="flex justify-between items-start z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500/[0.12] to-blue-600/[0.06] rounded-md flex items-center justify-center border border-blue-400/[0.10]">
                <img
                  src={energyIcon}
                  alt="Energy"
                  className="w-3 h-3 opacity-70 invert"
                />
              </div>
              <div className="text-blue-100/85 text-[11px] uppercase tracking-[0.12em] font-semibold">
                Energy
              </div>
            </div>
            <CircularProgress value={data.energy.value} max={data.energy.max} color="#3b82f6" />
          </div>
          {/* Energy illustration */}
          <div className="flex-1 flex items-center justify-center z-10 pointer-events-none my-1">
            <svg width="100%" height="100%" viewBox="0 0 120 50" fill="none" className="max-h-[50px] opacity-[0.07] group-hover/energy:opacity-[0.12] transition-opacity duration-700">
              {/* Power meter arc */}
              <path d="M15 40 A30 30 0 0 1 75 40" stroke="url(#energyArc)" strokeWidth="3" strokeLinecap="round" fill="none" />
              {/* Meter needle */}
              <line x1="45" y1="40" x2="30" y2="18" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
              <circle cx="45" cy="40" r="3" fill="#3b82f6" />
              {/* Tick marks */}
              <line x1="17" y1="32" x2="21" y2="34" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="22" y1="22" x2="26" y2="25" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="35" y1="14" x2="37" y2="18" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="53" y1="14" x2="51" y2="18" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="65" y1="22" x2="61" y2="25" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
              {/* Lightning bolt */}
              <path d="M90 8 L84 24 L92 22 L86 42 L98 20 L90 22 Z" fill="url(#boltGrad)" />
              <defs>
                <linearGradient id="energyArc" x1="15" y1="20" x2="75" y2="20">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
                <linearGradient id="boltGrad" x1="86" y1="8" x2="92" y2="42">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="z-10">
            <div className="flex items-baseline gap-1">
              <div className="text-[24px] font-semibold gradient-number leading-none">
                {data.energy.value}
              </div>
              <div className="text-[10px] text-blue-200/75 font-medium">
                kW/h
              </div>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="currentColor"
                className={data.energy.changePositive ? "text-emerald-400" : "text-red-400 rotate-180"}
              >
                <path d="M4 1L7 5H1L4 1Z" />
              </svg>
              <span className={`text-[10px] font-semibold ${data.energy.changePositive ? "text-emerald-400" : "text-red-400"}`}>
                {data.energy.change}
              </span>
              <span className="text-[10px] text-blue-300/60 font-medium ml-0.5">
                vs last hr
              </span>
            </div>
          </div>
          <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-blue-500/[0.05] blur-[35px] rounded-full pointer-events-none group-hover/energy:bg-blue-500/[0.09] transition-all duration-500"></div>
        </div>

        {/* Water Card */}
        <div className={`flex-1 card-inner p-3.5 flex flex-col justify-between group/water relative overflow-hidden transition-all duration-300 ${
          isWaterHighlighted ? "ring-1 ring-cyan-500/20 shadow-[0_0_16px_rgba(6,182,212,0.1)]" : ""
        }`}>
          <div className="flex justify-between items-start z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-cyan-500/[0.12] to-cyan-600/[0.06] rounded-md flex items-center justify-center border border-cyan-400/[0.10]">
                <img
                  src={waterIcon}
                  alt="Water"
                  className="w-3 h-3 opacity-70 invert"
                />
              </div>
              <div className="text-blue-100/85 text-[11px] uppercase tracking-[0.12em] font-semibold">
                Water
              </div>
            </div>
            <CircularProgress value={data.water.value} max={data.water.max} color="#06b6d4" />
          </div>
          {/* Water illustration */}
          <div className="flex-1 flex items-center justify-center z-10 pointer-events-none my-1">
            <svg width="100%" height="100%" viewBox="0 0 120 50" fill="none" className="max-h-[50px] opacity-[0.07] group-hover/water:opacity-[0.12] transition-opacity duration-700">
              {/* Water tank */}
              <rect x="10" y="10" width="30" height="35" rx="3" stroke="#22d3ee" strokeWidth="1.5" fill="none" />
              {/* Water level fill */}
              <rect x="12" y="22" width="26" height="21" rx="2" fill="url(#waterFill)" />
              {/* Water level marks */}
              <line x1="8" y1="16" x2="11" y2="16" stroke="#67e8f9" strokeWidth="1" />
              <line x1="8" y1="24" x2="11" y2="24" stroke="#67e8f9" strokeWidth="1" />
              <line x1="8" y1="32" x2="11" y2="32" stroke="#67e8f9" strokeWidth="1" />
              {/* Pipe from tank */}
              <path d="M40 30 H55 V38 H75" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" fill="none" />
              {/* Valve */}
              <circle cx="55" cy="34" r="4" stroke="#22d3ee" strokeWidth="1.5" fill="none" />
              <line x1="53" y1="34" x2="57" y2="34" stroke="#22d3ee" strokeWidth="1.5" />
              {/* Drops */}
              <path d="M85 12 C85 12 80 22 85 26 C90 22 85 12 85 12Z" fill="url(#dropGrad1)" />
              <path d="M98 20 C98 20 94 28 98 31 C102 28 98 20 98 20Z" fill="url(#dropGrad2)" />
              <path d="M108 8 C108 8 104 16 108 19 C112 16 108 8 108 8Z" fill="url(#dropGrad3)" />
              {/* Wave at bottom */}
              <path d="M78 42 Q85 36 92 42 Q99 48 106 42 Q113 36 120 42" stroke="#06b6d4" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M78 46 Q85 40 92 46 Q99 52 106 46" stroke="#22d3ee" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5" />
              <defs>
                <linearGradient id="waterFill" x1="12" y1="22" x2="12" y2="43">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id="dropGrad1" x1="85" y1="12" x2="85" y2="26">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="dropGrad2" x1="98" y1="20" x2="98" y2="31">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="dropGrad3" x1="108" y1="8" x2="108" y2="19">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="z-10">
            <div className="flex items-baseline gap-1">
              <div className="text-[24px] font-semibold gradient-number leading-none">
                {data.water.value}
              </div>
              <div className="text-[10px] text-blue-200/70 font-medium">m³</div>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="currentColor"
                className={data.water.changePositive ? "text-emerald-400" : "text-red-400 rotate-180"}
              >
                <path d="M4 1L7 5H1L4 1Z" />
              </svg>
              <span className={`text-[10px] font-semibold ${data.water.changePositive ? "text-emerald-400" : "text-red-400"}`}>
                {data.water.change}
              </span>
              <span className="text-[10px] text-blue-300/60 font-medium ml-0.5">
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
