/**
 * Lambda: sitewise-query
 *
 * REST API endpoint for querying SiteWise historical data and aggregates.
 * Fronted by API Gateway (HTTP API or REST API).
 *
 * Endpoints (via query string `action`):
 *   ?action=history    — Raw time-series for a property
 *   ?action=aggregates — Computed aggregates (avg, max, min, count)
 *   ?action=latest     — Latest value for a property
 *   ?action=batch      — Latest values for multiple properties at once
 *
 * Environment variables:
 *   AWS_REGION          — Region (default us-east-1)
 *   SITEWISE_PREFIX     — Property alias prefix (default /smart-factory/plc-1)
 */

import {
  IoTSiteWiseClient,
  GetAssetPropertyValueHistoryCommand,
  GetAssetPropertyValueCommand,
  BatchGetAssetPropertyValueCommand,
  GetAssetPropertyAggregatesCommand,
} from "@aws-sdk/client-iotsitewise";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const PREFIX = process.env.SITEWISE_PREFIX ?? "/smart-factory/plc-1";
const client = new IoTSiteWiseClient({ region: REGION });

/* ── OEE Shift & Config ────────────────────────────────── */

const SHIFTS = {
  morning:   { startHour: 6,  endHour: 14, breakMinutes: 30 },
  afternoon: { startHour: 14, endHour: 22, breakMinutes: 30 },
  night:     { startHour: 22, endHour: 6,  breakMinutes: 30 },
};

const OEE_CONFIG = {
  idealCycleTimeSec: 30,
};

function getCurrentShift(date = new Date()) {
  const hour = date.getUTCHours();
  if (hour >= 6 && hour < 14) return "morning";
  if (hour >= 14 && hour < 22) return "afternoon";
  return "night";
}

function getShiftBounds(shiftId, date = new Date()) {
  const shift = SHIFTS[shiftId];
  const start = new Date(date);
  start.setUTCMinutes(0, 0, 0);
  start.setUTCHours(shift.startHour);

  const end = new Date(start);
  if (shift.endHour > shift.startHour) {
    end.setUTCHours(shift.endHour);
  } else {
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCHours(shift.endHour);
  }

  // If we're before the shift start (night shift carry-over), go back a day
  if (date < start) {
    start.setUTCDate(start.getUTCDate() - 1);
    end.setUTCDate(end.getUTCDate() - 1);
  }

  return { start, end, breakMinutes: shift.breakMinutes };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

// Map friendly names to SiteWise property aliases
const PROPERTY_MAP = {
  // Analog sensors
  voltage: "/voltage/raw_value",
  current: "/current/raw_value",
  temperature: "/temperature/raw_value",
  pH: "/pH/raw_value",
  // Digital actuators
  photoE_sensor: "/photoE_sensor/state",
  metal_sensor: "/metal_sensor/state",
  push_button: "/push_button/state",
  motor: "/motor/state",
  // Relays
  relay_ch0: "/relay_ch0/state",
  relay_ch1: "/relay_ch1/state",
  relay_ch2: "/relay_ch2/state",
  relay_ch3: "/relay_ch3/state",
  relay_ch4: "/relay_ch4/state",
  relay_ch5: "/relay_ch5/state",
  relay_ch6: "/relay_ch6/state",
  relay_ch7: "/relay_ch7/state",
  // Alerts
  alert_0: "/alert_0",
  alert_1: "/alert_1",
  alert_2: "/alert_2",
  alert_3: "/alert_3",
};

// Metric aliases for auto-computed SiteWise properties
const METRIC_MAP = {
  voltage: { avg_1h: "/voltage/avg_1h", max_1h: "/voltage/max_1h" },
  current: { avg_1h: "/current/avg_1h", max_1h: "/current/max_1h" },
  temperature: { avg_1h: "/temperature/avg_1h", max_1h: "/temperature/max_1h" },
  pH: { avg_1h: "/pH/avg_1h", max_1h: "/pH/max_1h" },
  photoE_sensor: { toggle_count_1h: "/photoE_sensor/toggle_count_1h" },
  metal_sensor: { toggle_count_1h: "/metal_sensor/toggle_count_1h" },
  motor: { toggle_count_1h: "/motor/toggle_count_1h" },
  push_button: { toggle_count_1h: "/push_button/toggle_count_1h" },
};

function resolveAlias(property) {
  const suffix = PROPERTY_MAP[property];
  if (!suffix) return null;
  return `${PREFIX}${suffix}`;
}

function extractValue(entry) {
  const v = entry.value;
  if (!v) return null;
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.integerValue !== undefined) return v.integerValue;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  return null;
}

