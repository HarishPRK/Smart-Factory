export type PredictionHorizon = "5min" | "15min" | "30min";

export interface ForecastPoint {
  value: number;
  confidenceLow: number;
  confidenceHigh: number;
}

export interface ThresholdCrossing {
  willCross: boolean;
  threshold: number;
  minutesUntil: number | null;
  direction: "above" | "below";
}

export interface ParameterPrediction {
  parameterId: string;
  label: string;
  unit: string;
  currentValue: number;
  min: number;
  max: number;
  predictions: Record<PredictionHorizon, ForecastPoint>;
  trendDirection: "rising" | "falling" | "stable";
  rateOfChange: number;
  rateOfChangeUnit: string;
  thresholdCrossing: ThresholdCrossing | null;
  confidence: number;
}

export interface RULEstimate {
  parameterId: string;
  label: string;
  failureThreshold: number;
  currentDegradation: number;
  estimatedMinutesRemaining: number | null;
  confidence: number;
  trend: "degrading" | "stable" | "improving";
}

export interface HealthScore {
  overall: number;
  components: Record<string, number>;
  lastUpdated: number;
}

export interface OEEForecast {
  predictedEndOfShiftOEE: number;
  predictedTotalCycles: number;
  predictedQuality: number;
  availabilityForecast: number;
  confidenceLevel: number;
}

export type AnomalyType = "ema_deviation" | "rate_of_change" | "threshold_crossing";

export interface AnomalyAlert {
  id: string;
  parameterId: string;
  label: string;
  type: AnomalyType;
  severity: "critical" | "warning" | "info";
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  confidence: number;
}

export interface AIAnalysisResult {
  healthScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  summary: string;
  recommendations: string[];
  patterns: string[];
  timestamp: number;
}
