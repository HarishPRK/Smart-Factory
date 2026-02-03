import React from "react";
import workerIcon from "../assets/icons/worker.svg";
import energyIcon from "../assets/icons/energy_bolt.svg";
import noiseIcon from "../assets/icons/noise_ear.svg";
import emissionIcon from "../assets/icons/emission_cloud.svg";
import weatherIcon from "../assets/icons/weather_partly_cloudy.svg";

interface KPIItemProps {
  icon: string;
  value: string;
  label: string;
  unit?: string;
  sub?: string;
  color?: string;
}

const KPIItem: React.FC<KPIItemProps> = ({
  icon,
  value,
  label,
  unit,
  color = "text-white",
}) => (
  <div className="flex items-center space-x-4">
    <div
      className={`w-12 h-12 rounded-full border border-gray-700/50 flex items-center justify-center bg-gray-800/30`}
    >
      <img src={icon} alt={label} className="w-6 h-6 opacity-80" />
    </div>
    <div>
      <div
        className={`text-4xl font-tech font-bold flex items-baseline ${color} drop-shadow-sm`}
      >
        {value}
        {unit && (
          <span className="text-lg font-sans font-medium ml-1 text-gray-500">
            {unit}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-1 opacity-80">
        {label}
      </div>
    </div>
  </div>
);

const KPIBar: React.FC = () => {
  return (
    <div className="flex justify-between items-center w-full px-2">
      <div className="flex space-x-16">
        <KPIItem icon={workerIcon} value="2498" label="Total Workers" />
        <KPIItem
          icon={energyIcon}
          value="2041"
          unit="kW"
          label="Energy Utilized"
          color="text-cyan-400"
        />
        <KPIItem
          icon={noiseIcon}
          value="70"
          unit="db"
          label="Noise level"
          color="text-orange-400"
        />
        <KPIItem
          icon={emissionIcon}
          value="420"
          unit="ppm"
          label="Emission"
          color="text-green-400"
        />
      </div>
      <div className="flex items-center space-x-12 text-white text-right">
        <div className="flex items-center space-x-4">
          <img
            src={weatherIcon}
            alt="Weather"
            className="w-12 h-12 opacity-90"
          />
          <div className="text-left">
            <div className="text-4xl font-tech font-bold text-white">
              19°<span className="text-xl">C</span>
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              Colorado, US
            </div>
          </div>
        </div>
        <div className="text-left border-l border-gray-800 pl-6">
          <div className="text-3xl font-tech font-bold text-white">
            78{" "}
            <span className="text-sm font-sans font-normal text-gray-500">
              µg/m³
            </span>
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
            Air
          </div>
        </div>
        <div className="text-left border-l border-gray-800 pl-6">
          <div className="text-3xl font-tech font-bold text-white">
            16{" "}
            <span className="text-sm font-sans font-normal text-gray-500">
              %
            </span>
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
            Humidity
          </div>
        </div>
      </div>
    </div>
  );
};

export default KPIBar;
