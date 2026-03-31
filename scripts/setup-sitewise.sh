#!/usr/bin/env bash
#
# One-time AWS IoT SiteWise setup for the Smart Factory project.
#
# Creates asset models (AnalogSensor, DigitalActuator, PLCUnit),
# instantiates assets for every PLC field, sets property aliases,
# and configures attribute values.
#
# Prerequisites:
#   - AWS CLI v2 configured with credentials that have iotsitewise:* permissions
#   - jq installed (for JSON parsing)
#
# Usage:  bash scripts/setup-sitewise.sh
# Env:    AWS_REGION (default us-east-1)
#         SITEWISE_PREFIX (default /smart-factory/plc-1)

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PREFIX="${SITEWISE_PREFIX:-/smart-factory/plc-1}"
SW="aws iotsitewise --region $REGION"
OUTPUT_FILE="scripts/sitewise-ids.json"

echo "=== Smart Factory — SiteWise Setup ==="
echo "Region: $REGION"
echo "Alias prefix: $PREFIX"
echo ""

# ── Helpers ──────────────────────────────────────────────

wait_for_model() {
  local model_id="$1"
  local name="$2"
  echo -n "  Waiting for model '$name' to become ACTIVE..."
  while true; do
    status=$($SW describe-asset-model --asset-model-id "$model_id" \
      --query 'assetModelStatus.state' --output text 2>/dev/null || echo "CREATING")
    if [[ "$status" == "ACTIVE" ]]; then
      echo " done."
      return
    fi
    echo -n "."
    sleep 3
  done
}

wait_for_asset() {
  local asset_id="$1"
  local name="$2"
  echo -n "  Waiting for asset '$name' to become ACTIVE..."
  while true; do
    status=$($SW describe-asset --asset-id "$asset_id" \
      --query 'assetStatus.state' --output text 2>/dev/null || echo "CREATING")
    if [[ "$status" == "ACTIVE" ]]; then
      echo " done."
      return
    fi
    echo -n "."
    sleep 3
  done
}

get_property_id() {
  local model_id="$1"
  local prop_name="$2"
  $SW describe-asset-model --asset-model-id "$model_id" \
    --query "assetModelProperties[?name=='${prop_name}'].id" --output text
}

get_asset_property_id() {
  local asset_id="$1"
  local prop_name="$2"
  $SW describe-asset --asset-id "$asset_id" \
    --query "assetProperties[?name=='${prop_name}'].id" --output text
}

# ── Step 1: Create AnalogSensor Model ────────────────────

echo "[1/7] Creating AnalogSensor model..."

ANALOG_MODEL_ID=$($SW create-asset-model \
  --asset-model-name "SmartFactory_AnalogSensor" \
  --asset-model-properties '[
    {
      "name": "raw_value",
      "dataType": "DOUBLE",
      "type": { "measurement": {} }
    },
    {
      "name": "unit",
      "dataType": "STRING",
      "type": { "attribute": { "defaultValue": "-" } }
    },
    {
      "name": "min_range",
      "dataType": "DOUBLE",
      "type": { "attribute": { "defaultValue": "0" } }
    },
    {
      "name": "max_range",
      "dataType": "DOUBLE",
      "type": { "attribute": { "defaultValue": "100" } }
    },
    {
      "name": "nominal",
      "dataType": "DOUBLE",
      "type": { "attribute": { "defaultValue": "50" } }
    }
  ]' \
  --query 'assetModelId' --output text)

echo "  Model ID: $ANALOG_MODEL_ID"
wait_for_model "$ANALOG_MODEL_ID" "AnalogSensor"

# Add metrics (require the raw_value property ID)
RAW_VALUE_PROP_ID=$(get_property_id "$ANALOG_MODEL_ID" "raw_value")
echo "  Adding metrics (avg_1h, max_1h)..."

