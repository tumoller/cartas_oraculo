"use client";

import { useEffect } from "react";

// Destino da janela de pagamento da InfinitePay (via /api/payment/return/<id>).
// Aberta como janela separada: avisa a aba do site e fecha. Sem janela de origem: volta ao site.
export default function PagamentoConcluido() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "";
    const to = params.get("to") || "";
    const page = ["/baralho-cigano", "/mapa-astral", "/numerologia"].includes(to) ? to : "/baralho-cigano";
    if (window.opener && !window.opener.closed) {
      try { window.opener.postMessage({ type: "oracle-payment-return", id }, window.location.origin); } catch {}
      window.close();
    }
    // Se o navegador não deixar fechar (ou não houver aba de origem), segue para o site.
    const timer = window.setTimeout(() => window.location.replace(`${page}?pagamento=${encodeURIComponent(id)}`), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0705", color: "#f1d9a8", fontFamily: "Georgia, serif", textAlign: "center", padding: 24 }}>
      <p>Pagamento recebido. Voltando para a sua consulta…</p>
    </main>
  );
}
