import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import PageLoader from "./PageLoader";

/**
 * Branded splash on first load. The app renders underneath straight away;
 * the splash fades out once fonts are ready (and a short minimum has passed
 * so it doesn't flash).
 */
export default function AppBootLoader({
  children,
  minMs = 450,
}: {
  children: ReactNode;
  minMs?: number;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const minWait = new Promise((r) => window.setTimeout(r, minMs));
    const fonts = document.fonts?.ready ?? Promise.resolve();
    // Never hold the app hostage to a slow font CDN
    const cap = new Promise((r) => window.setTimeout(r, 2000));
    Promise.all([minWait, Promise.race([fonts, cap])]).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [minMs]);

  return (
    <>
      {children}
      <AnimatePresence>
        {!ready && (
          <motion.div
            key="boot"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100]"
          >
            <PageLoader />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
