"use client";

import type { ReactNode } from "react";
import type { ReadingSessionPayload } from "@/types";
import { SPREADS } from "@/lib/spread-config";
import { ConsultationScene } from "./ConsultationScene";
import { OraclePortrait } from "./OraclePortrait";

export function ConsultationWorkspace({
  session,
  table,
  onToggleImmersive,
  children,
}: {
  session: ReadingSessionPayload;
  table: ReactNode;
  onToggleImmersive?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="consultation-workspace mx-auto w-full max-w-[1560px] px-2 pb-24 pt-3 sm:px-5 lg:px-8">
      <header className="mb-5 text-center">
        <div className="mx-auto mb-2 flex max-w-6xl items-center justify-between gap-3 px-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-200">{session.persona}</p>
          {onToggleImmersive && (
            <button
              type="button"
              onClick={onToggleImmersive}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-950/40 px-4 py-1.5 text-xs font-semibold text-amber-100 hover:border-amber-300 hover:bg-amber-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 transition-colors"
              aria-label="Alternar para visão imersiva"
            >
              <span aria-hidden="true">✦</span>
              <span>Visão imersiva</span>
            </button>
          )}
        </div>
        <h1 className="mt-1 font-serif text-xl text-slate-100 sm:text-2xl lg:text-3xl">
          {SPREADS[session.spread || "line5"].title}
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          {session.userName} · {session.theme}
        </p>
      </header>
      <div className="consultation-columns grid w-full min-w-0 grid-cols-1 items-start gap-5 xl:gap-8">
        <aside className="consultation-table-panel w-full min-w-0">
          <ConsultationScene session={session} variant="tabletop" onToggleImmersive={onToggleImmersive}>
            {table}
          </ConsultationScene>
        </aside>
        <section
          aria-label="Leitura e áudio"
          className="consultation-reading w-full min-w-0 rounded-3xl p-5 shadow-xl sm:p-7 xl:p-8"
        >
          <div className="consultation-reading-portrait relative mb-5 hidden h-72 overflow-hidden rounded-2xl lg:block">
            <OraclePortrait persona={session.persona} preparing={false} playing={false} />
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
