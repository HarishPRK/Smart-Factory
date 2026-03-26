import type {
  Zone,
  ZoneId,
  Machine,
  Alert,
  KpiData,
  OverviewChip,
  FilterState,
  MachineType,
  KpiZoneValue,
  PLCParameter,
} from "../types";
import energyIcon from "../assets/icons/energy_bolt.svg";
import noiseIcon from "../assets/icons/noise_ear.svg";
import emissionIcon from "../assets/icons/emission_cloud.svg";
import waterIcon from "../assets/icons/water_drop.svg";

// --- Zones ---

export const zones: Zone[] = [
  { id: 1, name: "Zone 1" },
  { id: 2, name: "Zone 2" },
  { id: 3, name: "Zone 3" },
];

// --- Machines ---

export const machines: Machine[] = [
  {
    id: "m1",
    name: "Injection Molding",
    type: "Injection Molding",
    zoneId: 1,
    value: "250",
    unit: "kW",
    status: "high",
    statusLabel: "Critical",
    statusTone: "text-red-300 bg-red-500/[0.08] border border-red-500/[0.14]",
    temp: "92°C",
    color: "bg-red-500",
    glow: "shadow-[0_0_6px_rgba(239,68,68,0.5)]",
    barColor: "bg-gradient-to-r from-red-500 to-red-400",
    barWidth: "100%",
    iconBg: "bg-gradient-to-br from-red-500/[0.10] to-red-600/[0.04]",
    iconBorder: "border-red-500/[0.14]",
    dotColor: "bg-red-500",
    dotGlow: "shadow-[0_0_6px_rgba(239,68,68,0.5)]",
  },
  {
    id: "m2",
    name: "Hydraulic Press",
    type: "Hydraulic Press",
    zoneId: 2,
    value: "250",
    unit: "kW",
    status: "high",
    statusLabel: "Critical",
    statusTone: "text-red-300 bg-red-500/[0.08] border border-red-500/[0.14]",
    temp: "88°C",
    color: "bg-red-500",
    glow: "shadow-[0_0_6px_rgba(239,68,68,0.5)]",
    barColor: "bg-gradient-to-r from-red-500 to-red-400",
    barWidth: "100%",
    iconBg: "bg-gradient-to-br from-red-500/[0.10] to-red-600/[0.04]",
    iconBorder: "border-red-500/[0.14]",
    dotColor: "bg-red-500",
    dotGlow: "shadow-[0_0_6px_rgba(239,68,68,0.5)]",
  },
  {
    id: "m3",
    name: "Industrial Boiler",
    type: "Industrial Boiler",
    zoneId: 3,
    value: "100",
    unit: "kW",
    status: "medium",
    statusLabel: "Warning",
    statusTone:
      "text-amber-300 bg-amber-500/[0.08] border border-amber-500/[0.14]",
    temp: "74°C",
    color: "bg-amber-500",
    glow: "shadow-[0_0_6px_rgba(245,158,11,0.5)]",
    barColor: "bg-gradient-to-r from-amber-500 to-amber-400",
    barWidth: "40%",
    iconBg: "bg-gradient-to-br from-amber-500/[0.10] to-amber-600/[0.04]",
    iconBorder: "border-amber-500/[0.14]",
    dotColor: "bg-amber-500",
    dotGlow: "shadow-[0_0_6px_rgba(245,158,11,0.5)]",
  },
  {
    id: "m4",
    name: "Conveyor Belt",
    type: "Conveyor Belt",
    zoneId: 1,
    value: "30",
    unit: "kW",
    status: "low",
    statusLabel: "Normal",
    statusTone:
      "text-emerald-300 bg-emerald-500/[0.08] border border-emerald-500/[0.14]",
    temp: "45°C",
    color: "bg-emerald-500",
    glow: "shadow-[0_0_6px_rgba(16,185,129,0.5)]",
    barColor: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    barWidth: "12%",
    iconBg: "bg-gradient-to-br from-emerald-500/[0.10] to-emerald-600/[0.04]",
    iconBorder: "border-emerald-500/[0.14]",
    dotColor: "bg-emerald-500",
    dotGlow: "shadow-[0_0_6px_rgba(16,185,129,0.5)]",
  },
  {
    id: "m5",
    name: "CNC Lathe",
    type: "CNC Lathe",
    zoneId: 2,
    value: "30",
    unit: "kW",
    status: "low",
    statusLabel: "Normal",
    statusTone:
      "text-emerald-300 bg-emerald-500/[0.08] border border-emerald-500/[0.14]",
    temp: "42°C",
    color: "bg-emerald-500",
    glow: "shadow-[0_0_6px_rgba(16,185,129,0.5)]",
    barColor: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    barWidth: "12%",
    iconBg: "bg-gradient-to-br from-emerald-500/[0.10] to-emerald-600/[0.04]",
    iconBorder: "border-emerald-500/[0.14]",
    dotColor: "bg-emerald-500",
    dotGlow: "shadow-[0_0_6px_rgba(16,185,129,0.5)]",
  },
  {
    id: "m6",
    name: "Cooling Tower",
    type: "Cooling Tower",
    zoneId: 3,
    value: "45",
    unit: "kW",
    status: "low",
    statusLabel: "Normal",
    statusTone:
      "text-emerald-300 bg-emerald-500/[0.08] border border-emerald-500/[0.14]",
    temp: "38°C",
    color: "bg-emerald-500",
    glow: "shadow-[0_0_6px_rgba(16,185,129,0.5)]",
    barColor: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    barWidth: "18%",
    iconBg: "bg-gradient-to-br from-emerald-500/[0.10] to-emerald-600/[0.04]",
    iconBorder: "border-emerald-500/[0.14]",
    dotColor: "bg-emerald-500",
    dotGlow: "shadow-[0_0_6px_rgba(16,185,129,0.5)]",
  },
];

