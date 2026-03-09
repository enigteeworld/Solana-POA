"use client";

import React, { useEffect, useMemo, useState } from "react";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

type Piece = {
  id: string;
  left: number;
  delay: number;
  duration: number;
  rotate: number;
  size: number;
  opacity: number;
};

export function Celebration({ fire }: { fire: boolean }) {
  const [show, setShow] = useState(false);

  const pieces = useMemo<Piece[]>(() => {
    return Array.from({ length: 26 }).map((_, i) => ({
      id: `${i}-${Math.random().toString(16).slice(2)}`,
      left: rand(5, 95),
      delay: rand(0, 0.18),
      duration: rand(0.9, 1.35),
      rotate: rand(-120, 120),
      size: rand(6, 11),
      opacity: rand(0.65, 1),
    }));
  }, [fire]);

  useEffect(() => {
    if (!fire) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(t);
  }, [fire]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.8}px`,
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
          className="absolute top-[-24px] rounded-sm"
        />
      ))}

      <style jsx>{`
        span {
          background: linear-gradient(135deg, var(--accent-a), var(--accent-b));
          animation-name: drop;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
        @keyframes drop {
          0% {
            transform: translateY(0) rotate(0deg);
            filter: blur(0px);
          }
          100% {
            transform: translateY(110vh) rotate(520deg);
            filter: blur(0.2px);
          }
        }
      `}</style>
    </div>
  );
}