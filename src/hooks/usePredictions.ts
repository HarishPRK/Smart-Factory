import { useEffect } from "react";
import { usePLCStore } from "../stores/plcStore";
import { usePredictionStore } from "../stores/predictionStore";
import { analyzeAllParameters, computeHealthScore } from "../services/predictionEngine";
import type { AnomalyAlert } from "../types/predictions";
import { PLC_TELEMETRY_STALE_MS } from "../services/receivedTelemetry";

export function usePredictions() {
  useEffect(() => {
    const interval = setInterval(() => {
      const store = usePLCStore.getState();

      const histories: Record<string, number[]> = {};
      const times: Record<string, number[]> = {};
      const now = Date.now();
      if (store.telemetrySource === "plc") for (const id of ["voltage", "current", "ph", "temperature"]) {
        const values = store.receivedHistories[id] ?? [];
        const stamps = store.receivedSampleTimes[id] ?? [];
        if (values.length !== stamps.length || !stamps.length || now - stamps.at(-1)! >= PLC_TELEMETRY_STALE_MS) continue;
        // A reconnect starts a fresh observation window; do not regress across an outage.
        let start = 0;
        for (let index = 1; index < stamps.length; index++) if (stamps[index] - stamps[index - 1] >= PLC_TELEMETRY_STALE_MS) start = index;
        if (values.length - start < 5) continue;
        histories[id] = values.slice(start); times[id] = stamps.slice(start);
      }
      const { predictions, rulEstimates } = analyzeAllParameters(histories, times);
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
        lastComputedAt: predictions.length ? Date.now() : 0,
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);
}
