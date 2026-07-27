export type WorkspaceVisualizationKind =
  | "analytics"
  | "predict"
  | "twin"
  | "dps"
  | "routing"
  | "it-devices"
  | "ot-devices"
  | "gateway"
  | "video";

const AnalyticsVisualization = () => (
  <>
    <path className="kpi-viz__base" d="M8 39H152" />
    <rect className="kpi-viz__fill" x="13" y="27" width="13" height="12" rx="2" />
    <rect className="kpi-viz__fill" x="36" y="21" width="13" height="18" rx="2" />
    <rect className="kpi-viz__fill" x="59" y="25" width="13" height="14" rx="2" />
    <rect className="kpi-viz__fill" x="82" y="14" width="13" height="25" rx="2" />
    <rect className="kpi-viz__solid" x="105" y="8" width="13" height="31" rx="2" />
    <path
      className="kpi-viz__active"
      d="m13 29 29-8 23 5 24-14 22 4 38-10"
    />
    <circle className="kpi-viz__node" cx="149" cy="6" r="2.8" />
  </>
);

const PredictVisualization = () => (
  <>
    <path
      className="kpi-viz__fill"
      d="M82 17c18-8 40-8 70-12v23c-27-8-49-5-70 1Z"
    />
    <path
      className="kpi-viz__active"
      d="M8 35c13-1 18-9 29-8s15 7 25 3 12-11 20-13"
    />
    <path
      className="kpi-viz__active kpi-viz__flow"
      d="M82 17c19-1 34-6 47-4 9 1 15-3 23-8"
    />
    <path className="kpi-viz__base" d="M82 6v34" />
    <circle className="kpi-viz__node" cx="82" cy="17" r="3" />
    <circle className="kpi-viz__solid" cx="152" cy="5" r="2.3" />
  </>
);

const TwinVisualization = () => (
  <>
    <g className="kpi-viz__soft">
      <path d="m16 13 20-8 20 8-20 8Z" />
      <path d="M16 13v20l20 8 20-8V13M36 21v20" />
    </g>
    <g className="kpi-viz__active">
      <path d="m104 13 20-8 20 8-20 8Z" />
      <path d="M104 13v20l20 8 20-8V13M124 21v20" />
    </g>
    <path className="kpi-viz__base" d="M58 16h39M102 30H63" />
    <path className="kpi-viz__active kpi-viz__flow" d="M61 16h36M99 30H64" />
    <path className="kpi-viz__solid" d="m96 13 5 3-5 3ZM65 27l-5 3 5 3Z" />
  </>
);

const DpsVisualization = () => (
  <>
    <circle className="kpi-viz__node" cx="13" cy="23" r="5" />
    <circle className="kpi-viz__node" cx="147" cy="23" r="5" />
    <path className="kpi-viz__base" d="M18 23c30 0 31 15 62 15s34-15 62-15" />
    <path className="kpi-viz__soft" d="M18 23C45 23 49 8 80 8s34 15 62 15" />
    <path
      className="kpi-viz__soft kpi-viz__flow"
      d="M18 23c30 0 31 15 62 15s34-15 62-15"
    />
    <path className="kpi-viz__fill" d="m80 3 6 5-6 5-6-5Z" />
    <circle className="kpi-viz__solid" cx="80" cy="8" r="2.4" />
  </>
);

const RoutingVisualization = () => (
  <>
    <circle className="kpi-viz__node" cx="12" cy="9" r="3.5" />
    <circle className="kpi-viz__node" cx="12" cy="23" r="3.5" />
    <circle className="kpi-viz__node" cx="12" cy="37" r="3.5" />
    <rect className="kpi-viz__fill" x="68" y="8" width="24" height="30" rx="6" />
    <path className="kpi-viz__soft" d="M16 9c25 0 30 8 52 8M16 23h52M16 37c25 0 30-8 52-8" />
    <path className="kpi-viz__active" d="M92 17c21 0 24-8 51-8M92 29c21 0 24 8 51 8" />
    <path className="kpi-viz__active kpi-viz__flow" d="M16 23h52M92 17c21 0 24-8 51-8" />
    <rect className="kpi-viz__node" x="143" y="5" width="9" height="8" rx="2" />
    <rect className="kpi-viz__node" x="143" y="33" width="9" height="8" rx="2" />
    <circle className="kpi-viz__solid" cx="80" cy="16" r="2" />
    <circle className="kpi-viz__solid" cx="80" cy="23" r="2" />
    <circle className="kpi-viz__solid" cx="80" cy="30" r="2" />
  </>
);

