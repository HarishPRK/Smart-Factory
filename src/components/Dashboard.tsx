import React, { useState, useEffect } from "react";
import KPIBar from "./KPIBar";
import ActiveMachinery from "./ActiveMachinery";
import CurrentConsumption from "./CurrentConsumption";
import ZoneTabs from "./ZoneTabs";
import workerIcon from "../assets/icons/worker.svg";
import mapImage from "../assets/map.png";
import machineGear from "../assets/icons/machine_gear.svg";
import alertWarning from "../assets/icons/alert_warning.svg";
import gearIcon from "../assets/icons/Gear.svg";
import energyBolt from "../assets/icons/energy_bolt.svg";
import aiMic from "../assets/icons/ai_mic.svg";
import Weather from "../Weather";

const Dashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  const overviewChips = [
    {
      label: "Critical",
      value: "2",
      tone: "text-red-300 bg-red-500/[0.08] border border-red-500/[0.12] shadow-[0_0_14px_rgba(239,68,68,0.08)]",
    },
    {
      label: "Warnings",
      value: "1",
      tone: "text-amber-300 bg-amber-500/[0.08] border border-amber-500/[0.12] shadow-[0_0_14px_rgba(245,158,11,0.08)]",
    },
    {
      label: "Online",
      value: "6",
      tone: "text-emerald-300 bg-emerald-500/[0.08] border border-emerald-500/[0.12] shadow-[0_0_14px_rgba(16,185,129,0.08)]",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-dvh max-h-dvh text-white px-4 py-4 xl:px-5 xl:py-4 font-sans flex flex-col overflow-hidden gap-4">
      {/* Header */}
      <header className="glass flex items-center justify-between gap-4 flex-none animate-fade-in header-glow rounded-[28px] px-5 py-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-500 rounded-[16px] flex items-center justify-center text-white font-bold text-lg shadow-[0_0_28px_rgba(34,211,238,0.28),0_10px_28px_rgba(37,99,235,0.24)] relative group/logo cursor-pointer transition-all duration-300 hover:shadow-[0_0_36px_rgba(34,211,238,0.36),0_12px_34px_rgba(37,99,235,0.28)]">
            <span className="leading-none mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] group-hover/logo:scale-110 transition-transform duration-300">
              ♠
            </span>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-300 rounded-full border-2 border-[#07192f] shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse-glow"
              style={{ color: "#6ee7b7" }}
            ></div>
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-[0.24em] text-cyan-50 uppercase truncate">
              ABC Factory 4.0
            </div>
            <div className="text-[9px] text-sky-200/60 font-medium tracking-[0.22em] mt-1 flex items-center gap-2 uppercase">
              <span>Smart Manufacturing</span>
              <span className="w-1 h-1 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.75)]"></span>
              <span className="text-cyan-200/85">Live Operations</span>
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-3 min-w-0 pl-2">
            <div className="h-10 w-px bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent"></div>
            {/* <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-2.5 min-w-[220px]">
              <div className="text-[9px] uppercase tracking-[0.18em] text-sky-200/55 font-semibold">
                Command Center
              </div>
              <div className="text-[13px] text-sky-50/95 font-semibold mt-1">
                Neon overview active across all production zones.
              </div>
            </div> */}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          <div className="hidden 2xl:flex items-center gap-2 rounded-full border border-cyan-300/14 bg-sky-400/[0.05] px-4 py-2 text-[10px] text-sky-100/75 font-medium">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="text-cyan-200/75"
            >
              <circle
                cx="8"
                cy="8"
                r="6.5"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M8 4.5V8.3L10.5 10"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span className="tabular-nums">
              {currentTime.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-sky-300/20">•</span>
            <span className="tabular-nums">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-cyan-300/14 bg-sky-400/[0.05] px-4 py-2 text-[10px] text-sky-100/80 font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]"></span>
            Factory 028
          </div>
          <div className="hidden xl:flex items-center gap-2 rounded-full border border-cyan-300/14 bg-sky-400/[0.05] px-4 py-2 text-[10px] text-sky-100/80 font-medium">
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              className="text-cyan-200/75"
            >
              <path
                d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <circle
                cx="8"
                cy="6"
                r="1.4"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
            Colorado
          </div>
          <Weather
            temperature={25}
            condition="partly_cloudy"
            unit="C"
            location="Colorado"
          />

          <button className="icon-btn w-10 h-10 flex items-center justify-center rounded-full glass text-cyan-100/55 hover:text-cyan-50 relative transition-all duration-300 hover:shadow-[0_0_24px_rgba(34,211,238,0.18)] group/ai">
            <img
              src={aiMic}
              alt="AI Assistant"
              className="w-4 h-4 opacity-40 invert group-hover/ai:opacity-75 transition-all duration-300"
            />
            <div
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-cyan-300 rounded-full shadow-[0_0_10px_rgba(103,232,249,0.85)] animate-pulse-glow"
              style={{ color: "#67e8f9" }}
            ></div>
            <div className="absolute inset-0 rounded-full border border-cyan-300/0 group-hover/ai:border-cyan-300/25 transition-all duration-500"></div>
          </button>

          <button className="icon-btn notification-bell w-10 h-10 flex items-center justify-center rounded-full glass text-cyan-100/50 hover:text-white relative transition-all duration-300 hover:shadow-[0_0_24px_rgba(34,211,238,0.15)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              className="opacity-50 transition-opacity duration-300 group-hover:opacity-80"
            >
              <path
                d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                className="text-blue-200"
              />
              <path
                d="M8 17a2 2 0 004 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="text-blue-200"
              />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-gradient-to-r from-red-500 to-rose-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)] text-[8px] font-bold flex items-center justify-center px-1 text-white border border-[#030b1a]/80">
              3
            </span>
          </button>

          <button className="icon-btn w-10 h-10 flex items-center justify-center rounded-full glass text-cyan-100/50 hover:text-white relative transition-all duration-300 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)] group/settings">
            <img
              src={gearIcon}
              alt="Settings"
              className="w-4 h-4 opacity-35 invert group-hover/settings:opacity-65 group-hover/settings:rotate-90 transition-all duration-500"
            />
          </button>

          <button className="w-10 h-10 rounded-full overflow-hidden relative group/avatar transition-all duration-300 hover:shadow-[0_0_24px_rgba(59,130,246,0.15)]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-300/28 via-sky-300/16 to-blue-500/24 p-[1.5px] group-hover/avatar:from-cyan-300/45 group-hover/avatar:via-sky-300/30 group-hover/avatar:to-blue-500/40 transition-all duration-500">
              <div className="w-full h-full rounded-full bg-[#0a1d38] flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-cyan-400/20 via-sky-400/14 to-blue-500/20 flex items-center justify-center">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="opacity-50 group-hover/avatar:opacity-75 transition-opacity duration-300"
                  >
                    <circle
                      cx="10"
                      cy="7"
                      r="3.5"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M3 17.5c0-3 3-5.5 7-5.5s7 2.5 7 5.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <div
              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-300 rounded-full border-2 border-[#06192f] shadow-[0_0_10px_rgba(52,211,153,0.7)] z-10 animate-pulse-glow"
              style={{ color: "#6ee7b7" }}
            ></div>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-4 flex-grow min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <div className="col-span-3 flex flex-col gap-4 h-full min-h-0">
          <ActiveMachinery className="flex-[3] min-h-0" />
          <CurrentConsumption className="flex-[2] min-h-0" />
        </div>

        {/* Center Content */}
        <div className="col-span-6 flex flex-col gap-4 h-full min-h-0">
          <div className="flex items-end justify-between gap-4 px-1 animate-fade-in delay-1">
            <div>
              <div className="text-[10px] font-semibold text-cyan-200/55 uppercase tracking-[0.18em]">
                Operations Snapshot
              </div>
              <div className="text-[17px] font-semibold text-cyan-50/95 mt-1 tracking-tight leading-tight">
                Monitor alerts, machine health, and plant KPIs in one view.
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {overviewChips.map((chip) => (
                <div
                  key={chip.label}
                  className={`px-3 py-2 rounded-xl backdrop-blur-xl ${chip.tone}`}
                >
                  <div className="text-[8px] uppercase tracking-[0.15em] font-semibold opacity-70">
                    {chip.label}
                  </div>
                  <div className="text-sm font-semibold mt-0.5">
                    {chip.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <KPIBar />
          <div className="flex-grow min-h-0 card relative overflow-hidden flex items-center justify-center group">
            <img
              src={mapImage}
              alt="Map"
              className="w-full h-full object-cover opacity-35 mix-blend-luminosity scale-105 group-hover:scale-110 group-hover:opacity-45 transition-all duration-[1.5s] ease-out"
            />

            {/* Gradient overlays — richer blue tinted */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#030b1a]/50 via-transparent to-[#030b1a]/95 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#030b1a]/30 via-transparent to-[#030b1a]/30 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-blue-950/25 via-transparent to-transparent pointer-events-none"></div>

            {/* Ambient orbs for map section */}
            <div className="ambient-orb w-32 h-32 bg-blue-500/[0.04] top-10 right-20"></div>
            <div
              className="ambient-orb w-24 h-24 bg-indigo-500/[0.03] bottom-20 left-16"
              style={{ animationDelay: "-4s" }}
            ></div>

            {/* Map overlays */}
            <div className="absolute top-5 left-5 z-20">
              <ZoneTabs />
            </div>

            {/* <div className="absolute top-18 left-5 z-20 glass rounded-2xl px-4 py-3 max-w-[320px]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/60">
                Plant Overview
              </div>
              <div className="text-sm text-blue-50/92 font-semibold mt-1.5 leading-snug">
                Zone 2 is in focus with 2 active alerts requiring operator
                review.
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <span className="text-[9px] text-blue-200/70 bg-blue-500/[0.08] border border-blue-400/[0.1] px-2.5 py-1 rounded-lg uppercase tracking-[0.12em] font-semibold">
                  2,498 workers on floor
                </span>
                <span className="text-[9px] text-emerald-300/80 bg-emerald-500/[0.08] border border-emerald-500/[0.12] px-2.5 py-1 rounded-lg uppercase tracking-[0.12em] font-semibold">
                  Monitoring live
                </span>
              </div>
            </div> */}

            <div className="absolute top-5 right-5 glass rounded-2xl px-5 py-3 flex items-center gap-4 z-20">
              <div className="text-right">
                <div className="text-lg font-semibold gradient-number leading-none">
                  2,498
                </div>
                <div className="text-[9px] text-blue-300/55 uppercase tracking-[0.15em] mt-1.5 font-medium">
                  On-floor Workforce
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-500/[0.08] flex items-center justify-center border border-blue-400/[0.10] shadow-[0_0_12px_rgba(59,130,246,0.08)]">
                <img
                  src={workerIcon}
                  alt="Worker"
                  className="w-4 h-4 opacity-55 invert"
                />
              </div>
            </div>

            {/* Alert Cards with Warning Icons — enhanced */}
            <div className="absolute bottom-24 left-5 z-20">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-200/75">
                Priority Alerts
              </div>
              <div className="text-[10px] text-blue-300/45 mt-1">
                Issues are sorted by severity for faster response.
              </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex gap-3 z-20">
              {[
                {
                  name: "Injection Holding Machine",
                  issue: "Temperature critical",
                  time: "12m ago",
                },
                {
                  name: "Hydraulic Press Unit",
                  issue: "Pressure anomaly detected",
                  time: "8m ago",
                },
              ].map((alert, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-br from-red-950/30 to-red-950/15 backdrop-blur-xl border border-red-500/10 rounded-2xl p-3 flex items-center gap-3 hover:border-red-500/25 transition-all duration-300 group/alert relative overflow-hidden"
                >
                  {/* Alert icon */}
                  <div className="w-9 h-9 bg-red-500/[0.10] rounded-xl flex items-center justify-center border border-red-500/[0.15] flex-shrink-0 shadow-[0_0_16px_rgba(239,68,68,0.12)]">
                    <img
                      src={alertWarning}
                      alt="Warning"
                      className="w-4 h-4 opacity-60 invert"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-red-200/90 group-hover/alert:text-red-100 transition-colors truncate">
                      {alert.name}
                    </div>
                    <div className="text-[9px] text-red-400/60 mt-0.5 font-medium flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse-glow"
                        style={{ color: "#ef4444" }}
                      ></span>
                      {alert.issue} • {alert.time}
                    </div>
                  </div>
                  {/* Red glow — enhanced */}
                  <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-red-500/[0.06] blur-[25px] rounded-full pointer-events-none group-hover/alert:bg-red-500/[0.10] transition-all duration-500"></div>
                  <div className="absolute -top-8 -right-8 w-16 h-16 bg-red-500/[0.03] blur-[20px] rounded-full pointer-events-none"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-3 flex flex-col gap-4 h-full min-h-0">
          {/* Machine Heat */}
          <div className="card p-4 flex flex-col gap-3 flex-[1.8] min-h-0 animate-fade-in delay-2">
            <div className="flex justify-between items-center flex-none">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500/[0.12] to-orange-500/[0.06] rounded-lg flex items-center justify-center border border-amber-400/[0.12] shadow-[0_0_10px_rgba(245,158,11,0.08)]">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="opacity-55"
                  >
                    <path
                      d="M8 1v8.5M6.5 11.5a1.5 1.5 0 103 0c0-.8-.7-1.2-1.5-2-.8.8-1.5 1.2-1.5 2z"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <rect
                      x="6.5"
                      y="1"
                      width="3"
                      height="10"
                      rx="1.5"
                      stroke="white"
                      strokeWidth="1"
                      className="opacity-30"
                    />
                  </svg>
                </div>
                <h3 className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-[0.15em]">
                  Machine Heat
                </h3>
              </div>
              <span className="text-[9px] text-blue-200/50 font-medium flex items-center gap-1.5 bg-blue-500/[0.04] px-2 py-0.5 rounded-md border border-blue-400/[0.06]">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-pulse-glow"
                  style={{ color: "#60a5fa" }}
                ></span>
                Live
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-grow overflow-hidden">
              {[
                {
                  temp: 60,
                  zone: "Zone 1",
                  status: "Safe",
                  color: "text-emerald-400",
                  dot: "bg-emerald-400",
                  glow: "shadow-[0_0_8px_rgba(52,211,153,0.4)]",
                  borderAccent: "hover:border-emerald-500/20",
                  glowBg: "bg-emerald-500/[0.04]",
                  trend: "↓ 2°",
                  trendColor: "text-emerald-400",
                },
                {
                  temp: 72,
                  zone: "Zone 2",
                  status: "Warning",
                  color: "text-amber-400",
                  dot: "bg-amber-400",
                  glow: "shadow-[0_0_8px_rgba(251,191,36,0.4)]",
                  borderAccent: "hover:border-amber-500/20",
                  glowBg: "bg-amber-500/[0.04]",
                  trend: "↑ 5°",
                  trendColor: "text-amber-400",
                },
                {
                  temp: 90,
                  zone: "Zone 3",
                  status: "Critical",
                  color: "text-red-400",
                  dot: "bg-red-500",
                  glow: "shadow-[0_0_8px_rgba(239,68,68,0.5)]",
                  borderAccent: "hover:border-red-500/20",
                  glowBg: "bg-red-500/[0.04]",
                  trend: "↑ 12°",
                  trendColor: "text-red-400",
                },
                {
                  temp: 66,
                  zone: "Zone 4",
                  status: "Safe",
                  color: "text-emerald-400",
                  dot: "bg-emerald-400",
                  glow: "shadow-[0_0_8px_rgba(52,211,153,0.4)]",
                  borderAccent: "hover:border-emerald-500/20",
                  glowBg: "bg-emerald-500/[0.04]",
                  trend: "↓ 1°",
                  trendColor: "text-emerald-400",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`card-inner p-3.5 flex flex-col justify-between ${item.borderAccent} transition-all duration-300 relative overflow-hidden group/heat`}
                >
                  <div className="flex justify-between items-start relative z-10">
                    <span
                      className={`text-[8px] font-semibold ${item.trendColor} opacity-60`}
                    >
                      {item.trend}
                    </span>
                    <span
                      className={`text-[8px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] flex items-center gap-1 ${item.color}`}
                    >
                      <span
                        className={`w-1 h-1 rounded-full ${item.dot} ${item.glow}`}
                      ></span>
                      {item.status}
                    </span>
                  </div>
                  <div className="relative z-10">
                    <div className="text-[24px] font-semibold gradient-number leading-none">
                      {item.temp}
                      <span
                        className="text-[10px] text-blue-300/25 font-normal ml-0.5"
                        style={{
                          WebkitTextFillColor: "rgb(120 160 210 / 0.35)",
                        }}
                      >
                        °C
                      </span>
                    </div>
                    <div className="text-[9px] text-blue-300/50 mt-1.5 uppercase tracking-[0.15em] font-medium">
                      {item.zone}
                    </div>
                  </div>
                  {/* Ambient glow */}
                  <div
                    className={`absolute -bottom-6 -right-6 w-20 h-20 ${item.glowBg} blur-[25px] rounded-full pointer-events-none group-hover/heat:scale-125 transition-all duration-700`}
                  ></div>
                </div>
              ))}
            </div>
          </div>

          {/* Energy Generated */}
          <div className="card p-4 flex flex-col justify-between flex-[0.95] min-h-0 relative overflow-hidden animate-fade-in delay-4 group/energy">
            <div className="flex justify-between items-center flex-none z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-emerald-500/[0.12] to-green-500/[0.06] rounded-lg flex items-center justify-center border border-emerald-400/[0.12] shadow-[0_0_10px_rgba(16,185,129,0.08)]">
                  <img
                    src={energyBolt}
                    alt="Energy"
                    className="w-3.5 h-3.5 opacity-55 invert"
                  />
                </div>
                <h3 className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-[0.15em]">
                  Green Energy
                </h3>
              </div>
              <span className="text-[9px] text-emerald-400/70 bg-gradient-to-r from-emerald-500/[0.08] to-emerald-500/[0.04] px-2.5 py-0.5 rounded-md border border-emerald-500/[0.10] font-semibold flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse-glow"
                  style={{ color: "#34d399" }}
                ></span>
                Active
              </span>
            </div>
            <div className="flex items-end justify-between mt-4 z-10">
              <div>
                <div
                  className="text-[34px] font-semibold text-emerald-400 tracking-tight leading-none"
                  style={{
                    filter: "drop-shadow(0 0 12px rgba(52,211,153,0.15))",
                  }}
                >
                  200
                  <span className="text-sm text-emerald-500/40 font-normal ml-1.5">
                    kWh
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="currentColor"
                    className="text-emerald-400"
                  >
                    <path d="M4 1L7 5H1L4 1Z" />
                  </svg>
                  <span className="text-[9px] text-emerald-400/70 font-semibold">
                    +8.3%
                  </span>
                  <span className="text-[8px] text-blue-400/35 font-medium">
                    today
                  </span>
                </div>
              </div>
              <div className="text-[9px] text-blue-300/50 text-right uppercase tracking-[0.15em] font-medium leading-relaxed">
                <div className="flex items-center gap-1.5 justify-end mb-1">
                  <img
                    src={machineGear}
                    alt="Machine"
                    className="w-3 h-3 opacity-25 invert"
                  />
                  <span>CNC Lathe</span>
                </div>
                Machine
              </div>
            </div>
            {/* Glow effects — enhanced */}
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-500/[0.05] blur-[60px] rounded-full pointer-events-none group-hover/energy:bg-emerald-500/[0.09] transition-all duration-700"></div>
            <div className="absolute -bottom-6 right-10 w-24 h-24 bg-blue-400/[0.03] blur-[35px] rounded-full pointer-events-none"></div>
            <div className="absolute top-4 right-4 w-16 h-16 bg-emerald-400/[0.02] blur-[20px] rounded-full pointer-events-none"></div>
          </div>

          {/* Idle Machine */}
          <div className="card p-4 flex items-center justify-between flex-[0.85] min-h-0 animate-fade-in delay-6 relative overflow-hidden group/idle">
            <div className="flex items-center gap-4 z-10">
              <div className="w-11 h-11 card-inner rounded-xl flex items-center justify-center relative">
                <img
                  src={machineGear}
                  className="w-5 h-5 opacity-25 grayscale invert group-hover/idle:opacity-35 transition-opacity duration-300"
                  alt="Gear"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500/30 rounded-full border-2 border-[#0a1832] shadow-[0_0_4px_rgba(59,130,246,0.3)]">
                  <svg
                    width="5"
                    height="5"
                    viewBox="0 0 6 6"
                    className="absolute top-[2px] left-[2px]"
                  >
                    <rect
                      width="2"
                      height="4"
                      x="0"
                      y="1"
                      fill="rgba(147,197,253,0.5)"
                      rx="0.5"
                    />
                    <rect
                      width="2"
                      height="4"
                      x="3"
                      y="1"
                      fill="rgba(147,197,253,0.5)"
                      rx="0.5"
                    />
                  </svg>
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-blue-100/90">
                  CNC Lathe
                </div>
                <div className="text-[10px] text-blue-300/50 mt-1 flex items-center gap-2 font-medium tracking-[0.12em]">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/30 shadow-[0_0_4px_rgba(59,130,246,0.3)] animate-breathe"></span>
                  IDLE
                  <span className="text-blue-400/15">•</span>
                  <span className="text-[9px] text-blue-400/40 tracking-normal">
                    2h 14m
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 z-10">
              <button className="w-7 h-7 rounded-full card-inner text-blue-300/35 flex items-center justify-center text-xs hover:text-white hover:bg-blue-500/[0.10] transition-all duration-200 hover:shadow-[0_0_8px_rgba(59,130,246,0.1)]">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M6 2L3 5l3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button className="w-7 h-7 rounded-full card-inner text-blue-300/35 flex items-center justify-center text-xs hover:text-white hover:bg-blue-500/[0.10] transition-all duration-200 hover:shadow-[0_0_8px_rgba(59,130,246,0.1)]">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M4 2l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            {/* Subtle idle glow */}
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-blue-500/[0.03] blur-[30px] rounded-full pointer-events-none group-hover/idle:bg-blue-500/[0.06] transition-all duration-500"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
