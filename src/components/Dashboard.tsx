import React from "react";
import KPIBar from "./KPIBar";
import ActiveMachinery from "./ActiveMachinery";
import CurrentConsumption from "./CurrentConsumption";
import aiMic from "../assets/icons/ai_mic.svg";
import aiWave from "../assets/icons/ai_wave.svg";

const Dashboard: React.FC = () => {
  return (
    <div className="h-screen text-white p-6 font-sans selection:bg-cyan-500 selection:text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 flex-none relative z-20 px-2">
        <div className="flex items-center space-x-8">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black font-bold text-2xl shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            ♠
          </div>
          <div className="flex space-x-8">
            <div className="border-b border-gray-600 pb-1 pr-6">
              <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                Region
              </span>
              <div className="text-sm font-medium flex items-center mt-0.5 text-white">
                Colorado{" "}
                <span className="ml-3 text-[10px] text-gray-400">▼</span>
              </div>
            </div>
            <div className="border-b border-gray-600 pb-1 pr-6">
              <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                Zone
              </span>
              <div className="text-sm font-medium flex items-center mt-0.5 text-white">
                Factory 028{" "}
                <span className="ml-3 text-[10px] text-gray-400">▼</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2">
          <div className="text-3xl font-bold tracking-wide text-white drop-shadow-md">
            ABC FACTORY 4.0
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer relative">
            <span className="text-2xl">🔔</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#020617]"></span>
          </div>
          <div className="w-10 h-10 bg-gray-700 rounded-full overflow-hidden border border-gray-500">
            <img
              src="https://via.placeholder.com/40"
              alt="User"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </header>

      <div className="mb-2 flex-none">
        <KPIBar />
      </div>

      <div className="grid grid-cols-12 gap-6 relative z-10 flex-grow min-h-0">
        {/* Left Sidebar */}
        <div className="col-span-3 flex flex-col gap-6 h-full">
          <ActiveMachinery className="flex-[3] min-h-0" />
          <CurrentConsumption className="flex-[2] min-h-0" />
        </div>

        {/* Main Content (Central Map/Feed) */}
        <div className="col-span-6 bg-[#0f172a]/60 backdrop-blur-md rounded-3xl border border-white/10 relative overflow-hidden flex items-center justify-center group shadow-2xl h-full">
          {/* Placeholder for Map Image - Using a gradient or pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-blue-900/10 opacity-60"></div>
          {/* Grid overlay for map feel */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.1)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20"></div>

          {/* Floating Labels simulating map points */}
          <div className="absolute top-1/3 left-1/4 flex items-center space-x-2 animate-pulse">
            <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)]"></div>
            <span className="text-xs bg-black/60 px-2 py-1 rounded backdrop-blur text-red-400 border border-red-500/30">
              Machine Heat Detected!
            </span>
          </div>

          <div className="text-cyan-500/40 font-light text-lg tracking-[0.5em] z-10 uppercase">
            Central Map View
          </div>

          {/* Search Bar at Bottom */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-[90%] bg-white/95 backdrop-blur rounded-full px-6 py-3 flex items-center shadow-[0_10px_30px_rgba(0,0,0,0.3)] z-20 border border-white/50">
            <span className="text-3xl mr-5 font-thin text-gray-400 cursor-pointer hover:text-cyan-600 transition pb-1">
              +
            </span>
            <input
              type="text"
              placeholder="Ask anything"
              className="flex-grow bg-transparent outline-none text-gray-800 placeholder-gray-500 text-lg font-light"
            />
            <div className="flex items-center space-x-4 border-l border-gray-300 pl-6 ml-2">
              <img
                src={aiMic}
                alt="Mic"
                className="w-6 h-6 opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
              />
              <img
                src={aiWave}
                alt="Wave"
                className="w-6 h-6 opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-3 flex flex-col gap-6 h-full">
          {/* Green Energy */}
          <div className="bg-[#0f172a]/80 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors flex-1 min-h-0 flex flex-col">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-500/10 rounded-full blur-2xl"></div>
            <h3 className="text-gray-100 font-semibold mb-4 text-sm tracking-wide flex-none">
              Green Energy Generated
            </h3>
            <div className="flex items-center justify-between flex-grow px-2">
              {/* Placeholder Gauge */}
              <div className="relative w-28 h-14 overflow-hidden bg-gray-800/50 rounded-t-full border-t border-r border-l border-gray-700 self-end mb-4">
                <div className="absolute bottom-0 left-0 w-full h-full border-t-4 border-green-500 rounded-t-full transform origin-bottom rotate-[135deg] shadow-[0_0_10px_rgba(34,197,94,0.3)]"></div>
              </div>
              <div className="text-right z-10 self-center">
                <div className="text-3xl font-bold text-white tracking-tight">
                  200{" "}
                  <span className="text-sm font-normal text-gray-400 ml-1">
                    kWh
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  CNC Lathe Machine
                </div>
              </div>
            </div>
          </div>

          {/* IDLE Machine */}
          <div className="bg-[#0f172a]/80 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-white/5 relative hover:border-white/10 transition-colors flex-1 min-h-0 flex flex-col">
            <h3 className="text-gray-100 font-semibold mb-6 text-sm tracking-wide flex-none">
              IDLE Machine
            </h3>
            <div className="flex items-center space-x-5 mt-2 flex-grow justify-start">
              <div className="w-20 h-20 bg-gray-800/50 rounded-xl flex items-center justify-center border border-gray-700/50 shadow-inner relative overflow-hidden flex-none">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/5"></div>
                <img
                  src="../assets/icons/machine_gear.svg"
                  className="w-10 h-10 opacity-40 grayscale"
                />
              </div>
              <div>
                <div className="font-bold text-white text-lg leading-tight">
                  CNC Lathe
                  <br />
                  Machine
                </div>
                <div className="mt-3 flex items-center bg-gray-800/80 rounded-full px-3 py-1 w-fit border border-gray-700">
                  <div className="w-2 h-2 bg-gray-500 rounded-full mr-2 shadow-[0_0_5px_rgba(107,114,128,0.5)]"></div>
                  <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">
                    Off
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Machine Heat */}
          <div className="bg-[#0f172a]/80 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-white/5 hover:border-white/10 transition-colors flex-1 min-h-0 flex flex-col">
            <h3 className="text-gray-100 font-semibold mb-4 text-sm tracking-wide flex-none">
              Machine Heat
            </h3>
            <div className="grid grid-cols-2 gap-3 flex-grow content-center">
              <div className="bg-[#1e293b]/40 p-3 rounded-xl border border-white/5 hover:bg-[#1e293b]/60 transition-colors">
                <div className="text-white text-xl font-bold tracking-tight">
                  60°C
                </div>
                <div className="text-[10px] text-green-400 flex items-center mt-1 font-medium">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 shadow-[0_0_5px_rgba(74,222,128,0.5)]"></span>{" "}
                  Safe
                </div>
              </div>
              <div className="bg-[#1e293b]/40 p-3 rounded-xl border border-white/5 hover:bg-[#1e293b]/60 transition-colors">
                <div className="text-white text-xl font-bold tracking-tight">
                  72°C
                </div>
                <div className="text-[10px] text-orange-400 flex items-center mt-1 font-medium">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-1.5 shadow-[0_0_5px_rgba(251,146,60,0.5)]"></span>{" "}
                  Warning
                </div>
              </div>
              <div className="bg-[#1e293b]/40 p-3 rounded-xl border border-white/5 hover:bg-[#1e293b]/60 transition-colors">
                <div className="text-white text-xl font-bold tracking-tight">
                  90°C
                </div>
                <div className="text-[10px] text-red-400 flex items-center mt-1 font-medium">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5 shadow-[0_0_5px_rgba(248,113,113,0.5)]"></span>{" "}
                  Critical
                </div>
              </div>
              <div className="bg-[#1e293b]/40 p-3 rounded-xl border border-white/5 hover:bg-[#1e293b]/60 transition-colors">
                <div className="text-white text-xl font-bold tracking-tight">
                  66°C
                </div>
                <div className="text-[10px] text-green-400 flex items-center mt-1 font-medium">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 shadow-[0_0_5px_rgba(74,222,128,0.5)]"></span>{" "}
                  Safe
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