function extractTimestamp(entry) {
  const ts = entry.timestamp;
  if (!ts) return null;
  return ts.timeInSeconds * 1000 + Math.floor((ts.offsetInNanos ?? 0) / 1_000_000);
}

/* ── Action handlers ─────────────────────────────────── */

async function handleHistory(params) {
  const { property, startDate, endDate, maxResults } = params;
  const alias = resolveAlias(property);
  if (!alias) return respond(400, { error: `Unknown property: ${property}` });

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 3600_000);
  const end = endDate ? new Date(endDate) : new Date();

  // SiteWise requires Date objects with second precision
  start.setMilliseconds(0);
  end.setMilliseconds(0);

  const resp = await client.send(
    new GetAssetPropertyValueHistoryCommand({
      propertyAlias: alias,
      startDate: start,
      endDate: end,
      maxResults: maxResults ? Number(maxResults) : 500,
      timeOrdering: "ASCENDING",
    })
  );

  const points = (resp.assetPropertyValueHistory ?? []).map((entry) => ({
    timestamp: extractTimestamp(entry),
    value: extractValue(entry),
    quality: entry.quality,
  }));

  return respond(200, { property, alias, points, count: points.length });
}

async function handleAggregates(params) {
  const { property, startDate, endDate, resolution, aggregateTypes } = params;
  const alias = resolveAlias(property);
  if (!alias) return respond(400, { error: `Unknown property: ${property}` });

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 3600_000);
  const end = endDate ? new Date(endDate) : new Date();
  start.setMilliseconds(0);
  end.setMilliseconds(0);
  const types = aggregateTypes
    ? aggregateTypes.split(",")
    : ["AVERAGE", "MAXIMUM", "MINIMUM", "COUNT"];

  const resp = await client.send(
    new GetAssetPropertyAggregatesCommand({
      propertyAlias: alias,
      startDate: start,
      endDate: end,
      resolution: resolution || "1h",
      aggregateTypes: types,
      timeOrdering: "ASCENDING",
    })
  );

  const buckets = (resp.aggregatedValues ?? []).map((entry) => {
    const result = { timestamp: entry.timestamp?.getTime() };
    for (const type of types) {
      const key = type.toLowerCase();
      result[key] = entry.value?.[key]?.value ?? null;
    }
    return result;
  });

  return respond(200, { property, alias, resolution: resolution || "1h", buckets, count: buckets.length });
}

async function handleLatest(params) {
  const { property } = params;
  const alias = resolveAlias(property);
  if (!alias) return respond(400, { error: `Unknown property: ${property}` });

  const resp = await client.send(
    new GetAssetPropertyValueCommand({ propertyAlias: alias })
  );

  const entry = resp.propertyValue;
  if (!entry) return respond(200, { property, alias, value: null, timestamp: null });

  return respond(200, {
    property,
    alias,
    value: extractValue(entry),
    timestamp: extractTimestamp(entry),
    quality: entry.quality,
  });
}

async function handleBatch(params) {
  const { properties } = params;
  if (!properties) return respond(400, { error: "Missing 'properties' parameter (comma-separated)" });

  const propList = properties.split(",").map((p) => p.trim());
  const entries = [];

  for (let i = 0; i < propList.length; i++) {
    const alias = resolveAlias(propList[i]);
    if (!alias) continue;
    entries.push({ entryId: String(i), propertyAlias: alias });
  }

  if (entries.length === 0) return respond(400, { error: "No valid properties found" });

  const resp = await client.send(
    new BatchGetAssetPropertyValueCommand({ entries })
  );

  const results = {};
  for (const success of resp.successEntries ?? []) {
    const idx = Number(success.entryId);
    const entry = success.assetPropertyValue;
    results[propList[idx]] = {
      value: entry ? extractValue(entry) : null,
      timestamp: entry ? extractTimestamp(entry) : null,
      quality: entry?.quality,
    };
  }

  for (const err of resp.errorEntries ?? []) {
    const idx = Number(err.entryId);
    results[propList[idx]] = { error: err.errorMessage, value: null };
  }

  return respond(200, { results });
}

