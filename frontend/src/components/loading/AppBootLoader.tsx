import { useEffect, useState, type ReactNode } from "react";
import PageLoader from "./PageLoader";

/**
 * Shows the On the Line full-page loader until the app has had a short
 * chance to hydrate (auth, first route). Minimum display avoids flash.
 */
export default function AppBootLoader({
  children,
  minMs = 600,
}: {
  children: ReactNode;
  minMs?: number;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), minMs);
    return () => window.clearTimeout(t);
  }, [minMs]);

  if (!ready) {
    return <PageLoader message="Getting the lineup ready…" />;
  }

  return <>{children}</>;
}
