# Carta 28 e revisão editorial — 26/10/2026

- Usuário informou validação no Android: a princípio funciona e serve como MVP. Registro de relato do usuário, sem inferir cobertura de todos os cenários ou realizar novo teste no aparelho.
- Nova imagem enviada pelo usuário: XXVIII, O CIGANO. Copiada sem alteração para `public/cards/cigano/card-28.jpg`. SHA-256 conferido entre origem e destino: `95D961BDE905864F4A55DB4112E98F5C2AF3F65CEEBCCA262546D580A05C7746`.
- Removida a exceção de bloqueio da imagem na criação da leitura. Consultas antigas com imagem vazia não foram regravadas. Nenhum deploy realizado.
- Adicionado teste da rota: carta 28 preserva posição/ID e recebe caminho da arte; cartas pagas continuam ocultas na prévia. Suíte completa: 28 testes passaram, usando simulações e sem geração real.
- Revisão editorial de base/prompts realizada por leitura de código e auditada com GPT-6 Sol em esforço médio. Problemas e proposta registrados em `docs/MOTOR-E-REVISAO-EDITORIAL.md`; base e prompts não alterados.
- Feedback humano confirmado como objetivo; piloto preparado, sem participantes ou avaliações realizadas nesta rodada.
