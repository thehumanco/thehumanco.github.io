import { useEffect, useRef, useState, useMemo, Suspense } from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import { Analytics } from "@vercel/analytics/react"
import logoUrl from "./assets/logo.svg"
import "./App.css"

/* ----------------------------- TUNABLE KNOBS ----------------------------- */
const MODEL_URL = "/models/mecha.glb"
const MODEL_ROTATION = [Math.PI, 0, 0] // flip upright (try [0,0,Math.PI] if mirrored)
const TARGET_HEIGHT = 1.5              // figure height in world units (feet at y=0)

const DENSITY = 100000                  // coverage ≈ count × size²; big dots need far fewer points
const POINT_SIZE = 2.0                 // dot size in px, ≈3.3× the original 1.5 (raise toward 6)
const POINT_OPACITY = 0.75             // final opacity of the cloud
const POINT_BLUR = 2.0                 // 0 = hard dots, 1 = very soft; low = solid-ish
const POINT_COLOR = 0x3b2f2f           // same brown as the text (#3B2F2F)

const DISC_SIZE = 1.5                  // logo plane size — bigger = larger phase-1 logo
const DISC_FLOOR_Y = -0.01             // floor height (just under feet to avoid z-fighting)

const SPIN_SPEED = 0.35                // trophy rotation, rad/s
const PHASE1_FADE = 1.5                // logo fade-in (s)
const LAYDOWN_DUR = 1.1                // logo lays flat at steady (linear) speed (s)
const FIGURE_FADE = 1.5                // figure fade-in duration (s)

const CAMERA_POS = [0, 1.8, 7.0]       // pull z in/out to resize the figure
const CAMERA_LOOK = [0, 0, 0]          // aims at the floor line (= screen center)
const CAMERA_FOV = 40
/* ------------------------------------------------------------------------- */

const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

// Area-weighted surface sampling.
function samplePointsOnGeometry(geometry, count) {
  const positionAttr = geometry.attributes.position
  const indexAttr = geometry.index
  const triangles = []

  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      triangles.push([indexAttr.getX(i), indexAttr.getX(i + 1), indexAttr.getX(i + 2)])
    }
  } else {
    for (let i = 0; i < positionAttr.count; i += 3) {
      triangles.push([i, i + 1, i + 2])
    }
  }

  const cumulativeAreas = []
  let totalArea = 0
  for (const tri of triangles) {
    const a = new THREE.Vector3().fromBufferAttribute(positionAttr, tri[0])
    const b = new THREE.Vector3().fromBufferAttribute(positionAttr, tri[1])
    const c = new THREE.Vector3().fromBufferAttribute(positionAttr, tri[2])
    totalArea += new THREE.Triangle(a, b, c).getArea()
    cumulativeAreas.push(totalArea)
  }

  const randomPointInTriangle = (a, b, c) => {
    const r1 = Math.sqrt(Math.random())
    const r2 = Math.random()
    return a
      .clone()
      .multiplyScalar(1 - r1)
      .add(b.clone().multiplyScalar(r1 * (1 - r2)))
      .add(c.clone().multiplyScalar(r1 * r2))
  }

  const points = []
  for (let i = 0; i < count; i++) {
    const r = Math.random() * totalArea
    let low = 0,
      high = cumulativeAreas.length - 1
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (cumulativeAreas[mid] < r) low = mid + 1
      else high = mid
    }
    const tri = triangles[low]
    const a = new THREE.Vector3().fromBufferAttribute(positionAttr, tri[0])
    const b = new THREE.Vector3().fromBufferAttribute(positionAttr, tri[1])
    const c = new THREE.Vector3().fromBufferAttribute(positionAttr, tri[2])
    points.push(randomPointInTriangle(a, b, c))
  }
  return points
}

// Sample, flip upright, scale to TARGET_HEIGHT, feet at y=0, center X/Z.
function buildPointCloud(scene) {
  const R = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(...MODEL_ROTATION)
  )
  scene.updateMatrixWorld(true)

  const pts = []
  scene.traverse((o) => {
    if (!o.isMesh) return
    const local = samplePointsOnGeometry(o.geometry, DENSITY)
    for (const p of local) {
      p.applyMatrix4(o.matrixWorld)
      p.applyMatrix4(R)
      pts.push(p)
    }
  })

  const box = new THREE.Box3().setFromPoints(pts)
  const center = new THREE.Vector3()
  box.getCenter(center)
  const scale = TARGET_HEIGHT / (box.max.y - box.min.y)
  const cx = center.x * scale,
    cz = center.z * scale,
    minY = box.min.y * scale

  const positions = new Float32Array(pts.length * 3)
  for (let i = 0; i < pts.length; i++) {
    positions[i * 3] = pts[i].x * scale - cx
    positions[i * 3 + 1] = pts[i].y * scale - minY
    positions[i * 3 + 2] = pts[i].z * scale - cz
  }
  return positions
}

