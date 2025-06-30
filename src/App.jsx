import { useEffect, useRef, useState } from "react";
import "./index.css";

const OrbitRing = ({
  radius,
  direction = "clockwise",
  speed = 30,
  color = "#111",
  forceSingleBlue = false,
}) => {
  const rotation =
    direction === "clockwise" ? "animate-spin-rotate" : "animate-spin-reverse";

  const circumference = 2 * Math.PI * radius;
  const textRef = useRef(null);
  const [repeatCount, setRepeatCount] = useState(1);

  const phrase = "the human company";

  useEffect(() => {
    if (textRef.current) {
      const singleTextWidth = textRef.current.getComputedTextLength();
      const gap = radius * 0.05;
      const neededRepeats = Math.ceil(circumference / (singleTextWidth + gap)) - 1;
      setRepeatCount(neededRepeats);
    }
  }, [circumference, radius]);

  const blueIndex = forceSingleBlue
    ? Math.floor(Math.random() * repeatCount)
    : null;

  const tspans = Array.from({ length: repeatCount }).map((_, idx) => {
    const isBlue = forceSingleBlue
      ? idx === blueIndex
      : Math.random() < 0.1;
    const fill = isBlue ? "#0984e3" : color;
    return (
      <tspan key={idx} fill={fill}>
        {phrase + "   "}
      </tspan>
    );
  });

  return (
    <svg
      viewBox="-250 -250 500 500"
      className={`absolute w-[500px] h-[500px] ${rotation}`}
      style={{ animationDuration: `${speed}s` }}
    >
      <defs>
        <path
          id={`circle-${radius}`}
          d={`
            M ${radius}, 0
            a ${radius},${radius} 0 1,1 ${-radius * 2},0
            a ${radius},${radius} 0 1,1 ${radius * 2},0
          `}
          fill="none"
        />
      </defs>

      <text
        ref={textRef}
        className="invisible text-lg"
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        {phrase}
      </text>

      <text
        className="text-lg opacity-80"
        style={{ fontFamily: "'Space Mono', monospace'" }}
      >
        <textPath href={`#circle-${radius}`} startOffset="0%">
          {tspans}
        </textPath>
      </text>
    </svg>
  );
};

function DownArrowButton({ targetRef }) {
  const [hover, setHover] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth <= 768);
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const bottomOffset = isMobile
    ? "calc(env(safe-area-inset-bottom, 16px) + 7rem)" // higher on mobile
    : "calc(env(safe-area-inset-bottom, 16px) + 2rem)"; // lower on desktop

  return (
    <button
      onClick={() => {
        if (targetRef.current) {
          targetRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }}
      aria-label="Scroll down"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="absolute left-1/2 transform -translate-x-1/2 text-gray-600 transition-colors duration-300 outline-none focus:outline-none border-none"
      style={{
        bottom: bottomOffset,
        background: "none",
        border: "none",
        cursor: "pointer",
        boxShadow: "none",
        color: hover ? "#0984e3" : "#4b5563", // Tailwind text-gray-600 fallback: #4b5563
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

function TypingText({ fullText, typingSpeed = 30, onComplete }) {
  const [displayedText, setDisplayedText] = useState("");
  const indexRef = useRef(0);
  const speedRef = useRef(typingSpeed);
  const timeoutRef = useRef(null);

  // Keep typingSpeed updated in ref
  useEffect(() => {
    speedRef.current = typingSpeed;
  }, [typingSpeed]);

  useEffect(() => {
    function typeNextChar() {
      if (indexRef.current >= fullText.length) {
        if (onComplete) onComplete();
        return;
      }

      setDisplayedText(fullText.slice(0, indexRef.current + 1));
      indexRef.current += 1;
      timeoutRef.current = setTimeout(typeNextChar, speedRef.current);
    }

    typeNextChar();

    return () => clearTimeout(timeoutRef.current);
  }, [fullText, onComplete]);

  return <span>{displayedText}</span>;
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
          style={{ color: "#0984e3" }}
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
  const mechaRef = useRef(null);
  const [innerRadius, setInnerRadius] = useState(100);
  const [ringCount, setRingCount] = useState(6);
  const ringSpacing = 30;
  const [containerWidth, setContainerWidth] = useState(500);

  const secondSectionRef = useRef(null);
  const [secondSectionVisible, setSecondSectionVisible] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (mechaRef.current) {
        const rect = mechaRef.current.getBoundingClientRect();
        const maxDim = Math.max(rect.width, rect.height);
        const computedInnerRadius = maxDim / 2 + 60;
        setInnerRadius(computedInnerRadius);

        const availableHeight = window.innerHeight * 0.6;
        const maxRadius = availableHeight / 2;
        const maxRings = Math.floor(
          (maxRadius - computedInnerRadius) / ringSpacing
        );
        setRingCount(Math.max(1, maxRings));

        // Container width = 2 * (outermost radius) + padding
        const width = (computedInnerRadius + maxRings * ringSpacing) * 2 + 60;
        setContainerWidth(width);
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!secondSectionRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSecondSectionVisible(true);
          observer.disconnect(); // Optional: stop observing once visible
        }
      },
      {
        root: null, // viewport
        threshold: 0.5, // 50% of the second section is visible
      }
    );

    observer.observe(secondSectionRef.current);

    return () => observer.disconnect();
  }, []);

  const rings = Array.from({ length: ringCount }, (_, i) => {
    const radius = innerRadius + i * ringSpacing;
    const direction = i % 2 === 0 ? "clockwise" : "counterclockwise";
    const speed = 20 + i * 5;
    const gray = Math.floor((i / (ringCount - 1 || 1)) * 200 + 20);
    const color = `rgb(${gray},${gray},${gray})`;
    return { radius, direction, speed, color, isInner: i === 0 };
  });

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
    <div className="w-screen h-screen overflow-y-scroll snap-y snap-mandatory">
      {/* ===== First Landing Section ===== */}
      <section className="relative flex items-center justify-center w-screen h-screen px-[10vw] bg-white overflow-hidden snap-start">
        <h1
          ref={mechaRef}
          className="text-4xl font-bold z-20 select-none pointer-events-none text-black"
        >
          mecha
        </h1>

        {rings.map((ring) => (
          <OrbitRing
            key={ring.radius}
            {...ring}
            forceSingleBlue={ring.isInner}
          />
        ))}
        <DownArrowButton targetRef={secondSectionRef} />
      </section>

      {/* ===== Second Info/Contact Section ===== */}
      <section
        ref={secondSectionRef}
        className="w-screen h-screen flex items-center justify-center px-[10vw] bg-[#f5f7fa] snap-start"
      >
        <div
          className="flex flex-col gap-8"
          style={{ maxWidth: `${containerWidth}px` }}
        >
          <div className="text-center">
            <p className="text-lg text-neutral-600">
              {`we exist at a precipice of human experience, magnified by artificial intelligence.`}
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg text-neutral-600">
              {`to accelerate humanity's path to future abundance, we are building human foundation models for embodied intelligence, trained and scaled on the collective of human behaviors.`}
            </p>
          </div>
          {secondSectionVisible && (<div className="text-center">
            <TypingTextWithLinks parts={cta_text} typingSpeed={45} />
          </div>)}
        </div>
      </section>
    </div>
  );
}

export default App;
