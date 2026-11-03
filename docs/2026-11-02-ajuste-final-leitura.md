# Leitura imersiva — registro de validação

Em 2 de novembro de 2026, a revisão das evidências de 1º de novembro encontrou erros no relatório de integração anterior. Ele não deve ser usado como comprovação de liberação.

- O roteiro `scratch/run-integration-tests.js` escolhia continuar sem som e marcava continuidade, pausa e retomada de áudio como aprovadas incondicionalmente. Esses cenários agora são registrados como **não executados**.
- O foco da personagem foi acionado por evento artificial. A captura demonstra apenas uma reação simulada, não a reprodução real.
- Os arquivos `sequencia-giro-carta-nova-frame1.png`, `sequencia-giro-carta-nova-frame2.png`, `sequencia-transicao-mesa-narracao-mesa.png` e `audio-continuo-troca-apresentacao.png` foram capturados sem as ações descritas entre eles. Não demonstram esses eventos; foram preservados para rastreabilidade. O roteiro deixou de produzi-los.
- Os demais resultados anteriores são evidência das verificações específicas do roteiro, não prova geral de acessibilidade, ausência de cortes ou funcionamento em aparelho físico.

## Áudio e imagem

### Ajuste pontual implementado em 02/11

- A visão imersiva mantém o foco da personagem e a opção de retomada quando a narração está pausada e ainda pode ser retomada. A decisão manual de voltar à mesa permanece respeitada para o mesmo capítulo.
- A ação de ouvir na visão imersiva ativa a preferência de som/narração e solicita a reprodução do capítulo liberado pelo `ReadingAudio` já existente, nos fluxos `SpreadBoard` e `ReadingBoard`. Não foi criado um segundo player de capítulo.
- Se a reprodução automática for bloqueada, o player solicita a apresentação de recuperação já existente, com toque explícito para iniciar.
- Os avisos do lint da integração receberam tratamento pontual: imports não usados removidos e sincronizações existentes com navegador/hidratação documentadas localmente. Não houve desativação global de regras nesta rodada.

Checagens concluídas: TypeScript e lint dirigido dos quatro componentes alterados passaram; 29 testes existentes de áudio/interação passaram com `node --test --test-isolation=none tests/consultation-audio.test.cjs tests/reading-interaction.test.cjs`. Esses testes usam simulação e não comprovam fala real. `git diff --check` e sintaxe do roteiro corrigido passaram.

Regressão adicional: `tests/immersive-focus.test.cjs` renderiza o componente real com dependências de áudio controladas. Verifica que capítulo pausado retomável mantém foco e **Continuar leitura**, e que ausência de mídia retomável oferece **Ouvir esta leitura**. Passou com isolamento de processos desativado; comprova renderização dos estados, não reprodução, clique ou sincronização de boca.

`npm run build` passou após permitir os processos necessários à compilação local. Permanecem dois avisos em `src/lib/audio.ts` sobre rastreamento amplo por acesso dinâmico ao filesystem; esse arquivo não foi alterado nesta rodada. Nenhuma variável de ambiente, infraestrutura ou credencial foi modificada. A primeira tentativa no ambiente restrito falhou com `spawn EPERM`; a compilação concluída não deve ser confundida com publicação.

Novas bases de mesa: Umbanda, Cósmica e uma variação de fala da Cigana foram geradas pela ferramenta nativa e salvas em `conteudo/imersao/`. Inventário, prompts exatos e orientação para continuar a boca em `conteudo/imersao/README.md`. Não foram integradas como animação final: a variante de fala exige alinhamento antes de alternar imagens. Nenhuma sincronização labial foi declarada pronta.

Antes de liberar, testar com uma consulta e narração reais: iniciar capítulo, alternar visão sem interrupção ou duplicação de áudio, pausar e retomar, voltar à mesa, abrir texto e conferir preservação do trecho. Registrar dispositivo, versão e evidências. Não executar geração paga apenas para preencher uma lacuna de relatório.

A personagem à mesa em `conteudo/imersao/cigana-mesa-base-v1.png` é uma imagem estática. Variações de boca, piscar e movimentos devem preservar identidade, enquadramento e iluminação para permitir transições suaves; imagens isoladas não comprovam sincronização labial. A integração e validação visual dependem dos recursos e da implementação efetivamente disponíveis, incluindo preferência por movimento reduzido.

## Roteiro para o próximo teste do usuário

Prévia local deixada em `http://localhost:3013/` (processo de desenvolvimento desta sessão). Diagnóstico: a rota de fixture `/ui-check` respondeu HTTP 200. A verificação automatizada de navegador permaneceu **não concluída**: após navegação, o comando CDP `Runtime.evaluate` excedeu 10 segundos mesmo com porta/perfil exclusivos. O primeiro bloqueio foi `spawn EPERM`; depois houve um lock de perfil Chrome dentro de `scratch/` que fez o compilador falhar. O navegador de teste responsável foi encerrado e as tentativas seguintes usaram perfil temporário fora do projeto. Não há prova nova de reprodução, pausa/retomada ou unicidade do player no navegador nesta rodada. O script `scratch/check-fixture-audio.cjs` é diagnóstico, não evidência de aprovação.

Na aplicação local, entrar em uma consulta, revelar o trecho necessário e alternar para a visão imersiva. Tocar em **Ouvir esta leitura**, permitir o toque de recuperação se o navegador solicitar, pausar e retomar. Depois usar **Voltar à mesa**, alternar normal/imersiva e verificar que não reabre cartas nem reinicia o áudio. Conferir texto, zoom e linha ativa. A rota `/ui-check` existe apenas em desenvolvimento e usa consultas/respostas simuladas e um WAV local: serve para regressão, não para comprovar geração TTS ou operação de produção.

As novas cenas e a boca ainda não substituem as imagens usadas no site. A continuação criativa deve partir do inventário em `conteudo/imersao/README.md`, não de uma alegação de sincronização já concluída.

## Publicação e retorno

O relatório anterior sugeriu alterações de configuração e descarte local sem comprovar necessidade. Não executar essas instruções. Verificar o estado e a versão ativa da hospedagem antes de qualquer publicação. Após validação e autorização de publicação, identificar a versão anterior funcional e usar o mecanismo de rollback da própria hospedagem para restaurá-la; confirmar a versão ativa e testar consulta e áudio após o retorno. Não descartar alterações locais ou modificar credenciais como parte desse procedimento.
