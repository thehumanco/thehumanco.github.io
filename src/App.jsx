import { useEffect, useState } from "react"
import { Analytics } from "@vercel/analytics/react"
import logoUrl from "./assets/logo.svg"
import "./App.css"

function App() {
  // Animation phases:
  // 0 = nothing visible
  // 1 = logo fades in (centered)
  // 2 = logo slides up + text fades in from bottom
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    // Kick off the fade-in shortly after mount so the transition runs.
    const fadeInTimer = setTimeout(() => setPhase(1), 100)
    // After the logo has faded in AND lingered alone, start the slide + text reveal.
    const slideTimer = setTimeout(() => setPhase(2), 2500)
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
      {/* Hidden SVG holding the paintbrush/texture filter, reused by CSS via filter: url(#paint) */}
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter id="paint">
            {/* baseFrequency: higher = finer grain. Tune ~0.8–1.5 for a fine paper tooth. */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            {/* scale: how far edges are pushed. 1 = subtle, 2–3 = rough/painterly. */}
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

      {/* Logo */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: phase < 2 ? "50%" : "30vh",
          transform: "translate(-50%, -50%)",
          width: "min(30vh, 30vw)",
          height: "min(30vh, 30vw)",
          opacity: phase === 0 ? 0 : 1,
          transition:
            "opacity 1.5s ease, top 1.0s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <img
          src={logoUrl}
          alt="Mecha logo"
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Text blurb — fades in from the bottom of the screen, lands toward center (~70vh). */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: phase < 2 ? "100vh" : "70vh",
          transform: "translate(-50%, -50%)",
          opacity: phase < 2 ? 0 : 1,
          transition:
            "opacity 1.5s ease, top 1.0s cubic-bezier(0.4, 0, 0.2, 1)",
          letterSpacing: "0.05rem",
          lineHeight: "1.5",
          textAlign: "center",
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
