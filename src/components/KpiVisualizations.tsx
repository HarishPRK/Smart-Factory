import type { ReactNode } from "react";

/** The mock series has no timestamps or physical units. Its scale stays explicit. */
export const MetricSeries = ({
  data,
  kind,
}: {
  data: number[];
  kind: string;
}) => {
  if (data.length < 2) return null;

  const width = 200;
  const top = 5;
  const bottom = 43;
  const minimum = Math.min(...data);
  const maximum = Math.max(...data);
  const domainMinimum = kind === "energy" ? 0 : minimum;
  const span = maximum - domainMinimum || 1;
  const point = (value: number, index: number) => ({
    x: 5 + index * ((width - 10) / (data.length - 1)),
    y: bottom - ((value - domainMinimum) / span) * (bottom - top),
  });
  const points = data.map(point);
  const line = points.map(({ x, y }, index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
  const lastPoint = points[points.length - 1];

  return (
    <span className={`metric-series metric-series--${kind}`}>
      <svg className="metric-series__plot" viewBox={`0 0 ${width} 48`} preserveAspectRatio="none">
        <path className="metric-series__grid" d="M0 5H200M0 24H200M0 43H200" />
        {kind === "energy" ? (
          data.map((value, index) => {
            const barWidth = width / data.length - 6;
            const height = ((value - domainMinimum) / span) * (bottom - top);
            return <rect key={index} className={`metric-series__bar${index === data.length - 1 ? " is-latest" : ""}`} data-sample-value={value} x={index * (width / data.length) + 3} y={bottom - height} width={barWidth} height={height} rx="2" />;
          })
        ) : (
          <>
            {kind === "water" && <path className="metric-series__area" d={`${line} L${lastPoint.x},${bottom} L${points[0].x},${bottom} Z`} />}
            {kind === "noise" && points.map(({ x, y }, index) => <path key={index} className="metric-series__stem" d={`M${x} ${bottom}V${y}`} />)}
            <path className="metric-series__line" d={line} />
            {points.map(({ x, y }, index) => <circle key={index} className={index === data.length - 1 ? "metric-series__endpoint" : "metric-series__point"} data-sample-value={data[index]} cx={x} cy={y} r={index === data.length - 1 ? 2.6 : 1.6} />)}
          </>
        )}
      </svg>
      <span className="metric-series__caption">
        <span>Sample index</span>
        <span>{minimum}–{maximum}</span>
      </span>
    </span>
  );
};

export const OeeMeter = ({ value }: { value: string }) => {
  const percentage = Math.min(100, Math.max(0, Number.parseFloat(value)));

  return (
    <span className="oee-meter">
      <span className="oee-meter__track">
        {Array.from({ length: 25 }, (_, index) => (
          <span className="oee-meter__segment" key={index}>
            <span style={{ width: `${Math.min(100, Math.max(0, (percentage - index * 4) * 25))}%` }} />
          </span>
        ))}
      </span>
      <span className="oee-meter__scale"><span>0</span><span>50</span><span>100%</span></span>
    </span>
  );
};

const Node = ({ x, y, label, wide = false }: { x: number; y: number; label: string; wide?: boolean }) => (
  <g>
    <rect className="workspace-diagram__node" x={x} y={y} width={wide ? 34 : 26} height="18" rx="3" />
    <text x={x + (wide ? 17 : 13)} y={y + 12}>{label}</text>
  </g>
);

/** Schematics describe destinations; they never imply a connection or live traffic. */
export const WorkspaceDiagram = ({ kind }: { kind: string }) => {
  let diagram: ReactNode;
  switch (kind) {
    case "offerings":
      diagram = <><path d="M28 22H39M73 22H84M56 31V42" /><Node x={2} y={13} label="OT" /><Node x={39} y={13} label="EDGE" wide /><Node x={84} y={13} label="IT" /><path className="workspace-diagram__soft" d="M16 39H42M70 39H96" /></>;
      break;
    case "eagle":
      diagram = <><path d="M17 9H30V22H40M17 35H30V22M66 22H75" /><circle className="workspace-diagram__node" cx="10" cy="9" r="6" /><circle className="workspace-diagram__node" cx="10" cy="35" r="6" /><Node x={40} y={13} label="AI" /><path className="workspace-diagram__signal" d="M75 22H81L86 11 94 33 100 22H110" /></>;
      break;
    case "analytics":
      diagram = <><path className="workspace-diagram__soft" d="M4 4V40H110M4 22H110M40 4V40M76 4V40" /><path className="workspace-diagram__signal" d="M5 34 20 29 34 32 50 17 64 23 80 10 95 14 109 5" /><path className="workspace-diagram__secondary" d="M5 18 20 23 34 20 50 30 64 27 80 34 95 28 109 30" /></>;
      break;
    case "predict":
      diagram = <><path className="workspace-diagram__soft" d="M4 40H110M69 3V40" /><path className="workspace-diagram__signal" d="M4 33 15 28 26 31 37 23 48 26 59 18 69 22" /><path className="workspace-diagram__forecast" d="M69 22 82 16 95 10 110 4" /><path className="workspace-diagram__soft" d="M69 22 110 1M69 22 110 21" /></>;
      break;
    case "dps":
    case "routing":
      diagram = <><path className="workspace-diagram__soft" d="M19 22H30V5H82V22H93" /><path d={kind === "dps" ? "M19 22H30V36H82V22H93" : "M19 22H93"} /><circle className="workspace-diagram__node" cx="11" cy="22" r="7" /><circle className="workspace-diagram__node" cx="101" cy="22" r="7" /><path d="m86 18 5 4-5 4" /><Node x={39} y={kind === "dps" ? 27 : 13} label={kind === "dps" ? "PATH" : "APP"} wide={kind === "dps"} /></>;
      break;
    case "it-devices":
    case "ot-devices":
      diagram = <><path d="M17 29V36H95V29M56 36V42" />{[5, 44, 83].map((x, index) => <g key={x}><rect className="workspace-diagram__node" x={x} y="12" width="24" height="16" rx={kind === "it-devices" ? 2 : 1} />{kind === "it-devices" ? <path d={`M${x + 5} 31H${x + 19}M${x + 12} 28V31`} /> : <><path d={`M${x + 4} 17H${x + 20}M${x + 4} 22H${x + 14}`} /><circle className="workspace-diagram__port" cx={x + 20} cy="23" r="1.4" /></>}<text x={x + 12} y="8">{kind === "it-devices" ? ["PC", "LAN", "SRV"][index] : ["PLC", "I/O", "DRV"][index]}</text></g>)}</>;
      break;
    case "onboarding":
      diagram = <><Node x={2} y={13} label="NEW" /><path className="workspace-diagram__forecast" d="M28 22H41" /><Node x={41} y={13} label="EDGE" wide /><path d="M75 22H90" /><circle className="workspace-diagram__node" cx="101" cy="22" r="9" /><path d="M96 22H106M101 17V27" /></>;
      break;
    case "gateway":
      diagram = <><rect className="workspace-diagram__node" x="33" y="5" width="46" height="34" rx="4" /><path d="M41 13H69M41 20H59M17 13H33M17 31H33M79 13H95M79 31H95" />{[42, 50, 58, 66].map(x => <rect className="workspace-diagram__port" key={x} x={x} y="27" width="5" height="6" rx="1" />)}<path className="workspace-diagram__soft" d="M4 7H17V37H4M108 7H95V37H108" /></>;
      break;
    case "video":
      diagram = <><rect className="workspace-diagram__node" x="6" y="4" width="100" height="36" rx="3" /><path className="workspace-diagram__soft" d="M6 32H106M23 4V32M89 4V32" /><path d="M35 15V10H44M68 10H77V15M77 23V28H68M44 28H35V23" /><rect className="workspace-diagram__secondary" x="47" y="14" width="18" height="10" rx="1" /></>;
      break;
    case "langgraph":
      diagram = <><path d="M28 22H39M73 22H84M56 13V3H97V13M56 31V41H15V31" /><Node x={2} y={13} label="ASK" /><Node x={39} y={13} label="AGENT" wide /><Node x={84} y={13} label="TOOL" /></>;
      break;
    default:
      diagram = null;
  }

  return <svg className="workspace-diagram" viewBox="0 0 112 46" aria-hidden="true">{diagram}</svg>;
};
