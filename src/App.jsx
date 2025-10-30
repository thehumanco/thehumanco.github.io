import { useRef, useEffect, useState } from "react"
import * as THREE from "three"
import { Canvas, useFrame } from "@react-three/fiber"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { OrbitControls } from "@react-three/drei"
import "./App.css"

function samplePointsOnGeometry(geometry, count) {
  const positionAttr = geometry.attributes.position
  let indexAttr = geometry.index
  const triangles = []

  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      triangles.push([
        indexAttr.getX(i),
        indexAttr.getX(i + 1),
        indexAttr.getX(i + 2),
      ])
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
    const area = new THREE.Triangle(a, b, c).getArea()
    totalArea += area
    cumulativeAreas.push(totalArea)
  }

  function randomPointInTriangle(a, b, c) {
    let r1 = Math.sqrt(Math.random())
    let r2 = Math.random()
    let v1 = a.clone().multiplyScalar(1 - r1)
    let v2 = b.clone().multiplyScalar(r1 * (1 - r2))
    let v3 = c.clone().multiplyScalar(r1 * r2)
    return v1.add(v2).add(v3)
  }

  const points = []
  for (let i = 0; i < count; i++) {
    const r = Math.random() * totalArea
    let low = 0, high = cumulativeAreas.length - 1
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

function normalizeGeometry(geometry) {
  geometry.computeBoundingBox()
  const boundingBox = geometry.boundingBox
  const center = new THREE.Vector3()
  boundingBox.getCenter(center)

  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) - center.x
    const y = position.getY(i) - center.y
    const z = position.getZ(i) - center.z
    position.setXYZ(i, x, y, z)
  }
  position.needsUpdate = true

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

function PointCloudGLB({ url, density = 10000 }) {
  const group = useRef()
  const materialRef = useRef()
  const timeRef = useRef({
    value: -1.0,   // or your minY start
    phase: "animating",
    waitTimer: 0,
  });

  useEffect(() => {
    const loader = new GLTFLoader()
    loader.load(url, (gltf) => {
      const scene = gltf.scene
      const points = []

      scene.traverse((child) => {
        if (child.isMesh) {
          normalizeGeometry(child.geometry)
          const meshPoints = samplePointsOnGeometry(child.geometry, density)
          points.push(...meshPoints)
        }
      })

      const positions = points.map(p => [p.x, p.y, p.z]).flat()
      const yHeights = points.map(p => p.y)

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('yHeight', new THREE.Float32BufferAttribute(yHeights, 1))

      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          time: { value: -1.0 },
          dY: { value: 0.4 },
          startOpacity: { value: 0.1 },
          endOpacity: { value: 0.5 },
          color: { value: new THREE.Color(0x3B2F2F) },  // from App.css: background
          initial: { value: 1 },   // 1 = first cycle, 0 = subsequent cycles
          blurSoftness: { value: 0.75 },  // BLUR CONTROL: 0.0 = sharp, 1.0 = very soft/blurry (default: 0.5)
        },
        vertexShader: `
          uniform float time;
          uniform float dY;
          attribute float yHeight;
          varying float vY;
          varying float bandFactor;

          void main() {
            vY = yHeight;

            float sigma = dY / 4.0;
            float center = time - dY * 0.5;
            float dist = vY - center;
            bandFactor = exp(-0.5 * (dist * dist) / (sigma * sigma));

            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            // Base size 1.5, scaled up to ~3.0 at peak of bandFactor
            gl_PointSize = 1.5 + 3.0 * bandFactor;
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float startOpacity;
          uniform float endOpacity;
          uniform float time;
          uniform float dY;
          uniform int initial;
          uniform float blurSoftness;  // Blur control
          varying float bandFactor;
          varying float vY;

          void main() {
            // Calculate distance from center of point (for circular blur)
            vec2 center = gl_PointCoord - vec2(0.5);
            float dist = length(center);
            
            // Create radial blur with adjustable softness
            // blurSoftness of 0.0 = sharp edges, 1.0 = very soft/blurry
            float blurEdge = mix(0.5, 0.1, blurSoftness);  // Edge where fade starts
            float radialFade = 1.0 - smoothstep(blurEdge, 0.5, dist);
            
            float trailingEdge = time + dY * 0.5;
            float leadingEdge = time - dY * 0.5;

            float opacity = 0.0;

            if (initial == 1) {
              // FIRST CYCLE: fully transparent ahead of band, startOpacity behind band
              if (vY > trailingEdge) {
                opacity = 0.0;
              } else {
                opacity = startOpacity;
              }
            } else {
              // SUBSEQUENT CYCLES:
              if (vY > trailingEdge) {
                opacity = startOpacity;
              } else if (vY < leadingEdge) {
                opacity = startOpacity;
              } else {
                opacity = mix(startOpacity, endOpacity, bandFactor);
              }
            }

            // Apply radial blur fade to final opacity
            opacity *= radialFade;

            gl_FragColor = vec4(color, opacity);
          }
        `
      })

      materialRef.current = material

      const pointCloud = new THREE.Points(geometry, material)
      group.current.clear()
      group.current.add(pointCloud)
    })
  }, [url, density])

  useFrame((state, delta) => {
    if (!materialRef.current) return;

    const dY = materialRef.current.uniforms.dY.value;
    const minY = -1.0;           // Adjust based on your geometry normalization
    const maxY = 1.0 + dY;       // Upper bound for animation

    if (!timeRef.current.phase) {
      timeRef.current.phase = "animating";
      timeRef.current.waitTimer = 0;
      timeRef.current.value = minY;
    }

    if (timeRef.current.phase === "animating") {
      timeRef.current.value += delta * 1.5;  // Animation speed

      if (timeRef.current.value >= maxY) {
        timeRef.current.value = maxY;
        timeRef.current.phase = "waiting";
        timeRef.current.waitTimer = 0;
      }

    } else if (timeRef.current.phase === "waiting") {
      timeRef.current.waitTimer += delta;

      if (timeRef.current.waitTimer >= 2.5) {  // Wait 2.5 seconds at the end
        timeRef.current.phase = "reset";
      }

    } else if (timeRef.current.phase === "reset") {
      timeRef.current.value = minY;
      timeRef.current.phase = "animating";

      // After first animation cycle, disable initial transparent state
      if (materialRef.current.uniforms.initial.value === 1) {
        materialRef.current.uniforms.initial.value = 0;
      }
    }

    materialRef.current.uniforms.time.value = timeRef.current.value;
  });

  return <group ref={group} />
}


