import React, { useRef, useState, useEffect, Suspense, lazy } from "react";
import KPIBar from "./KPIBar";
import ZoneTabs from "./ZoneTabs";
import workerIcon from "../assets/icons/worker.svg";
import capgeminiLogo from "../assets/capgemini-logo.jpeg";
import alertWarning from "../assets/icons/alert_warning.svg";
import gearIcon from "../assets/icons/Gear.svg";
// Weather component available for future use but not shown in header
// import Weather from "../Weather";
// import { ShiftIndicator, SystemStatus } from "./HeaderWidgets";
import { useFilters } from "../context/FilterContext";
import PLCParametersWidget from "./PLCParametersWidget";
import MotorFanWidget from "./MotorFanWidget";
import EmergencyLightWidget from "./EmergencyLightWidget";
import IntegrationModal from "./IntegrationModal";
import GatewayTwinEmbed from "./GatewayTwinEmbed";
import { usePredictionStore } from "../stores/predictionStore";

const FactoryScene = lazy(() => import("./factory3d/FactoryScene"));
const AIAssistantModal = lazy(() => import("./AIAssistantModal"));
const LanggraphAgentPanel = lazy(() => import("./LanggraphAgentPanel"));
const NotificationDrawer = lazy(() => import("./NotificationDrawer"));
const KPIAnalyticsPanel = lazy(() => import("./KPIAnalyticsPanel"));
const OEEPanel = lazy(() => import("./OEEPanel"));
const PredictivePanel = lazy(() => import("./PredictivePanel"));
const UNSExplorerPanel = lazy(() => import("./UNSExplorerPanel"));
const DynamicPathSelectionPage = lazy(() =>
  import("../integrations/pages/DynamicPathSelection").then((m) => ({ default: m.DynamicPathSelectionPage })),
);
const ApplicationAwareRoutingPage = lazy(() =>
  import("../integrations/pages/ApplicationAwareRouting").then((m) => ({ default: m.ApplicationAwareRoutingPage })),
);
const DevicesPage = lazy(() =>
  import("../integrations/pages/Devices").then((m) => ({ default: m.DevicesPage })),
);
const OnboardingPage = lazy(() =>
  import("../integrations/pages/Onboarding").then((m) => ({ default: m.OnboardingPage })),
);
const VideoAnalyticsPage = lazy(() =>
  import("../integrations/pages/VideoAnalytics").then((m) => ({ default: m.VideoAnalyticsPage })),
);

/** Spinner shown inside an integration modal while its lazy page chunk loads. */
const IntegrationLoading: React.FC = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-24 text-cyan-200/70">
    <div className="w-7 h-7 rounded-full border-2 border-cyan-300/20 border-t-cyan-300/80 animate-spin"></div>
    <div className="text-[11px] uppercase tracking-[0.18em] font-semibold">Loading…</div>
  </div>
);

type NetworkBranchId = "b-mck-03" | "b-pln-01";

/** Smart Factory has no global branch picker, so the network integrations
 * expose the Connected Enterprise source mapping locally. McKinney/prpl is
 * the default because that is the Smart Factory gateway feed. */
const GatewaySourceSelector: React.FC<{
  value: NetworkBranchId;
  onChange: (value: NetworkBranchId) => void;
}> = ({ value, onChange }) => (
  <div
    className="toolbar"
    style={{ justifyContent: "flex-end", marginBottom: 14 }}
    aria-label="Gateway telemetry source"
  >
    <span style={{ color: "var(--text-muted)", fontSize: 11, marginRight: 4 }}>
      Gateway feed
    </span>
    <button
      type="button"
      className={value === "b-mck-03" ? "primary" : undefined}
      onClick={() => onChange("b-mck-03")}
    >
      prpl · McKinney
    </button>
    <button
      type="button"
      className={value === "b-pln-01" ? "primary" : undefined}
      onClick={() => onChange("b-pln-01")}
    >
      rdk · Plano
    </button>
  </div>
);

const Dashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [oeeOpen, setOeeOpen] = useState(false);
  const [predictiveOpen, setPredictiveOpen] = useState(false);
  const [dpsOpen, setDpsOpen] = useState(false);
  const [appRoutingOpen, setAppRoutingOpen] = useState(false);
  const [devicesDomain, setDevicesDomain] = useState<"IT" | "OT" | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [networkBranchId, setNetworkBranchId] = useState<NetworkBranchId>("b-mck-03");
  const [videoOpen, setVideoOpen] = useState(false);
  const [gwTwinOpen, setGwTwinOpen] = useState(false);
  const gwTwinFullscreenRef = useRef<HTMLDivElement>(null);
  const [unsOpen, setUnsOpen] = useState(false);
  const predAlertCount = usePredictionStore((s) => s.anomalyAlerts.length);
  const { filteredAlerts } = useFilters();

  // The integration modals cover the whole screen, so freeze the 3D render
  // loop while one is open — on integrated GPUs the scene otherwise competes
  // with the modal for the GPU and makes it take seconds to appear.
  const scenePaused = dpsOpen || appRoutingOpen || devicesDomain !== null || onboardingOpen || videoOpen || gwTwinOpen;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="smart-factory-ui min-h-dvh xl:h-dvh xl:max-h-dvh text-white px-3 py-3 xl:px-5 xl:py-3.5 font-sans flex flex-col overflow-y-auto xl:overflow-hidden gap-3">
      {/* Header — minimal, modern */}
      <header className="flex items-center justify-between gap-4 flex-none animate-fade-in px-3 py-2">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center relative group/logo cursor-pointer transition-all duration-300 overflow-hidden bg-white/95 shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
            <img
              src={capgeminiLogo}
              alt="Capgemini"
              className="w-8 h-8 object-contain group-hover/logo:scale-110 transition-transform duration-300"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-[0.06em] text-white/92 uppercase truncate leading-none">
              Manufacturing Industry
            </div>
            <div className="text-[10px] text-white/55 font-medium tracking-[0.1em] mt-1 uppercase">
              Live Operations
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Compact inline time + weather */}
          <div className="hidden lg:flex items-center gap-4 text-[13px] text-white/60 font-medium tabular-nums">
            <span>{currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            <span className="text-white/8">|</span>
            <span className="flex items-center gap-2">
              <span className="text-[15px] text-white/75 font-semibold">25°</span>
              <span className="text-white/55">Colorado</span>
            </span>
          </div>

          {/* Notification */}
          <button
            onClick={() => setNotifOpen(true)}
            className="icon-btn notification-bell w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white relative transition-all duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 17a2 2 0 004 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {filteredAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 rounded-full text-[8px] leading-none font-bold flex items-center justify-center px-1 text-white">
                {filteredAlerts.length}
              </span>
            )}
          </button>

          {/* UNS Explorer — live unified-namespace tree */}
          <button
            onClick={() => setUnsOpen(true)}
            title="UNS Explorer"
            className="icon-btn w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white relative transition-all duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="12" y="8" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="3" y="13" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 5h2.5v10H8M10.5 10H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>

          {/* Settings */}
          <button className="icon-btn w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white relative transition-all duration-200 group/settings">
            <img
              src={gearIcon}
              alt="Settings"
              className="w-4.5 h-4.5 opacity-50 invert group-hover/settings:rotate-90 transition-all duration-500"
            />
          </button>

          {/* Avatar */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 flex items-center justify-center cursor-pointer hover:from-indigo-500/40 hover:to-violet-500/30 transition-all duration-300">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="opacity-60">
              <circle cx="10" cy="7" r="3.5" stroke="white" strokeWidth="1.5" />
              <path d="M3 17.5c0-3 3-5.5 7-5.5s7 2.5 7 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 flex-grow min-h-0 xl:overflow-hidden">
        {/* Center Content */}
        <div className="xl:col-span-9 flex flex-col gap-3 xl:h-full min-h-0">
          <KPIBar
            onOeeClick={() => setOeeOpen(true)}
            onAnalyticsClick={() => setAnalyticsOpen(true)}
            onPredictClick={() => setPredictiveOpen(true)}
            onDpsClick={() => setDpsOpen(true)}
            onRoutingClick={() => setAppRoutingOpen(true)}
            onItDevicesClick={() => setDevicesDomain("IT")}
            onOtDevicesClick={() => setDevicesDomain("OT")}
            onOnboardingClick={() => setOnboardingOpen(true)}
            onGatewayTwinClick={() => setGwTwinOpen(true)}
            onVideoClick={() => setVideoOpen(true)}
            predAlertCount={predAlertCount}
          />
          <div className="flex-grow min-h-[460px] xl:min-h-0 card data-trace corner-marks relative overflow-hidden group rounded-2xl">
            {/* 3D Scene */}
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-white/50 text-[11px] tracking-wider uppercase">
                  Initializing 3D scene…
                </div>
              }
            >
              <FactoryScene paused={scenePaused} />
            </Suspense>

            {/* Gradient overlays */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0b0c1a]/70 to-transparent pointer-events-none z-10"></div>
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b0c1a]/80 to-transparent pointer-events-none z-10"></div>

            <div className="absolute top-14 left-5 z-20 pointer-events-auto">
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
            {filteredAlerts.length > 0 && false && (
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

        {/* Right Sidebar */}
        <div className="xl:col-span-3 flex flex-col gap-3 xl:h-full min-h-0">
          <PLCParametersWidget className="flex-1 min-h-[360px] xl:min-h-0" />
          <div className="flex-none h-[140px] flex gap-3">
            <MotorFanWidget className="flex-1 min-h-0" />
            <EmergencyLightWidget className="flex-1 min-h-0" />
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {/* External agentic-AI assistant. It sends only user-submitted prompts
            and remains separate from the governed Bedrock insight routes. */}
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
        {unsOpen && (
          <UNSExplorerPanel open={unsOpen} onClose={() => setUnsOpen(false)} />
        )}
      </Suspense>

      {/* Integration modals — the modal shell is a static import so it opens
          instantly on click; only the heavy page chunk lazy-loads, with its
          own spinner so the user gets immediate feedback instead of a frozen
          blank screen while the ~100KB chunk downloads and parses. */}
      {dpsOpen && (
        <IntegrationModal
          open={dpsOpen}
          onClose={() => setDpsOpen(false)}
          title="Dynamic Failover"
        >
          <Suspense fallback={<IntegrationLoading />}>
            <GatewaySourceSelector value={networkBranchId} onChange={setNetworkBranchId} />
            <DynamicPathSelectionPage branchId={networkBranchId} />
          </Suspense>
        </IntegrationModal>
      )}
      {appRoutingOpen && (
        <IntegrationModal
          open={appRoutingOpen}
          onClose={() => setAppRoutingOpen(false)}
          title="Application Traffic Routing"
        >
          <Suspense fallback={<IntegrationLoading />}>
            <GatewaySourceSelector value={networkBranchId} onChange={setNetworkBranchId} />
            <ApplicationAwareRoutingPage branchId={networkBranchId} />
          </Suspense>
        </IntegrationModal>
      )}
      {devicesDomain && (
        <IntegrationModal
          open
          onClose={() => setDevicesDomain(null)}
          title={`${devicesDomain} Devices`}
        >
          <Suspense fallback={<IntegrationLoading />}>
            <GatewaySourceSelector value={networkBranchId} onChange={setNetworkBranchId} />
            <DevicesPage domain={devicesDomain} branchId={networkBranchId} />
          </Suspense>
        </IntegrationModal>
      )}
      {onboardingOpen && (
        <IntegrationModal
          open
          onClose={() => setOnboardingOpen(false)}
          title="Gateway Onboarding"
        >
          <Suspense fallback={<IntegrationLoading />}>
            <GatewaySourceSelector value={networkBranchId} onChange={setNetworkBranchId} />
            <OnboardingPage branchId={networkBranchId} />
          </Suspense>
        </IntegrationModal>
      )}
      {videoOpen && (
        <IntegrationModal
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          title="Video Analytics"
        >
          <Suspense fallback={<IntegrationLoading />}>
            <VideoAnalyticsPage />
          </Suspense>
        </IntegrationModal>
      )}
      {/* Gateway Digital Twin — local embedded widget (public/widgets/gw-twin,
          built from the GW-Operational-Twin repo). Fully self-contained:
          in-browser TR-181 simulator, no backend, no external host. */}
      {gwTwinOpen && (
        <IntegrationModal
          open={gwTwinOpen}
          onClose={() => setGwTwinOpen(false)}
          title="Gateway Digital Twin"
          layout="immersive"
          enableFullscreen
          fullscreenTargetRef={gwTwinFullscreenRef}
        >
          <div ref={gwTwinFullscreenRef} style={{ height: "78vh", minHeight: 480, borderRadius: 12, overflow: "hidden" }}>
            <GatewayTwinEmbed />
          </div>
        </IntegrationModal>
      )}
    </div>
  );
};

export default Dashboard;
