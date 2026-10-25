"use client";

import { useEffect, useRef, useState } from "react";

// One short transition for the real revealed position; no shuffle or generation.
export function useRevealTransition(sessionId: string): number | null {
  const [position, setPosition] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string; position: number }>).detail;
      if (detail?.sessionId !== sessionId || !Number.isInteger(detail.position) || detail.position < 1) return;
      clearTimeout(timer.current);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPosition(null); return; }
      setPosition(detail.position);
      timer.current = setTimeout(() => setPosition(null), 620);
    };
    window.addEventListener("oracle-reveal", reveal);
    return () => { clearTimeout(timer.current); window.removeEventListener("oracle-reveal", reveal); };
  }, [sessionId]);
  return position;
}
