import React, { useState, useEffect, Suspense, lazy } from "react";
import KPIBar from "./KPIBar";
import ZoneTabs from "./ZoneTabs";
import workerIcon from "../assets/icons/worker.svg";
import capgeminiLogo from "../assets/capgemini-logo.jpeg";
import alertWarning from "../assets/icons/alert_warning.svg";
import gearIcon from "../assets/icons/Gear.svg";
import Weather from "../Weather";
import { ShiftIndicator, SystemStatus } from "./HeaderWidgets";
import { useFilters } from "../context/FilterContext";
import PLCParametersWidget from "./PLCParametersWidget";
import MotorFanWidget from "./MotorFanWidget";
import EmergencyLightWidget from "./EmergencyLightWidget";
import { usePredictionStore } from "../stores/predictionStore";

const FactoryScene = lazy(() => import("./factory3d/FactoryScene"));
const PLCControlRoom = lazy(() => import("./factory3d/PLCControlRoom"));
const AIAssistantModal = lazy(() => import("./AIAssistantModal"));
const LanggraphAgentPanel = lazy(() => import("./LanggraphAgentPanel"));
const NotificationDrawer = lazy(() => import("./NotificationDrawer"));
const KPIAnalyticsPanel = lazy(() => import("./KPIAnalyticsPanel"));
const OEEPanel = lazy(() => import("./OEEPanel"));
const PredictivePanel = lazy(() => import("./PredictivePanel"));
const DigitalTwinPanel = lazy(() => import("./DigitalTwinPanel"));
const IntegrationModal = lazy(() => import("./IntegrationModal"));
const DynamicPathSelectionPage = lazy(() =>
  import("../integrations/pages/DynamicPathSelection").then((m) => ({ default: m.DynamicPathSelectionPage })),
);
const VideoAnalyticsPage = lazy(() =>
  import("../integrations/pages/VideoAnalytics").then((m) => ({ default: m.VideoAnalyticsPage })),
);

const Dashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [oeeOpen, setOeeOpen] = useState(false);
  const [predictiveOpen, setPredictiveOpen] = useState(false);
  const [digitalTwinOpen, setDigitalTwinOpen] = useState(false);
  const [dpsOpen, setDpsOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const predAlertCount = usePredictionStore((s) => s.anomalyAlerts.length);
  const [sceneView, setSceneView] = useState<"factory" | "plc">("factory");
  const { filteredAlerts } = useFilters();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-dvh xl:h-dvh xl:max-h-dvh text-white px-3 py-3 xl:px-5 xl:py-4 font-sans flex flex-col overflow-y-auto xl:overflow-hidden gap-3 xl:gap-4">
      {/* Header */}
      <header className="glass flex items-center justify-between gap-4 flex-none animate-fade-in header-glow rounded-[28px] px-5 py-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Capgemini (integrator) — small mark, kept */}
          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center relative group/logo cursor-pointer transition-all duration-300 overflow-hidden bg-white shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
            <img
              src={capgeminiLogo}
              alt="Capgemini"
              className="w-8 h-8 object-contain group-hover/logo:scale-110 transition-transform duration-300"
            />
          </div>
          <div className="min-w-0 pl-1">
            <div className="text-[15px] font-bold tracking-[0.24em] text-white/95 uppercase truncate leading-none">
              Manufacturing Industry
            </div>
            <div className="text-[10px] text-white/45 font-medium tracking-[0.3em] mt-1.5 uppercase">
              Live Operations
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-3 min-w-0 pl-1.5">
            <div className="h-9 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent"></div>
            <SystemStatus operational={true} />
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          <div className="hidden 2xl:flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-[10px] text-white/70 font-medium">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="text-white/55"
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
            <span className="text-white/20">•</span>
            <span className="tabular-nums">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-[10px] text-white/75 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#91c904] shadow-[0_0_10px_rgba(145,201,4,0.8)]"></span>
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

          <button
            onClick={() => setNotifOpen(true)}
            className="icon-btn notification-bell w-10 h-10 flex items-center justify-center rounded-full glass text-cyan-100/50 hover:text-white relative transition-all duration-300 hover:shadow-[0_0_24px_rgba(34,211,238,0.15)]"
          >
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

      {/* Main Grid — stacks to a single column below xl (square / narrow
          screens), side-by-side 9:3 at xl and up. */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-grow min-h-0 xl:overflow-hidden">
        {/* Center Content — expanded for larger factory floor */}
        <div className="xl:col-span-9 flex flex-col gap-4 xl:h-full min-h-0">
          <KPIBar
            onOeeClick={() => setOeeOpen(true)}
            onAnalyticsClick={() => setAnalyticsOpen(true)}
            onPredictClick={() => setPredictiveOpen(true)}
            onDigitalTwinClick={() => setDigitalTwinOpen(true)}
            onDpsClick={() => setDpsOpen(true)}
            onVideoClick={() => setVideoOpen(true)}
            predAlertCount={predAlertCount}
          />
          <div className="flex-grow min-h-[460px] xl:min-h-0 card data-trace corner-marks relative overflow-hidden group">
            {/* 3D Scene — Factory or PLC Control Room */}
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-cyan-200/60 text-[11px]">
                  Initializing 3D scene…
                </div>
              }
            >
              {sceneView === "factory" ? <FactoryScene /> : <PLCControlRoom />}
            </Suspense>

            {/* Gradient overlays */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#030b1a]/60 to-transparent pointer-events-none z-10"></div>
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#030b1a]/90 to-transparent pointer-events-none z-10"></div>

            {/* View switcher tab */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex gap-1 p-1 rounded-xl bg-black/40 backdrop-blur-md border border-cyan-300/10">
              {(
                [
                  ["factory", "Factory Floor"],
                  ["plc", "PLC Controls"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setSceneView(id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 pointer-events-auto ${
                    sceneView === id
                      ? "bg-cyan-400/15 text-cyan-200 border border-cyan-400/25 shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                      : "text-sky-200/50 hover:text-sky-200/80 border border-transparent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Overlays — only show on factory view */}
            <div
              className={`absolute top-14 left-5 z-20 pointer-events-auto ${sceneView !== "factory" ? "hidden" : ""}`}
            >
              <ZoneTabs />
            </div>

            <div
              className={`absolute top-[280px] right-5 glass rounded-2xl px-5 py-3 flex items-center gap-4 z-20 hidden`}
            >
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

            {/* Alert Cards — hidden in factory view for full 3D scene visibility */}
            {filteredAlerts.length > 0 && sceneView === "factory" && false && (
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
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                          alert.severity === "critical"
                            ? "bg-red-500/[0.10] border-red-500/[0.15] shadow-[0_0_16px_rgba(239,68,68,0.12)]"
                            : alert.severity === "warning"
                              ? "bg-amber-500/[0.10] border-amber-500/[0.15] shadow-[0_0_16px_rgba(245,158,11,0.12)]"
                              : "bg-blue-500/[0.10] border-blue-500/[0.15] shadow-[0_0_16px_rgba(59,130,246,0.12)]"
                        }`}
                      >
                        <img
                          src={alertWarning}
                          alt="Warning"
                          className="w-4 h-4 opacity-60 invert"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-[12px] font-medium transition-colors truncate ${
                            alert.severity === "critical"
                              ? "text-red-200/90 group-hover/alert:text-red-100"
                              : alert.severity === "warning"
                                ? "text-amber-200/90 group-hover/alert:text-amber-100"
                                : "text-blue-200/90 group-hover/alert:text-blue-100"
                          }`}
                        >
                          {alert.machineName}
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 font-medium flex items-center gap-1.5 ${
                            alert.severity === "critical"
                              ? "text-red-400/60"
                              : alert.severity === "warning"
                                ? "text-amber-400/60"
                                : "text-blue-400/60"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full animate-pulse-glow ${
                              alert.severity === "critical"
                                ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                                : alert.severity === "warning"
                                  ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                                  : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]"
                            }`}
                            style={{
                              color:
                                alert.severity === "critical"
                                  ? "#ef4444"
                                  : alert.severity === "warning"
                                    ? "#f59e0b"
                                    : "#3b82f6",
                            }}
                          ></span>
                          {alert.issue} • {alert.time}
                        </div>
                      </div>
                      {/* Glow */}
                      <div
                        className={`absolute -bottom-6 -left-6 w-20 h-20 blur-[25px] rounded-full pointer-events-none transition-all duration-500 ${
                          alert.severity === "critical"
                            ? "bg-red-500/[0.06] group-hover/alert:bg-red-500/[0.10]"
                            : alert.severity === "warning"
                              ? "bg-amber-500/[0.06] group-hover/alert:bg-amber-500/[0.10]"
                              : "bg-blue-500/[0.06] group-hover/alert:bg-blue-500/[0.10]"
                        }`}
                      ></div>
                      <div
                        className={`absolute -top-8 -right-8 w-16 h-16 blur-[20px] rounded-full pointer-events-none ${
                          alert.severity === "critical"
                            ? "bg-red-500/[0.03]"
                            : alert.severity === "warning"
                              ? "bg-amber-500/[0.03]"
                              : "bg-blue-500/[0.03]"
                        }`}
                      ></div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Sidebar — PLC + motor/emergency + thin 3-phase strip
            (click strip to open per-phase detail drawer).
            On stacked (sub-xl) layouts the children need explicit heights
            since flex ratios collapse without a fixed-height parent. */}
        <div className="xl:col-span-3 flex flex-col gap-3 xl:h-full min-h-0">
          {/* 3-Phase now lives inside PLC Parameters as a clickable tile, so the
              sidebar is just PLC params + the motor/emergency row, which gets
              more vertical room. */}
          <PLCParametersWidget className="flex-1 min-h-[360px] xl:min-h-0" />
          <div className="flex-none h-[150px] flex gap-3">
            <MotorFanWidget className="flex-1 min-h-0" />
            <EmergencyLightWidget className="flex-1 min-h-0" />
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {/* Langgraph agent — always mounted so its own floating button is
            available in the corner. Talks to VITE_LANGGRAPH_API_BASE. */}
        <LanggraphAgentPanel />
        {notifOpen && (
          <NotificationDrawer
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            alerts={filteredAlerts}
          />
        )}
        {analyticsOpen && (
          <KPIAnalyticsPanel
            open={analyticsOpen}
            onClose={() => setAnalyticsOpen(false)}
          />
        )}
        {oeeOpen && (
          <OEEPanel open={oeeOpen} onClose={() => setOeeOpen(false)} />
        )}
        {predictiveOpen && (
          <PredictivePanel
            open={predictiveOpen}
            onClose={() => setPredictiveOpen(false)}
          />
        )}
        {digitalTwinOpen && (
          <DigitalTwinPanel
            open={digitalTwinOpen}
            onClose={() => setDigitalTwinOpen(false)}
          />
        )}
        {dpsOpen && (
          <IntegrationModal
            open={dpsOpen}
            onClose={() => setDpsOpen(false)}
            title="Dynamic Path Selection"
          >
            <DynamicPathSelectionPage />
          </IntegrationModal>
        )}
        {videoOpen && (
          <IntegrationModal
            open={videoOpen}
            onClose={() => setVideoOpen(false)}
            title="Video Analytics"
          >
            <VideoAnalyticsPage />
          </IntegrationModal>
        )}
      </Suspense>
    </div>
  );
};

export default Dashboard;
