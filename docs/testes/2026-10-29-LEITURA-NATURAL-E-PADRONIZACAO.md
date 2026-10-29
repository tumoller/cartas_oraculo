# Leitura natural e padronização — 29/10/2026

## Objetivo confirmado pelo usuário

Preservar uma experiência de leitura natural, fiel ao método escolhido, com interpretações favoráveis e difíceis sem final feliz obrigatório. Evitar ressalvas e perguntas de reflexão repetidas em cada parágrafo. Explicar claramente, na apresentação, a natureza simbólica da experiência e a ausência de verdade absoluta, respeitando crenças e intenção do consulente. Padronizar a experiência das modalidades e resolver a narração de cinco cartas.

O levantamento anexado foi conferido contra o código local e contra configuração e logs atuais da Railway. A fase inicial foi somente leitura; em seguida, após o alinhamento abaixo, foram implementados ajustes locais. Não houve deploy, geração paga ou modificação de consultas salvas. Alterações locais anteriores foram preservadas.

## Achados conferidos

| Frente | Evidência | Implicação |
|---|---|---|
| Cinco cartas | `src/lib/gemini.ts` gera sete campos e usa texto local quando falta chave ou ambos os modelos falham | O texto mecânico com nomes numerados e sinais de soma existe no fallback; não é necessário supor erro da IA para explicá-lo |
| Demais modalidades | `src/lib/spreads.ts` gera capítulos, notas individuais e síntese em uma chamada | Cinco cartas tem contrato distinto; uniformidade visual não exige reescrever o acervo |
| Estilo | Os dois prompts exigem possibilidade/condicionalidade, reflexão prática e fechamento prescrito; cinco cartas exige pergunta final | Essas regras podem produzir ressalvas e estrutura repetitivas; a qualidade real exige comparar amostras |
| Volume | Mesa de 36 pede 36 notas de 60–100 palavras, quatro linhas de 200–280, dois recortes de 80–140 e síntese de 180–260 | Só a saída pedida soma aproximadamente 3.300–5.260 palavras; contexto de entrada não é o único fator de espera, repetição ou resposta incompleta |
| Narração | `src/lib/audio.ts` e os dois boards oferecem síntese para cinco, capítulo para três, linhas e síntese para nove/36 | Player existe em cinco, mas depende de desbloqueio, revelação e aba da leitura; capítulos de relações não são narráveis hoje |
| Processamento | `package.json` inicia somente `next start`; `scripts/audio-worker.cjs` é processo separado | Site funcionando não comprova worker ativo nem fila processada |
| Recuperação de áudio | Job existente não é reenfileirado; falha terminal não é recuperada pelo botão de verificar; queda durante geração pode deixar estado antigo | Recuperação precisa conferir WAV/estado e evitar nova cobrança automática em resultado incerto |
| Consultas antigas | Sorteio persistido antes da geração; consulta pronta reutilizada; textos antigos preservados | Manter essa garantia ao alterar método, capítulos ou apresentação |

## Evidência remota desta rodada

- Projeto Railway `elegant-joy`; serviço `cartas_oraculo`; ambiente `production`.
- Deploy mais recente retornado: `cda4ed92-0e4d-4c49-966b-294c6d464c60`, status SUCCESS, commit `3a5ff09`, criado em 25/10. SUCCESS é estado de implantação, não validação de todos os fluxos.
- `GEMINI_API_KEY` está entre os nomes de variáveis cadastradas. Isso não valida seu valor, mas não sustenta a hipótese de ausência da variável apresentada no anexo.
- Logs de 28/10 às 15:32 BRT registram HTTP 503/alta demanda nos modelos `gemini-3.5-flash-lite` e `gemini-3.1-flash-lite`. É evidência concreta de falha dos dois modelos, compatível com fallback local; não foi correlacionado um ID de consulta ao relato.
- Startup registrado: `npm start` → `next start`. Configuração não retornou comando substituto; lista de serviços não contém worker de áudio separado. A implantação examinada não inicia o worker por esses mecanismos. Não houve inspeção de processos ou do job específico para afirmar seu estado atual.
- `ORACLE_AUDIO_DIR` e `ORACLE_TTS_MODEL` não aparecem nos nomes de variáveis retornados. Ausência de variável não prova ausência de volume ou modelo inválido. Persistência e geração TTS ainda precisam de validação funcional.

