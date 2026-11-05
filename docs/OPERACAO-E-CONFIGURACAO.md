# Operação e configuração

Referência atualizada em 29/10/2026. Alterações locais ainda não publicadas. Pendências ficam no [estado](ESTADO-DO-PROJETO.md).

## Ambiente

Use `.env.example` como lista inicial e preencha `.env` no ambiente autorizado. Não publicar `.env`, `.data`, credenciais ou dados de consultas.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL usado pelo Prisma |
| `ORACLE_ACCESS_SECRET` | Segredo estável de assinatura; trocar invalida provas de acesso existentes |
| `GEMINI_API_KEY` | Interpretação, TTS e token Live no servidor |
| `GEMINI_MODEL`, `GEMINI_MODEL_FALLBACK` | Modelos de interpretação |
| `ORACLE_TTS_MODEL`, `ORACLE_TTS_MODEL_FALLBACK`, `ORACLE_TTS_MODEL_FALLBACK2` | Modelos de narração (reservas usados em qualquer erro) |
| `ORACLE_AUDIO_DIR` | Pasta privada compartilhada por web e worker; padrão `.data/audio` |
| `ORACLE_DEMO_MODE` | Libera demonstração; não representa pagamento confirmado |
| `ORACLE_LIVE_ENABLED` | Habilita experimento Live |
| `NEXT_PUBLIC_READING_PRICE`, `NEXT_PUBLIC_PIX_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | Dados expostos ao navegador. Configuração Pix não implementa confirmação de pagamento |

Cinco cartas tenta os modelos principal e alternativo. Não há mais leitura estática silenciosa: se ambos falharem, a interpretação fica indisponível e a mesma consulta pode ser retomada com suas cartas preservadas. Demais modalidades exigem resposta válida da IA.

## Execução

```sh
npm install
npm run dev
```

`postinstall` gera o cliente Prisma. Preparar tabelas é etapa separada: conferir banco alvo, backup e diferença de esquema antes de autorizar sincronização/migração. Instalação não deve alterar banco real automaticamente.

Para servir compilação:

```sh
npm run build
npm start
```

`npm start` supervisiona web e worker juntos, no mesmo ambiente e diretório de áudio. Se um processo falhar, encerra o outro para permitir recuperação pela hospedagem. Este comando foi alterado localmente em 29/10 e ainda precisa ser publicado e validado na Railway.

Para desenvolvimento, ou para uma implantação que já supervisione os processos separadamente, use `npm run dev` (desenvolvimento) ou `npm run start:web` (web compilada) e, em outro processo com mesmo ambiente e armazenamento:

```sh
npm run audio:worker
```

`audio:welcomes` gera assets e pode consumir API: não executar como teste rotineiro. Reutilizar acolhimentos existentes.

## Áudio aguardando ou com falha

1. Identificar consulta/capítulo e conferir estado no mesmo navegador autorizado. Não repetir geração porque o player falhou.
2. Confirmar servidor e worker reais, ambiente, permissões e pasta compartilhada. Consultar logs sem expor texto privado/chaves.
3. Se WAV já existe, testar acesso/reprodução; reutilizar sem novo TTS. Erro de rede/player não comprova falha de geração.
4. O worker local usa uma porta exclusiva em localhost, derivada do diretório de áudio, liberada pelo sistema ao encerrar. A trava é por máquina, não distribuída. Não executar workers em máquinas distintas sobre a mesma fila de arquivos. Versões antigas ainda usam arquivo PID; não encerrar processos apenas por um PID histórico.
5. Confirmar retomada e reprodução no dispositivo. HTTP isolado não comprova áudio audível.

Fila e WAVs precisam de armazenamento persistente comum; não supor que dois serviços Railway compartilham automaticamente disco. Definir arranjo persistente/armazenamento compartilhado antes da oferta. Banco não armazena WAVs.

Com consentimento explícito de ouvir por consulta, a interface prepara a síntese e o capítulo atual durante a revelação. Só reproduz quando a parte está liberada e o zoom está fechado. Não há pedidos de áudio carta por carta. O completo também permite narração das relações (colunas/diagonais/vizinhança/cantos). Bloqueio de reprodução pelo navegador mostra ação para iniciar com toque. A prévia gratuita de cinco cartas não prepara a síntese bloqueada; ela pode ser preparada após abrir o restante.

Prévia visual controlada: em desenvolvimento, `/ui-check` usa sessões fictícias e respostas de áudio simuladas com um acolhimento local. Não acessa consultas reais nem chama Gemini. A rota retorna 404 fora do desenvolvimento. Ela valida interface, liberação e eventos do avatar; não valida qualidade da leitura, TTS real ou operação pública.

## Hospedagem e banco: evidência registrada

Em 25/10, histórico registrou container Railway iniciado, mas falha em `/api/reading/start`: `PrismaClientInitializationError`/servidor PostgreSQL inacessível. Diagnóstico apontou conexão direta Supabase/IPv6 e duas alternativas: habilitar saída IPv6 ou usar Session pooler. São caminhos históricos a revalidar no ambiente e documentação oficial antes de aplicar; esta rodada não consultou nem alterou configuração remota.

Em 29/10, consulta somente leitura à Railway retornou deploy `cda4ed92-0e4d-4c49-966b-294c6d464c60`, commit `3a5ff09`, SUCCESS; `GEMINI_API_KEY` cadastrada e IPv6 de saída habilitado. Logs de 28/10 mostram HTTP 503 por alta demanda nos dois modelos de interpretação. Startup publicado ainda é `next start`, sem worker iniciado nesse comando; não há serviço separado de worker na lista retornada. Usuário relatou áudio funcionando nos jogos de nove/36 e falhando em cinco na hospedagem, portanto ausência de worker no comando não prova sozinha a causa daquele incidente. Não houve correlação do job específico, teste funcional remoto nem alteração da configuração nesta rodada.

Fechamento: identificar serviço/deploy e commit atual, conferir tipo de conexão sem revelar senha, testar criação/reabertura de leitura e confirmar logs sem erro. Site abrindo ou build passando não comprovam banco funcional. Não sincronizar esquema para corrigir falha de rede.

## Dispositivos e publicação

HTTPS é requisito para microfone fora de localhost. IP doméstico HTTP não valida microfone Android. Endereços LAN, processos e logs antigos são históricos; verificar os atuais. Logs de runtime devem ficar fora de `.next` para não bloquear recompilações no Windows.

Validar reinício web/worker, persistência, cookie/acesso privado e recuperação após falha. Confirmação comercial inclui pagamento e recuperação quando implementados. Não prometer recursos inexistentes na demonstração.
