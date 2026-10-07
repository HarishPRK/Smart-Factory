import type { StageId } from "../../types/digitalTwin";

export const STAGE_NAMES: Record<StageId, string> = {
  intake: "Material intake", mixing: "Filling", forming: "Blow molding",
  curing: "Cooling", quality: "Inspection", packaging: "Packaging", dispatch: "Dispatch",
};

export const TWIN_STATUS_COLORS: Record<string, string> = {
  running: "#68d5b5", idle: "#9ba9b6", warning: "#efbc68", faulted: "#f17d81", blocked: "#efbc68",
};
