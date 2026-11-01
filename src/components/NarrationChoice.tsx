"use client";

export function NarrationChoice({ onChoose }: { onChoose: (enabled: boolean) => void }) {
  return (
    <section aria-label="Escolha da narração" className="mb-5 rounded-2xl border border-amber-300/30 bg-slate-950/70 p-4 text-center">
      <p className="font-serif text-lg text-amber-100">Gostaria de ouvir as leituras?</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => onChoose(true)}
          className="min-h-12 rounded-xl border border-amber-300 bg-amber-300/15 px-4 text-sm font-semibold text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          Ouvir as leituras
        </button>
        <button
          type="button"
          onClick={() => onChoose(false)}
          className="min-h-12 rounded-xl border border-slate-500 px-4 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          Continuar só com texto
        </button>
      </div>
    </section>
  );
}
