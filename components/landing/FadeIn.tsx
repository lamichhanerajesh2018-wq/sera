"use client";

// Scroll-triggered fade + rise, used throughout the redesigned landing page.
// Thin wrapper around Framer Motion's whileInView so every section animates
// consistently. Respects prefers-reduced-motion via useReducedMotion.
import { motion, useReducedMotion, type Variants } from "framer-motion";

export default function FadeIn({
  children,
  delay = 0,
  y = 24,
  className = "",
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const reduce = useReducedMotion();

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0 : 0.7, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-80px" }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
