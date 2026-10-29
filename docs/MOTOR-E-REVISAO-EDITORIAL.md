# Motor de leitura e revisão editorial — 29/10/2026

Referência do código local. Prompts e profundidade alterados em 29/10, ainda sem publicação; definições da base continuam pendentes de revisão. Direção alinhada: leitura natural e fiel às relações, sem positividade obrigatória ou avisos repetidos em cada trecho; natureza simbólica explicada na apresentação.

## Sorteio e interpretação são etapas diferentes

`src/lib/draw.ts` escolhe cartas com `crypto.randomInt`, remove cada selecionada do conjunto e repete até completar 3/5/9/36. Não há cartas repetidas na mesma mesa. Todas começam com a mesma chance; nome, pergunta, tema e personagem não direcionam o sorteio. Mesa de 36 contém todas as cartas em ordem aleatória.

Servidor salva posições antes de chamar a IA. A IA interpreta a mesa recebida, não escolhe as cartas. Toque no monte revela a próxima posição já sorteada. Reabrir a consulta não é novo jogo.

## Dados e prompts

Base única: `src/data/baralho.json`. Cada carta tem nome, palavras-chave, polaridade e significados de amor, trabalho e geral. Cinco cartas recebem todos esses significados e a polaridade; modalidades maiores recebem palavras-chave e significado do tema. O prompt proíbe pontuação, mas o campo de polaridade ainda chega ao modelo na modalidade de cinco.

O modelo recebe nome, personagem, tema, pergunta e cartas com posições. Nomes são enviados sem prefixo numérico. Não recebe perfil pessoal, comprovação dos fatos nem histórico de vida. Também não interpreta visualmente as imagens: recebe nomes/significados em texto. Diferentes artes não criam diferentes sistemas de sorteio.

Prompts completos estão em `src/lib/gemini.ts`, variável `instructions`, e `src/lib/spreads.ts`, campo `systemInstruction`.

| Tiragem | O prompt manda fazer | Significado prático |
|---|---|---|
| 3 | Centro 2; pares 1+2, 2+3; espelho 1+3 | Articular três símbolos em uma leitura conjunta |
| 5 | Centro 3; adjacentes 1+2, 2+3, 3+4, 4+5; espelhos 1+5 e 2+4 | Relacionar o eixo central aos lados e comparar extremos/intermediárias |
| 9 | Três linhas, três colunas, centro e duas diagonais | Ler relações horizontais, verticais e diagonais de um quadro 3x3 |
| 36 | Quatro linhas de nove, vizinhança do tema, quatro cantos e síntese | Ler a mesa 4x9 com recortes definidos; não é implementação de todas as técnicas tradicionais possíveis |

O plano completo da tabela é preservado. Para nove/36, o básico gera apenas linhas físicas e síntese; o completo acrescenta os recortes de relações. Três/cinco têm uma versão, com relações incorporadas à linha. `readingDepth` é validado e salvo no servidor; retentativas usam o valor salvo e consultas antigas sem campo são tratadas como completas. Nenhuma consulta pronta é regenerada por essa mudança.

Nas 36, referência do tema: Coração para amor; Peixes para trabalho/dinheiro; Caminhos para amizades/caminhos. É regra fixa do produto. Carta na borda/canto tem menos vizinhas. As posições não recebem automaticamente passado/presente/futuro. Sem pesos de positividade e sem resultado matemático.

Personagem muda tom: cigana prática, cósmica reflexiva com metáforas discretas, Umbanda simbólica/respeitosa sem alegar mediunidade. Prompts permitem relações simbólicas claras, inclusive tensões, perdas e impasses. Não obrigam pergunta final nem ressalva por carta; incerteza é localizada ao passar dos símbolos para fatos/futuro. Permanecem limites breves contra diagnósticos, garantias e certeza infundada sobre terceiros.

Cinco: temperatura 0,8; demais: 0,65. Isso permite variação de redação; não representa grau de verdade ou confiança. Modelo vem de variável de ambiente, com padrão no código; não foi confirmada a configuração remota nesta rodada.

Cinco têm tentativa de modelo principal e secundário. A contingência local mecânica foi removida: falha de ambos ou falta de chave produz erro e permite retomar as mesmas cartas. As demais modalidades não têm contingência local.

