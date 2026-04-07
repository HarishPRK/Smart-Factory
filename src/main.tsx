import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./globalTheme.css";
import App from "./App.tsx";

// Suppress THREE.js deprecation warnings from React Three Fiber internals.
// R3F v9 still uses THREE.Clock and PCFSoftShadowMap internally;
// these are harmless and will resolve when R3F updates to Three.js r184+.
const _origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : "";
  if (msg.includes("THREE.Clock") || msg.includes("PCFSoftShadowMap")) return;
  _origWarn.apply(console, args);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