## Proposta mínima para alinhar e implementar

### Tom e método

1. Apresentar a experiência como interpretação digital do Petit Lenormand/baralho cigano. O código usa esse baralho de 36 cartas; evitar descrevê-lo genericamente como um sistema de tarô sem explicar a diferença.
2. Permitir leitura direta das relações simbólicas, sem suavizar cartas difíceis ou obrigar desfecho positivo. Exemplo editorial: “A Foice junto do Navio marca uma interrupção no movimento; a linha termina em corte, sem outra combinação que indique retomada.” O exemplo ilustra tom, não define uma combinação universal.
3. Manter instruções breves contra alegações factuais infundadas sobre terceiros, diagnósticos e garantias. Um aviso geral não transforma essas alegações em fatos. Localizar a incerteza quando a interpretação passa do símbolo a um acontecimento real, sem repetir um aviso por carta.
4. Remover obrigações de pergunta final, aconselhamento positivo e fórmula idêntica por nota. Revisar a base preservando tensões, perdas e desafios; não substituir o repertório por mensagens motivacionais.
5. Não entregar texto estático ocultamente como equivalente à leitura contextualizada. Proposta: na falha de ambos os modelos, informar indisponibilidade e permitir retomar as mesmas cartas, sem sortear novamente. Esse fluxo já tem suporte de persistência, mas exige ajustar o gerador e os testes.

### Estrutura compartilhada

Reutilizar `ConsultationWorkspace`, `ConsultationReadingPane`, áudio e conversa existentes. Mesmos lugares e estados para cartas, leitura, narração e conversa em todas as modalidades. Mesma estrutura de experiência não significa o mesmo número de capítulos nem liberação sem controle de acesso.

Proposta inicial, dependente da escolha do usuário: manter 3/5/9/36 cartas; apresentação principal com leitura da linha ou linhas e síntese. Relações ampliadas (colunas, diagonais, vizinhança e cantos) podem ficar para uma oferta futura. Centro e pares podem continuar como técnica interna da interpretação sem exigir uma seção extra para cada técnica. Em três/cinco, evitar dois textos longos quase iguais para uma única linha.

Não criar dois produtos/preços até definir diferença de entrega. Se houver básico/completo, a distinção precisa existir no acesso e na geração, não só esconder abas de conteúdo já entregue ao navegador. Preservar capítulos e permissões das consultas antigas.

### Uma chamada ou várias

Uma chamada de interpretação por consulta é o ponto de partida proposto: todas as cartas, posições, pergunta e plano de capítulos juntos, com resposta estruturada. Hoje o sistema já funciona assim; não há uma chamada por carta. Trata-se de proposta de engenharia, não garantia de qualidade.

Reduzir primeiro a saída redundante, principalmente notas individuais longas da mesa de 36. Comparar aderência, duração e erros antes de dividir. Separar por capítulos somente se os testes mostrarem benefício: compartilhar o contexto da mesa, persistir o progresso e reconciliar a síntese. Não juntar modalidades diferentes em uma única solicitação. Narração e conversa ao vivo continuam etapas separadas da interpretação.

Referência técnica consultada: [saídas estruturadas na API Gemini](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/). Formato estruturado ajuda no contrato de dados, mas não substitui revisão da interpretação.

### Áudio publicado

Escolher uma implantação que execute web e worker com acesso efetivo ao mesmo armazenamento persistente; não presumir disco comum entre serviços distintos. Para a instalação atual, avaliar primeiro supervisionar ambos no mesmo serviço com volume persistente, sem alterar o comando de produção nesta auditoria. Verificar reinício, prontidão do worker, logs e recuperação segura de jobs. Não resolver apenas aumentando o tempo de espera do player.