const DeviceFleetVisualization = ({ domain }: { domain: "IT" | "OT" }) => (
  <>
    <rect className="kpi-viz__soft" x="8" y="6" width="144" height="34" rx="6" />
    <rect className="kpi-viz__fill" x="65" y="10" width="30" height="25" rx="5" />
    <path className="kpi-viz__base" d="M20 14h28M20 23h28M20 32h28M112 14h28M112 23h28M112 32h28" />
    <path className="kpi-viz__active kpi-viz__flow" d="M48 14h17M95 14h17M48 23h17M95 23h17M48 32h17M95 32h17" />
    {domain === "IT" ? (
      <>
        <rect className="kpi-viz__node" x="15" y="10" width="7" height="7" rx="1.5" />
        <rect className="kpi-viz__node" x="15" y="19" width="7" height="7" rx="1.5" />
        <rect className="kpi-viz__node" x="15" y="28" width="7" height="7" rx="1.5" />
        <circle className="kpi-viz__solid" cx="136" cy="14" r="2.2" />
      </>
    ) : (
      <>
        <circle className="kpi-viz__node" cx="19" cy="14" r="3.5" />
        <circle className="kpi-viz__node" cx="19" cy="23" r="3.5" />
        <circle className="kpi-viz__node" cx="19" cy="32" r="3.5" />
        <path className="kpi-viz__solid" d="M132 11h8v7h-8zM134 25h4v10h-4z" />
      </>
    )}
    <circle className="kpi-viz__solid" cx="80" cy="22" r="2.2" />
  </>
);

const GatewayVisualization = () => (
  <>
    <rect className="kpi-viz__soft" x="12" y="7" width="34" height="32" rx="5" />
    <rect className="kpi-viz__active" x="114" y="7" width="34" height="32" rx="5" />
    <path className="kpi-viz__base" d="M19 17h20M19 27h20M121 17h20M121 27h20" />
    <circle className="kpi-viz__solid" cx="21" cy="17" r="1.8" />
    <circle className="kpi-viz__solid" cx="21" cy="27" r="1.8" />
    <circle className="kpi-viz__solid" cx="123" cy="17" r="1.8" />
    <circle className="kpi-viz__solid" cx="123" cy="27" r="1.8" />
    <path className="kpi-viz__active kpi-viz__flow" d="M51 16h54M109 30H55" />
    <path className="kpi-viz__solid" d="m104 13 5 3-5 3ZM56 27l-5 3 5 3Z" />
  </>
);

const VideoVisualization = () => (
  <>
    <rect className="kpi-viz__soft" x="8" y="5" width="144" height="36" rx="6" />
    <path className="kpi-viz__base" d="M20 15v-5h9M140 15v-5h-9M20 31v5h9M140 31v5h-9" />
    <rect className="kpi-viz__fill" x="37" y="13" width="29" height="19" rx="3" />
    <rect className="kpi-viz__active" x="92" y="10" width="24" height="24" rx="3" />
    <path className="kpi-viz__active" d="M37 18h5v-5M61 13v5h5M37 27h5v5M61 32v-5h5" />
    <path className="kpi-viz__active" d="M92 15h5v-5M111 10v5h5M92 29h5v5M111 34v-5h5" />
    <path className="kpi-viz__active kpi-viz__scan" d="M78 8v30" />
    <circle className="kpi-viz__solid" cx="143" cy="13" r="2.2" />
  </>
);

const WorkspaceVisualization = ({
  kind,
}: {
  kind: WorkspaceVisualizationKind;
}) => {
  let content;

  switch (kind) {
    case "analytics":
      content = <AnalyticsVisualization />;
      break;
    case "predict":
      content = <PredictVisualization />;
      break;
    case "twin":
      content = <TwinVisualization />;
      break;
    case "dps":
      content = <DpsVisualization />;
      break;
    case "routing":
      content = <RoutingVisualization />;
      break;
    case "it-devices":
      content = <DeviceFleetVisualization domain="IT" />;
      break;
    case "ot-devices":
      content = <DeviceFleetVisualization domain="OT" />;
      break;
    case "gateway":
      content = <GatewayVisualization />;
      break;
    case "video":
      content = <VideoVisualization />;
      break;
  }

  return (
    <svg
      className={`kpi-workspace-viz kpi-workspace-viz--${kind}`}
      focusable="false"
      viewBox="0 0 160 46"
    >
      {content}
    </svg>
  );
};

export default WorkspaceVisualization;
