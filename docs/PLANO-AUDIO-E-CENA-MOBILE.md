# Áudio e cena mobile — plano de 23/10/2026

Status: levantamento; sem alteração de interface ou geração de novos assets nesta rodada.
Base: README.md, componentes atuais e estados da fila. Não repetir auditorias concluídas.

## Evidência e pendência

- Microfone: endereço LAN HTTP não atende ao requisito de acesso seguro já documentado. Validar no celular por HTTPS; não prometer funcionamento antes do teste com permissão concedida.
- Narração de trecho: geração no servidor independe desse bloqueio do microfone. Há três jobs prontos, uma tentativa cada e sem erro nos logs consultados; isto não identifica a consulta afetada.
- Possível falha de interface: POST aceito com resposta perdida faz o cliente marcar falha e parar polling. Deve voltar a consultar o mesmo capítulo, sem criar outro áudio, e distinguir falha de consulta de falha confirmada de geração.
- Player sem tratamento de erro de mídia: acrescentar mensagem simples para falha de carregamento/reprodução, preservando o arquivo pronto.
- Próxima verificação: aparelho/navegador, consulta/capítulo e estado exibido. Conferir status e acesso ao arquivo existente no mesmo navegador. Sem nova geração para testar o mesmo material.
- Áudios longos Live: ajustes anteriores de buffer/fim natural já aplicados; validação longa em aparelho real continua pendente, sem repetir geração indiscriminada.

## Experiência proposta

- Preservar cartas uma a uma e texto abaixo no jogo de cinco. A visualização de 36 tem mapa fixo e navegação por partes; falta revisão do usuário no celular.
- Botão flutuante com avatar da personagem, área de toque de pelo menos 48 px, afastado dos controles e da área segura do aparelho. Abre painel com conversar, narração, som ambiente e silenciar. Recolher não encerra a conversa; Encerrar é explícito. Microfone é controle independente de ouvir áudio.
- Conversa aberta: retrato frontal fixo na faixa superior, aproximadamente 30% da área disponível, com teto de altura para não esmagar cartas/texto. Restante rolável para cartas e leitura. Teclado aberto e paisagem usam cabeçalho compacto. Retrato recolhível.
- Cronômetro junto ao retrato, sempre visível enquanto conversa. Indicações discretas de ouvindo, preparando resposta e falando; anel acompanha áudio real, sem simular sincronização labial. Respeitar redução de movimento.
- Desktop: reaproveitar a cena e ampliar a área de leitura; avaliar faixa superior versus coluna lateral com protótipo, sem impor a geometria do celular.
- Nova arte frontal por personagem será necessária para sensação de contato visual; os retratos existentes servem apenas para testar enquadramento.

## Identidade dos três baralhos

É viável com a mesma estrutura e variáveis CSS, sem três aplicações ou fundos pesados.
- Cósmico: azul profundo, prata/dourado e estrelas discretas.
- Cigano: vinho, madeira/âmbar e dourado envelhecido; remover estrelas cósmicas.
- Umbanda: verde profundo, tons terrosos e luz quente, alinhados às artes fornecidas; sem inventar símbolos religiosos.
Mudar fundo, superfícies, bordas e brilhos como conjunto. Hoje há variações locais, mas o fundo global continua cósmico.

## Biblioteca de som proposta

Gerar uma vez e reutilizar por personagem somente após escolha das vozes:
1. Acolhimento: já há welcome-cosmico.wav, welcome-cigano.wav e welcome-umbanda.wav. Ouvir/aprovar antes de gerar substitutos.
2. Preparação, uma vez ao abrir: "Respire com calma e pense no que deseja compreender."
3. Convite, uma vez quando puder revelar: "Escolha uma carta por vez, no seu ritmo."
4. Panorama, uma vez ao abrir o resumo: "Agora vamos olhar para o conjunto da sua leitura."
5. Encerramento: "Você pode voltar à sua leitura quando quiser." Usar apenas quando acesso recuperável estiver implementado conforme a oferta.
6. Efeitos curtos de embaralhar/revelar; não falar a cada toque nem repetir frases aleatoriamente durante a leitura.
7. Uma faixa ambiente original ou licenciada para uso comercial, sem voz e em loop discreto. Volume separado, reduzir ao narrar e pausar ao captar microfone. Silenciar é sempre fácil.

