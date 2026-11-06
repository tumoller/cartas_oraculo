# Plano do portal — mapa astral, numerologia e relatórios (a partir de 2026-11-06)

Cada bloco abaixo é **uma sessão nova** do Claude Code. Para abrir uma, comece com:
"Leia docs/PLANO-PORTAL.md e execute a Sessão N."
Ao terminar, a sessão marca o bloco como feito aqui, com o commit.

## Prompt de abertura (colar numa sessão nova, trocando N)
```
Execute a Sessão N de docs/PLANO-PORTAL.md.

Antes de codar:
1. Leia docs/PLANO-PORTAL.md inteiro (contexto, decisões pendentes e o bloco da Sessão N) e o AGENTS.md. É Next 16: consulte node_modules/next/dist/docs antes de mexer em rotas e páginas.
2. Leia só os arquivos que o bloco cita (src/lib/natal.ts, products.ts, pricing.ts, payment-request.ts, ProductReadingPage.tsx etc.). Não varra o repositório inteiro.
3. Se alguma decisão pendente do plano bloquear a sessão, pergunte tudo de uma vez numa única pergunta, com a sua recomendação. O que não bloqueia, implemente com um padrão sensato e deixe anotado.

Execução:
- Você orquestra. Trabalho mecânico e bem delimitado (tabelas, testes, CSS, telas repetitivas) vai para subagentes Sonnet com instruções passo a passo e esforço no máximo "medium". Revise tudo o que eles entregarem.
- Cálculo astrológico/numerológico: só com fórmula de fonte confiável e teste automatizado. Na dúvida, deixe de fora e me diga. Nunca invente valores.
- Use o caso de referência do plano (Arthur) como teste de regressão do mapa.
- Verifique no navegador embutido (preview "dev") o que for visual, no tamanho mobile.
- Ao final: npx tsc --noEmit e npm test passando, commit na branch estabilizacao (não faça push nem mexa na main sem me perguntar) e atualize o bloco da sessão neste plano como FEITO, com o hash do commit e o que ficou pendente.

Seja brutalmente honesto no relatório final: o que foi verificado, o que não foi e o que depende de mim.
```

## Onde estamos (commit abc8b7d, já na main)
- O cálculo natal bate grau a grau com o Astrolink no caso de teste: Arthur, Sol 10° Peixes, Asc 13° Escorpião, Lua 27° Virgem, MC 1° Leão.
- Implementado:
  - `src/lib/natal.ts`: tropical, Placidus, nodo médio, aspectos e retrógrados.
  - `src/lib/numerology.ts`: pitagórica, com mestres 11, 22 e 33.
  - `src/lib/products.ts`: leitura por seções, uma delas grátis e as demais pagas.
  - `src/lib/cities.ts`: 5571 municípios do IBGE com fuso por UF.
  - Páginas `/mapa-astral` e `/numerologia`, pagamento pela InfinitePay (unlock).
- Preços **provisórios** em `src/lib/pricing.ts`: numerologia 14,90, mapa simples 19,90 e mapa completo 34,90.

## O que o concorrente (Astrolink) mostra
- O mapa completo é **grátis**, em troca de um cadastro (e-mail, Google ou Apple). O cadastro é a isca deles.
- Dinheiro vem de:
  - **guias temáticos** vendidos à parte: Mapa do Amor por R$ 69,90 (com "de 349,90" riscado), Guia de Chakras por R$ 39,90 e Mapa de Carreira;
  - **assinatura Premium**, com promoção de R$ 9,90 e contador regressivo, que dá desconto nos guias.
- Grátis também: sinastria básica, horóscopo diário pelos trânsitos, ciclo lunar, biorritmo, tarô de uma carta e muito conteúdo de SEO (páginas por signo e artigos).
- O mapa deles tem itens que não temos:
  - dignidades: domicílio, exílio, exaltação e queda;
  - decanato, Quíron, Lilith e Parte da Fortuna;
  - elementos em porcentagem, com pesos por planeta;
  - polaridade yin/yang;
  - a roda do mapa em imagem.
- **Nosso diferencial:** a leitura é personalizada pela persona, com voz e na cena imersiva, e não um texto de apostila igual para todos. Não copiar textos deles, só a estrutura das ofertas.

## Decisões pendentes do usuário (antes ou durante as sessões)
1. O mapa grátis pede **e-mail ou WhatsApp** em troca? A recomendação é que sim. Isso exige um aviso de LGPD (ver P5 em `docs/pesquisa-mapa-astral.md`).
2. **Preços finais**: dependem do P3 e da pesquisa de numerologia.
3. **Modelo visual do PDF**: o usuário vai mandar referências.
4. **Persona por produto**: hoje a pessoa escolhe entre as três.
5. Apagar as 2 sessões de teste "Maria Teste Silva" do banco (podem estar em produção).

## Pesquisas a rodar (Deep Research do usuário)
- `docs/pesquisa-numerologia.md`: escola, regras, casos de teste e mercado. **Bloqueia a Sessão 4.**
- `docs/pesquisa-mapa-astral.md`:
  - P1 e P2 já foram resolvidos no código (astronomy-engine MIT, fuso por UF);
  - P3 (preços), P4 (estrutura de relatório) e P5 (LGPD) continuam úteis.
  - Acrescentar ao P3: "quais guias temáticos de astrologia vendem no Brasil e por quanto, em PDF ou na web".

---