## Testes e critérios de fechamento

Baseline: `node --test --test-isolation=none tests/*.test.cjs tests/*.test.mjs` — 28 testes passaram. A execução padrão foi impedida por EPERM ao criar subprocessos; executar sem isolamento permitiu a suíte existente. Respostas de geração e TTS são simuladas: não comprova conteúdo real, microfone ou áudio audível em produção.

Para fechar os ajustes:

1. Mesma pergunta e cartas fixas em amostras antes/depois; incluir leituras favoráveis, difíceis e mistas nos três estilos. Verificar relações reais, resposta à pergunta, ausência de final positivo inventado e de ressalvas repetitivas. Avaliação humana continua necessária.
2. Teste de falha dos dois modelos: erro transparente, mesmas cartas na retomada, leitura pronta nunca regenerada.
3. Matriz das quatro modalidades: revelar, navegar, ler, pedir narração, pausar/retomar, conversar, reabrir; conferir também prévia bloqueada e capítulos indisponíveis.
4. Áudio na hospedagem: pedido autorizado, processamento real, WAV privado, reprodução no Android e reutilização após reabertura/reinício. Confirmar escuta, não apenas resposta HTTP.
5. Rede lenta, erro do provedor e queda do worker: mensagem útil e recuperação sem geração/cobrança duplicada inadvertida.
6. Se houver nível ampliado, testar autorização no servidor e preservação do acervo antigo.

## Decisões confirmadas e implementação local

- Usuário confirmou básico/completo para nove/36 e versão única para três/cinco; centro e combinações incorporados à linha nesses dois últimos.
- Cartas continuam visíveis; toque no monte abre a arte ampliada com flip e toque na arte fecha. Carta já revelada também abre zoom. Seletor “Acompanhar a leitura” foi movido para o início do painel de texto a pedido do usuário durante a prévia.
- Escolha explícita de ouvir por consulta; síntese e capítulo atual preparados durante revelação; reprodução somente após liberação visual e fechar zoom. Última carta abre a síntese em cinco/nove/36; três abre seu capítulo único. Relações do completo têm narração; não há TTS carta por carta. Botão no painel de texto permite mudar a escolha depois.
- Usuário esclareceu que cinco falhou na Railway, enquanto nove/36 funcionaram. Portanto, os logs de startup não provam ausência de qualquer processamento de áudio no momento do relato nem a causa única da falha específica.
- Prompts ajustados; notas individuais encurtadas; fallback estático de cinco removido. `readingDepth` validado/salvo/retomado e consultas antigas preservadas. Geração permanece em uma chamada por tentativa.
- `npm start` passa a supervisionar web/worker no mesmo ambiente. Trava PID substituída por exclusão local via porta; teste cobre worker duplicado e liberação. Persistência em volume e operação pública ainda exigem validação.

Verificação após implementação: 32 testes automatizados passaram, incluindo profundidade, retentativa, acesso, áudio, exclusão do worker e supervisão; TypeScript e lint das páginas/componentes alterados passaram. Sem API paga. Prévia em `/ui-check`, somente desenvolvimento, usa sessões fictícias e acolhimento local como áudio simulado; retorna 404 em produção. No navegador, as quatro modalidades foram percorridas: cinco/nove/36 abriram a síntese após a última carta, com reprodução automática e eventos do avatar; três foi percorrido sem som e teve narração ativada depois no painel. Colunas de nove e quatro cantos de 36 também reproduziram o áudio de teste. Seletor e troca de narração confirmados no painel de texto. Registro visual em `2026-10-29-seletor-na-leitura.png`. Isso não valida TTS remoto nem qualidade de novas leituras reais.

Criar perfis e preparar conteúdo pode avançar depois de definir a proposta. Não anunciar como disponível uma entrega ainda não validada. Venda continua dependendo de pagamento real, recuperação de acesso e limites comerciais, conforme o estado do projeto; esses itens não foram implementados neste levantamento.
