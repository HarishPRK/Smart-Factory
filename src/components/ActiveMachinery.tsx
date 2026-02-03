import React from "react";

const machinery = [
  { name: "Injection Molding Machine", value: "250", unit: "kW" },
  { name: "Hydraulic Press Machine", value: "200", unit: "kW" },
  { name: "Industrial Boiler Pump", value: "100", unit: "kW" },
  { name: "Conveyor Belt System", value: "40", unit: "kW" },
  { name: "CNC Lathe Machine", value: "20", unit: "kW" },
];

interface ActiveMachineryProps {
  className?: string;
}

const ActiveMachinery: React.FC<ActiveMachineryProps> = ({
  className = "",
}) => {
  return (
    <div className={`bg-[#1e1e1e] p-8 rounded-xl flex flex-col ${className}`}>
      <h3 className="text-gray-400 font-bold mb-6 text-xs uppercase tracking-widest flex-none">
        Active Machinery
      </h3>
      <div className="space-y-6 flex-grow overflow-y-auto pr-2 custom-scrollbar">
        {machinery.map((machine, index) => (
          <div
            key={index}
            className="flex justify-between items-center text-sm group cursor-pointer border-b border-gray-800 pb-4 last:border-0 last:pb-0"
          >
            <span className="text-white font-bold text-lg group-hover:text-[#ff3d6e] transition-colors">
              {machine.name}
            </span>
            <div className="flex items-baseline">
              <span className="text-white font-black text-2xl leading-none">
                {machine.value}
              </span>
              <span className="text-xs font-bold text-gray-500 ml-1">
                {machine.unit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActiveMachinery;
