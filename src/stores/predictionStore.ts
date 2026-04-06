import { create } from "zustand";
import type { ParameterPrediction, RULEstimate, HealthScore, OEEForecast, AnomalyAlert, AIAnalysisResult } from "../types/predictions";

interface PredictionStore {
  parameterPredictions: ParameterPrediction[];
  rulEstimates: RULEstimate[];
  healthScore: HealthScore;
  oeeForecast: OEEForecast | null;
  anomalyAlerts: AnomalyAlert[];
  aiAnalysis: AIAnalysisResult | null;
  aiAnalysisLoading: boolean;
  lastComputedAt: number;
}

export const usePredictionStore = create<PredictionStore>(() => ({
  parameterPredictions: [],
  rulEstimates: [],
  healthScore: { overall: 100, components: {}, lastUpdated: 0 },
  oeeForecast: null,
  anomalyAlerts: [],
  aiAnalysis: null,
  aiAnalysisLoading: false,
  lastComputedAt: 0,
}));
