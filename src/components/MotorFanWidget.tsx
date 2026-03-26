import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePLCContext } from "../context/PLCContext";

/* ── Web Audio motor hum generator ───────────────────── */

function startMotorSound(): { stop: () => void } {
  const ctx = new AudioContext();

  // Base hum — low frequency motor drone
  const hum = ctx.createOscillator();
  hum.type = "triangle";
  hum.frequency.value = 120;

  // Higher harmonic — gives it a mechanical whir
  const whir = ctx.createOscillator();
  whir.type = "sine";
  whir.frequency.value = 240;

  // Slight vibrato on the whir for realism
  const vibrato = ctx.createOscillator();
  vibrato.type = "sine";
  vibrato.frequency.value = 6;
  const vibratoGain = ctx.createGain();
  vibratoGain.gain.value = 8;
  vibrato.connect(vibratoGain);
  vibratoGain.connect(whir.frequency);

  const humGain = ctx.createGain();
  humGain.gain.value = 0.12;
  const whirGain = ctx.createGain();
  whirGain.gain.value = 0.06;

  const master = ctx.createGain();
  master.gain.value = 0;

  hum.connect(humGain);
  whir.connect(whirGain);
  humGain.connect(master);
  whirGain.connect(master);
  master.connect(ctx.destination);

  hum.start();
  whir.start();
  vibrato.start();

  // Ramp up smoothly like a motor starting
  master.gain.setTargetAtTime(1, ctx.currentTime, 0.3);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(autoStop);
    // Ramp down like motor winding down
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => {
      hum.stop();
      whir.stop();
      vibrato.stop();
      ctx.close();
    }, 1500);
  };

  const autoStop = setTimeout(stop, 5000);

  return { stop };
}

const BLADE_ANGLES = [0, 120, 240];
const BLADE_PATH =
  "M 20 16 C 18 12 16.5 8 17 5 C 17.5 3.5 20.5 3.5 22 5.5 C 22.5 8.5 22 12 21 16 Z";

interface MotorFanWidgetProps {
  className?: string;
}

