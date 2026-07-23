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
    <div className="flex glass rounded-xl p-1 w-fit shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
      {allZones.map((zone) => {
        const isActive = state.selectedZone === zone.id;
        return (
          <button
            key={zone.id}
            onClick={() => dispatch({ type: "SET_ZONE", zone: zone.id })}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] transition-all duration-250 relative overflow-hidden ${
              isActive
                ? "bg-white/[0.1] text-white font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.3),0_0_0_0.5px_rgba(255,255,255,0.08)_inset]"
                : "text-white/45 font-medium hover:text-white/80 hover:bg-white/[0.04]"
            }`}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.04] pointer-events-none rounded-lg"></div>
            )}
            <span className="relative z-10">{zone.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ZoneTabs;
