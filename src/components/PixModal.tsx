"use client";

import React, { useState } from "react";
import { Lock, Sparkles, X, Loader2 } from "lucide-react";
import { ReadingSessionPayload } from "@/types";

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onSuccess: (updatedSession: ReadingSessionPayload) => void;
}

export const PixModal: React.FC<PixModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  onSuccess,
}) => {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const price = process.env.NEXT_PUBLIC_READING_PRICE || "R$ 14,90";
  const handleSimulatePayment = async () => {
    setIsUnlocking(true);
    setErrorMsg(null);

    try {
      const response = await fetch(`/api/reading/${sessionId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível abrir a leitura completa.");
      }

      onSuccess(data.session);
      onClose();
    } catch (err: any) {
      console.error("Erro no unlock:", err);
      setErrorMsg(err.message || "Erro inesperado. Tente novamente.");
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="pix-title" className="relative w-full max-w-md bg-linear-to-b from-slate-900 via-slate-950 to-slate-900 border border-purple-500/40 rounded-2xl p-6 shadow-2xl cosmic-card-glow">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-900/50 border border-purple-400/50 mb-3 shadow-lg">
            <Lock className="w-6 h-6 text-purple-300" />
          </div>
          <h3 id="pix-title" className="text-xl font-bold text-slate-100 font-serif">
            Abrir a leitura completa
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Veja a continuação da carta 3, as cartas 4 e 5 e o resumo final.
          </p>
        </div>

        {/* Card do Preço */}
        <div className="flex items-baseline justify-center gap-2 py-3 px-4 rounded-xl bg-purple-950/40 border border-purple-500/30 mb-5">
          <span className="text-xs uppercase tracking-wider text-purple-300">
            Valor ilustrativo:
          </span>
          <span className="text-2xl font-extrabold text-amber-400 font-mono">
            {price}
          </span>
          <span className="text-xs text-slate-400">(sem cobrança)</span>
        </div>

        {/* Mensagem de Erro (se houver) */}
        {errorMsg && (
          <div role="alert" className="p-3 mb-4 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs text-center">
            {errorMsg}
          </div>
        )}

        {/* BOTÃO DE SIMULAÇÃO (PROTÓTIPO MVP) */}
        <button
          onClick={handleSimulatePayment}
          disabled={isUnlocking}
          className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isUnlocking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              Abrindo sua leitura...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-slate-950" />
              Abrir leitura completa
            </>
          )}
        </button>

        <p className="text-[11px] text-slate-500 text-center mt-3">
          Esta é uma demonstração. Nenhum pagamento será solicitado ou feito.
        </p>
      </div>
    </div>
  );
};
