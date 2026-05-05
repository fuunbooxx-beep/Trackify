"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";

export function Particles() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    setMounted(true);
    const newParticles = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <div className={`fixed inset-0 pointer-events-none z-[-1] overflow-hidden ${isDark ? "opacity-50" : "opacity-35"}`}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={isDark ? "absolute bg-neon-blue rounded-full shadow-[0_0_10px_rgba(0,243,255,0.8)]" : "absolute bg-primary rounded-full shadow-[0_0_10px_rgba(37,99,235,0.35)]"}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.1, 0.5, 0.1],
          }}
          transition={{
            duration: Math.random() * 3 + 4,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
