import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useMeterStore } from './useMeterStore'

type Point3 = [number, number, number]
type TextureSurface = { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }

function uploadCanvas(texture: THREE.CanvasTexture) {
  texture.needsUpdate = true
}

function makeTexture(width: number, height: number): TextureSurface {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return { canvas, texture }
}

function usePrintedTexture(paint: (ctx: CanvasRenderingContext2D) => void) {
  const surface = useMemo(() => {
    const result = makeTexture(1024, 1024)
    const ctx = result.canvas.getContext('2d')
    if (ctx) paint(ctx)
    result.texture.needsUpdate = true
    return result
  }, [paint])
  useEffect(() => () => surface.texture.dispose(), [surface])
  return surface.texture
}

function printNameplate(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#eff0ea'
  ctx.fillRect(0, 0, 1024, 1024)
  ctx.strokeStyle = '#cdd1c7'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(512, 512, 483, 0, Math.PI * 2)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#17211f'
  ctx.font = '700 64px Arial, sans-serif'
  ctx.fillText('AITUZERO', 512, 166)
  ctx.font = '600 30px Arial, sans-serif'
  ctx.fillText('Solid State Watt-Hour Meter', 512, 210)
  ctx.font = '500 17px Arial, sans-serif'
  ctx.fillStyle = '#53615d'
  ctx.fillText('BIDIRECTIONAL  /  SINGLE PHASE', 512, 247)
  ctx.font = '600 16px Arial, sans-serif'
  ctx.fillText('ALARM', 400, 666)
  ctx.fillText('1000 imp/kWh', 512, 666)
  ctx.fillText('EXPORT', 624, 666)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#263431'
  ctx.font = '600 20px Arial, sans-serif'
  ctx.fillText('TYPE: EM12100RS', 247, 701)
  ctx.font = '600 25px Arial, sans-serif'
  ctx.fillText('FORM 2S   CL200', 247, 735)
  ctx.font = '23px Arial, sans-serif'
  ctx.fillText('120/240 V   3 WIRE   60 Hz', 247, 764)
  ctx.font = '17px Arial, sans-serif'
  ctx.fillText('ANSI   •   Kh 1.0 Wh', 247, 801)
  ctx.textAlign = 'center'
  ctx.font = '600 17px Arial, sans-serif'
  ctx.fillText('OPTICAL IR', 792, 820)
  // A deterministic, decorative identifier. This is not a scannable certification label.
  let cursor = 327
  for (let index = 0; index < 83; index++) {
    const width = [2, 4, 2, 3, 5, 2, 4][index % 7]
    if (index % 2 === 0) ctx.fillRect(cursor, 847, width, 51)
    cursor += width
  }
  ctx.font = '18px monospace'
  ctx.fillText('SN  AZ2S-25090111', 512, 929)
  ctx.strokeStyle = '#849089'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(174, 746, 48, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = '600 30px Arial, sans-serif'
  ctx.fillText('2S', 174, 751)
  ctx.font = '10px Arial, sans-serif'
  ctx.fillText('METER FORM', 174, 773)
}

function printBoard(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#164e44'
  ctx.fillRect(0, 0, 1024, 1024)
  ctx.strokeStyle = '#478878'
  ctx.lineWidth = 4
  for (let index = 0; index < 21; index++) {
    const x = 110 + index * 39
    ctx.beginPath()
    ctx.moveTo(x, 165)
    ctx.lineTo(x, 360 + (index % 4) * 80)
    ctx.lineTo(512 + (x - 512) * 0.7, 670)
    ctx.lineTo(512 + (x - 512) * 0.7, 840)
    ctx.stroke()
  }
  ctx.strokeStyle = '#93b3a1'
  ctx.lineWidth = 2
  ctx.strokeRect(348, 360, 325, 260)
  ctx.fillStyle = '#d4dfcf'
  ctx.font = '22px monospace'
  ctx.fillText('AZ • 2S • METERING PCB', 270, 915)
  ctx.font = '16px monospace'
  ctx.fillText('L1 SENSOR', 100, 540)
  ctx.fillText('L2 SENSOR', 760, 540)
}

const digitSegments: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc',
  '5': 'afgcd', '6': 'afgecd', '7': 'abc', '8': 'abcdefg', '9': 'abfgcd',
}

