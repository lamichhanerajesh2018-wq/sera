"use client";

// The centerpiece "Interactive Interest Graph" — pick an interest and watch it
// expand into the ecosystem SERA discovers around it: people, communities,
// projects, businesses, software, learning, events and jobs. Click a chip to
// re-center the graph; hover a node to see what it represents.
import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Category =
  | "People"
  | "Community"
  | "Project"
  | "Business"
  | "Software"
  | "Learning"
  | "Event"
  | "Job";

interface GraphNode {
  icon: string;
  label: string;
  type: Category;
}

interface Interest {
  key: string;
  label: string;
  gradient: string;
  nodes: GraphNode[];
}

const INTERESTS: Interest[] = [
  {
    key: "ai",
    label: "Artificial Intelligence",
    gradient: "from-indigo-400 via-violet-400 to-cyan-300",
    nodes: [
      { icon: "🧑‍🔬", label: "AI Researchers to follow", type: "People" },
      { icon: "🌐", label: "AI Builders community", type: "Community" },
      { icon: "🚀", label: "Open-source LLM project", type: "Project" },
      { icon: "🏢", label: "AI startups hiring now", type: "Business" },
      { icon: "🛠️", label: "Vector database tools", type: "Software" },
      { icon: "📚", label: "ML engineering course", type: "Learning" },
      { icon: "🎟️", label: "AI Summit 2026", type: "Event" },
      { icon: "💼", label: "ML engineer roles", type: "Job" },
    ],
  },
  {
    key: "design",
    label: "Product Design",
    gradient: "from-fuchsia-400 via-violet-400 to-indigo-300",
    nodes: [
      { icon: "🎨", label: "Designers with your taste", type: "People" },
      { icon: "🌐", label: "Design systems community", type: "Community" },
      { icon: "🧩", label: "Open design-kit project", type: "Project" },
      { icon: "🏢", label: "Product studios to watch", type: "Business" },
      { icon: "🛠️", label: "Prototyping tools", type: "Software" },
      { icon: "📚", label: "UX research course", type: "Learning" },
      { icon: "🎟️", label: "Design conference nearby", type: "Event" },
      { icon: "💼", label: "Product designer roles", type: "Job" },
    ],
  },
  {
    key: "fitness",
    label: "Fitness & Wellness",
    gradient: "from-emerald-400 via-cyan-400 to-indigo-300",
    nodes: [
      { icon: "🏃", label: "Coaches near you", type: "People" },
      { icon: "🌐", label: "Morning runners community", type: "Community" },
      { icon: "📱", label: "Habit-tracking app project", type: "Project" },
      { icon: "🏢", label: "Wellness studios hiring", type: "Business" },
      { icon: "🛠️", label: "Recovery & training tools", type: "Software" },
      { icon: "📚", label: "Nutrition science course", type: "Learning" },
      { icon: "🎟️", label: "Local 10K next month", type: "Event" },
      { icon: "💼", label: "Wellness coach roles", type: "Job" },
    ],
  },
];

const RADIUS_X = 42; // percent
const RADIUS_Y = 40; // percent

export default function InterestGraph() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const gradientId = useId();
  const interest = INTERESTS[activeIdx];
  const count = interest.nodes.length;

  return (
    <div>
      {/* interest picker */}
      <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
        {INTERESTS.map((it, i) => (
          <button
            key={it.key}
            onClick={() => {
              setActiveIdx(i);
              setHoverIdx(null);
            }}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              i === activeIdx
                ? "border-white/20 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
            }`}
          >
            {it.label}
          </button>
        ))}
      </div>

      {/* graph */}
      <div className="relative mx-auto aspect-square w-full max-w-2xl select-none">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a5b4fc" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
          </defs>
          {interest.nodes.map((_, i) => {
            const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
            const x = 50 + RADIUS_X * Math.cos(angle);
            const y = 50 + RADIUS_Y * Math.sin(angle);
            const active = hoverIdx === i;
            return (
              <motion.line
                key={i}
                x1={50}
                y1={50}
                x2={x}
                y2={y}
                stroke={active ? `url(#${gradientId})` : "rgba(255,255,255,0.14)"}
                strokeWidth={active ? 0.6 : 0.35}
                initial={false}
                animate={{ opacity: active ? 1 : 0.7 }}
                transition={{ duration: 0.3 }}
              />
            );
          })}
        </svg>

        {/* center node */}
        <AnimatePresence mode="wait">
          <motion.div
            key={interest.key}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-1/2 z-10 flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-4 text-center backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(129,140,248,0.5)] sm:w-36"
          >
            <span
              className={`bg-gradient-to-br ${interest.gradient} bg-clip-text text-2xl font-semibold text-transparent`}
            >
              ✦
            </span>
            <p className="text-xs font-medium leading-tight text-white sm:text-sm">
              {interest.label}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Your interest</p>
          </motion.div>
        </AnimatePresence>

        {/* satellite nodes */}
        {interest.nodes.map((node, i) => {
          const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + RADIUS_X * Math.cos(angle);
          const y = 50 + RADIUS_Y * Math.sin(angle);
          const active = hoverIdx === i;
          return (
            <motion.button
              key={`${interest.key}-${i}`}
              type="button"
              onMouseEnter={() => setHoverIdx(i)}
              onFocus={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx((h) => (h === i ? null : h))}
              onBlur={() => setHoverIdx((h) => (h === i ? null : h))}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: active ? 1.08 : 1 }}
              transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.05 }}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`absolute z-20 flex w-[7.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border px-2.5 py-2.5 text-center backdrop-blur-xl transition-colors sm:w-36 ${
                active
                  ? "border-white/25 bg-white/[0.09]"
                  : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
              }`}
            >
              <span className="text-base">{node.icon}</span>
              <span className="text-[11px] font-medium leading-tight text-white/90 sm:text-xs">
                {node.label}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-white/40">{node.type}</span>
            </motion.button>
          );
        })}
      </div>

      <p className="mx-auto mt-8 max-w-md text-center text-sm text-white/40">
        Hover or tap a node to see how one interest opens into people, tools and opportunities worth knowing about.
      </p>
    </div>
  );
}