## Sessão 1 — Motor do mapa completo + mapa grátis como isca
**Objetivo:** igualar o conteúdo técnico ao do concorrente e transformar o mapa básico na porta de entrada.
- Em `natal.ts`:
  - **Dignidades:** tabela fixa por planeta e signo.
  - **Decanato.**
  - **Parte da Fortuna**, com a fórmula diurna e a noturna: o Sol acima ou abaixo do horizonte.
  - **Lilith média**, por fórmula.
  - **Polaridade.**
  - **Elementos ponderados:** documentar os pesos escolhidos, sem fingir que são os do Astrolink.
  - Testes para todos esses itens.
  - **Quíron fica de fora** até que haja uma fonte com precisão comprovada. A astronomy-engine não calcula Quíron.
- **Roda do mapa em SVG**, para a página e, depois, para o PDF: signos, casas, planetas e linhas de aspecto.
- **Mapa grátis:**
  - tabela + roda + trio Sol, Lua e Ascendente grátis;
  - as seções temáticas ficam pagas;
  - o formato da captura de contato depende da decisão 1.
- Pendências de UX da V1:
  - o modal de pagamento ainda diz "abro as cartas" (texto do Lenormand);
  - links na home para mapa astral e numerologia;
  - cards de persona acessíveis por teclado.
- **Feito quando:** os testes passam, a tela confere com o caso do Arthur e há commit na `estabilizacao`.

## Sessão 2 — Relatórios temáticos pagos + motor de PDF
**Depende da Sessão 1** (a roda em SVG e os dados enriquecidos).
- Generalizar `products.ts` para "relatórios": cada relatório tem várias seções longas, um índice e uma persona.
- Primeiros relatórios:
  - **Mapa do Amor:** Vênus, Marte, Lua, casas 5 e 7, Lilith e aspectos;
  - **Carreira e Dinheiro:** MC, casas 2, 6 e 10, Júpiter, Saturno e a Parte da Fortuna.
- **Motor de PDF automático:**
  - capa personalizada, roda do mapa, tabelas e o texto da IA;
  - layout bonito, seguindo as referências do usuário (decisão 3);
  - opção a avaliar primeiro: `@react-pdf/renderer`, em JS puro e sem Chromium no Railway;
  - opção alternativa: HTML com CSS de impressão renderizado por Chromium, que deixa a tipografia mais rica mas pesa no deploy;
  - decidir com um protótipo, não por suposição.
- O PDF é gerado uma vez, guardado e liberado após o pagamento por link de download. O produto "só PDF" sai por um preço baixo (ex.: 9,90), a confirmar nas decisões.
- **Feito quando:** um PDF real é gerado a partir de um mapa pago, abre bem no celular e há testes do gerador.

## Sessão 3 — Sinastria (casal) + Previsão do ano
**Depende da Sessão 2** (o formato de relatório e o PDF).
- **Sinastria:**
  - formulário com dois nascimentos;
  - aspectos cruzados entre os dois mapas;
  - casas de um mapa sobrepostas às do outro;
  - relatório pago e uma prévia grátis de "afinidade".
- **Previsão do ano**, por um destes caminhos:
  - **revolução solar:** o momento exato do retorno do Sol, calculado por bisseção com a astronomy-engine, mais o mapa desse instante;
  - **os trânsitos lentos do ano**: Júpiter, Saturno, Urano, Netuno e Plutão sobre os pontos natais.
- **Feito quando:** os testes de cálculo passam (incluindo o retorno solar com um erro menor que 1 minuto) e os dois relatórios saem em PDF.

## Sessão 4 — Numerologia v2
**Depende da pesquisa de numerologia.**
- Ajustar a escola e as regras ao que for padrão no Brasil e usar os casos de teste da pesquisa como testes automatizados.
- Adicionar o que a pesquisa indicar como popular:
  - dívidas e lições cármicas;
  - pináculos e desafios;
  - mês pessoal;
  - compatibilidade de casal.
- Relatório numerológico em PDF, reaproveitando o motor da Sessão 2.

## Sessão 5 — Contas, assinatura e conteúdo recorrente (maior; exige decisões)
- Login (e-mail mágico ou Google), um perfil com os dados de nascimento salvos e um histórico de compras.
- Assinatura recorrente pela InfinitePay: **confirmar na documentação como funciona a recorrência**.
- **Horóscopo diário personalizado**, pelos trânsitos do dia sobre o mapa natal, e o ano ou mês pessoal da numerologia. É isso que justifica a assinatura.
- Desconto de assinante nos relatórios avulsos.

## Sessão 6 — Produtos na cena imersiva com voz
- Levar o mapa e a numerologia para a experiência imersiva, com a persona falando, como já acontece no Lenormand.

## Depois (precisa de estudo)
- Quíron, com uma fonte de efemérides validada.
- Conteúdo de SEO: páginas por signo, Lua e Ascendente, e artigos. É um volume grande de conteúdo; planejar com o usuário.
- Tarô (P6), cigano de Umbanda e guias de chakras.

## Paralelismo
- A Sessão 1 e a pesquisa de numerologia podem andar ao mesmo tempo.
- As Sessões 2 e 3 são em sequência.
- A Sessão 4 pode rodar em paralelo às Sessões 2 e 3 depois da pesquisa. Ela só reaproveita o PDF no fim, então convém deixá-la para depois da Sessão 2.
- A Sessão 5 é independente, mas é a mais pesada em decisões.