/** Actual seven-segment geometry drawn into the LCD texture; no font fetch is required. */
function drawDigit(ctx: CanvasRenderingContext2D, digit: string, x: number, y: number) {
  const w = 63, h = 112, t = 8, half = h / 2
  const segments: Record<string, number[][]> = {
    a: [[t, 0], [w - t, 0], [w - 2, t], [w - t, t * 2], [t, t * 2], [2, t]],
    g: [[t, half - t], [w - t, half - t], [w, half], [w - t, half + t], [t, half + t], [0, half]],
    d: [[t, h - t * 2], [w - t, h - t * 2], [w - 2, h - t], [w - t, h], [t, h], [2, h - t]],
    f: [[0, t], [t, t * 2], [t, half - t], [0, half], [-t, half - t], [-t, t * 2]],
    b: [[w, t], [w + t, t * 2], [w + t, half - t], [w, half], [w - t, half - t], [w - t, t * 2]],
    e: [[0, half], [t, half + t], [t, h - t * 2], [0, h - t], [-t, h - t * 2], [-t, half + t]],
    c: [[w, half], [w + t, half + t], [w + t, h - t * 2], [w, h - t], [w - t, h - t * 2], [w - t, half + t]],
  }
  for (const [segment, points] of Object.entries(segments)) {
    ctx.fillStyle = digitSegments[digit]?.includes(segment) ? '#273d30' : 'rgba(48, 73, 53, .075)'
    ctx.beginPath()
    points.forEach(([px, py], index) => index ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py))
    ctx.closePath()
    ctx.fill()
  }
}

