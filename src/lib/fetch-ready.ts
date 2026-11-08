/**
 * GET de uma leitura que repete enquanto o servidor responde 202 (pago, mas a parte paga ainda está
 * sendo escrita). Cada pedido já espera até 25 s no servidor; desiste depois de `maxMs`.
 */
export async function fetchReady(url: string, maxMs = 5 * 60_000): Promise<Response> {
  const until = Date.now() + maxMs;
  for (;;) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status !== 202) return res;
    if (Date.now() > until) throw new Error("A leitura completa está demorando mais que o normal. Recarregue a página em instantes: o pagamento está guardado.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