$SW update-asset-model \
  --asset-model-id "$ANALOG_MODEL_ID" \
  --asset-model-name "SmartFactory_AnalogSensor" \
  --asset-model-properties "[
    {
      \"id\": \"$RAW_VALUE_PROP_ID\",
      \"name\": \"raw_value\",
      \"dataType\": \"DOUBLE\",
      \"type\": { \"measurement\": {} }
    },
    {
      \"id\": \"$(get_property_id "$ANALOG_MODEL_ID" "unit")\",
      \"name\": \"unit\",
      \"dataType\": \"STRING\",
      \"type\": { \"attribute\": { \"defaultValue\": \"-\" } }
    },
    {
      \"id\": \"$(get_property_id "$ANALOG_MODEL_ID" "min_range")\",
      \"name\": \"min_range\",
      \"dataType\": \"DOUBLE\",
      \"type\": { \"attribute\": { \"defaultValue\": \"0\" } }
    },
    {
      \"id\": \"$(get_property_id "$ANALOG_MODEL_ID" "max_range")\",
      \"name\": \"max_range\",
      \"dataType\": \"DOUBLE\",
      \"type\": { \"attribute\": { \"defaultValue\": \"100\" } }
    },
    {
      \"id\": \"$(get_property_id "$ANALOG_MODEL_ID" "nominal")\",
      \"name\": \"nominal\",
      \"dataType\": \"DOUBLE\",
      \"type\": { \"attribute\": { \"defaultValue\": \"50\" } }
    },
    {
      \"name\": \"avg_1h\",
      \"dataType\": \"DOUBLE\",
      \"type\": {
        \"metric\": {
          \"expression\": \"avg(raw_value)\",
          \"variables\": [{ \"name\": \"raw_value\", \"value\": { \"propertyId\": \"$RAW_VALUE_PROP_ID\" } }],
          \"window\": { \"tumbling\": { \"interval\": \"1h\" } }
        }
      }
    },
    {
      \"name\": \"max_1h\",
      \"dataType\": \"DOUBLE\",
      \"type\": {
        \"metric\": {
          \"expression\": \"max(raw_value)\",
          \"variables\": [{ \"name\": \"raw_value\", \"value\": { \"propertyId\": \"$RAW_VALUE_PROP_ID\" } }],
          \"window\": { \"tumbling\": { \"interval\": \"1h\" } }
        }
      }
    }
  ]" > /dev/null

wait_for_model "$ANALOG_MODEL_ID" "AnalogSensor (with metrics)"

# ── Step 2: Create DigitalActuator Model ─────────────────

echo "[2/7] Creating DigitalActuator model..."

DIGITAL_MODEL_ID=$($SW create-asset-model \
  --asset-model-name "SmartFactory_DigitalActuator" \
  --asset-model-properties '[
    {
      "name": "state",
      "dataType": "INTEGER",
      "type": { "measurement": {} }
    }
  ]' \
  --query 'assetModelId' --output text)

echo "  Model ID: $DIGITAL_MODEL_ID"
wait_for_model "$DIGITAL_MODEL_ID" "DigitalActuator"

# Add toggle_count_1h metric
STATE_PROP_ID=$(get_property_id "$DIGITAL_MODEL_ID" "state")
echo "  Adding metrics (toggle_count_1h)..."

$SW update-asset-model \
  --asset-model-id "$DIGITAL_MODEL_ID" \
  --asset-model-name "SmartFactory_DigitalActuator" \
  --asset-model-properties "[
    {
      \"id\": \"$STATE_PROP_ID\",
      \"name\": \"state\",
      \"dataType\": \"INTEGER\",
      \"type\": { \"measurement\": {} }
    },
    {
      \"name\": \"toggle_count_1h\",
      \"dataType\": \"DOUBLE\",
      \"type\": {
        \"metric\": {
          \"expression\": \"count(state)\",
          \"variables\": [{ \"name\": \"state\", \"value\": { \"propertyId\": \"$STATE_PROP_ID\" } }],
          \"window\": { \"tumbling\": { \"interval\": \"1h\" } }
        }
      }
    }
  ]" > /dev/null

wait_for_model "$DIGITAL_MODEL_ID" "DigitalActuator (with metrics)"

# ── Step 3: Create PLCUnit Model ─────────────────────────

echo "[3/7] Creating PLCUnit model..."

PLC_MODEL_ID=$($SW create-asset-model \
  --asset-model-name "SmartFactory_PLCUnit" \
  --asset-model-properties '[
    {
      "name": "plc_id",
      "dataType": "STRING",
      "type": { "attribute": { "defaultValue": "plc-1" } }
    },
    {
      "name": "alert_0",
      "dataType": "INTEGER",
      "type": { "measurement": {} }
    },
    {
      "name": "alert_1",
      "dataType": "INTEGER",
      "type": { "measurement": {} }
    },
    {
      "name": "alert_2",
      "dataType": "INTEGER",
      "type": { "measurement": {} }
    },
    {
      "name": "alert_3",
      "dataType": "INTEGER",
      "type": { "measurement": {} }
    }
  ]' \
  --asset-model-hierarchies "[
    {
      \"name\": \"analog_sensors\",
      \"childAssetModelId\": \"$ANALOG_MODEL_ID\"
    },
    {
      \"name\": \"digital_actuators\",
      \"childAssetModelId\": \"$DIGITAL_MODEL_ID\"
    }
  ]" \
  --query 'assetModelId' --output text)

echo "  Model ID: $PLC_MODEL_ID"
wait_for_model "$PLC_MODEL_ID" "PLCUnit"

