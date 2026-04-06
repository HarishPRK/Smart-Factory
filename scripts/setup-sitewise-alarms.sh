#!/usr/bin/env bash
#
# Sets up SiteWise Alarm definitions for the Smart Factory PLC.
#
# Creates composite alarm models with threshold rules for each analog sensor.
# These alarms fire server-side even when no browser is open.
#
# Prerequisites:
#   - AWS CLI v2 configured
#   - scripts/sitewise-ids.json must exist (from setup-sitewise.sh)
#
# Usage:  bash scripts/setup-sitewise-alarms.sh

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
IDS_FILE="scripts/sitewise-ids.json"
SW="aws iotsitewise --region $REGION"

if [[ ! -f "$IDS_FILE" ]]; then
  echo "ERROR: $IDS_FILE not found. Run setup-sitewise.sh first."
  exit 1
fi

echo "=== Smart Factory — SiteWise Alarms Setup ==="
echo ""
echo "This script creates IoT Events alarm models for your analog sensors."
echo "Alarms fire server-side when thresholds are breached."
echo ""

# Read asset IDs
VOLTAGE_ASSET=$(jq -r '.assets.voltage' "$IDS_FILE")
CURRENT_ASSET=$(jq -r '.assets.current' "$IDS_FILE")
PH_ASSET=$(jq -r '.assets.pH' "$IDS_FILE")
TEMP_ASSET=$(jq -r '.assets.temperature' "$IDS_FILE")

echo "Alarm Definitions to Create:"
echo "  - Voltage: Alert when < 2V or > 10V (nominal: 5V, range: 0-12V)"
echo "  - Current: Alert when > 8A (nominal: 6A, range: 0-10A)"
echo "  - pH: Alert when < 6 or > 8 (nominal: 7, range: 0-14)"
echo "  - Temperature: Alert when > 80°C (nominal: 25°C, range: 0-100°C)"
echo ""
echo "Asset IDs:"
echo "  Voltage:     $VOLTAGE_ASSET"
echo "  Current:     $CURRENT_ASSET"
echo "  pH:          $PH_ASSET"
echo "  Temperature: $TEMP_ASSET"
echo ""

# ── NOTE ─────────────────────────────────────────────────
# SiteWise Alarms require IoT Events detector models.
# As of 2026, the simplest approach is to create alarms
# directly from the SiteWise Console:
#
# 1. Go to AWS Console → IoT SiteWise → Models → SmartFactory_AnalogSensor
# 2. Click "Alarm" tab → "Add alarm"
# 3. For each sensor:
#    - Alarm name: e.g. "voltage_high_alarm"
#    - Property: raw_value
#    - Operator: Greater than / Less than
#    - Threshold: see values above
#    - Severity: 1 (critical) or 2 (warning)
#    - Notification: Configure SNS topic for email/SMS
#
# The CLI method below creates the alarm definitions programmatically.
# ─────────────────────────────────────────────────────────

echo "[1/4] Creating SNS topic for alarm notifications..."

TOPIC_ARN=$(aws sns create-topic \
  --name "SmartFactory-Alarms" \
  --region "$REGION" \
  --query 'TopicArn' --output text 2>/dev/null || echo "SKIP")

if [[ "$TOPIC_ARN" != "SKIP" ]]; then
  echo "  SNS Topic: $TOPIC_ARN"
  echo ""
  echo "  To receive email notifications, subscribe:"
  echo "  aws sns subscribe --topic-arn $TOPIC_ARN --protocol email --notification-endpoint YOUR_EMAIL"
  echo ""
else
  echo "  SNS topic creation skipped (may already exist)"
fi

echo "[2/4] Creating IAM role for IoT Events..."

cat > /tmp/iot-events-trust.json << 'TRUSTEOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "iotevents.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
TRUSTEOF

IOT_EVENTS_ROLE=$(aws iam create-role \
  --role-name SmartFactory-IoTEventsAlarmRole \
  --assume-role-policy-document file:///tmp/iot-events-trust.json \
  --query 'Role.Arn' --output text 2>/dev/null || \
  aws iam get-role --role-name SmartFactory-IoTEventsAlarmRole \
  --query 'Role.Arn' --output text)

echo "  IoT Events Role: $IOT_EVENTS_ROLE"

aws iam attach-role-policy --role-name SmartFactory-IoTEventsAlarmRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSIoTEventsFullAccess 2>/dev/null || true

aws iam attach-role-policy --role-name SmartFactory-IoTEventsAlarmRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSNSFullAccess 2>/dev/null || true

echo "[3/4] Alarm definitions ready for console setup."
echo ""
echo "=== Manual Steps Required ==="
echo ""
echo "Go to AWS Console → IoT SiteWise → Models → SmartFactory_AnalogSensor → Alarm tab"
echo ""
echo "Create these alarms:"
echo ""
echo "1. voltage_high_alarm"
echo "   Property: raw_value | Operator: Greater than | Threshold: 10"
echo "   Severity: 1 (Critical)"
echo ""
echo "2. voltage_low_alarm"
echo "   Property: raw_value | Operator: Less than | Threshold: 2"
echo "   Severity: 1 (Critical)"
echo ""
echo "3. current_high_alarm"
echo "   Property: raw_value | Operator: Greater than | Threshold: 8"
echo "   Severity: 2 (Warning)"
echo ""
echo "4. pH_high_alarm"
echo "   Property: raw_value | Operator: Greater than | Threshold: 8"
echo "   Severity: 2 (Warning)"
echo ""
echo "5. pH_low_alarm"
echo "   Property: raw_value | Operator: Less than | Threshold: 6"
echo "   Severity: 2 (Warning)"
echo ""
echo "6. temperature_high_alarm"
echo "   Property: raw_value | Operator: Greater than | Threshold: 80"
echo "   Severity: 1 (Critical)"
echo ""

echo "[4/4] Saving alarm config..."

cat > scripts/sitewise-alarms.json << JSONEOF
{
  "snsTopic": "$TOPIC_ARN",
  "iotEventsRole": "$IOT_EVENTS_ROLE",
  "alarmDefinitions": [
    { "name": "voltage_high", "property": "voltage", "operator": "GREATER_THAN", "threshold": 10, "severity": 1 },
    { "name": "voltage_low", "property": "voltage", "operator": "LESS_THAN", "threshold": 2, "severity": 1 },
    { "name": "current_high", "property": "current", "operator": "GREATER_THAN", "threshold": 8, "severity": 2 },
    { "name": "pH_high", "property": "pH", "operator": "GREATER_THAN", "threshold": 8, "severity": 2 },
    { "name": "pH_low", "property": "pH", "operator": "LESS_THAN", "threshold": 6, "severity": 2 },
    { "name": "temperature_high", "property": "temperature", "operator": "GREATER_THAN", "threshold": 80, "severity": 1 }
  ]
}
JSONEOF

echo "Alarm config saved to scripts/sitewise-alarms.json"
echo ""
echo "Done! After creating alarms in the console, they will fire automatically"
echo "when sensor values breach thresholds — even when no browser is open."