async function handleMetrics(params) {
  const { property } = params;
  const metricDefs = METRIC_MAP[property];
  if (!metricDefs) return respond(400, { error: `No metrics defined for property: ${property}` });

  const results = {};

  for (const [metricName, suffix] of Object.entries(metricDefs)) {
    const alias = `${PREFIX}${suffix}`;
    try {
      const resp = await client.send(
        new GetAssetPropertyValueCommand({ propertyAlias: alias })
      );
      const entry = resp.propertyValue;
      results[metricName] = {
        value: entry ? extractValue(entry) : null,
        timestamp: entry ? extractTimestamp(entry) : null,
      };
    } catch (err) {
      results[metricName] = { value: null, error: err.message };
    }
  }

  return respond(200, { property, metrics: results });
}

async function handleAlarms() {
  // Query current values for all analog sensors and compare against thresholds
  const ALARM_RULES = [
    { name: "voltage_high", property: "voltage", operator: "GT", threshold: 10, severity: 1, label: "Voltage High" },
    { name: "voltage_low", property: "voltage", operator: "LT", threshold: 2, severity: 1, label: "Voltage Low" },
    { name: "current_high", property: "current", operator: "GT", threshold: 8, severity: 2, label: "Current High" },
    { name: "pH_high", property: "pH", operator: "GT", threshold: 8, severity: 2, label: "pH High" },
    { name: "pH_low", property: "pH", operator: "LT", threshold: 6, severity: 2, label: "pH Low" },
    { name: "temperature_high", property: "temperature", operator: "GT", threshold: 80, severity: 1, label: "Temperature High" },
  ];

  // Batch fetch all analog sensor values
  const entries = ALARM_RULES
    .map((r) => r.property)
    .filter((v, i, a) => a.indexOf(v) === i) // unique
    .map((prop, i) => ({ entryId: String(i), propertyAlias: resolveAlias(prop) }))
    .filter((e) => e.propertyAlias);

  let currentValues = {};
  try {
    const resp = await client.send(new BatchGetAssetPropertyValueCommand({ entries }));
    const uniqueProps = [...new Set(ALARM_RULES.map((r) => r.property))];
    for (const success of resp.successEntries ?? []) {
      const idx = Number(success.entryId);
      const entry = success.assetPropertyValue;
      currentValues[uniqueProps[idx]] = {
        value: entry ? extractValue(entry) : null,
        timestamp: entry ? extractTimestamp(entry) : null,
      };
    }
  } catch (err) {
    return respond(500, { error: `Failed to fetch sensor values: ${err.message}` });
  }

  // Evaluate each alarm rule
  const alarms = ALARM_RULES.map((rule) => {
    const current = currentValues[rule.property];
    const value = current?.value;
    let state = "NORMAL";

    if (value != null) {
      if (rule.operator === "GT" && value > rule.threshold) state = "ACTIVE";
      if (rule.operator === "LT" && value < rule.threshold) state = "ACTIVE";
    }

    return {
      alarmId: rule.name,
      label: rule.label,
      property: rule.property,
      state,
      severity: rule.severity,
      threshold: { operator: rule.operator === "GT" ? ">" : "<", value: rule.threshold },
      currentValue: value,
      timestamp: current?.timestamp,
    };
  });

  const activeCount = alarms.filter((a) => a.state === "ACTIVE").length;

  return respond(200, { alarms, activeCount, total: alarms.length });
}

/* ── OEE handlers ───────────────────────────────────── */

