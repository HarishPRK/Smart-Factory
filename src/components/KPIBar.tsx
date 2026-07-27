import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Flame,
  Laptop,
  Route,
  ServerCog,
  Shuffle,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useFilters } from "../context/FilterContext";
import { getKpiForZone, kpis } from "../data/mockData";
import { useTweenedNumber } from "../hooks/useTweenedNumber";
import KpiCard, { type KpiCardStatusTone } from "./KpiCard";
import LorawanWidget from "./LorawanWidget";
import WorkspaceVisualization, {
  type WorkspaceVisualizationKind,
} from "./WorkspaceVisualizations";

function parseKpiValue(value: string) {
  const cleaned = value.replace(/,/g, "");
  const number = Number.parseFloat(cleaned);
  const decimalPoint = cleaned.indexOf(".");
  const decimals = decimalPoint >= 0 ? cleaned.length - decimalPoint - 1 : 0;

  return {
    decimals,
    group: value.includes(",") || number >= 1000,
    number,
    valid: Number.isFinite(number),
  };
}

const KpiCountUp = ({ value }: { value: string }) => {
  const { decimals, group, number, valid } = parseKpiValue(value);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const tweened = useTweenedNumber(valid && revealed ? number : 0, 800);

  if (!valid) return <>{value}</>;

  return (
    <>
      {tweened.toLocaleString("en-US", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
        useGrouping: group,
      })}
    </>
  );
};

const MiniSparkline = ({
  color,
  data,
}: {
  color: string;
  data: number[];
}) => {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 64;
  const height = 28;
  const inset = 2;

  const points = data.map((value, index) => ({
    x: inset + (index / (data.length - 1)) * (width - inset * 2),
    y: height - inset - ((value - min) / range) * (height - inset * 2),
  }));

  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const firstControl = previous.x + (current.x - previous.x) * 0.4;
    const secondControl = previous.x + (current.x - previous.x) * 0.6;
    path += ` C${firstControl},${previous.y} ${secondControl},${current.y} ${current.x},${current.y}`;
  }

  const lastPoint = points[points.length - 1];

  return (
    <svg className="kpi-card__sparkline" viewBox={`0 0 ${width} ${height}`}>
      <path className="kpi-card__sparkline-track" d={`M2 ${height - 3}H${width - 2}`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle cx={lastPoint.x} cy={lastPoint.y} fill={color} r="2.2" />
    </svg>
  );
};

