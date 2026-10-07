import type { ReactNode } from "react";

/** Destination symbols, not telemetry: no fabricated counts, activity, or trend values. */
export default function WorkspacePreview({ kind }: { kind: string }) {
  let drawing: ReactNode;
  switch (kind) {
    case "offerings":
      drawing = <><path d="M22 14H43M69 14H90" /><rect x="3" y="7" width="19" height="14" rx="3" /><rect x="43" y="3" width="26" height="22" rx="4" /><rect x="90" y="7" width="19" height="14" rx="3" /><path className="workspace-preview__muted" d="M49 10H63M49 15H59M49 20H63" /></>;
      break;
    case "eagle":
      drawing = <><path d="M15 5H30L43 14M15 23H30L43 14M67 14H78L83 5 92 23 98 14H110" /><circle cx="9" cy="5" r="4" /><circle cx="9" cy="23" r="4" /><rect x="43" y="6" width="24" height="16" rx="5" /><path className="workspace-preview__muted" d="M50 11H60M50 17H60" /></>;
      break;
    case "analytics":
      drawing = <><path className="workspace-preview__muted" d="M3 25H110M3 3V25" /><path d="M8 20V15M22 20V10M36 20V13M50 20V5" /><path d="M63 20 74 15 83 17 97 7 109 4" /><circle className="workspace-preview__fill" cx="109" cy="4" r="2" /></>;
      break;
    case "predict":
      drawing = <><path d="M3 22 17 15 30 18 44 9 58 12 71 8" /><path className="workspace-preview__muted" d="M71 3V26M71 8 110 2M71 8 110 20" /><path strokeDasharray="3 4" d="M71 8 110 10" /></>;
      break;
    case "dps":
      drawing = <><circle cx="9" cy="14" r="5" /><circle cx="103" cy="14" r="5" /><path className="workspace-preview__muted" d="M14 14H30V4H80V14H98" /><path d="M14 14H30V24H80V14H98M88 10 93 14 88 18" /><circle className="workspace-preview__fill" cx="54" cy="24" r="2" /></>;
      break;
    case "routing":
      drawing = <><rect x="2" y="7" width="21" height="14" rx="3" /><rect x="48" y="7" width="21" height="14" rx="3" /><path d="M23 14H48M69 14H81V4H109M81 14H109M81 14V24H109" /><path className="workspace-preview__muted" d="M8 12H17M54 12H63" /></>;
      break;
    case "it-devices":
      drawing = <><path className="workspace-preview__muted" d="M20 18V25H91V18M56 25V18" />{[7, 43, 79].map(x => <g key={x}><rect x={x} y="2" width="25" height="15" rx="2" /><path d={`M${x + 12} 17V21M${x + 7} 21H${x + 17}`} /></g>)}</>;
      break;
    case "ot-devices":
      drawing = <>{[4, 43, 82].map(x => <g key={x}><rect x={x} y="4" width="26" height="19" rx="2" /><path d={`M${x + 5} 10H${x + 21}M${x + 5} 16H${x + 12}`} /><circle className="workspace-preview__fill" cx={x + 21} cy="17" r="1.2" /></g>)}<path className="workspace-preview__muted" d="M30 14H43M69 14H82" /></>;
      break;
    case "onboarding":
      drawing = <><rect x="3" y="6" width="24" height="16" rx="3" /><path strokeDasharray="3 4" d="M31 14H53" /><rect x="56" y="3" width="26" height="22" rx="4" /><path d="M62 9H75M62 15H71M93 14H109M101 6V22" /></>;
      break;
    case "gateway":
      drawing = <><rect x="34" y="3" width="45" height="22" rx="4" /><path d="M42 9H69M11 7H23V14H34M11 21H23M79 14H91V7H106M91 21H106" />{[43,51,59,67].map(x=><rect className="workspace-preview__fill" key={x} x={x} y="17" width="3" height="3" rx=".5" />)}</>;
      break;
    case "langgraph":
      drawing = <><path d="M15 14H44M68 14H96M56 6V2H101V10M56 22V26H10V18" /><circle cx="10" cy="14" r="4" /><rect x="44" y="6" width="24" height="16" rx="5" /><circle cx="101" cy="14" r="4" /><path className="workspace-preview__muted" d="m50 14 4 3 8-6" /></>;
      break;
    case "video":
      drawing = <><rect x="3" y="3" width="48" height="22" rx="3" /><path className="workspace-preview__fill" d="m23 8 9 6-9 6Z" /><path d="M70 10V4H81M98 4H109V10M109 18V24H98M81 24H70V18" /><rect className="workspace-preview__muted" x="81" y="9" width="17" height="10" rx="2" /></>;
      break;
    default: drawing = null;
  }
  return <svg className="workspace-preview" viewBox="0 0 112 28" aria-hidden="true">{drawing}</svg>;
}
