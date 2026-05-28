import React, { useId } from "react";

interface MotorSpinner3DProps {
  /** Optional total current in amps; drives rotor RPM. */
  currentA?: number | null;
  /** Per-phase voltages — each coil pair lights independently when its phase
   *  voltage exceeds the live threshold. */
  phaseVoltages?: {
    a: number | null;
    b: number | null;
    c: number | null;
  };
  /** Render size in pixels (square). Default 180. */
  size?: number;
  /** Legacy override — kept for back-compat. If provided AND false, the
   *  rotor stays frozen regardless of phase data (e.g. when an upstream
   *  safety interlock is tripped). When omitted, visualization is fully
   *  derived from `phaseVoltages` + `currentA`. */
  running?: boolean;
}

/* Thresholds: a coil is rendered "live" once its phase voltage clears this
 * many volts; the rotor only spins when a phase is live AND the meter sees
 * at least this much current. Spin rate then scales with current. */
const VOLTAGE_LIVE_V = 50;
const CURRENT_SPIN_A = 0.02;

/**
 * 3D-styled 3-phase motor cross-section.
 *
 * Reacts to live meter data:
 *   - Each phase pair (A/B/C coils) lights up independently the moment its
 *     phase voltage clears VOLTAGE_LIVE_V — so a motor that's energised but
 *     unloaded still glows on the live phases.
 *   - The rotor spins whenever any phase is live AND current ≥ CURRENT_SPIN_A.
 *     Spin rate uses a sqrt curve so very small currents still produce a
 *     visible rotation (~38 RPM at 0.02A) instead of a near-frozen disc.
 *   - State label cycles OFFLINE → ENERGIZED · NO LOAD → NNN RPM as the
 *     conditions are met.
 *   - The yellow magnetic-axis arrow is bright when at least one phase is
 *     live, dimmed when offline.
 */
