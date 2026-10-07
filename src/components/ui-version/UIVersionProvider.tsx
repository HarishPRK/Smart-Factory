import { useCallback, useEffect, useState, type ReactNode } from "react";
import { UIVersionContext, UI_VERSION_STORAGE_KEY, type UIVersion } from "./UIVersionContext";

function isUIVersion(value: unknown): value is UIVersion {
  return value === "new" || value === "classic";
}

function readPreference(): UIVersion {
  const query = new URLSearchParams(window.location.search).get("ui");
  if (isUIVersion(query)) return query;
  try {
    const stored = window.localStorage.getItem(UI_VERSION_STORAGE_KEY);
    if (isUIVersion(stored)) return stored;
  } catch {
    // A blocked storage policy must not prevent viewing the dashboard.
  }
  return "new";
}

export function UIVersionProvider({ children }: { children: ReactNode }) {
  const [version, updateVersion] = useState<UIVersion>(readPreference);
  const setVersion = useCallback((next: UIVersion) => {
    updateVersion(next);
    try { window.localStorage.setItem(UI_VERSION_STORAGE_KEY, next); } catch { /* Session-only preference. */ }
    const url = new URL(window.location.href);
    url.searchParams.set("ui", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    const onNavigate = () => updateVersion(readPreference());
    window.addEventListener("popstate", onNavigate);
    return () => window.removeEventListener("popstate", onNavigate);
  }, []);

  return <UIVersionContext.Provider value={{ version, setVersion }}>{children}</UIVersionContext.Provider>;
}