Cada consulta usa uma chamada por tentativa de interpretação, reunindo cartas e plano. Não há chamada por carta. Notas individuais das modalidades por capítulos foram reduzidas para 25–45 palavras; os capítulos e a síntese mantêm desenvolvimento. Narração é outra etapa e só ocorre por capítulo/síntese com escolha explícita de ouvir; não há TTS individual de cada carta.

## O que o motor realmente garante

Código verifica cartas distintas, estrutura dos campos, capítulos/posições e alguns vazamentos de nomes ocultos na prévia. Não verifica automaticamente que o texto cumpriu todas as combinações, contagem de palavras, condicionalidade ou resposta útil à pergunta. Uma regra escrita no prompt não comprova obediência em cada saída.

As combinações são interpretadas pelo modelo; não existe uma tabela explícita que determine o significado de cada par. A qualidade precisa de amostras e revisão humana.

## Diagnóstico da base

| Carta | Problema atual | Direção proposta |
|---|---|---|
| Serpente | Pressupõe rivalidade, mentira e colegas desleais | Manter cautela/complexidade/desconfiança sem afirmar pessoa ou fato |
| Raposa | Atribui segundas intenções ao parceiro e golpes | Estratégia, autoproteção e atenção a inconsistências; fatos precisam de verificação |
| Árvore | Afirma saúde vigorosa | Crescimento, continuidade e cuidado; sem conclusão de saúde |
| Sol / Chave | Lucro, triunfo e êxito garantido | Clareza, visibilidade, abertura e possibilidade de avanço sem garantia |
| Cruz | Sofrimento seguido de conquista definitiva | Peso, responsabilidade, convicções e limites sem prêmio obrigatório |
| Estrela / Anel / Ratos | Guias, pactos cármicos e vampirismo como explicações | Preservar símbolo sem impor causa espiritual factual |
| Homem / Mulher | Associa razão/ação ao masculino e intuição/receptividade ao feminino | Pessoas/figuras relevantes conforme contexto, sem presumir gênero, papel ou traço fixo |

Esses textos alimentam a IA e a contingência. Acrescentar 'pode' a uma acusação não basta: é preciso evitar que a carta isolada vire evidência sobre alguém. Símbolos difíceis não precisam ser suavizados nem ganhar final feliz.

Proposta mínima: revisar as 36 definições compartilhadas, com núcleo simbólico, possíveis tensões e aplicações por tema; tirar garantias e estereótipos. Depois alinhar dados enviados (inclusive polaridade) e prompts. Só adicionar tabela de combinações se o piloto revelar necessidade. Preservar consultas antigas.

## Piloto de feedback com pessoas

Usuário confirmou que deseja avaliar leituras com pessoas, sem solicitar formulário novo no aplicativo. Piloto ainda não realizado nesta rodada.

Começar com 5–8 pessoas voluntárias. Primeira rodada em cinco cartas, com pergunta real não sensível e sem exigir relato íntimo. Explorar outras modalidades depois. Não pedir apenas 'acertou?': textos genéricos podem parecer pessoais sem responder à pergunta.

Após ler/ouvir, registrar notas de 1 a 5 para clareza, resposta à pergunta, conexão entre cartas, utilidade prática, naturalidade e facilidade de navegação. Perguntas abertas:

1. Com suas palavras, o que a leitura disse?
2. Qual trecho ajudou? Qual ficou vago, repetitivo ou contraditório?
3. Alguma frase pareceu acusação, diagnóstico, promessa ou certeza sem fundamento?
4. O que você faria com essa reflexão?
5. Houve dificuldade para revelar, ler, ouvir ou voltar?

Registro mínimo: código anônimo, modalidade/tema, versão do método/base/prompt, cartas e posições, notas, trecho problemático e observação. Não registrar segredo da consulta, URL de acesso ou dado pessoal desnecessário. Trecho sensível só com autorização.

Comparação editorial: mesma pergunta e mesmo sorteio antes/depois, versões A/B sem identificar qual é a nova e ordem alternada. Fazer isso em conjunto controlado de teste; não regenerar consultas compradas/salvas para comparar. Separar problema de conteúdo, áudio e navegação.

Critério proposto: qualquer acusação/garantia grave exige revisão; repetir rodada após corrigir padrões de confusão/contradição. Pequeno piloto identifica problemas e preferências; não comprova previsão nem qualidade universal.