// --- Alerts ---

export const alerts: Alert[] = [
  {
    id: "a1",
    machineName: "Injection Holding Machine",
    machineType: "Injection Molding",
    issue: "Temperature critical",
    time: "12m ago",
    severity: "critical",
    zoneId: 1,
  },
  {
    id: "a2",
    machineName: "Hydraulic Press Unit",
    machineType: "Hydraulic Press",
    issue: "Pressure anomaly detected",
    time: "8m ago",
    severity: "critical",
    zoneId: 2,
  },
  {
    id: "a3",
    machineName: "Industrial Boiler",
    machineType: "Industrial Boiler",
    issue: "Steam pressure elevated",
    time: "25m ago",
    severity: "warning",
    zoneId: 3,
  },
  {
    id: "a4",
    machineName: "Conveyor Belt",
    machineType: "Conveyor Belt",
    issue: "Belt tension variance",
    time: "1h ago",
    severity: "info",
    zoneId: 1,
  },
  {
    id: "a5",
    machineName: "CNC Lathe",
    machineType: "CNC Lathe",
    issue: "Spindle vibration detected",
    time: "45m ago",
    severity: "warning",
    zoneId: 2,
  },
];

// --- KPIs ---

export const kpis: KpiData[] = [
  {
    id: "energy",
    label: "Energy",
    value: "2,041",
    unit: "kW",
    icon: energyIcon,
    trend: "+3.2%",
    trendUp: true,
    accent: "from-blue-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-blue-500/[0.12] to-blue-600/[0.06]",
    iconBorder: "border-blue-400/[0.14]",
    iconGlow: "shadow-[0_0_14px_rgba(59,130,246,0.12)]",
    hoverBorder: "hover:border-blue-500/20",
    trendColor: "text-emerald-400",
    sparkColor: "#3b82f6",
    sparkData: [40, 55, 35, 60, 45, 70, 65, 80, 75, 90],
    zoneValues: {
      1: { value: "680", trend: "+2.1%", trendUp: true, sparkData: [35, 50, 30, 55, 40, 65, 60, 72, 68, 80] },
      2: { value: "720", trend: "+4.5%", trendUp: true, sparkData: [42, 58, 38, 63, 48, 73, 68, 85, 78, 95] },
      3: { value: "641", trend: "+2.8%", trendUp: true, sparkData: [38, 52, 32, 57, 42, 67, 62, 78, 72, 88] },
    },
  },
  {
    id: "noise",
    label: "Noise",
    value: "700",
    unit: "dB",
    icon: noiseIcon,
    trend: "-1.8%",
    trendUp: false,
    accent: "from-indigo-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-indigo-500/[0.12] to-indigo-600/[0.06]",
    iconBorder: "border-indigo-400/[0.14]",
    iconGlow: "shadow-[0_0_14px_rgba(99,102,241,0.12)]",
    hoverBorder: "hover:border-indigo-500/20",
    trendColor: "text-emerald-400",
    sparkColor: "#6366f1",
    sparkData: [70, 65, 72, 60, 55, 50, 58, 45, 48, 42],
    zoneValues: {
      1: { value: "245", trend: "-2.3%", trendUp: false, sparkData: [68, 62, 70, 58, 52, 48, 55, 42, 45, 40] },
      2: { value: "280", trend: "-0.9%", trendUp: false, sparkData: [72, 68, 74, 62, 58, 53, 60, 48, 50, 44] },
      3: { value: "175", trend: "-2.5%", trendUp: false, sparkData: [65, 60, 68, 55, 50, 45, 52, 40, 43, 38] },
    },
  },
  {
    id: "emission",
    label: "Emission",
    value: "420",
    unit: "PPM",
    icon: emissionIcon,
    trend: "+5.1%",
    trendUp: true,
    accent: "from-cyan-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-cyan-500/[0.12] to-cyan-600/[0.06]",
    iconBorder: "border-cyan-400/[0.14]",
    iconGlow: "shadow-[0_0_14px_rgba(6,182,212,0.12)]",
    hoverBorder: "hover:border-cyan-500/20",
    trendColor: "text-red-400",
    sparkColor: "#06b6d4",
    sparkData: [30, 35, 28, 40, 45, 50, 42, 55, 60, 58],
    zoneValues: {
      1: { value: "155", trend: "+4.2%", trendUp: true, sparkData: [28, 32, 25, 38, 42, 47, 40, 52, 56, 54] },
      2: { value: "148", trend: "+6.3%", trendUp: true, sparkData: [32, 38, 30, 43, 48, 54, 45, 58, 64, 62] },
      3: { value: "117", trend: "+4.8%", trendUp: true, sparkData: [25, 30, 22, 35, 40, 45, 38, 50, 55, 52] },
    },
  },
  {
    id: "water",
    label: "Water",
    value: "128.1",
    unit: "m³",
    icon: waterIcon,
    trend: "-2.4%",
    trendUp: false,
    accent: "from-sky-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-sky-500/[0.12] to-sky-600/[0.06]",
    iconBorder: "border-sky-400/[0.14]",
    iconGlow: "shadow-[0_0_14px_rgba(14,165,233,0.12)]",
    hoverBorder: "hover:border-sky-500/20",
    trendColor: "text-emerald-400",
    sparkColor: "#0ea5e9",
    sparkData: [60, 55, 65, 50, 45, 48, 40, 38, 42, 35],
    zoneValues: {
      1: { value: "48.2", trend: "-3.1%", trendUp: false, sparkData: [58, 52, 62, 48, 42, 45, 38, 35, 40, 32] },
      2: { value: "42.5", trend: "-1.5%", trendUp: false, sparkData: [62, 58, 68, 52, 48, 50, 42, 40, 44, 38] },
      3: { value: "37.4", trend: "-2.8%", trendUp: false, sparkData: [55, 50, 60, 45, 40, 44, 36, 34, 38, 30] },
    },
  },
];

