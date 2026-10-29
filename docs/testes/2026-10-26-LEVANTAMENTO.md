# Evidência do levantamento — 26/10/2026

## Escopo

Código local em `3a5ff094377da80ef9b71f274db587809f378991`, árvore inicialmente sem alterações. Inspecionados README, plano de áudio/cena, Git, esquema Prisma, scripts, testes e fluxos de consulta/áudio/Live. Duas revisões delegadas foram confrontadas com arquivos locais. GPT-6 Sol foi usado; a primeira revisão terminou em alto antes da correção do usuário, a segunda usou médio. Regra vigente: sempre médio.

Consultado formato do README do Dashboard Consignado para manter organização por assunto. Registros históricos de 22–25/10 recuperaram decisões e incidente de conectividade, sem prova de produção atual.

## Verificações

| Verificação | Resultado | Alcance |
|---|---|---|
| `git status --short` inicial | Sem alterações | Checkout local |
| `git log` | Importação `f617cb3`; atualizações `3a29e6e` e `3a5ff09` | Não confirma remoto/deploy |
| Suíte local Node 24.21.0 | 27 testes passaram | Simulações; não comprova serviço real |
| `npx --no-install tsc --noEmit --incremental false` | Passou, sem erros | Tipagem local, não comportamento publicado |
| Links locais dos guias atuais e `git diff --check` | Passaram | Não verifica links históricos/remotos; Git avisou apenas conversão futura LF/CRLF |

Comando da suíte:

```sh
node --experimental-strip-types --test --test-isolation=none tests/*.test.cjs tests/*.test.mjs
```

Isolamento padrão falhou por `spawn EPERM` antes dos testes. Executar no processo atual resolveu sem mudar código/permissões. Aviso de detecção de módulo TypeScript não foi falha. HTTP 400/429 do worker pertence aos cenários simulados de erro permanente/transitório.

Cobertura: campos públicos e fallback, preservação/reuso de consultas, acesso, capítulos e downloads antigos, fila/cache/repetição limitada, coordenação som/Live, assets, fonte, referência de tema e navegação. Não substitui piloto comercial nem teste real de microfone/escuta.

## Evidências no código

- `src/app/api/reading/[id]/unlock/route.ts`: desbloqueio demo sem confirmação financeira.
- `src/app/api/reading/start/route.ts`: persistência/reuso; sem limite comercial de frequência.
- `prisma/schema.prisma`: sem entidades de pagamento/conta.
- `src/lib/reading-access.ts`: cookie assinado por consulta, validade de 30 dias.
- `src/lib/audio.ts`, `scripts/audio-worker.cjs`: arquivos privados e processo separado.
- `src/lib/live.ts`, `src/components/LiveConsultation.tsx`: reserva/token e cronômetro cliente.
- `src/lib/soundscape.ts`: caminhos novos ainda `null`.
- `src/lib/spreads.ts`, `reading-chapters.ts`, `spread-navigation.ts`: modalidades e vizinhança.

## Não verificado

Railway, variáveis, Supabase remoto, privacidade atual do GitHub, domínio/HTTPS, pagamentos, processos/fila atuais, escuta real, Android físico e segurança/preços atuais dos provedores/dependências. Sem geração real de IA/TTS, alteração de banco, deploy, publicação ou configuração nesta rodada.

Documentos novos consolidam estado e propostas; não representam correções dos itens pendentes.
