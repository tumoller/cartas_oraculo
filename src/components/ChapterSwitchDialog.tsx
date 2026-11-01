"use client";

import { useEffect, useRef } from "react";

export function ChapterSwitchDialog({
  isOpen,
  mode = "playing",
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  mode?: "playing" | "unheard";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (isOpen && el && !el.open) {
      el.showModal();
      confirmButton.current?.focus();
    } else if (!isOpen && el?.open) {
      el.close();
    }
    return () => {
      if (el?.open) el.close();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isPlaying = mode === "playing";
  const title = isPlaying
    ? "Deseja mudar de leitura antes de terminar de ouvir?"
    : "Deseja avançar sem ouvir o áudio desta leitura?";
  const confirmText = isPlaying ? "Mudar de leitura" : "Avançar sem ouvir";
  const cancelText = isPlaying ? "Continuar ouvindo" : "Continuar nesta leitura";

  return (
    <dialog
      ref={dialog}
      onClose={onCancel}
      aria-labelledby="chapter-switch-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(calc(100vw-2rem),400px)] overflow-y-auto rounded-2xl border border-amber-400/40 bg-slate-950 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
    >
      <div className="flex flex-col items-center text-center">
        <h3 id="chapter-switch-title" className="font-serif text-lg text-amber-200">
          {title}
        </h3>
        <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            ref={confirmButton}
            type="button"
            onClick={onConfirm}
            className="min-h-12 flex-1 rounded-xl border border-amber-400/50 bg-amber-400/20 px-4 py-2.5 text-sm font-semibold text-amber-100 shadow-md hover:bg-amber-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 flex-1 rounded-xl border border-white/20 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </dialog>
  );
}
