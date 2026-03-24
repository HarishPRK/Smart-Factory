import React from "react";
import { useFilters } from "../context/FilterContext";
import { zones } from "../data/mockData";
import type { ZoneId } from "../types";

const allZones: { id: ZoneId | "all"; name: string }[] = [
  { id: "all", name: "All Zones" },
  ...zones,
];

const ZoneTabs: React.FC = () => {
  const { state, dispatch } = useFilters();

  return (
    <div className="flex glass rounded-full p-1 w-fit shadow-[0_4px_20px_rgba(0,10,40,0.3)]">
      {allZones.map((zone) => {
        const isActive = state.selectedZone === zone.id;
        return (
          <button
            key={zone.id}
            onClick={() => dispatch({ type: "SET_ZONE", zone: zone.id })}
            className={`px-4 py-1.5 rounded-full text-[10px] transition-all duration-300 relative overflow-hidden ${
              isActive
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-[0_2px_16px_rgba(59,130,246,0.35),0_0_0_0.5px_rgba(255,255,255,0.1)_inset]"
                : "text-blue-200/50 font-medium hover:text-white hover:bg-blue-500/[0.08]"
            }`}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.08] pointer-events-none rounded-full"></div>
            )}
            <span className="relative z-10">{zone.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ZoneTabs;