# ── Step 4: Create Assets ────────────────────────────────

echo "[4/7] Creating assets..."

# Analog sensors
declare -A ANALOG_ASSETS
for name in voltage current pH temperature; do
  id=$($SW create-asset --asset-name "SF_${name}" \
    --asset-model-id "$ANALOG_MODEL_ID" \
    --query 'assetId' --output text)
  ANALOG_ASSETS[$name]="$id"
  echo "  Created analog asset '$name': $id"
done

# Digital actuators
declare -A DIGITAL_ASSETS
DIGITAL_NAMES="photoE_sensor metal_sensor push_button motor relay_ch0 relay_ch1 relay_ch2 relay_ch3 relay_ch4 relay_ch5 relay_ch6 relay_ch7"
for name in $DIGITAL_NAMES; do
  id=$($SW create-asset --asset-name "SF_${name}" \
    --asset-model-id "$DIGITAL_MODEL_ID" \
    --query 'assetId' --output text)
  DIGITAL_ASSETS[$name]="$id"
  echo "  Created digital asset '$name': $id"
done

# PLCUnit
PLC_ASSET_ID=$($SW create-asset --asset-name "SF_PLC-1" \
  --asset-model-id "$PLC_MODEL_ID" \
  --query 'assetId' --output text)
echo "  Created PLC asset 'PLC-1': $PLC_ASSET_ID"

# Wait for all assets
for name in voltage current pH temperature; do
  wait_for_asset "${ANALOG_ASSETS[$name]}" "$name"
done
for name in $DIGITAL_NAMES; do
  wait_for_asset "${DIGITAL_ASSETS[$name]}" "$name"
done
wait_for_asset "$PLC_ASSET_ID" "PLC-1"

# ── Step 5: Associate Child Assets to PLCUnit ────────────

echo "[5/7] Associating assets to PLC-1..."

# Get hierarchy IDs
ANALOG_HIERARCHY_ID=$($SW describe-asset-model --asset-model-id "$PLC_MODEL_ID" \
  --query "assetModelHierarchies[?name=='analog_sensors'].id" --output text)
DIGITAL_HIERARCHY_ID=$($SW describe-asset-model --asset-model-id "$PLC_MODEL_ID" \
  --query "assetModelHierarchies[?name=='digital_actuators'].id" --output text)

for name in voltage current pH temperature; do
  $SW associate-assets --asset-id "$PLC_ASSET_ID" \
    --hierarchy-id "$ANALOG_HIERARCHY_ID" \
    --child-asset-id "${ANALOG_ASSETS[$name]}" > /dev/null
  echo "  Associated $name → PLC-1 (analog)"
done

for name in $DIGITAL_NAMES; do
  $SW associate-assets --asset-id "$PLC_ASSET_ID" \
    --hierarchy-id "$DIGITAL_HIERARCHY_ID" \
    --child-asset-id "${DIGITAL_ASSETS[$name]}" > /dev/null
  echo "  Associated $name → PLC-1 (digital)"
done

# ── Step 6: Set Property Aliases ─────────────────────────

echo "[6/7] Setting property aliases..."

# Analog sensor aliases (raw_value property)
for name in voltage current pH temperature; do
  prop_id=$(get_asset_property_id "${ANALOG_ASSETS[$name]}" "raw_value")
  $SW update-asset-property \
    --asset-id "${ANALOG_ASSETS[$name]}" \
    --property-id "$prop_id" \
    --property-alias "${PREFIX}/${name}/raw_value" > /dev/null
  echo "  ${PREFIX}/${name}/raw_value"
done

# Digital actuator aliases (state property)
for name in $DIGITAL_NAMES; do
  prop_id=$(get_asset_property_id "${DIGITAL_ASSETS[$name]}" "state")
  $SW update-asset-property \
    --asset-id "${DIGITAL_ASSETS[$name]}" \
    --property-id "$prop_id" \
    --property-alias "${PREFIX}/${name}/state" > /dev/null
  echo "  ${PREFIX}/${name}/state"
done

# PLC alert aliases
for i in 0 1 2 3; do
  prop_id=$(get_asset_property_id "$PLC_ASSET_ID" "alert_${i}")
  $SW update-asset-property \
    --asset-id "$PLC_ASSET_ID" \
    --property-id "$prop_id" \
    --property-alias "${PREFIX}/alert_${i}" > /dev/null
  echo "  ${PREFIX}/alert_${i}"
done

# ── Step 7: Set Attribute Values ─────────────────────────

echo "[7/7] Setting attribute values..."

