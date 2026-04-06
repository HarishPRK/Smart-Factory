import { useEffect } from "react";
import { usePLCStore } from "../stores/plcStore";
import { usePredictionStore } from "../stores/predictionStore";
import { analyzeAllParameters, computeHealthScore } from "../services/predictionEngine";
import type { AnomalyAlert } from "../types/predictions";

const SAMPLE_RATE_MS = 500; // simulation pushes at ~2Hz

export function usePredictions() {
  useEffect(() => {
    const interval = setInterval(() => {
      const store = usePLCStore.getState();

      const histories: Record<string, number[]> = {
        voltage: store.historyVoltage,
        current: store.historyCurrent,
        ph: store.historyPH,
        temperature: store.historyTemp,
      };

      // Skip if no data yet
      if (store.historyVoltage.length < 5) return;

      const { predictions, rulEstimates } = analyzeAllParameters(histories, SAMPLE_RATE_MS);
      const healthScore = computeHealthScore(predictions, rulEstimates);

      // Generate anomaly alerts from threshold crossings
      const alerts: AnomalyAlert[] = [];
      for (const pred of predictions) {
        if (pred.thresholdCrossing?.willCross && pred.thresholdCrossing.minutesUntil !== null) {
          const mins = pred.thresholdCrossing.minutesUntil;
          const severity = mins < 5 && pred.confidence > 0.7 ? "critical" : mins < 15 ? "warning" : "info";

          alerts.push({
            id: `${pred.parameterId}-threshold`,
            parameterId: pred.parameterId,
            label: pred.label,
            type: "threshold_crossing",
            severity,
            message: `${pred.label} predicted to ${pred.thresholdCrossing.direction === "above" ? "exceed" : "drop below"} ${pred.thresholdCrossing.threshold}${pred.unit} in ~${Math.round(mins)} min`,
            value: pred.currentValue,
            threshold: pred.thresholdCrossing.threshold,
            timestamp: Date.now(),
            confidence: pred.confidence,
          });
        }

        // Rate of change alerts
        if (Math.abs(pred.rateOfChange) > 0.5) {
          alerts.push({
            id: `${pred.parameterId}-roc`,
            parameterId: pred.parameterId,
            label: pred.label,
            type: "rate_of_change",
            severity: Math.abs(pred.rateOfChange) > 2 ? "warning" : "info",
            message: `${pred.label} ${pred.trendDirection} at ${Math.abs(pred.rateOfChange).toFixed(2)} ${pred.rateOfChangeUnit}`,
            value: pred.currentValue,
            threshold: 0,
            timestamp: Date.now(),
            confidence: pred.confidence,
          });
        }
      }

      usePredictionStore.setState({
        parameterPredictions: predictions,
        rulEstimates,
        healthScore,
        anomalyAlerts: alerts,
        lastComputedAt: Date.now(),
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);
}
