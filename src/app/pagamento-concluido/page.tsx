"use client";

import { useEffect } from "react";

// Destino da janela de pagamento da InfinitePay (via /api/payment/return/<id>).
// Aberta como janela separada: avisa a aba do site e fecha. Sem janela de origem: volta ao site.
export default function PagamentoConcluido() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") || "";
    if (window.opener && !window.opener.closed) {
      try { window.opener.postMessage({ type: "oracle-payment-return", id }, window.location.origin); } catch {}
      window.close();
    }
    // Se o navegador não deixar fechar (ou não houver aba de origem), segue para o site.
    const timer = window.setTimeout(() => window.location.replace(`/?pagamento=${encodeURIComponent(id)}`), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0705", color: "#f1d9a8", fontFamily: "Georgia, serif", textAlign: "center", padding: 24 }}>
      <p>Pagamento recebido. Voltando para a sua consulta…</p>
    </main>
  );
}