const MotorSpinner3D: React.FC<MotorSpinner3DProps> = ({
  currentA,
  phaseVoltages,
  size = 180,
  running,
}) => {
  const id = useId().replace(/:/g, "");
  const cx = 100;
  const cy = 100;
  const rOuter = 88;
  const rHousing = 78;
  const rStator = 62;
  const rRotor = 30;

  const PHASE_COLORS = { a: "#fbbf24", b: "#34d399", c: "#60a5fa" };
  const phases = [
    { key: "a" as const, angle: 0, color: PHASE_COLORS.a, v: phaseVoltages?.a },
    { key: "b" as const, angle: 120, color: PHASE_COLORS.b, v: phaseVoltages?.b },
    { key: "c" as const, angle: 240, color: PHASE_COLORS.c, v: phaseVoltages?.c },
  ];

  // Per-phase live state — drives coil glow independently of overall spin.
  const phaseLive = {
    a: (phaseVoltages?.a ?? 0) > VOLTAGE_LIVE_V,
    b: (phaseVoltages?.b ?? 0) > VOLTAGE_LIVE_V,
    c: (phaseVoltages?.c ?? 0) > VOLTAGE_LIVE_V,
  };
  const anyLive = phaseLive.a || phaseLive.b || phaseLive.c;
  const amps = Math.max(0, currentA ?? 0);

  // Spinning needs both a live phase AND meaningful current — and the
  // optional external `running=false` can still hard-stop us.
  const isSpinning =
    anyLive && amps > CURRENT_SPIN_A && running !== false;

  // sqrt curve so 0.02A still visibly turns (~38 RPM) while 5A reads as fast.
  // Result: 0.02 → 0.64 rps, 0.1 → 1.3 rps, 1 → 3 rps, 5 → 6.1 rps, 10 → 8.4 rps.
  const rps = isSpinning
    ? Math.min(10, 0.5 + Math.sqrt(amps) * 2.5)
    : 0;
  const spinDurationS = rps > 0 ? 1 / rps : 0;

  type State = "offline" | "energized" | "running";
  const state: State = !anyLive ? "offline" : isSpinning ? "running" : "energized";

  const stateLabel =
    state === "running" ? `${(rps * 60).toFixed(0)} RPM`
    : state === "energized" ? "ENERGIZED · NO LOAD"
    : "OFFLINE";

  const stateColor =
    state === "running" ? "#fbbf24"
    : state === "energized" ? "#94a3b8"
    : "#475569";

  return (
    <div
      style={{
        width: size,
        height: size,
        perspective: "600px",
        position: "relative",
      }}
    >
      <style>
        {`@keyframes motor-spin-${id} {
            from { transform: rotateZ(0deg); }
            to   { transform: rotateZ(360deg); }
          }
          @keyframes motor-flux-${id} {
            0%, 100% { opacity: 0.35; }
            50%      { opacity: 0.85; }
          }
        `}
      </style>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{
          // Tilt the whole motor so it reads as a 3D shaft sticking up.
          transform: "rotateX(58deg) rotateZ(-12deg)",
          transformOrigin: "center",
          filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.45))",
        }}
      >
        <defs>
          {/* Housing — brushed steel radial */}
          <radialGradient id={`housing-${id}`} cx="35%" cy="35%" r="80%">
            <stop offset="0%"   stopColor="#5a667a" />
            <stop offset="55%"  stopColor="#374151" />
            <stop offset="100%" stopColor="#111827" />
          </radialGradient>
          {/* Inner stator iron */}
          <radialGradient id={`stator-${id}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stopColor="#1f2937" />
            <stop offset="100%" stopColor="#0b1117" />
          </radialGradient>
          {/* Rotor laminated core */}
          <radialGradient id={`rotor-${id}`} cx="38%" cy="38%" r="70%">
            <stop offset="0%"   stopColor="#94a3b8" />
            <stop offset="50%"  stopColor="#475569" />
            <stop offset="100%" stopColor="#1f2937" />
          </radialGradient>
          {/* Shaft polished steel */}
          <radialGradient id={`shaft-${id}`} cx="40%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#f1f5f9" />
            <stop offset="60%"  stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>
          {/* Phase-coil glow filter */}
          <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Housing — outer disc */}
        <circle cx={cx} cy={cy} r={rOuter} fill={`url(#housing-${id})`} stroke="#0b1117" strokeWidth="2" />
        {/* Cooling fins around housing */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const x1 = cx + Math.cos(a) * (rOuter - 2);
          const y1 = cy + Math.sin(a) * (rOuter - 2);
          const x2 = cx + Math.cos(a) * (rHousing + 2);
          const y2 = cy + Math.sin(a) * (rHousing + 2);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="1.4"
            />
          );
        })}

        {/* Stator iron ring */}
        <circle cx={cx} cy={cy} r={rHousing} fill={`url(#stator-${id})`} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* 6 stator coils — two per phase, 180° apart. Each coil lights
            up purely from its own phase voltage, so phase C glowing while
            A/B are dark accurately reflects the live meter data. */}
        {phases.flatMap((p) => [p.angle, p.angle + 180]).map((deg, i) => {
          const phase = phases[Math.floor(i / 2)];
          const live = phaseLive[phase.key];
          const a = (deg * Math.PI) / 180;
          const rCoilCenter = (rStator + rHousing) / 2;
          const x = cx + Math.cos(a) * rCoilCenter;
          const y = cy + Math.sin(a) * rCoilCenter;
          return (
            <g key={`coil-${i}`} transform={`translate(${x},${y}) rotate(${deg + 90})`}>
              {/* Coil body — copper-look rounded rect */}
              <rect
                x="-9"
                y="-7"
                width="18"
                height="14"
                rx="3"
                fill={live ? phase.color : "#7c5b3a"}
                opacity={live ? 0.95 : 0.55}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="0.8"
                filter={live ? `url(#glow-${id})` : undefined}
              />
              {/* Winding bands */}
              {[-3, 0, 3].map((dy) => (
                <line
                  key={dy}
                  x1="-9"
                  y1={dy}
                  x2="9"
                  y2={dy}
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth="0.6"
                />
              ))}
              {/* Live flux pulse — only when energised */}
              {live && (
                <circle
                  cx="0"
                  cy="0"
                  r="11"
                  fill="none"
                  stroke={phase.color}
                  strokeWidth="1"
                  opacity="0.4"
                  style={{ animation: `motor-flux-${id} 1.2s ease-in-out infinite` }}
                />
              )}
            </g>
          );
        })}

        {/* Air gap ring */}
        <circle
          cx={cx}
          cy={cy}
          r={rStator}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        {/* Rotor (spins) */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: spinDurationS > 0
              ? `motor-spin-${id} ${spinDurationS.toFixed(3)}s linear infinite`
              : undefined,
          }}
        >
          {/* Rotor laminated core */}
          <circle cx={cx} cy={cy} r={rRotor} fill={`url(#rotor-${id})`} stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
          {/* Rotor slots (laminations) */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const x1 = cx + Math.cos(a) * (rRotor - 3);
            const y1 = cy + Math.sin(a) * (rRotor - 3);
            const x2 = cx + Math.cos(a) * (rRotor - 8);
            const y2 = cy + Math.sin(a) * (rRotor - 8);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(15,20,30,0.7)"
                strokeWidth="1.3"
              />
            );
          })}
          {/* Magnetic axis arrow — bright when any phase is energised, even
              if the rotor isn't spinning yet (motor is electrically alive). */}
          <line
            x1={cx - rRotor + 4}
            y1={cy}
            x2={cx + rRotor - 4}
            y2={cy}
            stroke="#facc15"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity={anyLive ? 0.9 : 0.3}
          />
          <polygon
            points={`${cx + rRotor - 4},${cy} ${cx + rRotor - 11},${cy - 5} ${cx + rRotor - 11},${cy + 5}`}
            fill="#facc15"
            opacity={anyLive ? 0.9 : 0.3}
          />
          {/* North/South poles */}
          <text
            x={cx + rRotor - 16}
            y={cy - 8}
            fontSize="7"
            fontWeight="700"
            fill="#facc15"
            opacity={anyLive ? 0.85 : 0.3}
          >
            N
          </text>
          <text
            x={cx - rRotor + 6}
            y={cy + 12}
            fontSize="7"
            fontWeight="700"
            fill="#60a5fa"
            opacity={anyLive ? 0.85 : 0.3}
          >
            S
          </text>
          {/* Shaft */}
          <circle cx={cx} cy={cy} r="6" fill={`url(#shaft-${id})`} stroke="rgba(0,0,0,0.5)" strokeWidth="0.8" />
          <circle cx={cx - 1.5} cy={cy - 1.5} r="1.8" fill="#f8fafc" opacity="0.7" />
        </g>

        {/* Mounting bolts on housing */}
        {[45, 135, 225, 315].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const x = cx + Math.cos(a) * (rOuter - 6);
          const y = cy + Math.sin(a) * (rOuter - 6);
          return (
            <g key={deg}>
              <circle cx={x} cy={y} r="2.6" fill="#0b1117" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
              <line x1={x - 1.5} y1={y} x2={x + 1.5} y2={y} stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
            </g>
          );
        })}
      </svg>

      {/* State badge — cycles OFFLINE → ENERGIZED · NO LOAD → NNN RPM
          as the live meter conditions are met. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -6,
          textAlign: "center",
          fontSize: "10px",
          fontFamily: "ui-monospace, Consolas, monospace",
          color: stateColor,
          letterSpacing: "0.08em",
          textShadow:
            state === "running" ? "0 0 6px rgba(251,191,36,0.4)" : undefined,
        }}
      >
        {stateLabel}
      </div>
    </div>
  );
};

export default MotorSpinner3D;
