import React, { useState, useEffect } from "react";
import KPIBar from "./KPIBar";
import ActiveMachinery from "./ActiveMachinery";
import CurrentConsumption from "./CurrentConsumption";
import ZoneTabs from "./ZoneTabs";
import FilterBar from "./FilterBar";
import workerIcon from "../assets/icons/worker.svg";
import mapImage from "../assets/map.png";
import capgeminiLogo from "../assets/capgemini-logo.jpeg";
import alertWarning from "../assets/icons/alert_warning.svg";
import gearIcon from "../assets/icons/Gear.svg";
import Weather from "../Weather";
import { ShiftIndicator, SystemStatus } from "./HeaderWidgets";
import { useFilters } from "../context/FilterContext";
import { computeOverviewChips } from "../data/mockData";
import PLCParametersWidget from "./PLCParametersWidget";
import MotorFanWidget from "./MotorFanWidget";
import EmergencyLightWidget from "./EmergencyLightWidget";
import AIAssistantModal, { AIFloatingButton } from "./AIAssistantModal";
import NotificationDrawer from "./NotificationDrawer";
import KPIAnalyticsPanel from "./KPIAnalyticsPanel";

const Dashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const { filteredMachines, filteredAlerts } = useFilters();

  const overviewChips = computeOverviewChips(filteredMachines);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-dvh max-h-dvh text-white px-4 py-4 xl:px-5 xl:py-4 font-sans flex flex-col overflow-hidden gap-4">
      {/* Header */}
      <header className="glass flex items-center justify-between gap-4 flex-none animate-fade-in header-glow rounded-[28px] px-5 py-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-[16px] flex items-center justify-center relative group/logo cursor-pointer transition-all duration-300 overflow-hidden bg-white">
            <img src={capgeminiLogo} alt="Capgemini" className="w-9 h-9 object-contain group-hover/logo:scale-110 transition-transform duration-300" />
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-300 rounded-full border-2 border-[#07192f] shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse-glow"
              style={{ color: "#6ee7b7" }}
            ></div>
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold tracking-[0.24em] text-cyan-50 uppercase truncate">
              Digital Factory
            </div>
            <div className="text-[11px] text-sky-200/70 font-medium tracking-[0.22em] mt-1 flex items-center gap-2 uppercase">
              <span className="text-cyan-200/85">Live Operations</span>
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-3 min-w-0 pl-2">
            <div className="h-10 w-px bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent"></div>
            <SystemStatus operational={true} />
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
          <ShiftIndicator />
          <Weather
            temperature={25}
            condition="partly_cloudy"
            unit="C"
            location="Colorado"
            humidity={62}
            windSpeed={12}
            aqi={42}
            aqiLabel="Good"
          />

          <div className="hidden xl:block h-6 w-px bg-gradient-to-b from-transparent via-cyan-300/20 to-transparent"></div>

          <button onClick={() => setNotifOpen(true)} className="icon-btn notification-bell w-10 h-10 flex items-center justify-center rounded-full glass text-cyan-100/50 hover:text-white relative transition-all duration-300 hover:shadow-[0_0_24px_rgba(34,211,238,0.15)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              className="opacity-65 transition-opacity duration-300 group-hover:opacity-80"
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
              {filteredAlerts.length}
            </span>
          </button>

          <button className="icon-btn w-10 h-10 flex items-center justify-center rounded-full glass text-cyan-100/50 hover:text-white relative transition-all duration-300 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)] group/settings">
            <img
              src={gearIcon}
              alt="Settings"
              className="w-4 h-4 opacity-70 invert group-hover/settings:opacity-65 group-hover/settings:rotate-90 transition-all duration-500"
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
              <div className="text-[11px] font-semibold text-cyan-200/70 uppercase tracking-[0.18em]">
                Operations Snapshot
              </div>
              <div className="text-[18px] font-semibold text-cyan-50 mt-1 tracking-tight leading-tight">
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
          <FilterBar />
          <div className="flex items-center gap-3">
            <div className="flex-1"><KPIBar /></div>
            <button
              onClick={() => setAnalyticsOpen(true)}
              className="flex-shrink-0 h-[96px] px-3 card flex flex-col items-center justify-center gap-1.5 group/analytics cursor-pointer hover:border-cyan-400/20 transition-all duration-300"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="text-cyan-300/50 group-hover/analytics:text-cyan-300 transition-colors">
                <rect x="2" y="10" width="3" height="8" rx="1" fill="currentColor" />
                <rect x="7" y="6" width="3" height="12" rx="1" fill="currentColor" />
                <rect x="12" y="3" width="3" height="15" rx="1" fill="currentColor" />
                <path d="M3 9L8 5L13 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
              </svg>
              <span className="text-[8px] text-sky-200/50 group-hover/analytics:text-sky-200/80 font-semibold uppercase tracking-[0.1em] transition-colors">Analytics</span>
            </button>
          </div>
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

            <div className="absolute top-5 right-5 glass rounded-2xl px-5 py-3 flex items-center gap-4 z-20">
              <div className="text-right">
                <div className="text-lg font-semibold gradient-number leading-none">
                  2,498
                </div>
                <div className="text-[10px] text-blue-300/55 uppercase tracking-[0.15em] mt-1.5 font-medium">
                  On-floor Workforce
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-500/[0.08] flex items-center justify-center border border-blue-400/[0.10] shadow-[0_0_12px_rgba(59,130,246,0.08)]">
                <img
                  src={workerIcon}
                  alt="Worker"
                  className="w-4 h-4 opacity-70 invert"
                />
              </div>
            </div>

            {/* Alert Cards */}
            {filteredAlerts.length > 0 && (
              <>
                <div className="absolute bottom-24 left-5 z-20">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-200/75">
                    Priority Alerts
                  </div>
                  <div className="text-[11px] text-blue-200/70 mt-1">
                    Issues are sorted by severity for faster response.
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex gap-3 z-20">
                  {filteredAlerts.slice(0, 2).map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex-1 backdrop-blur-xl border rounded-2xl p-3 flex items-center gap-3 transition-all duration-300 group/alert relative overflow-hidden ${
                        alert.severity === "critical"
                          ? "bg-gradient-to-br from-red-950/30 to-red-950/15 border-red-500/10 hover:border-red-500/25"
                          : alert.severity === "warning"
                            ? "bg-gradient-to-br from-amber-950/30 to-amber-950/15 border-amber-500/10 hover:border-amber-500/25"
                            : "bg-gradient-to-br from-blue-950/30 to-blue-950/15 border-blue-500/10 hover:border-blue-500/25"
                      }`}
                    >
                      {/* Alert icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                        alert.severity === "critical"
                          ? "bg-red-500/[0.10] border-red-500/[0.15] shadow-[0_0_16px_rgba(239,68,68,0.12)]"
                          : alert.severity === "warning"
                            ? "bg-amber-500/[0.10] border-amber-500/[0.15] shadow-[0_0_16px_rgba(245,158,11,0.12)]"
                            : "bg-blue-500/[0.10] border-blue-500/[0.15] shadow-[0_0_16px_rgba(59,130,246,0.12)]"
                      }`}>
                        <img
                          src={alertWarning}
                          alt="Warning"
                          className="w-4 h-4 opacity-60 invert"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12px] font-medium transition-colors truncate ${
                          alert.severity === "critical"
                            ? "text-red-200/90 group-hover/alert:text-red-100"
                            : alert.severity === "warning"
                              ? "text-amber-200/90 group-hover/alert:text-amber-100"
                              : "text-blue-200/90 group-hover/alert:text-blue-100"
                        }`}>
                          {alert.machineName}
                        </div>
                        <div className={`text-[10px] mt-0.5 font-medium flex items-center gap-1.5 ${
                          alert.severity === "critical"
                            ? "text-red-400/60"
                            : alert.severity === "warning"
                              ? "text-amber-400/60"
                              : "text-blue-400/60"
                        }`}>
                          <span
                            className={`w-1.5 h-1.5 rounded-full animate-pulse-glow ${
                              alert.severity === "critical"
                                ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                                : alert.severity === "warning"
                                  ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                                  : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]"
                            }`}
                            style={{ color: alert.severity === "critical" ? "#ef4444" : alert.severity === "warning" ? "#f59e0b" : "#3b82f6" }}
                          ></span>
                          {alert.issue} • {alert.time}
                        </div>
                      </div>
                      {/* Glow */}
                      <div className={`absolute -bottom-6 -left-6 w-20 h-20 blur-[25px] rounded-full pointer-events-none transition-all duration-500 ${
                        alert.severity === "critical"
                          ? "bg-red-500/[0.06] group-hover/alert:bg-red-500/[0.10]"
                          : alert.severity === "warning"
                            ? "bg-amber-500/[0.06] group-hover/alert:bg-amber-500/[0.10]"
                            : "bg-blue-500/[0.06] group-hover/alert:bg-blue-500/[0.10]"
                      }`}></div>
                      <div className={`absolute -top-8 -right-8 w-16 h-16 blur-[20px] rounded-full pointer-events-none ${
                        alert.severity === "critical"
                          ? "bg-red-500/[0.03]"
                          : alert.severity === "warning"
                            ? "bg-amber-500/[0.03]"
                            : "bg-blue-500/[0.03]"
                      }`}></div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-3 flex flex-col gap-3 h-full min-h-0">
          <PLCParametersWidget className="flex-[2.2] min-h-0" />

          <div className="flex-[1] min-h-0 flex gap-3">
            <MotorFanWidget className="flex-1 min-h-0" />
            <EmergencyLightWidget className="flex-1 min-h-0" />
          </div>

        </div>
      </div>

      <AIFloatingButton onClick={() => setAiChatOpen(true)} />
      <AIAssistantModal open={aiChatOpen} onClose={() => setAiChatOpen(false)} />
      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} alerts={filteredAlerts} />
      <KPIAnalyticsPanel open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
    </div>
  );
};

export default Dashboard;
