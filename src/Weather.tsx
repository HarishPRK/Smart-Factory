import "./Weather.css";
import weatherIcon from "./assets/icons/weather_partly_cloudy.svg";

interface WeatherProps {
  temperature?: number;
  condition?: string;
  unit?: string;
  location?: string;
}

function Weather({
  temperature = 72,
  condition = "sunny",
  unit = "C",
  location = "Location",
}: WeatherProps) {
  return (
    <div className="weather-widget glass animate-fade-in">
      <div className="weather-icon-container">
        <img src={weatherIcon} alt={condition} className="weather-icon-img" />
      </div>
      <div className="weather-info">
        <span className="temperature-value gradient-number">
          {temperature}
          <span className="temperature-degree">°</span>
          <span className="temperature-unit">{unit}</span>
        </span>
        <span className="weather-condition">{location}</span>
      </div>
    </div>
  );
}

export default Weather;