function LiveRegister() {
  const telemetry = useMeterStore(state => state.telemetry)
  const hasReading = useMeterStore(state => state.source === 'simulation' || state.lastPacketAt !== null)
  const surface = useMemo(() => makeTexture(1024, 330), [])
  useEffect(() => () => surface.texture.dispose(), [surface])
  useEffect(() => {
    const ctx = surface.canvas.getContext('2d')
    if (!ctx) return
    const gradient = ctx.createLinearGradient(0, 0, 0, 330)
    gradient.addColorStop(0, '#b6c6a9')
    gradient.addColorStop(0.5, '#cedbbb')
    gradient.addColorStop(1, '#bac9aa')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 1024, 330)
    if (!hasReading) {
      ctx.fillStyle = '#344d36'
      ctx.textAlign = 'center'
      ctx.font = '600 30px monospace'
      ctx.fillText('AWAITING METER DATA', 512, 122)
      ctx.font = '24px monospace'
      ctx.fillText('— — — — — —', 512, 184)
      ctx.font = '19px monospace'
      ctx.fillText('NO VALID TELEMETRY RECEIVED', 512, 272)
      ctx.textAlign = 'left'
      uploadCanvas(surface.texture)
      return
    }
    ctx.fillStyle = '#344d36'
    ctx.font = '600 22px monospace'
    ctx.fillText(telemetry.reverseEnergy ? '← EXPORT ACTIVE ENERGY' : '→ IMPORT ACTIVE ENERGY', 38, 39)
    ctx.textAlign = 'right'
    ctx.fillText(telemetry.reverseEnergy ? '2.8.0' : '1.8.0', 984, 39)
    ctx.textAlign = 'left'
    const energy = telemetry.reverseEnergy ? telemetry.exportKwh : telemetry.importKwh
    const value = Math.min(999999.999, energy).toFixed(3).padStart(10, '0')
    let cursor = 47
    for (const digit of value) {
      if (digit === '.') {
        ctx.fillStyle = '#273d30'
        ctx.fillRect(cursor - 3, 181, 12, 12)
        cursor += 19
      } else {
        drawDigit(ctx, digit, cursor, 80)
        cursor += 83
      }
    }
    ctx.font = '600 35px monospace'
    ctx.fillStyle = '#273d30'
    ctx.fillText('kWh', 850, 188)
    ctx.fillStyle = 'rgba(45, 71, 45, .3)'
    ctx.fillRect(34, 219, 956, 2)
    ctx.fillStyle = '#344d36'
    ctx.font = '20px monospace'
    const columns = [38, 295, 548, 811]
    ;['ACTIVE', 'VOLTAGE', 'CURRENT', 'PF'].forEach((text, index) => ctx.fillText(text, columns[index], 259))
    ctx.font = '600 26px monospace'
    ;[
      `${(telemetry.activePower / 1000).toFixed(2)}kW`,
      `${telemetry.voltage.toFixed(1)}V`,
      `${telemetry.current.toFixed(1)}A`,
      telemetry.powerFactor.toFixed(3),
    ].forEach((text, index) => ctx.fillText(text, columns[index], 302))
    uploadCanvas(surface.texture)
  }, [surface, telemetry, hasReading])
  return (
    <group position={[0, 0.3, 0.31]}>
      <mesh castShadow>
        <boxGeometry args={[1.92, 0.695, 0.06]} />
        <meshStandardMaterial color="#b9c0b5" roughness={0.38} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.034]}>
        <planeGeometry args={[1.78, 0.574]} />
        <meshBasicMaterial map={surface.texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Cylinder({ radius, depth, position = [0, 0, 0], color, metalness = 0, roughness = 0.5 }: {
  radius: number; depth: number; position?: Point3; color: THREE.ColorRepresentation; metalness?: number; roughness?: number
}) {
  return <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
    <cylinderGeometry args={[radius, radius, depth, 96]} />
    <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
  </mesh>
}

function Screw({ position, radius = 0.048 }: { position: Point3; radius?: number }) {
  return <group position={position}>
    <Cylinder radius={radius} depth={0.024} color="#929e9e" metalness={0.94} roughness={0.25} />
    <mesh position={[0, 0, 0.014]}>
      <boxGeometry args={[radius * 1.45, radius * 0.18, 0.002]} />
      <meshStandardMaterial color="#344443" roughness={0.8} />
    </mesh>
    <mesh position={[0, 0, 0.015]}>
      <boxGeometry args={[radius * 0.18, radius * 1.45, 0.002]} />
      <meshStandardMaterial color="#344443" roughness={0.8} />
    </mesh>
  </group>
}

function Ring({ radius, tube, z, color = '#b8c3c6', metalness = 0.88 }: {
  radius: number; tube: number; z: number; color?: string; metalness?: number
}) {
  return <mesh position={[0, 0, z]} castShadow>
    <torusGeometry args={[radius, tube, 12, 128]} />
    <meshStandardMaterial color={color} metalness={metalness} roughness={0.25} />
  </mesh>
}

function heatColor(temperature: number, offset = 0) {
  const amount = THREE.MathUtils.clamp((temperature + offset - 25) / 65, 0, 1)
  return new THREE.Color().setHSL(0.57 - amount * 0.57, 0.88, 0.48)
}

function TerminalBlade({ thermal, temperature }: { thermal: boolean; temperature: number }) {
  const geometry = useMemo(() => {
    // Plated flat blade with chamfered tip and an actual through-hole, as in
    // the product reference. The XY outline becomes the XZ terminal plane.
    const shape = new THREE.Shape()
    shape.moveTo(-0.18, 0)
    shape.lineTo(0.18, 0)
    shape.lineTo(0.18, -0.355)
    shape.lineTo(0.105, -0.445)
    shape.lineTo(-0.105, -0.445)
    shape.lineTo(-0.18, -0.355)
    shape.closePath()
    const hole = new THREE.Path()
    hole.absarc(0, -0.315, 0.056, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const result = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2, steps: 1, curveSegments: 16 })
    result.translate(0, 0, -0.0225)
    return result
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow>
    <meshStandardMaterial color={thermal ? heatColor(temperature + 23) : '#bfc0ac'} metalness={0.87} roughness={0.27} />
  </mesh>
}

function MeterLeds({ reducedMotion }: { reducedMotion: boolean }) {
  const pulseMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const lastPulse = useRef(-1)
  const pulseUntil = useRef(0)
  const lastObserved = useRef(0)
  const reverseEnergy = useMeterStore(state => (state.source === 'simulation' || state.lastPacketAt !== null) && state.telemetry.reverseEnergy)
  const alarm = useMeterStore(state => (state.source === 'simulation' || state.lastPacketAt !== null) && state.telemetry.alarms.length > 0)
  useFrame(({ clock }) => {
    const state = useMeterStore.getState()
    if (state.source !== 'simulation' && state.lastPacketAt === null) {
      if (pulseMaterial.current) {
        pulseMaterial.current.emissiveIntensity = 0
        pulseMaterial.current.color.set('#b56936')
      }
      lastPulse.current = -1
      return
    }
    const elapsed = clock.elapsedTime
    const pulsesPerSecond = Math.abs(state.telemetry.activePower) * state.impPerKwh / 3_600_000
    if (lastPulse.current !== state.telemetry.pulseCount) {
      if (lastPulse.current >= 0) pulseUntil.current = elapsed + 0.055
      lastPulse.current = state.telemetry.pulseCount
      lastObserved.current = elapsed
    }
    // The counter remains exact. Above 8 Hz the lens animation is visibly decimated
    // to avoid temporal aliasing; a reduced-motion preference renders a steady lens.
    const active = !state.paused && elapsed - lastObserved.current < 0.4
    const on = reducedMotion
      ? !state.paused && pulsesPerSecond > 0 && (state.connection === 'simulated' || state.connection === 'connected')
      : active && (pulsesPerSecond > 8 ? elapsed % 0.125 < 0.035 : elapsed < pulseUntil.current)
    if (pulseMaterial.current) {
      pulseMaterial.current.emissiveIntensity = on ? 3 : 0.03
      pulseMaterial.current.color.set(on ? '#ffbe7c' : '#b56936')
    }
  })
  return <group position={[0, -0.275, 0.32]}>
    {[-0.285, 0, 0.285].map(x => <Cylinder key={x} radius={0.042} depth={0.021} position={[x, 0, 0]} color="#748077" metalness={0.55} />)}
    <mesh position={[0, 0, 0.015]}>
      <sphereGeometry args={[0.032, 20, 16]} />
      <meshStandardMaterial ref={pulseMaterial} color="#b56936" emissive="#ff862d" emissiveIntensity={0.03} roughness={0.22} />
    </mesh>
    <mesh position={[-0.285, 0, 0.015]}>
      <sphereGeometry args={[0.031, 20, 16]} />
      <meshStandardMaterial color={alarm ? '#ff4b31' : '#743d30'} emissive="#ff422a" emissiveIntensity={alarm ? 2.8 : 0} roughness={0.22} />
    </mesh>
    <mesh position={[0.285, 0, 0.015]}>
      <sphereGeometry args={[0.031, 20, 16]} />
      <meshStandardMaterial color={reverseEnergy ? '#23e5a0' : '#315149'} emissive="#12de96" emissiveIntensity={reverseEnergy ? 2.6 : 0} roughness={0.22} />
    </mesh>
  </group>
}

function PrintedBoard({ thermal, temperature }: { thermal: boolean; temperature: number }) {
  const texture = usePrintedTexture(printBoard)
  return <group>
    <Cylinder radius={1.29} depth={0.07} position={[0, 0, -0.2]} color={thermal ? heatColor(temperature) : '#71817b'} metalness={0.65} />
    <Cylinder radius={1.17} depth={0.058} position={[0, 0, -0.115]} color={thermal ? heatColor(temperature + 8) : '#124336'} roughness={0.56} />
    <mesh position={[0, 0, -0.084]}>
      <circleGeometry args={[1.17, 96]} />
      <meshStandardMaterial map={thermal ? null : texture} color={thermal ? heatColor(temperature + 8) : '#ffffff'} roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.06, -0.005]} castShadow>
      <boxGeometry args={[0.46, 0.39, 0.14]} />
      <meshStandardMaterial color={thermal ? heatColor(temperature + 16) : '#242b2c'} roughness={0.6} />
    </mesh>
    {Array.from({ length: 12 }, (_, i) => <mesh key={`ic-${i}`} position={[-0.2 + i % 6 * 0.08, i < 6 ? 0.285 : -0.17, -0.06]}>
      <boxGeometry args={[0.031, 0.13, 0.025]} />
      <meshStandardMaterial color="#b8bab3" metalness={0.86} roughness={0.3} />
    </mesh>)}
    {[-0.73, 0.73].map((x, index) => <group key={x} position={[x, 0.04, -0.015]}>
      <mesh castShadow>
        <torusGeometry args={[0.22, 0.075, 12, 32]} />
        <meshStandardMaterial color={thermal ? heatColor(temperature + 20) : '#b38148'} metalness={0.7} roughness={0.36} />
      </mesh>
      {Array.from({ length: 12 }, (_, winding) => {
        const angle = winding / 12 * Math.PI * 2
        return <mesh key={winding} position={[Math.cos(angle) * 0.215, Math.sin(angle) * 0.215, 0.012]} rotation={[0, 0, angle]}>
          <boxGeometry args={[0.12, 0.028, 0.13]} />
          <meshStandardMaterial color={thermal ? heatColor(temperature + 24) : '#d9aa68'} metalness={0.73} roughness={0.3} />
        </mesh>
      })}
      <mesh position={[0, index ? -0.57 : 0.57, -0.015]}>
        <boxGeometry args={[0.24, 0.3, 0.15]} />
        <meshStandardMaterial color="#2c3633" roughness={0.55} />
      </mesh>
    </group>)}
    {[[-0.48, -0.6], [-0.21, -0.72], [0.52, 0.58]].map(([x, y]) => <Cylinder key={`${x}-${y}`} radius={0.084} depth={0.19} position={[x, y, 0.01]} color={thermal ? heatColor(temperature + 5) : '#344251'} metalness={0.36} roughness={0.38} />)}
    {[-0.66, 0.66].flatMap(x => [-0.65, 0.65].map(y => <Cylinder key={`${x}-${y}`} radius={0.065} depth={0.34} position={[x, y, -0.28]} color="#b79c64" metalness={0.65} />))}
  </group>
}

