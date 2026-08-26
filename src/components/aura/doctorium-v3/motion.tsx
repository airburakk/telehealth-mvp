"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// V3 hareket birimi — TEK yer: süre/easing brief'e sabit (200-400ms, [0.32,0.72,0,1]), yalnız
// scroll'a girişte bir kez oynar (viewport once), prefers-reduced-motion'da anında görünür
// (transform/opacity hiç oynamaz — useReducedMotion Framer'ın kendi medya-sorgusu, ayrıca CSS
// yazmaya gerek yok). "Anlam taşıyan" sınırı: yalnız bölüm girişleri; kart/ikon düzeyi YOK.
const EASE = [0.32, 0.72, 0, 1] as const;

export function FadeInUp({
  children, delay = 0, className,
}: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
