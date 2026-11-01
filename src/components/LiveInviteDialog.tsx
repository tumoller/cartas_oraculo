"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { sceneAssets } from "@/lib/scene-assets";

export function LiveInviteDialog({
  isOpen,
  persona,
  onAccept,
  onDismiss,
}: {
  isOpen: boolean;
  persona: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const acceptButton = useRef<HTMLButtonElement>(null);
  const art = sceneAssets(persona);

  useEffect(() => {
    const el = dialog.current;
    if (isOpen && el && !el.open) {
      el.showModal();
      acceptButton.current?.focus();
    } else if (!isOpen && el?.open) {
      el.close();
    }
    return () => {
      if (el?.open) el.close();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialog}
      onClose={onDismiss}
      aria-labelledby="live-invite-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(calc(100vw-2rem),420px)] overflow-y-auto rounded-2xl border border-cyan-400/50 bg-slate-950 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4 size-20 overflow-hidden rounded-full border-2 border-cyan-400/60 shadow-lg">
          <Image
            src={art.close}
            alt={persona}
            fill
            sizes="80px"
            className="object-cover object-top"
          />
        </div>
        <h3 id="live-invite-title" className="font-serif text-lg text-cyan-200">
          Gostaria de fazer uma pergunta ou conversar sobre sua leitura?
        </h3>
        <p className="mt-2 text-xs text-slate-300">
          Para falar pelo microfone, o navegador solicitará sua autorização ao continuar. Você também pode digitar suas dúvidas em uma conversa de até 3 minutos.
        </p>
        <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            ref={acceptButton}
            type="button"
            onClick={onAccept}
            className="min-h-12 flex-1 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            Sim, conversar
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-12 rounded-xl border border-white/20 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40"
          >
            Agora não
          </button>
        </div>
      </div>
    </dialog>
  );
}