async function handleOEE(params) {
  const now = new Date();
  const shiftId = params.shiftId || getCurrentShift(now);
  const { start, end, breakMinutes } = getShiftBounds(shiftId, now);
  const idealCycleTimeSec = params.idealCycleTimeSec
    ? Number(params.idealCycleTimeSec)
    : OEE_CONFIG.idealCycleTimeSec;

  // Clamp end to now if shift is still in progress
  const effectiveEnd = end > now ? now : end;
  start.setMilliseconds(0);
  effectiveEnd.setMilliseconds(0);

  // Fetch motor toggle count (run time proxy) and sensor toggle counts in parallel
  const [motorAgg, photoEAgg, metalAgg] = await Promise.all([
    client.send(new GetAssetPropertyAggregatesCommand({
      propertyAlias: `${PREFIX}/motor/toggle_count_1h`,
      startDate: start,
      endDate: effectiveEnd,
      resolution: "1h",
      aggregateTypes: ["SUM"],
      timeOrdering: "ASCENDING",
    })).catch(() => ({ aggregatedValues: [] })),
    client.send(new GetAssetPropertyAggregatesCommand({
      propertyAlias: `${PREFIX}/photoE_sensor/toggle_count_1h`,
      startDate: start,
      endDate: effectiveEnd,
      resolution: "1h",
      aggregateTypes: ["SUM"],
      timeOrdering: "ASCENDING",
    })).catch(() => ({ aggregatedValues: [] })),
    client.send(new GetAssetPropertyAggregatesCommand({
      propertyAlias: `${PREFIX}/metal_sensor/toggle_count_1h`,
      startDate: start,
      endDate: effectiveEnd,
      resolution: "1h",
      aggregateTypes: ["SUM"],
      timeOrdering: "ASCENDING",
    })).catch(() => ({ aggregatedValues: [] })),
  ]);

  // Sum up hourly buckets
  const sumBuckets = (agg) =>
    (agg.aggregatedValues ?? []).reduce((sum, entry) => sum + (entry.value?.sum?.value ?? 0), 0);

  const motorToggleCount = sumBuckets(motorAgg);
  const photoEToggles = sumBuckets(photoEAgg);
  const metalToggles = sumBuckets(metalAgg);

  // Derive OEE inputs
  const shiftDurationSec = (effectiveEnd - start) / 1000;
  const plannedDowntimeSec = breakMinutes * 60;
  const plannedProductionTimeSec = shiftDurationSec - plannedDowntimeSec;

  // Estimate run time from motor activity.
  // Each toggle pair = one on/off cycle. More toggles = more downtime events.
  // Base assumption: motor is mostly on; subtract estimated downtime per toggle pair.
  const motorDowntimeEvents = Math.floor(motorToggleCount / 2);
  const estimatedDowntimePerEvent = 120; // seconds per unplanned stop
  const unplannedStopSec = Math.min(motorDowntimeEvents * estimatedDowntimePerEvent, plannedProductionTimeSec * 0.5);
  const runTimeSec = Math.max(0, plannedProductionTimeSec - unplannedStopSec);

  // Cycles = toggle pairs (on+off = 1 cycle)
  const totalCycles = Math.floor(photoEToggles / 2);
  const rejectCycles = Math.floor(metalToggles / 2);
  const goodCycles = Math.max(0, totalCycles - rejectCycles);

  // Compute pillars (guard against division by zero)
  const availability = plannedProductionTimeSec > 0 ? runTimeSec / plannedProductionTimeSec : 0;
  const performance = runTimeSec > 0 ? (idealCycleTimeSec * totalCycles) / runTimeSec : 0;
  const quality = totalCycles > 0 ? goodCycles / totalCycles : 1;
  const oee = availability * performance * quality;

  const fmt = (v) => `${(Math.min(v, 1) * 100).toFixed(1)}%`;

  return respond(200, {
    machineId: "plc-1",
    timestamp: Date.now(),
    availability: { value: Math.min(availability, 1), percentage: fmt(availability) },
    performance: { value: Math.min(performance, 1), percentage: fmt(performance) },
    quality: { value: Math.min(quality, 1), percentage: fmt(quality) },
    oee: { value: Math.min(oee, 1), percentage: fmt(oee) },
    plannedProductionTimeSec,
    runTimeSec,
    plannedDowntimeSec,
    unplannedDowntimeSec: Math.max(0, plannedProductionTimeSec - runTimeSec),
    totalCycles,
    goodCycles,
    rejectCycles,
    idealCycleTimeSec,
    shiftId,
  });
}

