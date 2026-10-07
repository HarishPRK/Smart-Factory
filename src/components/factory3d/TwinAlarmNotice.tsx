import { AlertTriangle, ArrowUpRight, ShieldAlert } from "lucide-react";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { STAGE_NAMES } from "./twinPresentation";
import type { TwinAlarmSummary } from "./twinAlarmState";

const SOURCES = { live: "Live PLC", sim: "Model", mixed: "Mixed input", unknown: "Equipment state" } as const;

export default function TwinAlarmNotice({ alarm }: { alarm: TwinAlarmSummary }) {
  const select = useSceneSelectionStore((s) => s.select);
  if (alarm.severity === "normal") return null;
  const cause = alarm.reasons.find((reason) => reason.stopRequired) ?? alarm.reasons[0];
  const station = cause?.stageId;
  const source = alarm.lineStopped && cause?.source === "unknown" ? "unknown" : alarm.source;
  const heading = alarm.lineStopped ? "Twin line stopped" : alarm.speedLimit < 1 ? "Process slowed" : alarm.severity === "critical" ? "Critical reading" : "Attention required";
  return <section className="twin-alarm-notice" data-severity={alarm.severity} aria-label="Twin threshold response">
    <div className="twin-alarm-notice__signal" aria-hidden="true">{alarm.lineStopped ? <ShieldAlert size={21} /> : <AlertTriangle size={21} />}</div>
    <div className="twin-alarm-notice__copy">
      <div className="twin-alarm-notice__heading" role="status" aria-live="polite" aria-atomic="true"><strong>{heading}</strong><span>{SOURCES[source]}</span></div>
      <p>{station && <b>{STAGE_NAMES[station]} · </b>}{cause?.description ?? "Equipment needs attention"}</p>
      {alarm.lineStopped && <small>Visual interlock · resumes when the fault clears</small>}
    </div>
    {station && <button type="button" onClick={() => select(station)} aria-label={`Inspect ${STAGE_NAMES[station]} alarm`} title={`Inspect ${STAGE_NAMES[station]}`}><ArrowUpRight size={18} /></button>}
  </section>;
}