const annotationStyle = {
  display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' as const,
  color: '#48565b', font: '500 10px "IBM Plex Mono", monospace',
  padding: '7px 10px', border: '1px solid #d3dde0', borderRadius: 4,
  background: 'rgba(255,255,255,.92)', boxShadow: '0 2px 8px #18323f07',
  pointerEvents: 'none' as const,
}

/** Procedural visual reference, not a certified manufacturer mechanical drawing. */
export default function MeterModel({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const exploded = useMeterStore(state => state.exploded)
  const thermal = useMeterStore(state => state.thermal && (state.source === 'simulation' || state.lastPacketAt !== null))
  const annotations = useMeterStore(state => state.annotations)
  const narrowViewport = useThree(state => state.size.width < 500)
  const temperature = useMeterStore(state => state.telemetry.temperature)
  const baseRef = useRef<THREE.Group>(null)
  const boardRef = useRef<THREE.Group>(null)
  const faceRef = useRef<THREE.Group>(null)
  const coverRef = useRef<THREE.Group>(null)
  const frontFacingRef = useRef(true)
  const [frontFacing, setFrontFacing] = useState(true)
  const nameplate = usePrintedTexture(printNameplate)
  const dome = useMemo(() => new THREE.LatheGeometry([
    new THREE.Vector2(1.505, -0.26), new THREE.Vector2(1.512, -0.16),
    new THREE.Vector2(1.505, 0.2), new THREE.Vector2(1.482, 0.54),
    new THREE.Vector2(1.465, 0.65), new THREE.Vector2(1.421, 0.725),
    new THREE.Vector2(1.35, 0.754), new THREE.Vector2(1.1, 0.77),
    new THREE.Vector2(0.65, 0.789), new THREE.Vector2(0, 0.794),
  ], 128), [])
  useEffect(() => () => dome.dispose(), [dome])
  useFrame(({ camera }, delta) => {
    const facesFront = camera.position.z > 0
    if (facesFront !== frontFacingRef.current) {
      frontFacingRef.current = facesFront
      setFrontFacing(facesFront)
    }
    const rate = reducedMotion ? 1 : 1 - Math.exp(-delta * 6)
    const layers: [THREE.Group | null, number][] = [
      [baseRef.current, exploded ? -1.25 : 0], [boardRef.current, exploded ? -0.4 : 0],
      [faceRef.current, exploded ? 0.85 : 0], [coverRef.current, exploded ? 2.15 : 0],
    ]
    for (const [layer, target] of layers) if (layer) layer.position.z = THREE.MathUtils.lerp(layer.position.z, target, rate)
  })
  return <group>
    <group ref={baseRef}>
      <Cylinder radius={1.515} depth={0.275} position={[0, 0, -0.455]} color={thermal ? heatColor(temperature - 4) : '#222a2c'} roughness={0.47} />
      <Cylinder radius={1.42} depth={0.095} position={[0, 0, -0.61]} color="#151e21" roughness={0.65} />
      <Ring radius={1.455} tube={0.046} z={-0.58} color="#333f43" metalness={0.28} />
      <Ring radius={1.49} tube={0.05} z={-0.31} />
      {Array.from({ length: 20 }, (_, index) => {
        const angle = index / 20 * Math.PI * 2
        return <mesh key={index} position={[Math.sin(angle) * 1.498, Math.cos(angle) * 1.498, -0.445]} rotation={[0, 0, -angle]} castShadow>
          <boxGeometry args={[0.085, 0.043, 0.2]} />
          <meshStandardMaterial color="#394245" roughness={0.52} metalness={0.22} />
        </mesh>
      })}
      {[-0.65, 0.65].flatMap(x => [-0.62, 0.62].map(y => <group key={`${x}-${y}`} position={[x, y, -0.67]}>
        <Cylinder radius={0.235} depth={0.045} color="#10191d" roughness={0.72} />
        <TerminalBlade thermal={thermal} temperature={temperature} />
        <Screw position={[0.145, 0, -0.02]} radius={0.038} />
      </group>))}
      <mesh position={[0, 0, -0.665]}>
        <boxGeometry args={[0.32, 0.71, 0.05]} />
        <meshStandardMaterial color="#2e373b" roughness={0.75} />
      </mesh>
      {[-1.0, 1.0].map(x => <Screw key={x} position={[x, 0, -0.65]} />)}
    </group>
    <group ref={boardRef}>
      <PrintedBoard thermal={thermal} temperature={temperature} />
    </group>
    <group ref={faceRef}>
      <Cylinder radius={1.338} depth={0.087} position={[0, 0, 0.251]} color={thermal ? heatColor(temperature + 3) : '#dfe2d9'} roughness={0.54} />
      <mesh position={[0, 0, 0.297]} receiveShadow>
        <circleGeometry args={[1.316, 128]} />
        <meshBasicMaterial map={nameplate} color={thermal ? heatColor(temperature - 9) : '#ffffff'} toneMapped={false} />
      </mesh>
      <Ring radius={1.326} tube={0.014} z={0.286} color="#e0e4db" metalness={0.18} />
      <LiveRegister />
      <MeterLeds reducedMotion={reducedMotion} />
      <group position={[0.727, -0.66, 0.32]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.066, 0.15, 6, 20]} />
          <meshStandardMaterial color="#394449" roughness={0.26} metalness={0.65} />
        </mesh>
        {[-0.067, 0.067].map(x => <Cylinder key={x} radius={0.043} depth={0.021} position={[x, 0, 0.062]} color="#182125" roughness={0.12} metalness={0.42} />)}
      </group>
      {[Math.PI / 2, 3 * Math.PI / 2].map(angle =>
        <Screw key={angle} position={[Math.cos(angle) * 1.377, Math.sin(angle) * 1.377, 0.205]} radius={0.037} />)}
    </group>
    <group ref={coverRef}>
      <mesh geometry={dome} rotation={[Math.PI / 2, 0, 0]} renderOrder={5}>
        <meshPhysicalMaterial
          color={thermal ? '#d1f0f3' : '#ffffff'} roughness={0.1} transmission={0.95}
          ior={1.5} transparent opacity={thermal ? 0.18 : 0.3} thickness={0.045}
          metalness={0} clearcoat={1} clearcoatRoughness={0.06} envMapIntensity={0.55}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
      <Ring radius={1.497} tube={0.026} z={-0.24} />
      <Ring radius={1.496} tube={0.016} z={-0.148} color="#d8e2e1" metalness={0.6} />
      <Ring radius={1.415} tube={0.013} z={0.726} color="#c6d5d3" metalness={0.38} />
      <mesh position={[0.0, -1.51, -0.193]} castShadow>
        <boxGeometry args={[0.26, 0.13, 0.15]} />
        <meshStandardMaterial color="#a2adb1" metalness={0.87} roughness={0.3} />
      </mesh>
      <Screw position={[0, -1.505, -0.104]} radius={0.038} />
    </group>
    {annotations && frontFacing && <>
      <Html position={exploded ? [0, 1.7, 1.15] : [-1.66, 0.7, 0.5]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div style={annotationStyle}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#0c9d87' }} />LIVE REGISTER</div>
      </Html>
      {!narrowViewport && <Html position={exploded ? [0, -1.65, 1.15] : [1.6, -0.55, 0.14]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div style={annotationStyle}>OPTICAL IR PORT</div>
      </Html>}
      {exploded && !narrowViewport && <Html position={[0, -1.7, -1.92]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div style={annotationStyle}>4-BLADE SOCKET</div>
      </Html>}
    </>}
    {annotations && !frontFacing && <Html position={narrowViewport ? [0, 1.7, exploded ? -1.92 : -0.8] : [-1.25, -0.94, exploded ? -1.92 : -0.8]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div style={annotationStyle}>{narrowViewport ? '4 TERMINAL BLADES' : 'FORM 2S · 4 TERMINAL BLADES'}</div>
    </Html>}
  </group>
}
