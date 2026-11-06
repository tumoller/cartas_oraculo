# Pesquisas externas — Mapa Astral (e Tarô)

Cole cada prompt numa ferramenta de pesquisa (Gemini Deep Research, Perplexity, ChatGPT com busca).
Traga de volta **só o bloco "Formato da resposta"** de cada um. Data de referência: novembro/2026.

---

## P1 — Biblioteca de efemérides e licença (bloqueia a arquitetura)

```
Preciso calcular mapas astrais natais num servidor Node.js (Next.js rodando no Railway), para um site comercial pago.
Compare estas opções de biblioteca, com fontes atuais (2026):
- Swiss Ephemeris (licença AGPL x licença profissional paga: preço atual, o que a AGPL exige de um SaaS fechado, se a cláusula de rede obriga abrir o código do site)
- pacotes npm: "sweph", "swisseph", "swisseph-wasm" (herdam a AGPL?)
- "astronomy-engine" (MIT): precisão em graus para planetas, Lua e nodos; serve para astrologia?
- "circular-natal-horoscope-js": licença, manutenção, sistemas de casas suportados, precisão
- qualquer outra opção MIT/BSD madura para JS/TS
Para cada uma: licença, último release, precisão (arco-minutos), se calcula Ascendente/MC, casas Placidus e Signos Inteiros, Nodo Lunar verdadeiro/médio, Quíron, Lilith, retrogradação, e se roda em Node sem compilar C.
Formato da resposta: tabela comparativa + recomendação única para uso comercial de código fechado + riscos legais em 3 linhas.
```

## P2 — Fuso horário histórico e geolocalização no Brasil

```
Para converter hora local de nascimento em UTC no Brasil, quero saber:
1. Quão confiável é o banco IANA (tzdata) para o Brasil antes de 1985, especialmente 1914–1985 (horário de verão por decreto, estados que aderiram ou não, Acre/Amazonas que mudaram de fuso em 2008 e 2013, Fernando de Noronha, Mato Grosso do Sul etc.). Liste períodos conhecidos em que o tzdata erra ou é "best effort".
2. Existe tabela oficial/curada de horário de verão por estado e ano (decretos)? Fonte.
3. Base de municípios do IBGE com latitude/longitude: link oficial, formato, licença de uso comercial.
4. Para nascimentos fora do Brasil: geocodificação gratuita viável (Nominatim: política de uso comercial e limites; alternativas como GeoNames: licença).
5. Como sites como astro.com e Personare tratam essas ambiguidades (ex.: hora repetida no fim do horário de verão).
Formato da resposta: lista de armadilhas com período + estado + correção recomendada; links das bases; recomendação de stack (máx. 10 linhas).
```

## P3 — Mercado brasileiro: o que já é grátis, o que vende e por quanto

```
Pesquise o mercado de mapa astral online no Brasil em 2026: Personare, Astrolink, João Bidu, Astrocentro, Co-Star, The Pattern, astro.com e astrólogos que vendem pelo Instagram/TikTok/lives.
Para cada um: o que entregam de graça, o que é pago, formato (texto, PDF, vídeo, áudio, ao vivo), preço em R$.
Quais produtos de astrologia mais vendem (mapa natal completo, sinastria/compatibilidade amorosa, revolução solar, previsões do ano, trânsitos, mapa de carreira, mapa kármico/nodos)?
Como as lives de TikTok usam mapa astral (o que o público pede, quanto paga por pergunta)?
Formato da resposta: tabela concorrente × grátis × pago × preço; top 5 produtos por demanda com faixa de preço; 5 lacunas que ninguém atende bem.
```

## P4 — Estrutura de um relatório natal profissional (o "cérebro")

```
Sou dev montando um motor que calcula o mapa natal (posições exatas) e manda para uma IA escrever a interpretação. Preciso da estrutura que um astrólogo profissional brasileiro usaria, não de textos prontos:
1. Padrão no Brasil: zodíaco tropical? Sistema de casas mais usado (Placidus, Koch, Signos Inteiros)? Quais pontos entram (Sol a Plutão, Asc, MC, Nodos, Quíron, Lilith, Parte da Fortuna)?
2. Aspectos maiores e menores e orbes usuais (por planeta, luminares com orbe maior?).
3. Ordem de leitura de um relatório completo e de um relatório curto (quais elementos pesam mais: regente do Ascendente, stelliums, elementos/modalidades, planetas angulares, dignidades).
4. Como tratar quem não sabe a hora de nascimento (mapa ao meio-dia, sem casas/Ascendente; o que pode e não pode ser afirmado).
5. Seções que o público leigo mais valoriza (amor, dinheiro/carreira, propósito) e quais posições respondem cada uma.
6. Autores/obras de referência em português.
Formato da resposta: esquema em tópicos (JSON ou lista) com regras e pesos, sem textos interpretativos longos.
```

## P5 — Jurídico (LGPD e consumidor)

```
Site brasileiro que vende leituras de baralho cigano e mapa astral geradas por IA, coletando nome completo, data, hora e cidade de nascimento, e opcionalmente uma vertente religiosa (Umbanda).
1. LGPD: esses dados são pessoais ou sensíveis? A escolha de vertente religiosa vira dado sensível (convicção religiosa)? Base legal, consentimento, retenção, o que precisa constar na política de privacidade.
2. CDC: avisos obrigatórios para serviço de entretenimento/esotérico, direito de arrependimento em produto digital entregue na hora, limites (não prometer cura, ganho financeiro, decisões médicas).
3. Precisa informar que a leitura é gerada por IA? Há regra vigente ou em tramitação (PL 2338 de IA) em 2026?
Formato da resposta: checklist objetivo do que implementar (textos, checkboxes, prazos de retenção).
```

## P6 — Tarô: viabilidade real (para depois)

```
Quero adicionar tarô a um site de leituras com IA. Pesquise:
1. Direitos autorais das imagens: o Rider-Waite-Smith original (1909, Pamela Colman Smith) está em domínio público no Brasil e nos EUA? Que versões/recolorizações a U.S. Games ainda protege?
2. Arcanos maiores só (22) vs. baralho completo (78): o que o público espera em leitura online paga?
3. Tiragens mais vendidas online (1 carta, 3 cartas, Cruz Celta) e preços praticados no Brasil.
Formato da resposta: 10 linhas + tabela de tiragens/preços.
```
