# Estado do projeto — 29/10/2026

## Situação

A experiência principal está implementada e permite preparar conteúdos de apresentação e demonstrações controladas. Em 29/10 foram ajustados localmente profundidade básico/completo, tom dos prompts, revelação ampliada por toque e preparação da narração. Essas mudanças ainda não foram publicadas. O projeto não está concluído para venda: faltam confirmação real de pagamento, recuperação de compra entre dispositivos e controle completo de consumo.

Base: código local com alterações sobre `3a5ff09`; deploy Railway consultado em 29/10 ainda em `3a5ff09`. Ver [levantamento e ajustes de 29/10](testes/2026-10-29-LEITURA-NATURAL-E-PADRONIZACAO.md) e [evidências anteriores](testes/2026-10-26-LEVANTAMENTO.md). Não houve deploy ou geração paga nesta rodada.

## O que já executamos

| Frente | Entrega existente | Limite |
|---|---|---|
| Método | Centro, combinações e espelhos preservados; pergunta opcional até 500 caracteres; prompts permitem leitura direta, inclusive difícil, sem ressalvas repetidas ou final feliz obrigatório | Interpretação simbólica; revisão editorial das 36 definições e amostras reais pendente |
| Modalidades | Três/cinco em versão única; nove/36 com básico (linhas + síntese) e completo (relações adicionais); profundidade salva no servidor e preservada na retomada | Implementação local; acesso continua demonstrativo, não compra real; acervo antigo preservado como completo |
| Persistência | Sorteio salvo antes da interpretação; reaproveitamento da mesma tentativa pronta; reabertura sem novo sorteio | Interrupção durante geração textual ainda requer recuperação operacional |
| Proteção | Campos bloqueados removidos no servidor; cookie assinado HttpOnly por leitura; exportação e áudio privados | Cookie de 30 dias não substitui recuperação entre dispositivos |
| Artes | 36 arquivos por estilo, três personagens com retratos, cenas e paletas próprias; nova arte O Cigano 28 integrada em 26/10 | Alteração local para novas consultas; consultas antigas com imagem vazia não foram regravadas |
| Interface | Toque no monte abre zoom com animação; toque na arte fecha; cartas da mesa/texto ampliam por toque; seletor no painel de leitura; redução de movimento preservada | Ajustes de 29/10 locais; validação Android anterior não cobre automaticamente a nova interface |
| Mesa de 36 | Posições preservadas, quatro linhas, referência do tema e vizinhanças de 4/6/9 cartas; capítulo preservado ao selecionar vizinhas | Textos antigos não foram regenerados |
| Áudio | Escolha explícita por consulta; preparação de síntese/capítulo durante revelação e reprodução ao liberar; capítulos de relações narráveis; nenhuma narração individual por carta; cache/download privado preservados | Novo npm start supervisiona web/worker juntos; persistência e áudio real na Railway ainda precisam de validação após publicação |
| Coordenação sonora | Uma voz por vez, volume, pausa, tratamento de erro, dock e acompanhamento opcional | Música e efeitos sem arquivos aprovados; manifesto inativo |
| Live | Token efêmero contextualizado, uma reserva de teste por leitura e interface de três minutos | Cronômetro cliente não garante teto financeiro no servidor |
| Fonte e dependências | Importação Git privada registrada; commits posteriores de atualização de framework presentes localmente | Remoto, segurança atual das versões e deploy não revalidados |

## Problemas conhecidos e correções sem confirmação

| Prioridade | Item | Situação e critério de fechamento |
|---|---|---|
| P0 | Erro de banco na Railway | Histórico de 25/10 registra `PrismaClientInitializationError` na criação da leitura. Falta confirmar correção com logs e fluxo real. Diagnóstico no manual de operação |
| P0 | Pagamento simulado | `unlock` depende de `ORACLE_DEMO_MODE=true` e não consulta provedor. Fechar com cobrança real, confirmação autenticada/idempotente e teste de duplicidade/falha |
| P0 | Limites de consumo | Criação de consultas não tem limite comercial de uso; Live não tem teto efetivo no servidor. Fechar com regras da oferta aplicadas no servidor e teste de abuso/concorrência |
| P0 | Recuperação de compra/consulta | Acesso depende do navegador/cookie. Fechar com mecanismo verificável de recuperação e teste em outro aparelho |
| P0 | Persistência operacional | Validar armazenamento de áudio compartilhado entre web/worker, reinício supervisionado, backup e restauração. Disco efêmero não atende |
| P1 | Geração textual interrompida | Não existe job de texto em background que garanta recuperação após encerramento do processo. Definir retomada segura sem alterar sorteio nem duplicar chamadas |
| P1 | Publicação da correção da trava do worker | Trava PID substituída localmente por exclusão via porta localhost; teste de duplicidade e liberação passou. Falta publicar e validar reinício na hospedagem |
| P1 | Conferência de artes | Carta 28 substituída localmente pela nova arte enviada pelo usuário; ainda conferir numeração impressa de 15/18 e correspondência entre símbolo, nome e imagem |
| P1 | Revisão editorial | Revisar as 36 definições da base compartilhada e amostras de leitura em cada um dos três estilos; evitar certeza sobre terceiros/futuro, diagnósticos e promessas |
| P1 | Cenários complementares no Android | Validação geral informada pelo usuário em 26/10: funcionando e utilizável como MVP. Não repetir auditoria geral; registrar quais cenários de microfone/HTTPS, áudio longo, permissões, teclado e rede foram efetivamente cobertos |
| P1 | Oferta e suporte | Definir entrega, prazo, atendimento, termos/privacidade e tratamento de falhas/reembolso antes da cobrança |

P0 bloqueia venda ou funcionamento confiável. P1 deve ser encerrado conforme o escopo da oferta; microfone/Live podem ser excluídos da primeira oferta.

## Ordem sugerida para concluir

1. Confirmar criação e reabertura de leitura na hospedagem, banco e persistência de áudio; corrigir somente o que ainda falhar.
2. Validar experiência local e publicar os ajustes de 29/10; revisar artes/textos. Formatos alinhados: três/cinco únicos; nove/36 básico e completo; texto, narração de capítulos e conversa com controles equivalentes. Preço do completo ainda não definido; mapa astral segue separado.
3. Implementar pagamento, recuperação e limites vinculados à oferta, com testes de confirmação duplicada, acesso e falhas.
4. Fazer piloto completo em Android/Chrome por HTTPS: consulta, pagamento, desbloqueio, narração, reabertura em outro aparelho e suporte.
5. Aprovar experiência e oferta; então abrir venda. Produção de prévias pode começar em paralelo, conforme [lançamento](LANCAMENTO-E-CONTEUDOS.md).

## Evoluções que podem esperar

Detalhamento do sorteio, prompts, diagnóstico da base e piloto com pessoas em [motor e revisão editorial](MOTOR-E-REVISAO-EDITORIAL.md). A revisão identificou garantias, acusações e estereótipos na base; ainda não os alterou.

Música ambiente, efeitos, novas poses/vídeos, combinações estruturadas, caderno, compartilhamento e mapa astral são propostas/evoluções, não entregas necessárias para a primeira oferta. Mapa astral permanece produto separado. Preservar leituras e áudios antigos ao mudar apresentação.
