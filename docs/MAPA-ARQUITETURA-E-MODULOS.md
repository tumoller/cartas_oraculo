# Arquitetura e módulos

Referência do código local em 26/10/2026. Status e prioridades ficam no [estado](ESTADO-DO-PROJETO.md).

## Estrutura

Next.js App Router, React e TypeScript; Prisma/PostgreSQL; Gemini para interpretação, TTS e Live. Versões e comandos em `package.json`. PostgreSQL é configurado por `DATABASE_URL`; o fornecedor não é fixado pelo esquema.

| Responsabilidade | Arquivos principais |
|---|---|
| Entrada, estilos, tema, pergunta e referências de histórico | `src/app/page.tsx` |
| Explicação pública | `src/app/como-funciona/page.tsx` |
| Criação e reutilização de tentativa | `src/app/api/reading/start/route.ts` |
| Recuperação da leitura, unlock demo e exportação | `src/app/api/reading/[id]/` |
| Cinco cartas e contingência local | `src/lib/gemini.ts` |
| Modalidades, posições e capítulos | `src/lib/spreads.ts`, `spread-config.ts`, `reading-chapters.ts` |
| Seleção dentro de grupos | `src/lib/spread-navigation.ts` |
| Saneamento e cookie de acesso | `src/lib/sanitize.ts`, `reading-access.ts` |
| Mesa e interpretação | `src/components/ReadingBoard.tsx`, `SpreadBoard.tsx`, `ConsultationTable.tsx`, `ConsultationReadingPane.tsx` |
| Cena e espaço de leitura | `src/components/ConsultationScene.tsx`, `ConsultationWorkspace.tsx` |
| Narração e worker | `src/lib/audio.ts`, `consultation-audio.ts`, `scripts/audio-worker.cjs` |
| Conversa experimental | `src/lib/live.ts`, `live-playback.ts`, `src/components/LiveConsultation.tsx` |
| Preferências e manifesto de sons | `src/lib/sound-preference.ts`, `soundscape.ts`, `reading-font.ts` |
| Dados persistidos | `prisma/schema.prisma` — `ReadingSession` |
| Artes e acolhimentos | `public/cards/`, `public/audio/`; retratos referenciados por `src/lib/scene-assets.ts` |

## Fluxo da consulta

1. Cliente envia modalidade, estilo, tema, pergunta e identidade da tentativa. Servidor valida entrada.
2. Sorteio é persistido antes da interpretação. Tentativa pronta é reutilizada; retentativa preserva mesa.
3. Interpretação e metadados são salvos. Resposta passa pelo saneamento e recebe cookie assinado.
4. Interface revela posições já sorteadas. Revelar, navegar, aumentar fonte e reabrir não criam outra leitura.
5. Prévia de cinco libera três cartas; campos pagos ficam protegidos no servidor. `unlock` atual é demonstração.
6. Texto completo pode ser exportado. Narração exige pedido explícito de capítulo permitido e usa texto salvo, nunca texto arbitrário do cliente.

O esquema registra cartas/leitura em JSON, estado e acesso pago. Não há entidades de pedido financeiro, usuário ou confirmação de gateway no esquema atual.

## Texto, áudio e Live

- Cinco cartas possuem contingência local; modalidades maiores exigem chave/modelo. Não prometer que todas funcionam sem IA.
- Novas narrações: três cartas `section1`; cinco `synthesis`; nove `section1–3` e `synthesis`; 36 `section1–4` e `synthesis`. Capítulos antigos já gravados continuam acessíveis por download autorizado, sem reabrir geração indiscriminada.
- Áudio usa arquivos privados e estados em `.data/audio` ou `ORACLE_AUDIO_DIR`, cache e até três tentativas transitórias por job. Web e worker precisam enxergar o mesmo armazenamento.
- Live usa leitura salva, token efêmero e reserva em `.data/live`. Flag, acesso completo e reserva são controles existentes; não equivalem a limite financeiro por tempo no servidor.
- Artes, seleção e títulos podem evoluir sem regenerar interpretações/áudios salvos. Preservar IDs, ordem e posições.
