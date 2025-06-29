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

      {/* Hidden measurement text */}
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

function App() {
  const mechaRef = useRef(null);
  const [innerRadius, setInnerRadius] = useState(100);
  const [ringCount, setRingCount] = useState(6);
  const ringSpacing = 30;

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
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const rings = Array.from({ length: ringCount }, (_, i) => {
    const radius = innerRadius + i * ringSpacing;
    const direction = i % 2 === 0 ? "clockwise" : "counterclockwise";
    const speed = 20 + i * 5;
    const gray = Math.floor((i / (ringCount - 1 || 1)) * 200 + 20);
    const color = `rgb(${gray},${gray},${gray})`;
    return { radius, direction, speed, color, isInner: i === 0 };
  });

  return (
    <div className="relative flex items-center justify-center w-screen h-screen bg-white overflow-hidden">
      <h1
        ref={mechaRef}
        className="text-4xl font-bold z-10 select-none pointer-events-none"
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
    </div>
  );
}

export default App;
