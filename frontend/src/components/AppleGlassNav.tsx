"use client";

import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

export type GlassNavItem = {
  name: string;
  to: string;
  end?: boolean;
  badge?: number;
};

type Props = {
  items: GlassNavItem[];
  className?: string;
};

/**
 * Apple-style glassmorphism pill nav — frosted glass, spring active pill.
 * Active tab is driven by the current route (react-router).
 */
export default function AppleGlassNav({ items, className }: Props) {
  const location = useLocation();

  function isActive(item: GlassNavItem) {
    if (item.end) {
      return location.pathname === item.to;
    }
    return (
      location.pathname === item.to ||
      location.pathname.startsWith(item.to + "/")
    );
  }

  return (
    <nav
      className={cn(
        "flex items-center gap-1 rounded-full border border-white/40 bg-white/25 p-1.5 shadow-lg shadow-black/5 ring-1 ring-black/5 backdrop-blur-xl",
        className
      )}
      aria-label="Primary"
    >
      {items.map((item) => {
        const active = isActive(item);
        return (
          <NavLink
            key={item.to + item.name}
            to={item.to}
            end={item.end}
            className={cn(
              "relative px-3.5 py-1.5 text-sm font-medium transition-colors duration-300",
              active ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {active && (
              <motion.div
                layoutId="lineup-glass-active"
                className="absolute inset-0 rounded-full bg-white/90 shadow-sm backdrop-blur-md ring-1 ring-emerald-500/20"
                transition={{ type: "spring", bounce: 0.28, duration: 0.55 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {item.name}
              {typeof item.badge === "number" && item.badge > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
