import React from "react";
import energyIcon from "../assets/icons/energy_bolt.svg";
import waterIcon from "../assets/icons/water_drop.svg";

interface CurrentConsumptionProps {
  className?: string;
}

const CurrentConsumption: React.FC<CurrentConsumptionProps> = ({
  className = "",
}) => {
  return (
    <div
      className={`bg-[#1e1e1e] p-8 rounded-xl flex flex-col justify-center ${className}`}
    >
      <h3 className="text-gray-400 font-bold mb-6 text-xs uppercase tracking-widest flex-none">
        Current Consumption
      </h3>
      <div className="space-y-8 flex-grow flex flex-col justify-center">
        <div className="flex items-center space-x-6">
          <div className="w-14 h-14 flex items-center justify-center bg-[#252525] rounded-xl">
            <img src={energyIcon} alt="Energy" className="w-8 h-8 opacity-90" />
          </div>
          <div>
            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1 font-bold">
              Energy
            </div>
            <div className="text-4xl font-black text-white flex items-baseline">
              200{" "}
              <span className="text-sm font-bold text-gray-500 ml-1">kW</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="w-14 h-14 flex items-center justify-center bg-[#252525] rounded-xl">
            <img src={waterIcon} alt="Water" className="w-8 h-8 opacity-90" />
          </div>
          <div>
            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1 font-bold">
              Water
            </div>
            <div className="text-4xl font-black text-white flex items-baseline">
              128.1
              <span className="text-xl font-bold text-gray-500 ml-1">m</span>
              <sup className="text-xs font-bold text-gray-500">3</sup>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrentConsumption;
