import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Box, RefreshCw } from 'lucide-react'
import MeterModel from './MeterModel'
import { useMeterStore } from './useMeterStore'

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  return reduced
}

function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const moving = useRef(true)
  const destination = useRef(new THREE.Vector3(3, 1.3, 6.8))
  const lookAt = useRef(new THREE.Vector3())
  const orbit = useRef(new THREE.Spherical())
  const targetOrbit = useRef(new THREE.Spherical())
  const offset = useRef(new THREE.Vector3())
  const preset = useMeterStore(state => state.cameraPreset)
  const exploded = useMeterStore(state => state.exploded)
  const { camera, size, gl } = useThree()
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const portraitFactor = Math.max(1, 1 / Math.max(0.58, aspect))
    const distance = (exploded ? 9.05 : 6.1) * portraitFactor
    const direction = preset === 'front' ? [0, 0.08, 1]
      : preset === 'terminals' ? [-0.47, 0.6, -1] : exploded ? [1.48, 0.54, 1] : [0.42, 0.19, 1]
    destination.current.set(...direction as [number, number, number]).normalize().multiplyScalar(distance)
    lookAt.current.set(0, -0.02, exploded ? 0.4 : 0)
    destination.current.add(lookAt.current)
    moving.current = true
  }, [preset, exploded, size.width, size.height])
  useEffect(() => {
    const stop = () => { moving.current = false }
    gl.domElement.addEventListener('pointerdown', stop)
    gl.domElement.addEventListener('wheel', stop, { passive: true })
    return () => {
      gl.domElement.removeEventListener('pointerdown', stop)
      gl.domElement.removeEventListener('wheel', stop)
    }
  }, [gl])
  useFrame((_, delta) => {
    if (!moving.current || !controls.current) return
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta * 5)
    // Interpolate around the device, so switching to the rear preset never
    // sends the camera through the enclosure.
    orbit.current.setFromVector3(offset.current.copy(camera.position).sub(controls.current.target))
    targetOrbit.current.setFromVector3(offset.current.copy(destination.current).sub(lookAt.current))
    const thetaDelta = THREE.MathUtils.euclideanModulo(targetOrbit.current.theta - orbit.current.theta + Math.PI, Math.PI * 2) - Math.PI
    orbit.current.theta += thetaDelta * alpha
    orbit.current.phi = THREE.MathUtils.lerp(orbit.current.phi, targetOrbit.current.phi, alpha)
    orbit.current.radius = THREE.MathUtils.lerp(orbit.current.radius, targetOrbit.current.radius, alpha)
    controls.current.target.lerp(lookAt.current, alpha)
    camera.position.setFromSpherical(orbit.current).add(controls.current.target)
    controls.current.update()
    if (camera.position.distanceToSquared(destination.current) < 0.00004) moving.current = false
  })
  return <OrbitControls
    ref={controls} makeDefault enableDamping={!reducedMotion} dampingFactor={0.085}
    minDistance={3.6} maxDistance={15} minPolarAngle={0.2} maxPolarAngle={Math.PI - 0.2}
    enablePan={false} rotateSpeed={0.65} zoomSpeed={0.7}
  />
}

function StudioEnvironment() {
  return <>
    <ambientLight intensity={0.9} />
    <hemisphereLight args={['#eef5ff', '#8a9590', 1.5]} />
    <directionalLight position={[4, 6, 5]} intensity={3.5} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0001} />
    <directionalLight position={[-5, 2, 1]} intensity={2.2} color="#d8eaf1" />
    <directionalLight position={[0, 3, -5]} intensity={2.7} color="#ffffff" />
    {/* Generated in a local cube camera: no remote HDRI or network asset. */}
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" position={[0, 5, -2]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} intensity={2.5} />
      <Lightformer form="rect" position={[-4, 1, 3]} rotation={[0, Math.PI / 2, 0]} scale={[3, 7, 1]} intensity={4} />
      <Lightformer form="rect" position={[5, 1, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[2, 6, 1]} intensity={3} />
      <Lightformer form="rect" position={[0, 1, 6]} scale={[6, 2, 1]} intensity={1} />
    </Environment>
    <Grid position={[0, -1.68, 0]} args={[18, 18]} cellSize={0.5} cellThickness={0.45} cellColor="#ced8db" sectionSize={2} sectionThickness={0.65} sectionColor="#bac9cf" fadeDistance={11} fadeStrength={1.8} infiniteGrid />
    <ContactShadows position={[0, -1.655, 0]} opacity={0.3} scale={12} blur={3.1} far={5} resolution={256} color="#476170" />
  </>
}

function CanvasLifecycle({ onLoss }: { onLoss: () => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const contextLost = (event: Event) => {
      event.preventDefault()
      onLoss()
    }
    gl.domElement.addEventListener('webglcontextlost', contextLost)
    return () => gl.domElement.removeEventListener('webglcontextlost', contextLost)
  }, [gl, onLoss])
  return null
}

function SceneFallback({ retry }: { retry: () => void }) {
  return <div role="status" style={{ minHeight: 380, height: '100%', display: 'grid', placeContent: 'center', gap: 12, textAlign: 'center', padding: 28, color: '#64747c' }}>
    <Box size={36} strokeWidth={1.1} style={{ margin: '0 auto' }} />
    <strong style={{ color: '#263b43', fontSize: 15 }}>3D viewport unavailable</strong>
    <p style={{ maxWidth: 320, margin: 0, fontSize: 13, lineHeight: 1.6 }}>Enable hardware acceleration or try another browser. Live telemetry and simulation controls remain available.</p>
    <button type="button" onClick={retry} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, width: 'fit-content', margin: '5px auto', padding: '9px 15px', border: '1px solid #b8c8ce', borderRadius: 6, background: 'white', color: '#26464f', cursor: 'pointer' }}><RefreshCw size={14} />Retry viewport</button>
  </div>
}

class SceneErrorBoundary extends Component<{ children: ReactNode; retry: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <SceneFallback retry={this.props.retry} /> : this.props.children
  }
}

export default function MeterScene() {
  const reducedMotion = useReducedMotion()
  const [attempt, setAttempt] = useState(0)
  const [lost, setLost] = useState(false)
  const retry = () => { setLost(false); setAttempt(value => value + 1) }
  return <div role="img" aria-label="Interactive three-dimensional Aituzero Form 2S smart meter. Drag to orbit; scroll to zoom. Use camera presets for precise inspection." style={{ height: '100%', width: '100%', minHeight: 360 }}>
    {lost ? <SceneFallback retry={retry} /> : <SceneErrorBoundary key={attempt} retry={retry}>
      <Canvas
        shadows="percentage" dpr={[1, 1.75]} camera={{ position: [3, 1.3, 6.8], fov: 38, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
        fallback={<SceneFallback retry={retry} />}
        onCreated={({ gl }) => { gl.setClearColor('#eff3f5', 0); gl.toneMappingExposure = 1.1 }}
      >
        <Suspense fallback={null}>
          <StudioEnvironment />
          <MeterModel reducedMotion={reducedMotion} />
          <CameraRig reducedMotion={reducedMotion} />
          <CanvasLifecycle onLoss={() => setLost(true)} />
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>}
  </div>
}
