export function pcmStartTime(now: number, queuedUntil: number) {
  // Pequena reserva no início/retomada; trechos já enfileirados continuam sem espaços.
  return queuedUntil > now ? queuedUntil : now + 0.18;
}