function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 75 }} style={{ height: "100%" }}>
      <ambientLight />
      <PointCloudGLB url="/models/mecha.glb" density={40000} />
      <OrbitControls 
        enableZoom={false} 
        autoRotate={true} 
        autoRotateSpeed={10.0} 
        minDistance={1.0} 
        maxDistance={3.0}
      />
    </Canvas>
  )
}


function DownArrowButton({ targetRef }) {
  const [isHovered, setIsHovered] = useState(false)

  const handleClick = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    targetRef.current.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        height: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        opacity: isHovered ? 1 : 0.5,
        transition: "opacity 0.3s ease",
        border: "none",
        WebkitTapHighlightColor: "transparent",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
        userSelect: "none",
        outline: "none",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={{ height: "2rem", width: "2rem" }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

function TypingTextWithLinks({ parts, typingSpeed = 50, onComplete }) {
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [displayedParts, setDisplayedParts] = useState([]);

  const timeoutRef = useRef(null);

  useEffect(() => {
    if (currentPartIndex >= parts.length) {
      if (onComplete) onComplete();
      return;
    }

    const part = parts[currentPartIndex];
    const isTyped = part.type === "text" || part.type === "typingLink";

    if (!isTyped) {
      // Instantly render non-typed links (like 'whitepaper')
      setDisplayedParts((prev) => [...prev, part]);
      setCurrentPartIndex((idx) => idx + 1);
      setCharIndex(0);
    } else {
      if (charIndex < part.content.length) {
        timeoutRef.current = setTimeout(() => {
          setCharIndex((ci) => ci + 1);
        }, typingSpeed);
      } else {
        // Finished this part
        setDisplayedParts((prev) => [
          ...prev,
          { ...part, content: part.content.slice(0, charIndex) },
        ]);
        setCurrentPartIndex((idx) => idx + 1);
        setCharIndex(0);
      }
    }

    return () => clearTimeout(timeoutRef.current);
  }, [currentPartIndex, charIndex, parts, typingSpeed, onComplete]);

  const renderPart = (part, key) => {
    if (part.type === "link" || part.type === "typingLink") {
      return (
        <a
          key={key}
          href={part.href}
          target={part.href.startsWith("http") ? "_blank" : undefined}
          rel={part.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="underline"
          style={{ color: "#2F6B4F" }}
        >
          {part.content}
        </a>
      );
    } else {
      return <span key={key}>{part.content}</span>;
    }
  };

  return (
    <p className="text-lg text-neutral-600">
      {displayedParts.map((part, i) => renderPart(part, i))}

      {currentPartIndex < parts.length &&
        (() => {
          const part = parts[currentPartIndex];
          const isTyped = part.type === "text" || part.type === "typingLink";
          if (!isTyped) return null;

          return renderPart(
            { ...part, content: part.content.slice(0, charIndex) },
            "current"
          );
        })()}
    </p>
  );
}

function App() {
  const secondPageRef = useRef()
  const [secondSectionVisible, setSecondSectionVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSecondSectionVisible(true);
        } else {
          setSecondSectionVisible(false);
        }
      },
      { threshold: 0.5 } // Adjust threshold to when you want to trigger
    );

    if (secondPageRef.current) {
      observer.observe(secondPageRef.current);
    }

    return () => {
      if (secondPageRef.current) {
        observer.unobserve(secondPageRef.current);
      }
    };
  }, []);

  const cta_text = [
    { type: "text", content: "read our " },
    {
      type: "typingLink",
      content: "whitepaper",
      href: "https://docs.google.com/document/d/1tDWwM_INWMjXt9wiuTAahJqA8X7qV3vylczf01YtztU/edit?usp=sharing",
    },
    { type: "text", content: ". contact us at " },
    {
      type: "typingLink",
      content: "hello@mecha.company",
      href: "mailto:hello@mecha.company",
    },
    { type: "text", content: "." },
  ];

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
      }}
    >
      {/* First Page */}
      <section
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          scrollSnapAlign: "start",
        }}
      >
        <div className="responsive-container" style={{ height: "70vh" }}>
          <Scene />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto", // only as wide as content
            rowGap: "0.1rem",
            justifyContent: "center",         // center the grid itself
            width: "100%",                    // full width of screen
          }}
        >
          {/* Top Left: Mecha */}
          <div
            style={{
              fontWeight: 900,
              letterSpacing: "0.3em",
              textAlign: "left",
              whiteSpace: "nowrap",
            }}
          >
            mecha
          </div>

          {/* Top Right: the */}
          <div
            style={{
              fontWeight: 200,
              letterSpacing: "0.3em",
              textAlign: "right",
              opacity: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            the
          </div>

          {/* Bottom Left: human */}
          <div
            style={{
              fontWeight: 200,
              letterSpacing: "0.3em",
              textAlign: "left",
              opacity: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            human&nbsp;
          </div>

          {/* Bottom Right: company */}
          <div
            style={{
              fontWeight: 200,
              letterSpacing: "0.3em",
              textAlign: "left",
              opacity: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            company
          </div>
        </div>

        <br />
        <br />
        <DownArrowButton targetRef={secondPageRef} />
      </section>

      {/* Second Page */}
      <section
        ref={secondPageRef}
        style={{
          height: "100vh",
          width: "100vw",
          scrollSnapAlign: "start",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          letterSpacing: "0.07rem",
        }}
      >
        <div className="responsive-content">
          <div>
            {`to accelerate humanity's path to abundance, we are building foundation models for embodied intelligence at the scale of human labor.`}
          </div>
          <br />
          <div>
            {`we are backed by naval ravikant, pieter abbeel, rob fergus, milan kovac, thomas wolf, and others.`}
          </div>
          {secondSectionVisible && (
            <div style={{ visibility: secondSectionVisible ? 'visible' : 'hidden' }}>
              <TypingTextWithLinks parts={cta_text} typingSpeed={45} />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default App