function hexToRgbChannels(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

type RailGroup = "metrics" | "workspaces";

interface WorkspaceCardDescriptor {
  accent: string;
  accentRgb: string;
  ariaLabel: string;
  icon: LucideIcon;
  id: WorkspaceVisualizationKind;
  label: string;
  onClick?: () => void;
  status?: React.ReactNode;
  statusTone?: KpiCardStatusTone;
  visualization: WorkspaceVisualizationKind;
}

interface KPIBarProps {
  onOeeClick?: () => void;
  onAnalyticsClick?: () => void;
  onPredictClick?: () => void;
  onDpsClick?: () => void;
  onRoutingClick?: () => void;
  onItDevicesClick?: () => void;
  onOtDevicesClick?: () => void;
  onGatewayTwinClick?: () => void;
  onVideoClick?: () => void;
  predAlertCount?: number;
}

const KPIBar: React.FC<KPIBarProps> = ({
  onOeeClick,
  onAnalyticsClick,
  onPredictClick,
  onDpsClick,
  onRoutingClick,
  onItDevicesClick,
  onOtDevicesClick,
  onGatewayTwinClick,
  onVideoClick,
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
    setCanScrollLeft(element.scrollLeft > 4);
    setCanScrollRight(maxScroll > 4 && element.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
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
    onAnalyticsClick,
    onPredictClick,
    onDpsClick,
    onRoutingClick,
    onItDevicesClick,
    onOtDevicesClick,
    onGatewayTwinClick,
    onVideoClick,
  ].filter(Boolean).length + 1;

  const groups: Array<{ id: RailGroup; label: string; count: number }> = [
    { id: "metrics", label: "Plant KPIs", count: kpis.length },
    { id: "workspaces", label: "Workspaces", count: workspaceCount },
  ];

  const actionCards: WorkspaceCardDescriptor[] = [
    {
      accent: "#22d3ee",
      accentRgb: "34, 211, 238",
      ariaLabel: "Open analytics trends",
      icon: ChartNoAxesCombined,
      id: "analytics",
      label: "Analytics",
      onClick: onAnalyticsClick,
      visualization: "analytics",
    },
    {
      accent: "#c084fc",
      accentRgb: "192, 132, 252",
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
      visualization: "predict",
    },
    {
      accent: "#60a5fa",
      accentRgb: "96, 165, 250",
      ariaLabel: "Open dynamic path selection",
      icon: Shuffle,
      id: "dps",
      label: "DPS",
      onClick: onDpsClick,
      visualization: "dps",
    },
    {
      accent: "#a78bfa",
      accentRgb: "167, 139, 250",
      ariaLabel: "Open application traffic routing",
      icon: Route,
      id: "routing",
      label: "App routing",
      onClick: onRoutingClick,
      visualization: "routing",
    },
    {
      accent: "#5eead4",
      accentRgb: "94, 234, 212",
      ariaLabel: "Open IT device inventory",
      icon: Laptop,
      id: "it-devices",
      label: "IT devices",
      onClick: onItDevicesClick,
      visualization: "it-devices",
    },
    {
      accent: "#fb7185",
      accentRgb: "251, 113, 133",
      ariaLabel: "Open OT device inventory",
      icon: Flame,
      id: "ot-devices",
      label: "OT devices",
      onClick: onOtDevicesClick,
      visualization: "ot-devices",
    },
    {
      accent: "#67e8f9",
      accentRgb: "103, 232, 249",
      ariaLabel: "Open Gateway Twin in a new tab",
      icon: ServerCog,
      id: "gateway",
      label: "Gateway twin",
      onClick: onGatewayTwinClick,
      status: <span aria-hidden="true">↗</span>,
      statusTone: "neutral",
      visualization: "gateway",
    },
    {
      accent: "#7ab4ee",
      accentRgb: "122, 180, 238",
      ariaLabel: "Open video analytics streams",
      icon: Video,
      id: "video",
      label: "Video",
      onClick: onVideoClick,
      visualization: "video",
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
    kpis.map((kpi, index) => {
      const selected = state.selectedKpi === kpi.id;
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
          accent={kpi.sparkColor}
          accentRgb={hexToRgbChannels(kpi.sparkColor)}
          aria-haspopup={kpi.id === "oee" ? "dialog" : undefined}
          aria-label={actionLabel}
          delayIndex={index}
          icon={
            <img
              alt=""
              className="kpi-card__source-icon"
              src={kpi.icon}
            />
          }
          label={kpi.label}
          onClick={() => {
            if (kpi.id === "oee" && onOeeClick) {
              onOeeClick();
              return;
            }
            dispatch({ type: "SET_KPI", kpi: kpi.id });
          }}
          primary={<KpiCountUp value={zoneData.value} />}
          secondary={kpi.unit}
          selected={selected}
          status={
            selected ? (
              "Filtering"
            ) : (
              <>
                <span aria-hidden="true">
                  {zoneData.trendUp ? "↑" : "↓"}
                </span>
                {trendValue}
              </>
            )
          }
          statusTone={selected ? "neutral" : trendTone}
          variant="metric"
          visualization={
            <MiniSparkline data={zoneData.sparkData} color={kpi.sparkColor} />
          }
        />
      );
    });

  const renderWorkspaceCards = () => [
    ...actionCards.map((card, index) => {
      if (!card.onClick) return null;
      const Icon = card.icon;

      return (
        <KpiCard
          key={card.id}
          accent={card.accent}
          accentRgb={card.accentRgb}
          aria-haspopup={card.id === "gateway" ? undefined : "dialog"}
          aria-label={card.ariaLabel}
          delayIndex={index}
          icon={<Icon size={17} strokeWidth={1.8} />}
          label={card.label}
          onClick={card.onClick}
          status={card.status}
          statusTone={card.statusTone}
          variant="module"
          visualization={<WorkspaceVisualization kind={card.visualization} />}
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
    <section className="kpi-deck" aria-label="Factory metrics and tools">
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
              <span aria-hidden="true" className="kpi-deck__tab-count">
                {group.count}
              </span>
            </button>
          ))}
        </div>

        <span aria-live="polite" className="kpi-deck__position">
          {activeGroupMeta.count} items
        </span>
      </div>

      {groups.map((group) => {
        const active = activeGroup === group.id;

        return (
          <div
            key={group.id}
            aria-labelledby={`kpi-tab-${group.id}`}
            className="kpi-deck__panel"
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
                  className="kpi-rail__viewport"
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
                  style={{
                    maskImage: `linear-gradient(90deg, ${
                      canScrollLeft ? "transparent 0, #000 42px" : "#000 0"
                    }, ${
                      canScrollRight
                        ? "#000 calc(100% - 48px), transparent 100%"
                        : "#000 100%"
                    })`,
                    msOverflowStyle: "none",
                    scrollbarWidth: "none",
                    WebkitMaskImage: `linear-gradient(90deg, ${
                      canScrollLeft ? "transparent 0, #000 42px" : "#000 0"
                    }, ${
                      canScrollRight
                        ? "#000 calc(100% - 48px), transparent 100%"
                        : "#000 100%"
                    })`,
                  }}
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
