import "./Weather.css";

interface WeatherProps {
  temperature?: number;
  condition?: string;
  unit?: string;
  location?: string;
  feelsLike?: number;
  humidity?: number;
  windSpeed?: number;
  aqi?: number;
  aqiLabel?: string;
}

function WeatherIcon({ condition }: { condition: string }) {
  switch (condition) {
    case "sunny":
      return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="6" fill="url(#sunGrad)" />
          <g stroke="url(#rayGrad)" strokeWidth="2" strokeLinecap="round">
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="16" y1="26" x2="16" y2="30" />
            <line x1="2" y1="16" x2="6" y2="16" />
            <line x1="26" y1="16" x2="30" y2="16" />
            <line x1="6.1" y1="6.1" x2="8.9" y2="8.9" />
            <line x1="23.1" y1="23.1" x2="25.9" y2="25.9" />
            <line x1="6.1" y1="25.9" x2="8.9" y2="23.1" />
            <line x1="23.1" y1="8.9" x2="25.9" y2="6.1" />
          </g>
          <defs>
            <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
            <linearGradient id="rayGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "cloudy":
      return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <path
            d="M10 24a6 6 0 01-.8-11.95A8 8 0 0125 14h1a5 5 0 01.5 9.97"
            fill="url(#cloudGrad)"
            stroke="rgba(148,210,255,0.4)"
            strokeWidth="0.5"
          />
          <defs>
            <linearGradient id="cloudGrad" x1="8" y1="10" x2="28" y2="26">
              <stop offset="0%" stopColor="rgba(186,230,253,0.35)" />
              <stop offset="100%" stopColor="rgba(125,185,232,0.15)" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "rainy":
      return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <path
            d="M10 20a5 5 0 01-.67-9.96A7 7 0 0123 12h.5a4.5 4.5 0 01.5 8.97"
            fill="url(#rainCloudGrad)"
            stroke="rgba(148,210,255,0.3)"
            strokeWidth="0.5"
          />
          <line x1="12" y1="24" x2="10" y2="28" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="17" y1="24" x2="15" y2="28" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <line x1="22" y1="24" x2="20" y2="28" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <defs>
            <linearGradient id="rainCloudGrad" x1="8" y1="8" x2="26" y2="22">
              <stop offset="0%" stopColor="rgba(156,210,245,0.3)" />
              <stop offset="100%" stopColor="rgba(100,160,210,0.12)" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "partly_cloudy":
    default:
      return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <circle cx="12" cy="12" r="5" fill="url(#pcSunGrad)" />
          <g stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="4" y1="12" x2="7" y2="12" />
            <line x1="5.4" y1="5.4" x2="7.5" y2="7.5" />
            <line x1="18.6" y1="5.4" x2="16.5" y2="7.5" />
            <line x1="5.4" y1="18.6" x2="7.5" y2="16.5" />
          </g>
          <path
            d="M12 26a5.5 5.5 0 01-.73-10.95A7.5 7.5 0 0125.5 17H26a4.5 4.5 0 01.45 8.97"
            fill="url(#pcCloudGrad)"
            stroke="rgba(148,210,255,0.35)"
            strokeWidth="0.5"
          />
          <defs>
            <radialGradient id="pcSunGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
            <linearGradient id="pcCloudGrad" x1="10" y1="14" x2="28" y2="28">
              <stop offset="0%" stopColor="rgba(186,230,253,0.35)" />
              <stop offset="100%" stopColor="rgba(125,185,232,0.15)" />
            </linearGradient>
          </defs>
        </svg>
      );
  }
}

function HumidityIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2S4.5 6.5 4.5 9.5a3.5 3.5 0 107 0C11.5 6.5 8 2 8 2z"
        fill="url(#humGrad)"
        stroke="rgba(96,165,250,0.5)"
        strokeWidth="0.8"
      />
      <defs>
        <linearGradient id="humGrad" x1="8" y1="2" x2="8" y2="14">
          <stop offset="0%" stopColor="rgba(96,165,250,0.5)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.25)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function WindIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 6h8a2 2 0 10-1-3.5" stroke="rgba(125,211,252,0.65)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 10h6a1.5 1.5 0 110 3" stroke="rgba(125,211,252,0.5)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 8h10a2.5 2.5 0 100-5" stroke="rgba(125,211,252,0.35)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function AqiIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" fill="url(#aqiGrad)" />
      <circle cx="8" cy="8" r="5.5" stroke="rgba(52,211,153,0.3)" strokeWidth="0.8" strokeDasharray="2 2" />
      <defs>
        <radialGradient id="aqiGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(52,211,153,0.6)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0.3)" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function Weather({
  temperature = 25,
  condition = "partly_cloudy",
  unit = "C",
  location = "Colorado",
  humidity = 62,
  windSpeed = 12,
  aqi = 42,
  aqiLabel = "Good",
}: WeatherProps) {
  const aqiColor =
    aqi <= 50
      ? "text-emerald-300/80"
      : aqi <= 100
        ? "text-amber-300/80"
        : "text-red-300/80";

  const aqiDot =
    aqi <= 50
      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
      : aqi <= 100
        ? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]"
        : "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.6)]";

  return (
    <div className="weather-widget glass animate-fade-in">
      {/* Main weather section */}
      <div className="weather-main">
        <div className="weather-icon-glow"></div>
        <WeatherIcon condition={condition} />
      </div>

      <div className="weather-temp-block">
        <div className="weather-temp-row">
          <span className="weather-temp gradient-number">
            {temperature}
            <span className="weather-degree">°</span>
            <span className="weather-unit">{unit}</span>
          </span>
        </div>
        <span className="weather-location">{location}</span>
      </div>

      <div className="weather-divider"></div>

      {/* Stats row */}
      <div className="weather-stats">
        <div className="weather-stat">
          <HumidityIcon />
          <span className="weather-stat-value">{humidity}%</span>
        </div>
        <div className="weather-stat">
          <WindIcon />
          <span className="weather-stat-value">{windSpeed} km/h</span>
        </div>
        <div className="weather-stat">
          <AqiIcon />
          <span className="weather-stat-value">
            <span className={aqiColor}>{aqi}</span>
            <span className="weather-stat-sep">·</span>
            <span className={`flex items-center gap-1 ${aqiColor}`}>
              <span className={`w-1 h-1 rounded-full ${aqiDot}`}></span>
              {aqiLabel}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default Weather;
