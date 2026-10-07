import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Droplets,
  Factory,
  Gauge,
  Volume2,
  Zap,
  CloudCog,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Flame,
  Laptop,
  PackagePlus,
  Route,
  ServerCog,
  Shuffle,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useFilters } from "../context/FilterContext";
import { getKpiForZone, kpis } from "../data/mockData";
import KpiCard, { type KpiCardStatusTone } from "./KpiCard";
import KpiSparkline from "./KpiSparkline";
import WorkspacePreview from "./WorkspacePreview";
import LorawanWidget from "./LorawanWidget";
import ZoneTabs from "./ZoneTabs";

function hexToRgbChannels(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

const metricStyles: Record<string, { color: string; icon: LucideIcon }> = {
  energy: { color: "#43d8f1", icon: Zap },
  noise: { color: "#8acde8", icon: Volume2 },
  emission: { color: "#6ed6a2", icon: Factory },
  water: { color: "#5fbaf3", icon: Droplets },
  oee: { color: "#76decf", icon: Gauge },
};

type RailGroup = "metrics" | "workspaces";

interface WorkspaceCardDescriptor {
  accent: string;
  accentRgb: string;
  ariaLabel: string;
  icon: LucideIcon;
  id: string;
  label: string;
  onClick?: () => void;
  status?: React.ReactNode;
  statusTone?: KpiCardStatusTone;
  description: string;
}

interface KPIBarProps {
  onOfferingsClick?: () => void;
  onEagleClick?: () => void;
  onOeeClick?: () => void;
  onAnalyticsClick?: () => void;
  onPredictClick?: () => void;
  onDpsClick?: () => void;
  onRoutingClick?: () => void;
  onItDevicesClick?: () => void;
  onOtDevicesClick?: () => void;
  onOnboardingClick?: () => void;
  onGatewayTwinClick?: () => void;
  onVideoClick?: () => void;
  onLanggraphClick?: () => void;
  predAlertCount?: number;
}

const KPIBar: React.FC<KPIBarProps> = ({
  onOfferingsClick,
  onEagleClick,
  onOeeClick,
  onAnalyticsClick,
  onPredictClick,
  onDpsClick,
  onRoutingClick,
  onItDevicesClick,
  onOtDevicesClick,
  onOnboardingClick,
  onGatewayTwinClick,
  onVideoClick,
  onLanggraphClick,
  predAlertCount = 0,
}) => {
  const { state, dispatch } = useFilters();
  const [activeGroup, setActiveGroup] = useState<RailGroup>("metrics");
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const maxScroll = element.scrollWidth - element.clientWidth;
    // Measure the unobstructed panel too, so arrows cannot keep themselves
    // visible when cards would fit without their reserved width.
    const panelWidth = element.parentElement?.clientWidth ?? element.clientWidth;
    const needsScroll = element.scrollWidth - panelWidth > 4;
    setCanScrollLeft(needsScroll && element.scrollLeft > 4);
    setCanScrollRight(needsScroll && maxScroll > 4 && element.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [activeGroup, updateScrollState]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      updateScrollState();
    });
    return () => cancelAnimationFrame(frame);
  }, [activeGroup, updateScrollState]);

  const scrollByAmount = (direction: 1 | -1) => {
    const element = scrollRef.current;
    if (!element) return;

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const step = Math.max(240, Math.round(element.clientWidth * 0.72));
    element.scrollBy({
      behavior: reduceMotion ? "auto" : "smooth",
      left: direction * step,
    });
  };

  const workspaceCount = [
    onOfferingsClick,
    onEagleClick,
    onAnalyticsClick,
    onPredictClick,
    onDpsClick,
    onRoutingClick,
    onItDevicesClick,
    onOtDevicesClick,
    onOnboardingClick,
    onGatewayTwinClick,
    onVideoClick,
    onLanggraphClick,
  ].filter(Boolean).length + 1;

  const groups: Array<{ id: RailGroup; label: string; count: number }> = [
    { id: "metrics", label: "Plant KPIs", count: kpis.length },
    { id: "workspaces", label: "Workspaces", count: workspaceCount },
  ];

  const actionCards: WorkspaceCardDescriptor[] = [
    {
      accent: '#67e8f9', accentRgb: '103, 232, 249',
      ariaLabel: 'Open Solution Offerings', icon: CloudCog, id: 'offerings',
      label: 'Solution Offerings', onClick: onOfferingsClick, description: 'Connected solutions',
    },
    {
      accent: '#7dd9ed', accentRgb: '125, 217, 237',
      ariaLabel: 'Open EA:GLE', icon: Activity, id: 'eagle',
      label: 'EA:GLE', onClick: onEagleClick, description: 'Operational intelligence',
    },
    {
      accent: "#22d3ee",
      accentRgb: "34, 211, 238",
      ariaLabel: "Open analytics trends",
      icon: ChartNoAxesCombined,
      id: "analytics",
      label: "Analytics",
      onClick: onAnalyticsClick,
      description: "Trends & sensor history",
    },
    {
      accent: "#7dd9ed",
      accentRgb: "125, 217, 237",
      ariaLabel:
        predAlertCount > 0
          ? `Open predictive risks, ${predAlertCount} alert${predAlertCount === 1 ? "" : "s"}`
          : "Open predictive risks",
      icon: BrainCircuit,
      id: "predict",
      label: "Predict",
      onClick: onPredictClick,
      status:
        predAlertCount > 0
          ? `${predAlertCount > 99 ? "99+" : predAlertCount} alert${predAlertCount === 1 ? "" : "s"}`
          : undefined,
      statusTone: "warning",
      description: "Predictive maintenance",
    },
    {
      accent: "#60a5fa",
      accentRgb: "96, 165, 250",
      ariaLabel: "Open dynamic path selection",
      icon: Shuffle,
      id: "dps",
      label: "DPS",
      onClick: onDpsClick,
      description: "Dynamic path selection",
    },
    {
      accent: "#80cae8",
      accentRgb: "128, 202, 232",
      ariaLabel: "Open application traffic routing",
      icon: Route,
      id: "routing",
      label: "App routing",
      onClick: onRoutingClick,
      description: "Application traffic",
    },
    {
      accent: "#5eead4",
      accentRgb: "94, 234, 212",
      ariaLabel: "Open IT device inventory",
      icon: Laptop,
      id: "it-devices",
      label: "IT devices",
      onClick: onItDevicesClick,
      description: "IT device inventory",
    },
    {
      accent: "#fb7185",
      accentRgb: "251, 113, 133",
      ariaLabel: "Open OT device inventory",
      icon: Flame,
      id: "ot-devices",
      label: "OT devices",
      onClick: onOtDevicesClick,
      description: "OT device inventory",
    },
    {
      accent: "#fbbf24",
      accentRgb: "251, 191, 36",
      ariaLabel: "Open gateway onboarding",
      icon: PackagePlus,
      id: "onboarding",
      label: "Onboarding",
      onClick: onOnboardingClick,
      description: "Connect a gateway",
    },
    {
      accent: "#67e8f9",
      accentRgb: "103, 232, 249",
      ariaLabel: "Open Gateway Twin",
      icon: ServerCog,
      id: "gateway",
      label: "Gateway twin",
      onClick: onGatewayTwinClick,
      statusTone: "neutral",
      description: "Gateway observability",
    },
    {
      accent: "#76decf",
      accentRgb: "118, 222, 207",
      ariaLabel: "Open LangGraph AI",
      icon: BrainCircuit,
      id: "langgraph",
      label: "LangGraph AI",
      onClick: onLanggraphClick,
      description: "Chat with the factory agent.",
    },
    {
      accent: "#7ab4ee",
      accentRgb: "122, 180, 238",
      ariaLabel: "Open video analytics streams",
      icon: Video,
      id: "video",
      label: "Video",
      onClick: onVideoClick,
      description: "Camera intelligence",
    },
  ];

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % groups.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + groups.length) % groups.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = groups.length - 1;

    if (nextIndex === null) return;

    event.preventDefault();
    setActiveGroup(groups[nextIndex].id);
    requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus());
  };

  const renderMetricCards = () =>
    kpis.map((kpi) => {
      const selected = state.selectedKpi === kpi.id;
      const metricStyle = metricStyles[kpi.id] ?? metricStyles.energy;
      const MetricIcon = metricStyle.icon;
      const zoneData = getKpiForZone(kpi, state.selectedZone);
      const trendTone: KpiCardStatusTone = kpi.trendColor.includes("red")
        ? "critical"
        : "positive";
      const trendValue = zoneData.trend.replace(/^[+-]/, "");
      const actionLabel =
        kpi.id === "oee"
          ? `Open OEE details. ${zoneData.value} ${kpi.unit}`
          : `${selected ? "Clear" : "Apply"} ${kpi.label} dashboard filter. ${zoneData.value} ${kpi.unit}`;

      return (
        <KpiCard
          key={kpi.id}
          accent={metricStyle.color}
          accentRgb={hexToRgbChannels(metricStyle.color)}
          aria-haspopup={kpi.id === "oee" ? "dialog" : undefined}
          aria-label={actionLabel}
          aria-description={kpi.id === "oee"
            ? `Sample data. Overall equipment effectiveness, ${zoneData.value} percent on a 0 to 100 percent scale.`
            : `Sample data. ${zoneData.trendUp ? "Increase" : "Decrease"} of ${trendValue}.`}
          icon={<MetricIcon size={17} strokeWidth={1.8} />}
          label={kpi.label}
          onClick={() => {
            if (kpi.id === "oee" && onOeeClick) {
              onOeeClick();
              return;
            }
            dispatch({ type: "SET_KPI", kpi: kpi.id });
          }}
          primary={zoneData.value}
          secondary={kpi.unit}
          selected={selected}
          visual={<KpiSparkline data={zoneData.sparkData} />}
          status={
            selected ? (
              "Filtering"
            ) : (
              <>
                {zoneData.trendUp ? <ArrowUp aria-hidden="true" size={11} /> : <ArrowDown aria-hidden="true" size={11} />}
                {trendValue}
              </>
            )
          }
          statusTone={selected ? "neutral" : trendTone}
          variant="metric"
        />
      );
    });

  const renderWorkspaceCards = () => [
    ...actionCards.map((card) => {
      if (!card.onClick) return null;
      const Icon = card.icon;

      return (
        <KpiCard
          key={card.id}
          accent={card.accent}
          accentRgb={card.accentRgb}
          aria-haspopup={card.id === "gateway" ? undefined : "dialog"}
          aria-label={card.ariaLabel}
          icon={<Icon size={17} strokeWidth={1.8} />}
          label={card.label}
          onClick={card.onClick}
          status={card.status}
          statusTone={card.statusTone}
          title={card.description}
          visual={<WorkspacePreview kind={card.id} />}
          variant="module"
        />
      );
    }),
    <LorawanWidget key="lorawan" />,
  ];

  const renderActiveCards = () => {
    if (activeGroup === "metrics") return renderMetricCards();
    return renderWorkspaceCards();
  };

  const activeGroupMeta =
    groups.find((group) => group.id === activeGroup) ?? groups[0];
  const activeGroupLabel = activeGroupMeta.label;

  return (
    <section className="kpi-deck kpi-deck--instruments" aria-label="Factory metrics and tools">
      <div className="kpi-deck__toolbar">
        <div
          aria-label="KPI rail category"
          className="kpi-deck__tabs"
          role="tablist"
        >
          {groups.map((group, index) => (
            <button
              key={group.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              aria-controls={`kpi-panel-${group.id}`}
              aria-selected={activeGroup === group.id}
              className="kpi-deck__tab"
              id={`kpi-tab-${group.id}`}
              onClick={() => setActiveGroup(group.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={activeGroup === group.id ? 0 : -1}
              type="button"
            >
              <span>{group.label}</span>
              {group.id === "metrics" && <span className="kpi-data-source">Sample data</span>}
              <span aria-hidden="true" className="kpi-deck__tab-count">
                {group.count}
              </span>
            </button>
          ))}
        </div>

        <div className="operations-zones"><ZoneTabs /></div>
      </div>

      {groups.map((group) => {
        const active = activeGroup === group.id;

        return (
          <div
            key={group.id}
            aria-labelledby={`kpi-tab-${group.id}`}
            className={`kpi-deck__panel${canScrollLeft || canScrollRight ? " is-scrollable" : ""}`}
            hidden={!active}
            id={`kpi-panel-${group.id}`}
            role="tabpanel"
          >
            {active ? (
              <>
                <button
                  aria-controls="kpi-rail-scroll"
                  aria-label={`Scroll ${activeGroupLabel} left`}
                  className="kpi-rail__control"
                  disabled={!canScrollLeft}
                  onClick={() => scrollByAmount(-1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={17} strokeWidth={1.8} />
                </button>

                <div
                  ref={scrollRef}
                  aria-label={`${activeGroupLabel} cards`}
                  className={`kpi-rail__viewport kpi-rail__viewport--${activeGroup}`}
                  id="kpi-rail-scroll"
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      scrollByAmount(-1);
                    }
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      scrollByAmount(1);
                    }
                  }}
                  role="region"
                  tabIndex={0}
                >
                  {renderActiveCards()}
                </div>

                <button
                  aria-controls="kpi-rail-scroll"
                  aria-label={`Scroll ${activeGroupLabel} right`}
                  className="kpi-rail__control"
                  disabled={!canScrollRight}
                  onClick={() => scrollByAmount(1)}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" size={17} strokeWidth={1.8} />
                </button>
              </>
            ) : null}
          </div>
        );
      })}
    </section>
  );
};

export default KPIBar;
