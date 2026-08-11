import { readFileSync } from "node:fs";

import {
  sensorBindingsSchema,
  type SensorBinding,
} from "../../../packages/agentic-store-contracts/src/index.js";

/**
 * Loads deployment-specific PLC/gateway mappings without coupling the domain
 * model to a transport or vendor. The JSON file is validated at startup so a
 * bad tag-to-twin mapping fails fast rather than silently corrupting the twin.
 */
export function loadSensorBindingsFile(path: string | undefined): SensorBinding[] {
  if (!path) return [];
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse sensor bindings at ${path}.`, { cause: error });
  }
  return sensorBindingsSchema.parse(parsed);
}