function PedestalScene({ phase }) {
  const groupRef = useRef()
  const discRef = useRef()
  const { scene: gltfScene } = useGLTF(MODEL_URL)
  const { camera } = useThree()

  const [tex, setTex] = useState(null)
  const t1 = useRef(null)
  const t2 = useRef(null)
  const prevPhase = useRef(0)
  const qFace = useRef(null)
  const qFloor = useRef(null)

  // Build the static point cloud + a simple unlit dot shader once.
  const built = useMemo(() => {
    const positions = buildPointCloud(gltfScene)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        color: { value: new THREE.Color(POINT_COLOR) },
        opacity: { value: 0 },
        size: { value: POINT_SIZE },
        blurSoftness: { value: POINT_BLUR },
      },
      vertexShader: `
        uniform float size;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        uniform float blurSoftness;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          float blurEdge = mix(0.5, 0.1, blurSoftness);
          float radialFade = 1.0 - smoothstep(blurEdge, 0.5, d);
          gl_FragColor = vec4(color, opacity * radialFade);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    points.renderOrder = 2
    points.visible = false
    return { points, material }
  }, [gltfScene])

  // Aim camera and precompute disc "face camera" + "lie flat" orientations.
  useEffect(() => {
    camera.lookAt(...CAMERA_LOOK)
    const dir = new THREE.Vector3().copy(camera.position).normalize()
    qFace.current = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      dir
    )
    qFloor.current = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0)
    )
  }, [camera])

  // Rasterize SVG → texture for the disc.
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const S = 1024
      const c = document.createElement("canvas")
      c.width = c.height = S
      c.getContext("2d").drawImage(img, 0, 0, S, S)
      const texture = new THREE.CanvasTexture(c)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 16
      setTex(texture)
    }
    img.src = logoUrl
    return () => {
      cancelled = true
    }
  }, [])

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime
    const disc = discRef.current

    if (phase !== prevPhase.current) {
      if (phase === 1) t1.current = now
      if (phase === 2) t2.current = now
      prevPhase.current = phase
    }

    // PHASE 1 — logo faces camera (centered), fades in.
    if (disc && qFace.current && phase < 2) {
      disc.quaternion.copy(qFace.current)
      if (phase === 1 && t1.current != null) {
        disc.material.opacity = Math.min((now - t1.current) / PHASE1_FADE, 1)
      }
    }

    // PHASE 2 — logo lies flat into the floor; figure fades in immediately after; spin.
    if (phase >= 2 && t2.current != null) {
      const t = now - t2.current

      const layP = Math.min(t / LAYDOWN_DUR, 1)
      const le = layP // linear: immediate start, no slow tail
      if (disc && qFace.current && qFloor.current) {
        disc.material.opacity = 1
        disc.quaternion.copy(qFace.current).slerp(qFloor.current, le)
        disc.position.y = THREE.MathUtils.lerp(0, DISC_FLOOR_Y, le)
      }

      // Linear lay-down reaches flat exactly at LAYDOWN_DUR, so the instant the
      // logo is the floor, the cloud begins fading in — no separate offset needed.
      if (t >= LAYDOWN_DUR) {
        built.points.visible = true
        const p = Math.min((t - LAYDOWN_DUR) / FIGURE_FADE, 1)
        const e = easeInOutCubic(p)
        built.material.uniforms.opacity.value = POINT_OPACITY * e
        if (groupRef.current) groupRef.current.rotation.y += delta * SPIN_SPEED * e
      }
    }
  })

  return (
    <group ref={groupRef}>
      {tex && (
        <mesh ref={discRef} position={[0, 0, 0]} renderOrder={1}>
          <planeGeometry args={[DISC_SIZE, DISC_SIZE]} />
          <meshBasicMaterial
            map={tex}
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      <primitive object={built.points} />
    </group>
  )
}
useGLTF.preload(MODEL_URL)

function App() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const fadeInTimer = setTimeout(() => setPhase(1), 100)
    const slideTimer = setTimeout(() => setPhase(2), 2000)
    return () => {
      clearTimeout(fadeInTimer)
      clearTimeout(slideTimer)
    }
  }, [])

  const cta_text = (
    <>
      Read our{" "}
      <a
        href="https://docs.google.com/document/d/1tDWwM_INWMjXt9wiuTAahJqA8X7qV3vylczf01YtztU/edit?usp=sharing"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        style={{ color: "#2F6B4F" }}
      >
        whitepaper
      </a>
      . Get in touch at{" "}
      <a
        href="mailto:hello@gsi.company"
        className="underline"
        style={{ color: "#2F6B4F" }}
      >
        hello@gsi.company
      </a>
      .
    </>
  )

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Hidden SVG holding the paintbrush/texture filter for the text. */}
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id="paint"
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
            filterUnits="objectBoundingBox"
            primitiveUnits="userSpaceOnUse"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="1.2"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* 3D layer — full screen, behind the text. pointerEvents:none keeps links clickable. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <Canvas
          camera={{ position: CAMERA_POS, fov: CAMERA_FOV }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <PedestalScene phase={phase} />
          </Suspense>
        </Canvas>
      </div>

      {/* Text blurb — lower half, fades/slides in when phase === 2. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: phase < 2 ? "100vh" : "72vh",
          transform: "translate(-50%, -50%)",
          opacity: phase < 2 ? 0 : 1,
          transition: "opacity 1.1s ease-out, top 1.1s ease-out",
          letterSpacing: "0.05rem",
          lineHeight: "1.5",
          textAlign: "center",
          zIndex: 1,
        }}
      >
        <div className="responsive-content textured">
          <div>
            We are building Grounded Superintelligence, human foundation models for robotics
            vertically integrated over our operations, hardware, and software.
            We are backed by Naval Ravikant, Pieter Abbeel, Rob Fergus, Milan
            Kovac, Thomas Wolf, and others.
          </div>
          <p className="text-lg text-neutral-600" style={{ marginTop: "1.5rem" }}>
            {cta_text}
          </p>
        </div>
      </div>

      <Analytics />
    </div>
  )
}

export default App