const MotorFanWidget: React.FC<MotorFanWidgetProps> = ({ className = "" }) => {
  const { outputs, sendCommand } = usePLCContext();
  const [manualOn, setManualOn] = useState(false);
  // ON if manually toggled OR PLC says motor is on (Photo-E triggered)
  const isOn = manualOn || outputs.motorFanOn;
  const [showBanner, setShowBanner] = useState(false);
  const motorSoundRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (isOn) {
      setShowBanner(true);
      if (!motorSoundRef.current) {
        motorSoundRef.current = startMotorSound();
      }
    } else {
      setShowBanner(false);
      if (motorSoundRef.current) {
        motorSoundRef.current.stop();
        motorSoundRef.current = null;
      }
    }
    return () => {
      if (motorSoundRef.current) {
        motorSoundRef.current.stop();
        motorSoundRef.current = null;
      }
    };
  }, [isOn]);

  const handleToggle = () => {
    const turningOn = !manualOn;
    setManualOn(turningOn);
    // Publish to plc/control with relay payload
    const relayState = turningOn
      ? [1, 0, 0, 0, 0, 0, 0, 0]
      : [0, 0, 0, 0, 0, 0, 0, 0];
    sendCommand("motor_fan", {
      _topic: "plc/control",
      _rawPayload: { "8ch_relay_1": relayState },
    }).catch(() => {});
  };

  // RPM ramps up/down — used only for animation speed
  const [rpm, setRpm] = useState(0);
  useEffect(() => {
    const target = isOn ? 1750 : 0;
    const id = setInterval(() => {
      setRpm((prev) => {
        const diff = target - prev;
        if (Math.abs(diff) < 15) return target;
        return Math.round(prev + diff * 0.1);
      });
    }, 50);
    return () => clearInterval(id);
  }, [isOn]);

  const spinMs = rpm > 50 ? Math.max(200, Math.round(60000 / (rpm * 0.8))) : undefined;
  const speedFactor = Math.min(1, rpm / 1750);
  const discOpacity = speedFactor > 0.35 ? ((speedFactor - 0.35) / 0.65) * 0.22 : 0;

  return (
    <div
      className={`card p-3 flex flex-col gap-2 animate-fade-in delay-4 cursor-pointer active:scale-[0.97] transition-all duration-300 ${className}`}
      onClick={handleToggle}
    >
      {/* Header */}
      <div className="flex justify-between items-center flex-none">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-cyan-500/[0.12] to-blue-500/[0.06] rounded-lg flex items-center justify-center border border-cyan-400/[0.12] shadow-[0_0_8px_rgba(103,232,249,0.08)]">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="opacity-60">
              <path
                d="M8 2C5.8 3.2 5 6 6.5 7.5C5 5.8 2 6 2 8C2 10.2 5.2 11 6.5 9.5C5.3 11 6 14 8 14C10.2 12.8 11 10 9.5 8.5C11 10.2 14 10 14 8C14 5.8 10.8 5 9.5 6.5C10.7 5 10 2 8 2Z"
                stroke="white" strokeWidth="1.1" fill="none" strokeLinejoin="round"
              />
              <circle cx="8" cy="8" r="1.5" fill="white" opacity="0.55" />
            </svg>
          </div>
          <h3 className="text-[12px] font-semibold text-blue-200/60 uppercase tracking-[0.15em]">
            Motor Fan
          </h3>
        </div>
        <span className={`text-[11px] font-medium flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-all duration-700 ${
          isOn
            ? "text-cyan-400/80 bg-cyan-500/[0.07] border-cyan-500/[0.12]"
            : "text-blue-200/40 bg-blue-500/[0.04] border-blue-400/[0.06]"
        }`}>
          <span
            className={`w-1.5 h-1.5 rounded-full transition-all duration-700 ${isOn ? "bg-cyan-400 animate-pulse-glow" : "bg-blue-400/30"}`}
            style={isOn ? { color: "#67e8f9" } : undefined}
          />
          {isOn ? "Running" : "Standby"}
        </span>
      </div>

      {/* Fan SVG — centered */}
      <div className="flex-grow min-h-0 flex items-center justify-center py-1">
        <div className="relative flex items-center justify-center flex-shrink-0">
          {isOn && (
            <div
              className="absolute rounded-full animate-pulse-glow"
              style={{
                width: 90, height: 90,
                background: "radial-gradient(circle, rgba(103,232,249,0.18) 0%, transparent 70%)",
                filter: "blur(10px)",
                color: "#67e8f9",
              }}
            />
          )}
          <svg viewBox="0 0 40 40" width="80" height="80" style={{ overflow: "visible" }}>
            <circle cx="20" cy="20" r="18.5"
              stroke="#06b6d4" strokeWidth="0.6" fill="none"
              opacity={isOn ? 0.22 : 0.06} style={{ transition: "opacity 0.6s" }}
            />
            <circle cx="20" cy="20" r="17"
              stroke="#0e7490" strokeWidth="0.3" strokeDasharray="2 3" fill="none"
              opacity={isOn ? 0.12 : 0.03} style={{ transition: "opacity 0.6s" }}
            />
            <circle cx="20" cy="20" r="15.5"
              fill="#67e8f9" opacity={discOpacity} style={{ transition: "opacity 0.9s" }}
            />
            <g style={{
              transformOrigin: "20px 20px",
              transformBox: "view-box",
              animation: spinMs ? `fan-spin ${spinMs}ms linear infinite` : "none",
              filter: isOn ? "drop-shadow(0 0 4px rgba(103,232,249,0.75))" : "none",
            } as React.CSSProperties}>
              {BLADE_ANGLES.map((angle) => (
                <path
                  key={`b${angle}`}
                  d={BLADE_PATH}
                  fill={isOn ? "#67e8f9" : "#3b5272"}
                  transform={`rotate(${angle} 20 20)`}
                  opacity={isOn ? 0.92 : 0.30}
                  style={{ transition: "fill 0.6s, opacity 0.6s" }}
                />
              ))}
            </g>
            <circle cx="20" cy="20" r="4.5"
              fill={isOn ? "#0e7490" : "#0b1a30"} style={{ transition: "fill 0.6s" }}
            />
            <circle cx="20" cy="20" r="2.5"
              fill={isOn ? "#22d3ee" : "#1e3a5f"}
              opacity={isOn ? 0.55 : 0.25}
              style={{ transition: "fill 0.6s, opacity 0.6s" }}
            />
            <circle cx="20" cy="20" r="0.9" fill="white" opacity="0.45" />
          </svg>
        </div>
      </div>

      {/* Motor fan banner — portaled to top of page */}
      {createPortal(
        <div
          className={`fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center transition-all duration-500 ${
            showBanner ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
          }`}
        >
          <div className="mx-4 mt-3 w-full max-w-2xl rounded-xl border border-cyan-500/30 bg-cyan-950/90 backdrop-blur-md shadow-[0_4px_30px_rgba(6,182,212,0.3)] px-5 py-3 flex items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center animate-pulse">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C5.8 3.2 5 6 6.5 7.5C5 5.8 2 6 2 8C2 10.2 5.2 11 6.5 9.5C5.3 11 6 14 8 14C10.2 12.8 11 10 9.5 8.5C11 10.2 14 10 14 8C14 5.8 10.8 5 9.5 6.5C10.7 5 10 2 8 2Z" fill="#22d3ee" opacity="0.9" transform="translate(4 4) scale(1.2)" />
              </svg>
            </div>
            <div className="flex-grow min-w-0">
              <div className="text-[13px] font-bold text-cyan-300 uppercase tracking-wider">
                Motor Fan Activated
              </div>
              <div className="text-[11px] text-cyan-200/60 mt-0.5">
                Motor fan is now running. Sensor triggered or manual override active.
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBanner(false);
              }}
              className="flex-shrink-0 w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center hover:bg-cyan-500/20 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MotorFanWidget;