Uma voz principal por vez. Live suspende narração e acolhimentos; iniciar outra voz exige encerrar/pausar Live explicitamente para evitar sobreposição. Música e fala têm volumes independentes.

## Início de áudio no celular

Oferecer "Começar com som" ou "Começar sem som". Preparar o player persistente a partir desse toque; não depender de autoplay depois da chamada assíncrona. Se o navegador negar, mostrar "Toque para ouvir". Nunca ativar microfone sem ação e permissão explícitas.
Referência pontual nova: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay

## Ordem de execução proposta

1. Diagnosticar capítulo afetado e corrigir acompanhamento/erro do player; validar microfone e reprodução em HTTPS no aparelho real.
2. Centralizar som e acesso à conversa no avatar flutuante; montar cena frontal adaptável, preservando cartas/textos existentes.
3. Aplicar paletas por personagem e biblioteca ambiente após aprovação das vozes/artes.
4. PagBank, recuperação de compras/consultas, limites de pacote no servidor e persistência na Railway permanecem requisitos comerciais. Conteúdo é tratado em outra sessão; mapa astral permanece produto separado.

## Diagnóstico confirmado após retorno do usuário
Android/Chrome ficou aguardando. No momento da checagem, servidor e worker não estavam ativos; 9 jobs e só 3 estados prontos, deixando 6 pedidos sem processamento. worker.lock antigo apontava para PID25512, já reutilizado por node_repl.exe, causando falso positivo de worker ativo. Confirmada ausência do worker real antes de remover a trava. Worker e servidor reiniciados para retomar os pedidos existentes, sem novo POST de geração. Ainda não é validação de reprodução no celular. Na produção, usar supervisor/serviço Railway e tratar recuperação de trava sem confiar apenas em PID existente.

## Primeira implementação autorizada
- Escolha persistente de som, avatar flutuante e acolhimento existente somente por toque. Habilitar som não gera narrações.
- Anel mede o volume real do acolhimento; capítulos e Live ainda não alimentam esse anel.
- Preparação de capítulo com pequenas cartas em CSS e redução de movimento. Após 60 segundos, parar espera animada e permitir verificar o pedido existente. Requisições têm prazo; resposta perdida não declara geração falhada.
- Erro de reprodução tratado. Silenciar interrompe reprodução e microfone; não encerra o cronômetro de uma conversa já iniciada.
- Nenhum áudio novo gerado nesta rodada. Novos retratos e cena superior de entrega das cartas continuam próximos passos, com assets existentes como referência.

## Cena visual v2 — artes aprovadas
- Cósmico e Umbanda usam retratos transparentes meio-corpo-realista e close-realista. Cigana preserva arte anterior até aprovação.
- Palco de 288 px no celular e 360 px no desktop; mesa desenhada em CSS, três versos decorativos distribuídos em sequência finita de aproximadamente 1,9 s. Rever preparação é só visual: não altera cartas, não solicita geração e não reproduz som sozinho.
- Conversa recebe retrato frontal, faixa de até 27dvh/220px e cronômetro destacado. Sem sincronização labial.
- Redução de movimento, áreas de toque e safe-area preservadas. Teste de arquivos de cena e TypeScript passaram. Verificação visual automatizada indisponível nesta rodada (ferramenta do navegador falha na inicialização); enquadramento no aparelho permanece para avaliação.

