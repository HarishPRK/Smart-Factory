import React, { useRef, useState, useEffect, Suspense, lazy } from "react";
import KPIBar from "./KPIBar";
import { Activity, Bell, Bot, Box, ChartNoAxesCombined, Network, Sparkles, Gauge, ArrowUpRight, PanelRight, ChevronRight } from "lucide-react";
import { usePLCContext } from "../context/PLCContext";
import capgeminiLogo from "../assets/capgemini-logo.jpeg";
// Weather component available for future use but not shown in header
// import Weather from "../Weather";
// import { ShiftIndicator, SystemStatus } from "./HeaderWidgets";
import { useFilters } from "../context/FilterContext";
import PLCParametersWidget from "./PLCParametersWidget";
import MotorFanWidget from "./MotorFanWidget";
import EmergencyLightWidget from "./EmergencyLightWidget";
import IntegrationModal from "./IntegrationModal";
import GatewayTwinEmbed from "./GatewayTwinEmbed";
import SmartMeterEmbed from "./SmartMeterEmbed";
import { usePredictionStore } from "../stores/predictionStore";

import { OfferingNavigation } from '../integrations/components/offerings/OfferingNavigation';
const ServiceOfferingsPage = lazy(() => import('../integrations/pages/ServiceOfferings').then(m => ({ default: m.ServiceOfferingsPage })));
const HardwareAnomaliesPage = lazy(() => import('../integrations/pages/HardwareAnomalies').then(m => ({ default: m.HardwareAnomaliesPage })));
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

