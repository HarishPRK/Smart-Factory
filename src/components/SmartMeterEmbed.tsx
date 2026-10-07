/** Use the entry document explicitly; Vite treats the directory URL as an SPA route. */
export default function SmartMeterEmbed() {
  return <iframe
    title="Aituzero Form 2S smart meter"
    src="/widgets/aituzero-meter/index.html"
    loading="lazy"
    style={{ width: "100%", height: "100%", border: 0, background: "#f1f4f5" }}
  />;
}