## Ajustes após teste do usuário — 24/10
- Três avatares aprovados aplicados. Página inicial mostra meio-corpo em seletor com rolagem lateral no celular; conversa usa close para destacar rosto.
- Popup inclui A−/A+ e padrão, preferência de 16/18/20/22 px salva; leitura começa em 18 px. Começar com som toca acolhimento existente no gesto. Com preferência salva tenta acolhimento na abertura, sujeito ao bloqueio de autoplay do navegador.
- Tiragens 3/9/36 iniciam fechadas e revelam em ordem fixa, sem sorteio adicional. Removido Explorar; destaque segue capítulo. Cartas grandes com interpretações salvas abaixo; resumo mostra todas. Diálogo é aberto após render da posição e imagem tem key para impedir frame anterior.
- Cinco cartas: desktop também inicia fechado, pagamento não vira cartas; mobile preserva ritual inicial e exige toque nas cartas 4 e 5. Conteúdo acompanha revelação.
- Prompt das próximas tiragens maiores solicita interpretações individuais contextualizadas de 60–100 palavras. Leituras antigas não foram regeneradas nem expandidas artificialmente.
- Carta cigana 28: arquivo card-28.jpg está numerado XXVIII mas tem rótulo O Culpado. ZIP Downloads também só tem O_CULPADO; bloqueio anterior é deliberado. Pendente arte corrigida Homem/Cigano. Não restaurar rótulo errado silenciosamente.
- Preparação visual preservada conforme pedido; nenhum efeito de carta ou áudio novo foi gerado. Fonte, assets e preferência têm verificações locais; navegador automatizado continua indisponível.

## Presença, ritmo e identidade — primeira rodada implementada
- Ambientes CSS próprios: observatório cósmico; cigano com madeira/tecido e âmbar; Pomba Gira com vinho/preto e luz quente. Tema global segue personagem escolhida, sem estrelas nos dois últimos.
- Preparação mostra 3/5 versos ou grupos 3x3/4x9 conforme modalidade, sem faces nem novas posições. Progresso só recebe oracle-reveal de cartas realmente abertas; replay visual não sorteia ou gera áudio. Revelação tátil dura 720–760 ms, com redução de movimento.
- Uma voz por vez, medição de amplitude real nos acolhimentos, capítulos e PCM Live, com anel e luz discretos; Live bloqueia outras vozes até término/interrupção explícita e conserva buffer final. Um contexto de mídia compartilhado por aba e gráficos por elemento evitam recriar sources em re-render/StrictMode.
- Acompanhar ouvindo é opt-in no painel, usa áudios salvos e move somente para capítulo já revelado. Dock recolhível até 22dvh/160px; em telas baixas/teclado/paisagem usa faixa compacta. Pausa e continuidade não geram áudio. Foco deixa espaço para dock.
- Volume de voz independente. SoundscapeControls contém suporte lazy a ambiente e efeitos shuffle/place/flip, duck de 80% durante voz, pausa ao microfone e ao silenciar. public/audio possui só três acolhimentos aprovados; manifesto src/lib/soundscape.ts fica null para todos os novos sons até aprovação dos arquivos e direitos. Controles indisponíveis não são exibidos; nenhum download 404 ou substituto sintetizado.
- Ativação futura: colocar arquivos locais aprovados em public/audio e preencher somente os caminhos correspondentes do manifesto; não é necessário usar API para reprodução. Ambiente é opcional e inicia desligado.
- Nenhum áudio/consulta real novo gerado: fila permaneceu em 9 jobs prontos. Combinações estruturadas, caderno e compartilhamento pertencem à etapa seguinte.
- TypeScript e 8 testes focados passaram (coordenação/remontagem/retomada, duck/microfone, regressão Live). Build passou. JS inicial reportado pelo build mudou de 126 para 130 kB, sem nova dependência. Isso não mede tempo de carregamento no aparelho.
- Ainda pendentes: revisão visual e áudio no Android/Chrome real por HTTPS, teclado/conexão lenta no aparelho e avaliação com pessoas. A ferramenta de navegador estava indisponível nas rodadas anteriores; não declarar teste real de usabilidade concluído.

