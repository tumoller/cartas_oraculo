"use client";

import type { ReactNode } from "react";
import type { ReadingSessionPayload } from "@/types";
import { SPREADS } from "@/lib/spread-config";
import { ConsultationScene } from "./ConsultationScene";

export function ConsultationWorkspace({ session, table, children }: {
  session: ReadingSessionPayload;
  table: ReactNode;
  children: ReactNode;
}) {
  return <div className="consultation-workspace mx-auto w-full max-w-[1600px] pb-24 pt-3 sm:px-3">
    <header className="mb-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-200">{session.persona}</p>
      <h1 className="mt-1 font-serif text-xl text-slate-100 sm:text-2xl">{SPREADS[session.spread || "line5"].title}</h1>
      <p className="mt-1 text-sm text-slate-300">{session.userName} · {session.theme}</p>
    </header>
    <div className="consultation-columns grid min-w-0 grid-cols-1 items-start gap-5 xl:gap-8">
      <aside className="min-w-0"><ConsultationScene session={session} variant="tabletop">{table}</ConsultationScene></aside>
      <section aria-label="Leitura e áudio" className="consultation-reading min-w-0 rounded-3xl p-5 shadow-xl sm:p-7 xl:p-8">{children}</section>
    </div>
  </div>;
}
