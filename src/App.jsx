import { useEffect, useRef } from "react";

export default function Landing() {
  const lines = Array(5).fill("the human company");

  return (
    <div className="flex flex-col justify-center items-start min-h-screen bg-white p-12 space-y-10">
      {/* Logo */}
      <h1 className="font-serif text-7xl font-bold">Mecha</h1>
      <div className="w-full border-t border-black"></div>

      {/* Marquee Lines */}
      <div className="space-y-2">
        {lines.map((text, idx) => (
          <Marquee key={idx} reverse={idx % 2 === 1}>
            {text}
          </Marquee>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-10 text-black text-sm">June 2025</div>
    </div>
  );
}

function Marquee({ children, reverse = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    let animationId;
    let offset = 0;

    const step = () => {
      offset += reverse ? -1 : 1;
      if (el) {
        el.style.transform = `translateX(${offset}px)`;
      }
      animationId = requestAnimationFrame(step);
    };
    step();

    return () => cancelAnimationFrame(animationId);
  }, [reverse]);

  return (
    <div className="overflow-hidden whitespace-nowrap">
      <div
        ref={ref}
        className="inline-block text-2xl font-sans text-black opacity-70"
      >
        {Array(20)
          .fill(children)
          .join(" \u00A0 \u00A0 \u00A0 ")}
      </div>
    </div>
  );
}