async function handleOEETrend(params) {
  const timeRange = params.timeRange || "24h";
  const rangeMs = { "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 }[timeRange] ?? 86_400_000;
  const resolution = params.resolution || "1h";

  const now = new Date();
  const start = new Date(now.getTime() - rangeMs);
  start.setMilliseconds(0);
  now.setMilliseconds(0);

  // Fetch toggle counts over the range
  const [photoEAgg, metalAgg] = await Promise.all([
    client.send(new GetAssetPropertyAggregatesCommand({
      propertyAlias: `${PREFIX}/photoE_sensor/toggle_count_1h`,
      startDate: start,
      endDate: now,
      resolution,
      aggregateTypes: ["SUM"],
      timeOrdering: "ASCENDING",
    })).catch(() => ({ aggregatedValues: [] })),
    client.send(new GetAssetPropertyAggregatesCommand({
      propertyAlias: `${PREFIX}/metal_sensor/toggle_count_1h`,
      startDate: start,
      endDate: now,
      resolution,
      aggregateTypes: ["SUM"],
      timeOrdering: "ASCENDING",
    })).catch(() => ({ aggregatedValues: [] })),
  ]);

  const photoEBuckets = photoEAgg.aggregatedValues ?? [];
  const metalBuckets = metalAgg.aggregatedValues ?? [];

  const idealCycle = OEE_CONFIG.idealCycleTimeSec;
  const bucketDurationSec = resolution === "1h" ? 3600 : 28800;

  const points = photoEBuckets.map((entry, i) => {
    const ts = entry.timestamp?.getTime() ?? 0;
    const totalToggles = entry.value?.sum?.value ?? 0;
    const rejectToggles = metalBuckets[i]?.value?.sum?.value ?? 0;
    const totalCycles = Math.floor(totalToggles / 2);
    const rejectCycles = Math.floor(rejectToggles / 2);
    const goodCycles = Math.max(0, totalCycles - rejectCycles);

    const a = 0.9; // Approximate availability per bucket
    const runTime = bucketDurationSec * a;
    const p = runTime > 0 ? Math.min((idealCycle * totalCycles) / runTime, 1) : 0;
    const q = totalCycles > 0 ? goodCycles / totalCycles : 1;
    const oee = a * p * q;

    return {
      timestamp: ts,
      oee: Math.round(oee * 1000) / 1000,
      availability: Math.round(a * 1000) / 1000,
      performance: Math.round(p * 1000) / 1000,
      quality: Math.round(q * 1000) / 1000,
    };
  });

  return respond(200, { timeRange, resolution, points, count: points.length });
}

/* ── Main handler ────────────────────────────────────── */

export async function handler(event) {
  // Support both API Gateway REST (event.queryStringParameters)
  // and direct invocation (event as params)
  if (event.httpMethod === "OPTIONS") {
    return respond(200, {});
  }

  try {
    const params = {
      ...(event.queryStringParameters ?? {}),
      ...(event.body ? JSON.parse(event.body) : {}),
    };

    const action = params.action;

    switch (action) {
      case "history":
        return await handleHistory(params);
      case "aggregates":
        return await handleAggregates(params);
      case "latest":
        return await handleLatest(params);
      case "batch":
        return await handleBatch(params);
      case "metrics":
        return await handleMetrics(params);
      case "alarms":
        return await handleAlarms();
      case "oee":
        return await handleOEE(params);
      case "oee-trend":
        return await handleOEETrend(params);
      default:
        return respond(400, {
          error: `Unknown action: ${action}`,
          validActions: ["history", "aggregates", "latest", "batch", "metrics", "alarms", "oee", "oee-trend"],
        });
    }
  } catch (err) {
    console.error("SiteWise query error:", err);
    return respond(500, { error: err.message });
  }
}
