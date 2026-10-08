export function subscribeAnyMessage(listener: (topic: string, payload: unknown) => void) {
  const samples: [string, unknown][] = [
    ['meter/data', { voltage: 230.1, current: 1.4, power: 321.9 }],
    ['prplHome/McKinney/lineA/plc1/data/boardA', { voltage: 4.31, counter: 0, relay_motor: false }],
    ['prplHome/McKinney/lineA/plc1/data/boardB', { pressure: 53.1, lidar_distance_cm: 12, fire: 65 }],
    ['prplHome/McKinney/lineA/plc1/data/esp32', { temperature: 24.6, humidity: 42, fingerprint: 0 }],
    ['prplHome/McKinney/lineA/plc1/data/system_metrics', { uptime_seconds: 12400, memory_percent: 37 }],
  ];
  const first = setTimeout(() => samples.forEach(([topic, payload]) => listener(topic, payload)), 30);
  const tick = setInterval(() => samples.forEach(([topic, payload]) => listener(topic, payload)), 2000);
  return () => { clearTimeout(first); clearInterval(tick); };
}
