"use client";

// Decorative hero background: a slow-drifting constellation of connected
// nodes over soft gradient light — a visual metaphor for interests expanding
// into a network of people, tools and opportunities. Purely ambient;
// aria-hidden and inert to pointer events.
import { motion, useReducedMotion } from "framer-motion";

const NODES = [
  { x: 90, y: 110 }, { x: 260, y: 60 }, { x: 430, y: 140 }, { x: 610, y: 80 },
  { x: 720, y: 190 }, { x: 170, y: 260 }, { x: 360, y: 300 }, { x: 540, y: 260 },
  { x: 680, y: 340 }, { x: 110, y: 420 }, { x: 300, y: 460 }, { x: 500, y: 430 },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7], [7, 8],
  [2, 6], [6, 9], [9, 10], [10, 11], [7, 11], [5, 9], [3, 8],
];

export default function HeroBackground() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.12] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* drifting gradient light */}
      <motion.div
        className="absolute -top-32 left-[10%] h-[30rem] w-[30rem] rounded-full bg-indigo-600/25 blur-[120px]"
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 24, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-0 right-[5%] h-[26rem] w-[26rem] rounded-full bg-violet-600/20 blur-[110px]"
        animate={reduce ? undefined : { x: [0, -30, 0], y: [0, 34, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-6rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-cyan-500/15 blur-[100px]"
        animate={reduce ? undefined : { x: [0, 24, -24, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* constellation */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.35] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]"
        viewBox="0 0 800 520"
        preserveAspectRatio="xMidYMid slice"
      >
        {EDGES.map(([a, b], i) => (
          <motion.line
            key={`${a}-${b}`}
            x1={NODES[a].x}
            y1={NODES[a].y}
            x2={NODES[b].x}
            y2={NODES[b].y}
            stroke="url(#hero-line)"
            strokeWidth={1}
            initial={{ opacity: 0.15 }}
            animate={reduce ? undefined : { opacity: [0.1, 0.4, 0.1] }}
            transition={{ duration: 6, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
          />
        ))}
        {NODES.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={i % 3 === 0 ? 4 : 2.6}
            fill="white"
            initial={{ opacity: 0.4, scale: 1 }}
            animate={reduce ? undefined : { opacity: [0.3, 0.9, 0.3], scale: [1, 1.3, 1] }}
            transition={{ duration: 4.5, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          />
        ))}
        <defs>
          <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