set_attribute() {
  local asset_id="$1" prop_name="$2" value="$3" data_type="$4"
  local prop_id
  prop_id=$(get_asset_property_id "$asset_id" "$prop_name")

  local value_payload
  if [[ "$data_type" == "STRING" ]]; then
    value_payload="{\"stringValue\": \"$value\"}"
  else
    value_payload="{\"doubleValue\": $value}"
  fi

  $SW batch-put-asset-property-value --entries "[{
    \"entryId\": \"attr-$(date +%s%N)\",
    \"assetId\": \"$asset_id\",
    \"propertyId\": \"$prop_id\",
    \"propertyValues\": [{
      \"value\": $value_payload,
      \"timestamp\": { \"timeInSeconds\": $(date +%s) }
    }]
  }]" > /dev/null
}

# Voltage: 0-12V, nominal 5.0
set_attribute "${ANALOG_ASSETS[voltage]}" "unit" "V" "STRING"
set_attribute "${ANALOG_ASSETS[voltage]}" "min_range" "0" "DOUBLE"
set_attribute "${ANALOG_ASSETS[voltage]}" "max_range" "12" "DOUBLE"
set_attribute "${ANALOG_ASSETS[voltage]}" "nominal" "5.0" "DOUBLE"
echo "  voltage: unit=V, range=0-12, nominal=5.0"

# Current: 0-10A, nominal 6.0
set_attribute "${ANALOG_ASSETS[current]}" "unit" "A" "STRING"
set_attribute "${ANALOG_ASSETS[current]}" "min_range" "0" "DOUBLE"
set_attribute "${ANALOG_ASSETS[current]}" "max_range" "10" "DOUBLE"
set_attribute "${ANALOG_ASSETS[current]}" "nominal" "6.0" "DOUBLE"
echo "  current: unit=A, range=0-10, nominal=6.0"

# pH: 0-14, nominal 7.0
set_attribute "${ANALOG_ASSETS[pH]}" "unit" "pH" "STRING"
set_attribute "${ANALOG_ASSETS[pH]}" "min_range" "0" "DOUBLE"
set_attribute "${ANALOG_ASSETS[pH]}" "max_range" "14" "DOUBLE"
set_attribute "${ANALOG_ASSETS[pH]}" "nominal" "7.0" "DOUBLE"
echo "  pH: unit=pH, range=0-14, nominal=7.0"

# Temperature: 0-100°C, nominal 25.0
set_attribute "${ANALOG_ASSETS[temperature]}" "unit" "°C" "STRING"
set_attribute "${ANALOG_ASSETS[temperature]}" "min_range" "0" "DOUBLE"
set_attribute "${ANALOG_ASSETS[temperature]}" "max_range" "100" "DOUBLE"
set_attribute "${ANALOG_ASSETS[temperature]}" "nominal" "25.0" "DOUBLE"
echo "  temperature: unit=°C, range=0-100, nominal=25.0"

# ── Output Resource IDs ──────────────────────────────────

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Saving resource IDs to $OUTPUT_FILE ..."

cat > "$OUTPUT_FILE" << JSONEOF
{
  "region": "$REGION",
  "aliasPrefix": "$PREFIX",
  "models": {
    "analogSensor": "$ANALOG_MODEL_ID",
    "digitalActuator": "$DIGITAL_MODEL_ID",
    "plcUnit": "$PLC_MODEL_ID"
  },
  "assets": {
    "plc1": "$PLC_ASSET_ID",
    "voltage": "${ANALOG_ASSETS[voltage]}",
    "current": "${ANALOG_ASSETS[current]}",
    "pH": "${ANALOG_ASSETS[pH]}",
    "temperature": "${ANALOG_ASSETS[temperature]}",
    "photoE_sensor": "${DIGITAL_ASSETS[photoE_sensor]}",
    "metal_sensor": "${DIGITAL_ASSETS[metal_sensor]}",
    "push_button": "${DIGITAL_ASSETS[push_button]}",
    "motor": "${DIGITAL_ASSETS[motor]}",
    "relay_ch0": "${DIGITAL_ASSETS[relay_ch0]}",
    "relay_ch1": "${DIGITAL_ASSETS[relay_ch1]}",
    "relay_ch2": "${DIGITAL_ASSETS[relay_ch2]}",
    "relay_ch3": "${DIGITAL_ASSETS[relay_ch3]}",
    "relay_ch4": "${DIGITAL_ASSETS[relay_ch4]}",
    "relay_ch5": "${DIGITAL_ASSETS[relay_ch5]}",
    "relay_ch6": "${DIGITAL_ASSETS[relay_ch6]}",
    "relay_ch7": "${DIGITAL_ASSETS[relay_ch7]}"
  }
}
JSONEOF

echo "Done! Verify in the AWS Console: IoT SiteWise → Assets → SF_PLC-1"
echo ""
echo "Next step: run 'npm run sitewise-ingest' to start data ingestion."
