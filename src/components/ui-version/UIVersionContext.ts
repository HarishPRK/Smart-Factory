import { createContext, useContext } from "react";

export type UIVersion = "new" | "classic";
export const UI_VERSION_STORAGE_KEY = "smart-factory.ui-version";
export const UIVersionContext = createContext<{
  version: UIVersion;
  setVersion: (version: UIVersion) => void;
} | null>(null);

export function useUIVersion() {
  const context = useContext(UIVersionContext);
  if (!context) throw new Error("useUIVersion must be used inside UIVersionProvider");
  return context;
}
