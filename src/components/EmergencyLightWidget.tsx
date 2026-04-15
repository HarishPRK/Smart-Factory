import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePLCContext } from "../context/PLCContext";
import { usePLCStore } from "../stores/plcStore";

/* ── Web Audio siren generator ────────────────────────── */

function startSiren(): { stop: () => void } {
  const ctx = new AudioContext();

  // Primary carrier — aggressive sawtooth siren
  const carrier = ctx.createOscillator();
  carrier.type = "sawtooth";
  carrier.frequency.value = 900;

  // Second carrier — higher harmonic for piercing effect
  const carrier2 = ctx.createOscillator();
  carrier2.type = "square";
  carrier2.frequency.value = 1400;

  // LFO — sweeps both carriers up and down
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 3.5; // faster sweep (~3.5 cycles/sec)

  const lfoGain1 = ctx.createGain();
  lfoGain1.gain.value = 500; // sweep depth: 900 ± 500 = 400–1400 Hz

  const lfoGain2 = ctx.createGain();
  lfoGain2.gain.value = 600; // sweep depth: 1400 ± 600 = 800–2000 Hz

  // Distortion for more intensity
  const distortion = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = ((Math.PI + 3) * x) / (Math.PI + 3 * Math.abs(x));
  }
  distortion.curve = curve;
  distortion.oversample = "2x";

  // Volume controls
  const gain1 = ctx.createGain();
  gain1.gain.value = 0.22;

  const gain2 = ctx.createGain();
  gain2.gain.value = 0.1;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.35;

  // Connect LFO to both carriers
  lfo.connect(lfoGain1);
  lfo.connect(lfoGain2);
  lfoGain1.connect(carrier.frequency);
  lfoGain2.connect(carrier2.frequency);

  // Connect carriers through distortion to master
  carrier.connect(gain1);
  carrier2.connect(gain2);
  gain1.connect(distortion);
  gain2.connect(distortion);
  distortion.connect(masterGain);
  masterGain.connect(ctx.destination);

  carrier.start();
  carrier2.start();
  lfo.start();

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(autoStop);
    masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    setTimeout(() => {
      carrier.stop();
      carrier2.stop();
      lfo.stop();
      ctx.close();
    }, 300);
  };

  // Auto-stop after 8 seconds
  const autoStop = setTimeout(stop, 8000);

  return { stop };
}

interface EmergencyLightWidgetProps {
  className?: string;
}