// --- PLC Parameters (Input Devices) ---

export const plcParameters: PLCParameter[] = [
  {
    id: "voltage",
    label: "Voltage",
    kind: "analog",
    value: 5.0,
    unit: "V",
    min: 0,
    max: 12,
    nominal: 5.0,
    decimals: 1,
    accentHex: "#f59e0b",
    status: "normal",
  },
  {
    id: "current",
    label: "Current",
    kind: "analog",
    value: 6.0,
    unit: "A",
    min: 0,
    max: 10,
    nominal: 6.0,
    decimals: 1,
    accentHex: "#06b6d4",
    status: "normal",
  },
  {
    id: "relay",
    label: "Relay",
    kind: "relay",
    active: true,
    accentHex: "#10b981",
    status: "normal",
  },
  {
    id: "ph",
    label: "pH",
    kind: "analog",
    value: 7.0,
    unit: "",
    min: 0,
    max: 14,
    nominal: 7.0,
    decimals: 1,
    accentHex: "#8b5cf6",
    status: "normal",
  },
  {
    id: "photoE",
    label: "Photo-E",
    kind: "digital",
    active: false,
    accentHex: "#10b981",
    status: "normal",
  },
  {
    id: "metal",
    label: "Metal Det.",
    kind: "digital",
    active: false,
    accentHex: "#f97316",
    status: "normal",
  },
];

// --- Consumption data per zone ---

export type ConsumptionData = {
  energy: { value: number; max: number; change: string; changePositive: boolean };
  water: { value: number; max: number; change: string; changePositive: boolean };
};

