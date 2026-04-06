#!/usr/bin/env bash
#
# Guide for setting up SiteWise Predictions on the Smart Factory models.
#
# SiteWise Predictions uses ML to detect anomalies in your sensor data.
# It requires a few days of historical data to train.
#
# Prerequisites:
#   - Data flowing into SiteWise for at least 3-5 days
#   - Asset models already created (via setup-sitewise.sh)
#
# Usage:  bash scripts/setup-sitewise-predictions.sh

set -euo pipefail

echo "=== Smart Factory — SiteWise Predictions Setup Guide ==="
echo ""
echo "SiteWise Predictions uses ML to detect anomalies in your sensor data."
echo "It learns normal patterns and flags when readings deviate."
echo ""
echo "=== Prerequisites ==="
echo "  - Data must be flowing into SiteWise for at least 3-5 days"
echo "  - The sitewise-ingest.mjs script must have been running continuously"
echo ""
echo "=== Steps (AWS Console) ==="
echo ""
echo "1. Go to: AWS Console -> IoT SiteWise -> Models"
echo ""
echo "2. Select 'SmartFactory_AnalogSensor' model"
echo ""
echo "3. Click the 'Predictions' tab"
echo ""
echo "4. Click 'Add prediction definition'"
echo ""
echo "5. Configure:"
echo "   - Name: analog_anomaly_detection"
echo "   - Input property: raw_value"
echo "   - Training data range: Last 7 days (or whatever you have)"
echo "   - Prediction type: Anomaly detection"
echo ""
echo "6. Click 'Create'"
echo "   SiteWise will train on your historical data."
echo "   Training takes 15-30 minutes."
echo ""
echo "7. Once trained, predictions appear as new properties on each"
echo "   AnalogSensor asset (SF_voltage, SF_current, SF_pH, SF_temperature)"
echo ""
echo "8. The prediction outputs:"
echo "   - anomaly_score: 0.0 (normal) to 1.0 (highly anomalous)"
echo "   - prediction_reason: which input contributed most"
echo ""
echo "=== How It Works ==="
echo ""
echo "SiteWise Predictions learns the NORMAL patterns of each sensor:"
echo "  - Voltage usually stays around 4.5-5.5V"
echo "  - pH drifts slowly between 6.8-7.2"
echo "  - Temperature follows a daily cycle"
echo ""
echo "When a reading deviates from the learned pattern, the anomaly_score"
echo "rises. Your dashboard can query this score and highlight anomalies."
echo ""
echo "=== After Setup ==="
echo ""
echo "The dashboard's PLC Analytics panel already has anomaly detection"
echo "(statistical). Once Predictions is trained, you can switch to"
echo "ML-based detection by querying the anomaly_score property."
echo ""
echo "No code changes needed — the Lambda and dashboard will auto-detect"
echo "prediction properties when they exist."
echo ""
echo "=== Check Status ==="
echo "aws iotsitewise describe-asset-model \\"
echo "  --asset-model-id \$(jq -r '.models.analogSensor' scripts/sitewise-ids.json) \\"
echo "  --query 'assetModelProperties[?name==\`anomaly_score\`]' \\"
echo "  --region us-east-1"
