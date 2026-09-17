import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Soft page enter animation. Wrap page root content (not sticky chrome).
 * Uses location.key so each navigation re-triggers.
 */
export default function PageTransition({ children, className = "" }: Props) {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
