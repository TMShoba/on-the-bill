import { useEffect, useRef } from "react";

type Props = {
  className?: string;
  /** particle count — keep modest for mobile */
  count?: number;
  /** emerald-tinted for brand, or soft white */
  tone?: "emerald" | "white" | "mixed";
  opacity?: number;
};

/**
 * Lightweight canvas particle field — soft drifting dots + faint links.
 * Respects prefers-reduced-motion (static sparse dots only).
 */
export default function ParticleBackground({
  className = "",
  count = 48,
  tone = "mixed",
  opacity = 0.85,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; c: string };
    let particles: P[] = [];

    const colors =
      tone === "emerald"
        ? ["#10b981", "#34d399", "#6ee7b7"]
        : tone === "white"
          ? ["#ffffff", "#e2e8f0", "#94a3b8"]
          : ["#10b981", "#34d399", "#ffffff", "#94a3b8"];

    function resize() {
      const parent = canvas!.parentElement;
      w = parent?.clientWidth || window.innerWidth;
      h = parent?.clientHeight || window.innerHeight;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      const n = Math.max(12, Math.floor(count * (w < 640 ? 0.55 : 1)));
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1 + Math.random() * 2.2,
        a: 0.25 + Math.random() * 0.55,
        c: colors[Math.floor(Math.random() * colors.length)],
      }));
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.fillStyle = p.c;
        ctx!.globalAlpha = p.a * 0.6 * opacity;
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h);
      const linkDist = Math.min(120, w * 0.12);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }

      // faint constellation lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < linkDist) {
            ctx!.strokeStyle = a.c;
            ctx!.globalAlpha = (1 - d / linkDist) * 0.18 * opacity;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx!.beginPath();
        ctx!.fillStyle = p.c;
        ctx!.globalAlpha = p.a * opacity;
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    resize();
    seed();
    if (reduced) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      resize();
      seed();
      if (reduced) drawStatic();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [count, tone, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    />
  );
}