export const consumptionByZone: Record<ZoneId | "all", ConsumptionData> = {
  all: {
    energy: { value: 200, max: 350, change: "12% less", changePositive: true },
    water: { value: 128.1, max: 200, change: "5% more", changePositive: false },
  },
  1: {
    energy: { value: 72, max: 150, change: "8% less", changePositive: true },
    water: { value: 48.2, max: 80, change: "3% more", changePositive: false },
  },
  2: {
    energy: { value: 68, max: 150, change: "15% less", changePositive: true },
    water: { value: 42.5, max: 80, change: "2% less", changePositive: true },
  },
  3: {
    energy: { value: 60, max: 150, change: "10% less", changePositive: true },
    water: { value: 37.4, max: 80, change: "7% more", changePositive: false },
  },
};

// --- Carousel Machines (bottom-right card) ---

export type CarouselMachineBase = {
  id: string;
  name: string;
  type: "simple" | "plc";
};

export type SimpleCarouselMachine = CarouselMachineBase & {
  type: "simple";
  status: string;
  idleTime: string;
};

export type PLCInput = { label: string; value: string; unit: string; min: number; max: number; nominal: number };
export type PLCOutput = { label: string; active: boolean };

export type PLCCarouselMachine = CarouselMachineBase & {
  type: "plc";
  status: string;
  inputs: PLCInput[];
  outputs: PLCOutput[];
};

export type CarouselMachine = SimpleCarouselMachine | PLCCarouselMachine;

export const carouselMachines: CarouselMachine[] = [
  {
    id: "cm2",
    name: "PLC",
    type: "plc",
    status: "RUNNING",
    inputs: [
      { label: "Pressure", value: "4.2", unit: "bar", min: 1.0, max: 8.0, nominal: 4.2 },
      { label: "pH", value: "7.1", unit: "", min: 5.0, max: 9.0, nominal: 7.1 },
      { label: "Flow", value: "12.8", unit: "L/m", min: 5.0, max: 20.0, nominal: 12.8 },
      { label: "O2", value: "21.3", unit: "%", min: 16.0, max: 25.0, nominal: 21.0 },
    ],
    outputs: [
      { label: "Motor", active: true },
      { label: "Fan", active: true },
    ],
  },
];

// --- Machine type list for filter dropdown ---

export const machineTypes: MachineType[] = [
  "Injection Molding",
  "Hydraulic Press",
  "Industrial Boiler",
  "Conveyor Belt",
  "CNC Lathe",
  "Cooling Tower",
];

// --- Filter helper functions ---

const statusToSeverity: Record<string, string> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

export function getFilteredMachines(state: FilterState): Machine[] {
  return machines.filter((m) => {
    if (state.selectedZone !== "all" && m.zoneId !== state.selectedZone) return false;
    if (state.severity !== "all" && statusToSeverity[m.status] !== state.severity) return false;
    if (state.machineType !== "all" && m.type !== state.machineType) return false;
    return true;
  });
}

export function getFilteredAlerts(state: FilterState): Alert[] {
  return alerts.filter((a) => {
    if (state.selectedZone !== "all" && a.zoneId !== state.selectedZone) return false;
    if (state.severity !== "all" && a.severity !== state.severity) return false;
    if (state.machineType !== "all" && a.machineType !== state.machineType) return false;
    return true;
  });
}

export function computeOverviewChips(filteredMachines: Machine[]): OverviewChip[] {
  const critical = filteredMachines.filter((m) => m.status === "high").length;
  const warnings = filteredMachines.filter((m) => m.status === "medium").length;
  const online = filteredMachines.length;

  return [
    {
      label: "Critical",
      value: String(critical),
      tone: "text-red-300 bg-red-500/[0.08] border border-red-500/[0.12] shadow-[0_0_14px_rgba(239,68,68,0.08)]",
    },
    {
      label: "Warnings",
      value: String(warnings),
      tone: "text-amber-300 bg-amber-500/[0.08] border border-amber-500/[0.12] shadow-[0_0_14px_rgba(245,158,11,0.08)]",
    },
    {
      label: "Online",
      value: String(online),
      tone: "text-emerald-300 bg-emerald-500/[0.08] border border-emerald-500/[0.12] shadow-[0_0_14px_rgba(16,185,129,0.08)]",
    },
  ];
}

export function getKpiForZone(
  kpi: KpiData,
  zoneId: ZoneId | "all"
): KpiZoneValue {
  if (zoneId === "all") {
    return {
      value: kpi.value,
      trend: kpi.trend,
      trendUp: kpi.trendUp,
      sparkData: kpi.sparkData,
    };
  }
  return kpi.zoneValues[zoneId];
}

