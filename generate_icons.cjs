const fs = require('fs');
const path = require('path');

const icons = {
  "worker.svg": "W",
  "energy_bolt.svg": "E",
  "noise_ear.svg": "N",
  "emission_cloud.svg": "CO2",
  "weather_partly_cloudy.svg": "Sun",
  "water_drop.svg": "H2O",
  "machine_gear.svg": "Gear",
  "ai_mic.svg": "Mic",
  "ai_wave.svg": "Wave",
  "alert_warning.svg": "!"
};

const iconDir = path.join(__dirname, 'src', 'assets', 'icons');

if (!fs.existsSync(iconDir)){
    fs.mkdirSync(iconDir, { recursive: true });
}

Object.entries(icons).forEach(([filename, label]) => {
  const content = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="2" width="20" height="20" rx="4" fill="#ddd" />
  <text x="12" y="16" font-family="Arial" font-size="8" text-anchor="middle" fill="#000">${label}</text>
</svg>`;
  fs.writeFileSync(path.join(iconDir, filename), content);
  console.log(`Created ${filename}`);
});
