"use client";

import { useEffect, useState } from "react";

export type TimedMessage = { at: number; text: string }; // at = segundos desde que `active` virou true

/** Devolve a mensagem da vez conforme os segundos decorridos desde que `active` ficou true. */
export function useElapsedMessage(active: boolean, messages: TimedMessage[]): string {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => { clearInterval(id); setElapsed(0); };
  }, [active]);
  const secs = active ? elapsed : 0;
  let text = messages[0].text;
  for (const m of messages) if (m.at <= secs) text = m.text;
  return text;
}
