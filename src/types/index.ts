export type ZoneId = 1 | 2 | 3;

export type Zone = {
  id: ZoneId;
  name: string;
};

export type MachineStatus = "high" | "medium" | "low";
export type StatusLabel = "Critical" | "Warning" | "Normal";

export type MachineType =
  | "Injection Molding"
  | "Hydraulic Press"
  | "Industrial Boiler"
  | "Conveyor Belt"
  | "CNC Lathe"
  | "Cooling Tower";

export type Machine = {
  id: string;
  name: string;
  type: MachineType;
  zoneId: ZoneId;
  value: string;
  unit: string;
  status: MachineStatus;
  statusLabel: StatusLabel;
  temp: string;
  barWidth: string;
  statusTone: string;
  color: string;
  glow: string;
  barColor: string;
  iconBg: string;
  iconBorder: string;
  dotColor: string;
  dotGlow: string;
};

export type Severity = "critical" | "warning" | "info";

export type Alert = {
  id: string;
  machineName: string;
  machineType: MachineType;
  issue: string;
  time: string;
  severity: Severity;
  zoneId: ZoneId;
};

export type KpiId = "energy" | "noise" | "emission" | "water";

export type KpiZoneValue = {
  value: string;
  trend: string;
  trendUp: boolean;
  sparkData: number[];
};

export type KpiData = {
  id: KpiId;
  label: string;
  value: string;
  unit: string;
  icon: string;
  trend: string;
  trendUp: boolean;
  sparkData: number[];
  zoneValues: Record<ZoneId, KpiZoneValue>;
  accent: string;
  iconBg: string;
  iconBorder: string;
  iconGlow: string;
  hoverBorder: string;
  trendColor: string;
  sparkColor: string;
};

export type TimeRange = "1h" | "6h" | "24h" | "7d";

export type FilterState = {
  selectedZone: ZoneId | "all";
  timeRange: TimeRange;
  severity: Severity | "all";
  machineType: MachineType | "all";
  selectedKpi: KpiId | null;
};


export type OverviewChip = {
  label: string;
  value: string;
  tone: string;
};

export type PLCParameterKind = "analog" | "digital" | "relay";

export type PLCParameter = {
  id: string;
  label: string;
  kind: PLCParameterKind;
  // Analog fields
  value?: number;
  unit?: string;
  min?: number;
  max?: number;
  nominal?: number;
  decimals?: number;
  // Digital fields
  active?: boolean;
  // Visual styling
  accentHex: string;
  status: "normal" | "warning" | "critical";
  // Whether this is a placeholder
  placeholder?: boolean;
};