const Dashboard: React.FC<{ headerSlot?: React.ReactNode }> = ({ headerSlot }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [langgraphOpen, setLanggraphOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [oeeOpen, setOeeOpen] = useState(false);
  const [predictiveOpen, setPredictiveOpen] = useState(false);
  const [offeringsOpen, setOfferingsOpen] = useState(() => window.location.pathname === '/service-offerings');
  const [eagleOpen, setEagleOpen] = useState(() => window.location.pathname === '/hardware-anomalies');
  const [dpsOpen, setDpsOpen] = useState(false);
  const [appRoutingOpen, setAppRoutingOpen] = useState(false);
  const [devicesDomain, setDevicesDomain] = useState<"IT" | "OT" | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [networkBranchId, setNetworkBranchId] = useState<NetworkBranchId>("b-mck-03");
  const [videoOpen, setVideoOpen] = useState(false);
  const [gwTwinOpen, setGwTwinOpen] = useState(false);
  const [smartMeterOpen, setSmartMeterOpen] = useState(false);
  const [modelFocused, setModelFocused] = useState(false);
  const [inspectorHost, setInspectorHost] = useState<HTMLDivElement | null>(null);
  const gwTwinFullscreenRef = useRef<HTMLDivElement>(null);
  const smartMeterFullscreenRef = useRef<HTMLDivElement>(null);
  const [unsOpen, setUnsOpen] = useState(false);
  const predAlertCount = usePredictionStore((s) => s.anomalyAlerts.length);
  const { filteredAlerts } = useFilters();
  const { isConnected } = usePLCContext(false);

  // The integration modals cover the whole screen, so freeze the 3D render
  // loop while one is open — on integrated GPUs the scene otherwise competes
  // with the modal for the GPU and makes it take seconds to appear.
  const scenePaused = analyticsOpen || oeeOpen || predictiveOpen || offeringsOpen || eagleOpen || dpsOpen || appRoutingOpen || devicesDomain !== null || onboardingOpen || videoOpen || gwTwinOpen || smartMeterOpen;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`smart-factory-ui operations-shell plant-console${modelFocused ? " is-model-focused" : ""}`}>
      <aside className="operations-rail">
        <a href={import.meta.env.BASE_URL} aria-label="Manufacturing Industry home" className="rail-brand"><img src={capgeminiLogo} alt="Capgemini" /></a>
        <nav className="operations-nav" aria-label="Main navigation">
          <button className="is-current" aria-current="page"><Box size={20} /><span>Twin</span></button>
          <button onClick={() => setAnalyticsOpen(true)}><ChartNoAxesCombined size={20} /><span>Analytics</span></button>
          <button onClick={() => setOfferingsOpen(true)}><Network size={20} /><span>Solutions</span></button>
          <button onClick={() => setUnsOpen(true)}><Activity size={20} /><span>Network</span></button>
        </nav>
        <span className="rail-footnote">OPERATIONS</span>
      </aside>
      <header className="operations-header">
        <div className="operations-brand"><span>Manufacturing</span><ChevronRight size={14} /><span className="workspace-name">Plant workspace</span></div>
        <div className="operations-header__actions">
          {headerSlot}
          <time>{currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</time>
          <button aria-label="Open Aituzero Smart Meter" title="Smart meter" onClick={() => setSmartMeterOpen(true)}><Gauge size={18} /></button>
          <button aria-label="UNS Explorer" title="UNS Explorer" onClick={() => setUnsOpen(true)}><Network size={18} /></button>
          <button aria-label={`Notifications: ${filteredAlerts.length} alerts`} title="Notifications" className="operations-notifications" onClick={() => setNotifOpen(true)}><Bell size={18} />{filteredAlerts.length > 0 && <span>{filteredAlerts.length}</span>}</button>
          <button className="operations-assistant" aria-label="Ask AI" onClick={() => setAiChatOpen(true)}><Sparkles size={15} /><span>Ask AI</span></button>
          <button type="button" className="operations-langgraph" aria-label="Open LangGraph AI" aria-haspopup="dialog" aria-expanded={langgraphOpen} aria-controls={langgraphOpen ? "langgraph-agent-dialog" : undefined} onClick={() => setLanggraphOpen(true)}><Bot size={17} /><span>LangGraph AI</span></button>
        </div>
      </header>
      <div className="operations-titlebar">
        <div><h1>Production line</h1><p>Monitor the process. Inspect every machine.</p></div>
        <div className="operations-titlebar__status"><span className={isConnected ? "connection-state is-connected" : "connection-state"}><i />{isConnected ? "PLC connected" : "PLC offline"}</span><button className="focus-model" aria-pressed={modelFocused} onClick={() => setModelFocused(!modelFocused)}><PanelRight size={15} />{modelFocused ? "Show telemetry" : "Focus model"}</button><button onClick={() => setPredictiveOpen(true)}><Activity size={15} />Insights<ArrowUpRight size={14} /></button></div>
      </div>

      <IntegrationModal open={offeringsOpen} onClose={() => setOfferingsOpen(false)} title="Solution Offerings" layout="immersive" enableFullscreen>
        <OfferingNavigation.Provider value={(path) => {
          setOfferingsOpen(false);
          if (path === '/hardware-anomalies') setEagleOpen(true);
          else if (path === '/path-selection') setDpsOpen(true);
          else if (path === '/video-analytics') setVideoOpen(true);
          else if (path === '/cost-insights') setAnalyticsOpen(true);
        }}>
          <Suspense fallback={<IntegrationLoading />}><ServiceOfferingsPage /></Suspense>
        </OfferingNavigation.Provider>
      </IntegrationModal>
      <IntegrationModal open={eagleOpen} onClose={() => setEagleOpen(false)} title="EA:GLE" layout="immersive" enableFullscreen>
        <Suspense fallback={<IntegrationLoading />}><HardwareAnomaliesPage /></Suspense>
      </IntegrationModal>

      {/* Main Grid */}
      <div className="operations-grid">
        {/* Center Content */}
        <div className="operations-main">
          <KPIBar
            onOeeClick={() => setOeeOpen(true)}
            onAnalyticsClick={() => setAnalyticsOpen(true)}
            onPredictClick={() => setPredictiveOpen(true)}
            onOfferingsClick={() => setOfferingsOpen(true)}
            onEagleClick={() => setEagleOpen(true)}
            onDpsClick={() => setDpsOpen(true)}
            onRoutingClick={() => setAppRoutingOpen(true)}
            onItDevicesClick={() => setDevicesDomain("IT")}
            onOtDevicesClick={() => setDevicesDomain("OT")}
            onOnboardingClick={() => setOnboardingOpen(true)}
            onGatewayTwinClick={() => setGwTwinOpen(true)}
            onVideoClick={() => setVideoOpen(true)}
            predAlertCount={predAlertCount}
          />
          <section className="operations-twin" aria-label="Interactive factory digital twin">
            <Suspense fallback={<div className="twin-loading"><Box size={26} /><span>Preparing your factory view</span><small>Loading the production model…</small></div>}>
              <FactoryScene paused={scenePaused} inspectorHost={modelFocused ? null : inspectorHost} />
            </Suspense>
          </section>
        </div>

        {/* Right Sidebar */}
        <div className="operations-sidebar">
          <div ref={setInspectorHost} className="twin-inspector-slot" />
          <PLCParametersWidget className="operations-plc" />
          <div className="operations-actuators">
            <MotorFanWidget className="flex-1 min-h-0" />
            <EmergencyLightWidget className="flex-1 min-h-0" />
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {aiChatOpen && <AIAssistantModal open onClose={() => setAiChatOpen(false)} />}
        {/* External agentic-AI assistant. It sends only user-submitted prompts
            and remains separate from the governed Bedrock insight routes. */}
        <LanggraphAgentPanel open={langgraphOpen} onClose={() => setLanggraphOpen(false)} />
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
      {/* Gateway Digital Twin — hosted HTTP dashboard with the same live AWS
          telemetry as the standalone Twin, without a separate sign-in. */}
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
      {smartMeterOpen && (
        <IntegrationModal
          open
          onClose={() => setSmartMeterOpen(false)}
          title="Aituzero Smart Meter"
          layout="immersive"
          enableFullscreen
          fullscreenTargetRef={smartMeterFullscreenRef}
        >
          <div ref={smartMeterFullscreenRef} style={{ height: "calc(var(--fit-vh, 100vh) - 152px)", minHeight: 480, borderRadius: 12, overflow: "hidden" }}>
            <SmartMeterEmbed />
          </div>
        </IntegrationModal>
      )}
    </div>
  );
};

export default Dashboard;
