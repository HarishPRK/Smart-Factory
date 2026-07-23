/* Temporary probe: record the esp32 UNS stream from two bridge endpoints at
 * once and report per-stream stats for the MQ gas keys — arrival order,
 * timestamp regressions (out-of-order delivery), duplicates, and value
 * ranges. Delete after use. */
import WebSocket from "ws";

const ENDPOINTS = {
  local: "ws://localhost:9001",
  ec2: "ws://ec2-3-239-12-96.compute-1.amazonaws.com/ws",
};
const TOPIC = "prplHome/McKinney/lineA/plc1/data/esp32";
const KEYS = ["boardB_esp32_voc", "boardB_esp32_co", "boardB_esp32_no2", "boardB_esp32_alcohol"];
const DURATION_MS = 45_000;

const streams = {};

for (const [name, url] of Object.entries(ENDPOINTS)) {
  const rec = { frames: [], errors: 0 };
  streams[name] = rec;
  const ws = new WebSocket(url);
  ws.on("open", () => console.log(`[${name}] connected`));
  ws.on("error", (e) => { console.error(`[${name}] ${e.message}`); rec.errors++; });
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.topic !== TOPIC) return;
      rec.frames.push({
        at: Date.now(),
        publishedAt: msg.publishedAt,
        bridgeTs: msg.payload?._bridgeTs,
        values: Object.fromEntries(KEYS.map((k) => [k, msg.payload?.[k]])),
        keys: Object.keys(msg.payload ?? {}).length,
      });
    } catch { /* ignore */ }
  });
}

setTimeout(() => {
  for (const [name, rec] of Object.entries(streams)) {
    const f = rec.frames;
    console.log(`\n═══ ${name} — ${f.length} esp32 frames in ${DURATION_MS / 1000}s ═══`);
    if (!f.length) continue;

    // timestamp source and regressions
    const hasBridgeTs = f.filter((x) => x.bridgeTs !== undefined).length;
    console.log(`_bridgeTs present: ${hasBridgeTs}/${f.length}`);
    for (const tsKey of ["publishedAt", "bridgeTs"]) {
      const ts = f.map((x) => x[tsKey]).filter((v) => v !== undefined);
      if (ts.length < 2) continue;
      let regressions = 0, dupes = 0, maxBack = 0;
      for (let i = 1; i < ts.length; i++) {
        if (ts[i] < ts[i - 1]) { regressions++; maxBack = Math.max(maxBack, ts[i - 1] - ts[i]); }
        if (ts[i] === ts[i - 1]) dupes++;
      }
      console.log(`${tsKey}: ${regressions} regressions (max ${maxBack}ms back), ${dupes} equal-ts pairs`);
    }

    // inter-arrival jitter
    const gaps = f.slice(1).map((x, i) => x.at - f[i].at);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    console.log(`arrival gap: mean ${mean.toFixed(0)}ms, min ${Math.min(...gaps)}ms, max ${Math.max(...gaps)}ms`);

    // per-key: value range + how often consecutive frames "jump back"
    for (const k of KEYS) {
      const vals = f.map((x) => x.values[k]).filter((v) => typeof v === "number");
      if (!vals.length) { console.log(`${k}: no data`); continue; }
      let dirChanges = 0;
      for (let i = 2; i < vals.length; i++) {
        const d1 = vals[i - 1] - vals[i - 2], d2 = vals[i] - vals[i - 1];
        if (d1 !== 0 && d2 !== 0 && Math.sign(d1) !== Math.sign(d2)) dirChanges++;
      }
      const min = Math.min(...vals), max = Math.max(...vals);
      console.log(`${k}: n=${vals.length} range=[${min}, ${max}] direction-changes=${dirChanges} seq=${vals.slice(0, 20).join(",")}`);
    }
  }
  process.exit(0);
}, DURATION_MS);