## Layout compacto após prints — 24/10
- ConsultationWorkspace alinha duas colunas no desktop e usa largura disponível (máximo 1680 px). Cabeçalho curto; altura de trabalho acompanha viewport, com rolagem interna para textos longos e fallback em telas baixas.
- ConsultationScene variant tabletop une retrato central, controles e grade REAL na mesma superfície. Remove versos decorativos/replay nesse modo. Mobile usa retrato de 160 px e uma única visão geral recolhível; revelar também fica acessível sem abrir a grade.
- Todas as modalidades mostram uma carta por vez, com setas e swipe, seleção pelas miniaturas e ação separada de ampliar. Resumo e áudio de capítulo ficam no topo; não há lista vertical de 36 interpretações. Resumo final mantém navegação pelas cartas.
- Revelar posição 10/19/28 muda automaticamente menu e destaque para linha 2/3/4. Selecionar miniatura revelada mostra carta correspondente; linhas fora do capítulo ficam apagadas. Posições e sorteio não mudam.
- Cinco cartas mantém paywall 4/5 e teaser da terceira para prévia; pago usa interpretação completa. Uma única revelação sequencial para desktop e mobile evita estados divergentes. Troca de capítulo remonta o player correto e pausa áudio anterior; teste de cleanup atualizado.
- TypeScript e 6 testes focados passaram: transição física entre linhas, coordenação de áudio/remontagem, preservação de posições e reabertura sem nova chamada IA. Nenhuma geração nova foi solicitada pelos testes desta rodada; novos sons continuam aguardando arquivos aprovados. A contagem da fila durante uso do usuário passou a 11 jobs, sem atribuir origem ou estado a essas solicitações.
- Navegador automatizado continua indisponível por falha de inicialização do runtime. Compilação/HTTP não confirmam geometria visual ou gesto no celular; validar layout no navegador real e Android, incluindo fontes maiores e tela baixa.

## Reorganização após novos prints — 24/10
- O layout compacto anterior foi substituído: colunas de aproximadamente 36%/64% no desktop, altura natural e uma única rolagem da página. Removidas as caixas independentes de rolagem de texto e carta. A conversa fica recolhida, com entrada igual nas modalidades.
- ConsultationTable centraliza a grade real de todas as tiragens/personagens. Frente e verso ocupam a mesma proporção vertical 24/43; a altura não depende do espaço restante da coluna. Seleção, próxima posição e linha ativa mantêm destaque próprio. Cartas fechadas não montam imagem ou nome.
- ConsultationReadingPane centraliza carta, interpretação, setas e gesto lateral. Visualizações Carta selecionada e Leitura da linha/Resumo são botões nativos com aria-pressed, sem simular um padrão de abas incompleto. A posição na mesa é identificada separadamente do nome da carta. Imagem remonta por posição para evitar reaproveitar a anterior.
- No celular, a visão geral é recolhível, mas o seletor de capítulos continua disponível. Revelar, selecionar miniatura e mudar capítulo levam ao painel correspondente após ação explícita. Os versos continuam com formato de carta nas tiragens 3/5/9/36. A navegação por setas altera cartas; o seletor altera partes da leitura.
- Tela inicial corrige largura mínima de fieldsets e contém o carrossel dentro do formulário. Escolha de som explícita antes de iniciar. Preparação central em tela cheia, usando retrato aprovado e entrada discreta, sem repetir piscadas. Não representa progresso de geração fictício. Acolhimento e áudio existente são reutilizados.
- Dock de áudio passa a faixa compacta; rótulos Pausar áudio, Ouvir acolhimento e Retomar áudio substituem Continuar. Não reaparece por acolhimento inativo de outra montagem. Ajuste A−/A+ agora amplia controles/rótulos e interpretação, não apenas os parágrafos. Tamanho padrão de leitura continua 18 px.
- Microfone mantém bloqueio antes da permissão em acesso inseguro, agora com orientação específica sobre endereço seguro. O teste pelo IP HTTP não valida microfone Android; HTTPS e aparelho real continuam pendentes. Não foi feita chamada Live ou geração de narração para validar layout.
- Verificação visual desta rodada: Chrome com viewport 1440x900 mostrou cartas fechadas de aproximadamente 44x78 px e ausência de rolagens internas no painel; revelar posição 10 selecionou Linha 2. Em 390x844, carta em destaque mediu aproximadamente 157x281 px. Em 320x740 e fonte de leitura 22 px, largura do documento permaneceu igual à disponível; campos da entrada também ficaram contidos (33–279 px em 312 px disponíveis).
- Estas verificações usaram dados locais de demonstração e componentes reais em uma página temporária, removida antes da compilação. Nenhuma nova consulta foi sorteada/gerada para os testes. Captura mobile em docs/validacao-interface-2026-10-24/mobile-390.png. O navegador voltou a permitir inspeção/captura e parte das ações por teclado, embora comandos de entrada tenham apresentado falhas intermitentes; não chamar isso de teste em Android físico ou teste de toque real.
- Sete testes focados passaram: tamanho/restauração de texto, transição de linha, áudio único/remontagem, alias da carta 11, posições/vizinhança e reabertura sem nova geração. Pagamentos, hospedagem pública e novos arquivos sonoros continuam fora desta correção de interface.
- Compilação final passou; JavaScript inicial reportado em 127 kB (antes 129 kB), sem nova dependência. Isso não mede carregamento no aparelho. Servidor compilado reiniciado e HTTP 200 confirmado em http://192.168.15.70:3000/. Serviço de áudio encontrado parado; antes de reabri-lo, foi confirmado que os 11 jobs já tinham WAV salvo. Serviço reaberto para pedidos futuros, sem retomar geração antiga; serviço de áudio sem erros; servidor registrou apenas avisos de configuração/otimização de imagens. PIDs naquele momento: servidor 25608 e áudio 36496; verificar identidade antes de operações futuras, pois PIDs podem ser reutilizados.

