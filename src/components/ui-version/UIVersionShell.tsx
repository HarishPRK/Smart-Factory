import { Component, Suspense, lazy, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useUIVersion } from "./UIVersionContext";
import UIVersionSwitch from "./UIVersionSwitch";
import newTheme from "./new-theme.css?inline";
import classicTheme from "../../legacy/legacy-theme.css?inline";

const NewDashboard = lazy(() => import("../Dashboard"));
const ClassicDashboard = lazy(() => import("../../legacy/components/Dashboard"));

function LoadingInterface() {
  return <div className="ui-version-fallback"><UIVersionSwitch /><p role="status">Opening your factory workspace…</p></div>;
}

class InterfaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="ui-version-fallback"><UIVersionSwitch /><p role="alert">This interface could not load. Switch interfaces or refresh to retry.</p><button type="button" onClick={() => window.location.reload()}>Refresh</button></div>;
    return this.props.children;
  }
}

/** Presentation alone is replaced; App keeps the live provider mounted. */
export default function UIVersionShell() {
  const { version } = useUIVersion();
  useLayoutEffect(() => {
    document.documentElement.dataset.uiVersion = version;
    document.body.style.removeProperty("cursor");
    return () => { delete document.documentElement.dataset.uiVersion; };
  }, [version]);
  return <>
    {createPortal(<style data-ui-theme={version}>{version === "new" ? newTheme : classicTheme}</style>, document.head)}
    <InterfaceBoundary key={version}>
      <Suspense fallback={<LoadingInterface />}>
        {version === "new" ? <NewDashboard headerSlot={<UIVersionSwitch />} /> : <ClassicDashboard headerSlot={<UIVersionSwitch />} />}
      </Suspense>
    </InterfaceBoundary>
  </>;
}