const EmergencyLightWidget: React.FC<EmergencyLightWidgetProps> = ({
  className = "",
}) => {
  const { sendCommand } = usePLCContext(false);
  const emergencyLightOn = usePLCStore((s) => s.emergencyLightOn);
  const alerts = usePLCStore((s) => s.alerts);
  const [manualAlert, setManualAlert] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Active if manually toggled OR PLC relay[1] is on OR PLC alerts triggered
  const plcAlert = emergencyLightOn || alerts.some(Boolean);
  const hasAlert = manualAlert || plcAlert;
  const [bannerEpoch, setBannerEpoch] = useState(0);
  const [dismissedBannerEpoch, setDismissedBannerEpoch] = useState(0);
  const sirenRef = useRef<{ stop: () => void } | null>(null);

  const showBanner = hasAlert && dismissedBannerEpoch !== bannerEpoch;

  useEffect(() => {
    if (!hasAlert) return;

    const frameId = requestAnimationFrame(() => {
      setBannerEpoch((current) => current + 1);
    });

    return () => cancelAnimationFrame(frameId);
  }, [hasAlert]);

  useEffect(() => {
    if (hasAlert) {
      // Start siren sound
      if (!sirenRef.current) {
        sirenRef.current = startSiren();
      }
    } else {
      // Stop siren sound
      if (sirenRef.current) {
        sirenRef.current.stop();
        sirenRef.current = null;
      }
    }
    return () => {
      if (sirenRef.current) {
        sirenRef.current.stop();
        sirenRef.current = null;
      }
    };
  }, [hasAlert]);

  const handleToggle = () => {
    const turningOn = !manualAlert;
    setManualAlert(turningOn);
    // Publish to plc/control with relay channel 1
    const relayState = turningOn ? 1 : 0;
    sendCommand("emergency_light", {
      _topic: "plc/control",
      _rawPayload: { boardA_8ch_relay_alarm: relayState },
    }).catch(() => {});
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = 160;
    const H = 160;
    canvas.width = W;
    canvas.height = H;

    const cx = W / 2;
    const cy = H / 2 + 6;
    let angle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      if (hasAlert) {
        angle += 0.06;
      }

      const beamDir = Math.cos(angle);
      const facing = (beamDir + 1) / 2;

      ctx.beginPath();
      ctx.arc(cx, cy - 6, 56, 0, Math.PI * 2);
      ctx.strokeStyle = hasAlert
        ? `rgba(239,68,68,${0.12 + facing * 0.15})`
        : "rgba(51,65,85,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (hasAlert) {
        const glowX = cx + beamDir * 14;
        const grad = ctx.createRadialGradient(
          glowX,
          cy - 10,
          0,
          glowX,
          cy - 10,
          50,
        );
        grad.addColorStop(0, `rgba(239,68,68,${0.15 + facing * 0.2})`);
        grad.addColorStop(1, "rgba(239,68,68,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      const baseY = cy + 22;
      const baseW = 36;
      const baseH = 10;
      ctx.beginPath();
      ctx.moveTo(cx - baseW / 2 + 3, baseY);
      ctx.lineTo(cx + baseW / 2 - 3, baseY);
      ctx.lineTo(cx + baseW / 2, baseY + baseH / 2);
      ctx.lineTo(cx - baseW / 2, baseY + baseH / 2);
      ctx.closePath();
      ctx.fillStyle = hasAlert ? "#7f1d1d" : "#2a3a52";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - baseW / 2, baseY + baseH / 2);
      ctx.lineTo(cx + baseW / 2, baseY + baseH / 2);
      ctx.lineTo(cx + baseW / 2 - 1, baseY + baseH);
      ctx.lineTo(cx - baseW / 2 + 1, baseY + baseH);
      ctx.closePath();
      ctx.fillStyle = hasAlert ? "#991b1b" : "#1e293b";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - baseW / 2 + 3, baseY);
      ctx.lineTo(cx + baseW / 2 - 3, baseY);
      ctx.strokeStyle = hasAlert
        ? "rgba(252,165,165,0.3)"
        : "rgba(100,140,180,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const domeBase = baseY;
      const domeTop = cy - 28;
      const domeW = 26;
      const domeTopW = 10;

      ctx.beginPath();
      ctx.moveTo(cx - domeW / 2, domeBase);
      ctx.quadraticCurveTo(
        cx - domeTopW / 2 - 4,
        domeTop + 20,
        cx - domeTopW / 2,
        domeTop,
      );
      ctx.lineTo(cx + domeTopW / 2, domeTop);
      ctx.quadraticCurveTo(
        cx + domeTopW / 2 + 4,
        domeTop + 20,
        cx + domeW / 2,
        domeBase,
      );
      ctx.closePath();
      ctx.fillStyle = hasAlert ? "#7f1d1d" : "#2a3a52";
      ctx.fill();
      ctx.strokeStyle = hasAlert
        ? "rgba(239,68,68,0.2)"
        : "rgba(100,140,180,0.08)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (hasAlert) {
        const lightX = cx + beamDir * 8;
        const lightW = 6 + facing * 4;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx - domeW / 2 + 1, domeBase);
        ctx.quadraticCurveTo(
          cx - domeTopW / 2 - 3,
          domeTop + 20,
          cx - domeTopW / 2 + 1,
          domeTop + 1,
        );
        ctx.lineTo(cx + domeTopW / 2 - 1, domeTop + 1);
        ctx.quadraticCurveTo(
          cx + domeTopW / 2 + 3,
          domeTop + 20,
          cx + domeW / 2 - 1,
          domeBase,
        );
        ctx.closePath();
        ctx.clip();

        const beamGrad = ctx.createLinearGradient(
          lightX - lightW,
          0,
          lightX + lightW,
          0,
        );
        beamGrad.addColorStop(0, "rgba(239,68,68,0)");
        beamGrad.addColorStop(0.3, `rgba(239,68,68,${0.3 + facing * 0.5})`);
        beamGrad.addColorStop(0.5, `rgba(252,165,165,${0.4 + facing * 0.5})`);
        beamGrad.addColorStop(0.7, `rgba(239,68,68,${0.3 + facing * 0.5})`);
        beamGrad.addColorStop(1, "rgba(239,68,68,0)");
        ctx.fillStyle = beamGrad;
        ctx.fillRect(
          lightX - lightW * 2,
          domeTop,
          lightW * 4,
          domeBase - domeTop,
        );

        if (facing > 0.7) {
          const hotGrad = ctx.createRadialGradient(
            lightX,
            cy - 8,
            0,
            lightX,
            cy - 8,
            8,
          );
          hotGrad.addColorStop(0, `rgba(255,255,255,${(facing - 0.7) * 1.5})`);
          hotGrad.addColorStop(
            0.5,
            `rgba(252,165,165,${(facing - 0.7) * 0.8})`,
          );
          hotGrad.addColorStop(1, "rgba(239,68,68,0)");
          ctx.fillStyle = hotGrad;
          ctx.fillRect(lightX - 12, domeTop, 24, domeBase - domeTop);
        }
        ctx.restore();

        const rayAlphaL = Math.max(0, -beamDir) * 0.7;
        const rayAlphaR = Math.max(0, beamDir) * 0.7;
        const rayAlphaTop = facing * 0.6;

        if (rayAlphaL > 0.05) {
          ctx.beginPath();
          ctx.moveTo(cx - domeW / 2 - 2, cy - 8);
          ctx.lineTo(cx - domeW / 2 - 22, cy - 20);
          ctx.lineTo(cx - domeW / 2 - 18, cy + 2);
          ctx.closePath();
          ctx.fillStyle = `rgba(239,68,68,${rayAlphaL * 0.3})`;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(cx - domeW / 2 - 2, cy);
          ctx.lineTo(cx - domeW / 2 - 20, cy + 4);
          ctx.strokeStyle = `rgba(239,68,68,${rayAlphaL})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        if (rayAlphaR > 0.05) {
          ctx.beginPath();
          ctx.moveTo(cx + domeW / 2 + 2, cy - 8);
          ctx.lineTo(cx + domeW / 2 + 22, cy - 20);
          ctx.lineTo(cx + domeW / 2 + 18, cy + 2);
          ctx.closePath();
          ctx.fillStyle = `rgba(239,68,68,${rayAlphaR * 0.3})`;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(cx + domeW / 2 + 2, cy);
          ctx.lineTo(cx + domeW / 2 + 20, cy + 4);
          ctx.strokeStyle = `rgba(239,68,68,${rayAlphaR})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        if (rayAlphaTop > 0.1) {
          ctx.beginPath();
          ctx.moveTo(cx - 3, domeTop);
          ctx.lineTo(cx, domeTop - 16);
          ctx.lineTo(cx + 3, domeTop);
          ctx.closePath();
          ctx.fillStyle = `rgba(239,68,68,${rayAlphaTop * 0.35})`;
          ctx.fill();
        }

        const capGrad = ctx.createRadialGradient(
          cx,
          domeTop + 2,
          0,
          cx,
          domeTop + 2,
          8,
        );
        capGrad.addColorStop(0, `rgba(252,165,165,${0.3 + facing * 0.5})`);
        capGrad.addColorStop(1, "rgba(239,68,68,0)");
        ctx.fillStyle = capGrad;
        ctx.beginPath();
        ctx.arc(cx, domeTop + 2, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const idleGrad = ctx.createLinearGradient(
          cx - 6,
          domeTop,
          cx + 6,
          domeBase,
        );
        idleGrad.addColorStop(0, "rgba(100,140,180,0.06)");
        idleGrad.addColorStop(1, "rgba(100,140,180,0)");
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx - domeW / 2 + 1, domeBase);
        ctx.quadraticCurveTo(
          cx - domeTopW / 2 - 3,
          domeTop + 20,
          cx - domeTopW / 2 + 1,
          domeTop + 1,
        );
        ctx.lineTo(cx + domeTopW / 2 - 1, domeTop + 1);
        ctx.quadraticCurveTo(
          cx + domeTopW / 2 + 3,
          domeTop + 20,
          cx + domeW / 2 - 1,
          domeBase,
        );
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = idleGrad;
        ctx.fillRect(cx - 8, domeTop, 16, domeBase - domeTop);
        ctx.restore();
      }

      ctx.beginPath();
      ctx.ellipse(cx, domeBase, domeW / 2, 2.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = hasAlert ? "rgba(127,29,29,0.8)" : "rgba(30,41,59,0.5)";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, domeBase, domeW / 2, 2.5, 0, Math.PI, Math.PI * 2);
      ctx.strokeStyle = hasAlert
        ? "rgba(252,165,165,0.2)"
        : "rgba(100,140,180,0.08)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx, domeTop, domeTopW / 2, 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = hasAlert ? "#991b1b" : "#1e293b";
      ctx.fill();
      ctx.strokeStyle = hasAlert
        ? "rgba(252,165,165,0.15)"
        : "rgba(100,140,180,0.06)";
      ctx.lineWidth = 0.6;
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [hasAlert]);

  return (
    <div
      className={`card p-3 flex flex-col gap-2 animate-fade-in delay-5 cursor-pointer active:scale-[0.97] transition-all duration-300 ${className}`}
      onClick={handleToggle}
    >
      {/* Header */}
      <div className="flex justify-between items-center flex-none">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 bg-gradient-to-br rounded-lg flex items-center justify-center border transition-all duration-500 ${
              hasAlert
                ? "from-red-500/[0.2] to-red-600/[0.1] border-red-400/[0.2] shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                : "from-red-500/[0.08] to-blue-500/[0.04] border-red-400/[0.08] shadow-[0_0_8px_rgba(239,68,68,0.05)]"
            }`}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              className="opacity-75"
            >
              <path
                d="M8 1 L9 6 L14 5 L10 8 L14 11 L9 10 L8 15 L7 10 L2 11 L6 8 L2 5 L7 6 Z"
                stroke="white"
                strokeWidth="0.8"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="text-[13px] font-semibold text-blue-100/90 uppercase tracking-[0.15em]">
            Emergency
          </h3>
        </div>
        <span
          className={`text-[12px] font-medium flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-all duration-500 ${
            hasAlert
              ? "text-red-400/90 bg-red-500/[0.1] border-red-500/[0.2]"
              : "text-blue-200/60 bg-blue-500/[0.04] border-blue-400/[0.06]"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${hasAlert ? "bg-red-400 animate-pulse" : "bg-blue-400/30"}`}
          />
          {hasAlert ? "Active" : "Clear"}
        </span>
      </div>

      {/* Canvas Beacon */}
      <div className="flex-grow min-h-0 flex items-center justify-center">
        <canvas ref={canvasRef} style={{ width: 110, height: 110 }} />
      </div>

      {/* Emergency banner — portaled to top of page */}
      {createPortal(
        <div
          className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center transition-all duration-500 ${
            showBanner
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0 pointer-events-none"
          }`}
        >
          <div className="mx-4 mt-3 w-full max-w-2xl rounded-xl border border-red-500/30 bg-red-950/90 backdrop-blur-md shadow-[0_4px_30px_rgba(239,68,68,0.3)] px-5 py-3 flex items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center animate-pulse">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L1 21h22L12 2z" fill="#ef4444" opacity="0.9" />
                <path
                  d="M12 9v5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="17" r="1" fill="white" />
              </svg>
            </div>
            <div className="flex-grow min-w-0">
              <div className="text-[13px] font-bold text-red-300 uppercase tracking-wider">
                Emergency Alert Active
              </div>
              <div className="text-[11px] text-red-200/60 mt-0.5">
                Emergency light has been triggered. Check factory floor
                immediately.
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDismissedBannerEpoch(bannerEpoch);
              }}
              className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-500/10 border border-red-400/20 flex items-center justify-center hover:bg-red-500/20 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 2l8 8M10 2l-8 8"
                  stroke="#fca5a5"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default EmergencyLightWidget;