## Revelar, depois interpretar — 25/10
- Prioridade desta rodada: imersão no celular com as artes aprovadas. Monte interativo real, posições vazias numeradas e preenchimento progressivo. O toque no monte revela a próxima posição já sorteada; movimento nativo de 600 ms leva o verso do monte até o lugar correto, vira e assenta. Nenhuma nova chamada de interpretação ou sorteio acompanha o efeito. Navegação, fonte e troca de capítulo não repetem o voo.
- Monte permanece acessível durante a rolagem da mesa no celular. Quando necessário, o enquadramento acompanha a posição recém-preenchida. O fechamento do grupo leva à leitura conjunta; toque em carta já revelada permite vê-la maior. Não há distribuição automática de cartas sem toque. Movimento reduzido dispensa voo e virada; mesa oculta ou animação indisponível não impedem revelar.
- Retrato ampliado 1,45x no desktop e 1,25x no celular, com vinheta menor para preservar o rosto. Ambiente em camadas recebe oscilação discreta de luz por CSS. Não foram criados GIFs, vídeos, poses de mãos, imagens, efeitos sonoros ou músicas. Essas artes/sons continuam dependentes dos materiais aprovados.
- Três cartas formam uma leitura única. Cinco cartas: prévia só após revelar as três gratuitas; leitura paga só após as cinco, com preservação do bloqueio 4/5. Quadro de nove: primeiro revelar o quadro completo; depois linhas, colunas/centro, diagonais e síntese. Textos individuais podem cruzar cartas, por isso só aparecem após revelar toda a mesa.
- Mesa de 36 no celular: linha atual de nove cartas apresentada em três faixas maiores, com as posições originais numeradas. O resumo final mostra as 36 posições e oferece Ver linha 1–4 para aproximar. Isso não altera relações, vizinhança ou ordem de sorteio. Contador distingue avanço na linha e na mesa.
- Novas tiragens maiores recebem methodVersion v2. Nas novas mesas de 36, cada capítulo de linha usa só suas posições; interpretação/narração fica disponível ao terminar aquela linha, após a animação. Vizinhança, cantos, síntese e notas individuais aguardam a mesa completa. Leituras antigas, que podem cruzar linhas em qualquer trecho, aguardam as 36 cartas sem regenerar os textos salvos.
- Títulos e explicações compartilhados em reading-chapters.ts distinguem o quadro independente de nove da vizinhança dentro da mesa de 36. Os quatro cantos representam uma moldura; a síntese considera a mesa inteira. IDs, posições e textos das consultas salvas permanecem intactos; apenas títulos de apresentação são normalizados.
- Novas solicitações de áudio: três cartas têm section1; cinco têm synthesis; nove têm section1–3 e synthesis; 36 têm section1–4 e synthesis. Colunas, diagonais, vizinhança e cantos permanecem em texto. Áudio por carta individual foi retirado das novas solicitações. Esses números são de trechos oferecidos, não promessa de teto absoluto de tentativas do provedor.
- POST de áudio exige um capítulo permitido e explícito; JSON inválido, corpo vazio, campos extras e capítulos individuais são rejeitados antes de enfileirar. Som ligado, revelação e conclusão de linha nunca enfileiram áudio. Botão identifica a linha/consulta que será narrada. Arquivos antigos de capítulos/cartas continuam disponíveis por download autenticado, sem permitir nova geração desses capítulos.
- Narrações ficam na visualização de leitura conjunta. Ao explorar a carta, o player conjunto permanece montado e só é ocultado; o dock continua permitindo pausar. A síntese de cinco é a única narração dessa modalidade. Prompts de novas leituras reforçam uma fala autossuficiente, conexões reais e começo/desenvolvimento/fechamento; leituras antigas não foram reescritas.
- Verificações focadas: 12 testes passaram para política de capítulos, rejeição sem enfileirar, cache/reuso, downloads antigos, posições, coerência de capítulos e liberação após o grupo. Dois testes adicionais do motor de cinco passaram após o ajuste do prompt. Nenhuma chamada real de IA/TTS foi feita pelos testes.
- Conferência em Chrome com viewport mobile 390x844: antes da última carta, interpretação e síntese ausentes; após a conclusão, visualização conjunta ativa. Testadas prévia gratuita 3/5, consulta paga 5/5, linha de 9 da mesa de 36 e mesa completa. Resumo exibiu 36 posições e quatro atalhos; linhas exibiram nove posições. Capturas com dados de demonstração: docs/validacao-interface-2026-10-24/mesa-mobile-v2.png e mesa-desktop-v2.png. Páginas e endpoint temporários de inspeção removidos antes da compilação.
- Essa validação de tela não substitui Android físico, conexão lenta, microfone por HTTPS ou escuta de uma nova voz. Nenhum resultado desses testes foi declarado como concluído. O endereço local HTTP continua inadequado para validar microfone Android; não atribuir esse bloqueio ao modelo de voz.
- Compilação final desta rodada concluída. JS inicial reportado: 129 kB, ante 127 kB na rodada anterior; nenhuma nova dependência. Servidor compilado aberto novamente em 0.0.0.0:3000 e HTTP 200 confirmado no IP local. Serviços conferidos naquele momento: servidor PID 16860, áudio PID 36496. Não reutilizar esses PIDs sem verificar a identidade em operações futuras.

