import { useUIVersion } from "./UIVersionContext";
import "./ui-version-switch.css";

export default function UIVersionSwitch() {
  const { version, setVersion } = useUIVersion();
  return (
    <div className="ui-version-switch" role="group" aria-label="Interface version">
      <button type="button" aria-pressed={version === "new"} onClick={() => setVersion("new")}>New UI</button>
      <button type="button" aria-pressed={version === "classic"} onClick={() => setVersion("classic")}>Classic UI</button>
    </div>
  );
}