## Referência da vizinhança — 25/10
- Conferida, por leitura apenas, a consulta correspondente ao print: tema Trabalho & Dinheiro, Peixes na posição 28. O capítulo salvo lê Navio (19), Jardim (20), Peixes (28) e Cruz (29). O grupo destacado correspondia ao texto, mas faltava identificar sua referência; a expressão região central no texto confundia um recorte no canto com o centro geométrico da mesa.
- A referência recebe contorno próprio e descrição com nome, posição e tamanho do grupo. Nas bordas/cantos, a interface explica por que existem menos de nove cartas. Ao abrir esse capítulo, a carta do tema é a seleção inicial. IDs, texto, posições e sorteio salvos não foram alterados; nada foi regenerado.
- Corrigida a troca indevida de capítulo ao selecionar uma carta pertencente ao recorte atual. Vizinhança, cantos, colunas e diagonais mantêm o grupo selecionado durante a inspeção das suas cartas. Escolher uma carta fora do grupo continua levando à linha física correspondente.
- Compartilhada a identificação da carta do tema entre gerador e interface. Orientação de futuras leituras evita chamar qualquer vizinhança de região central por padrão. Testes direcionados cobrem grupos de 4/6/9 em canto/borda/interior, preservação da mesa e manutenção do capítulo ao selecionar vizinhas. Dois testes focados passaram; TypeScript passou. O script temporário de conferência foi removido.
- Compilação concluída. Para reiniciar, conferir o dono da porta 3000 com Get-NetTCPConnection: o processo iniciado com argumentos relativos pode não aparecer numa busca que exige o caminho absoluto do projeto em CommandLine. Nesta rodada, o servidor anterior PID 16860 mantinha logs abertos em .next e bloqueou a limpeza do build; após identificá-lo pela porta e pelos argumentos, foi encerrado e o build concluiu. Novos logs do servidor ficam em .data/runtime/server.stdout.log e server.stderr.log, fora da pasta de compilação.

