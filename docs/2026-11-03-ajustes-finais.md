# Ajustes finais locais — 03/11/2026

- Nove cenas de mesa servidas em `public/scenes`, mapeadas por tema em `scene-assets.ts` e usadas na visão imersiva. Expressões em camadas com transição suave e movimento contínuo independente do áudio; movimento reduzido mantém a base estática.
- Desktop: personagem na metade esquerda, mesa na metade direita em todas as tiragens. Celular: degradê inferior sobre a cena. Não foram gerados fundos horizontais novos.
- Um único `LiveConsultation` por consulta, fora das apresentações ocultáveis, preservando a conexão ao alternar visão. Na visão imersiva o painel fica no rodapé do celular ou à direita no desktop; ao abrir, oculta a mesa/foco sobrepostos.
- Silenciar microfone desabilita trilhas e bloqueia ambos os caminhos de envio PCM, preservando captura e reprodução. Retomada reutiliza captura; encerramento libera recursos. Controle local de saída da voz, chat rolável e controles compactos.

## Validação dirigida

TypeScript, lint dos componentes de integração e testes focais de foco/retomada passaram. Novo teste `tests/live-consultation.test.cjs` passou nos dois caminhos de captura com mocks: bloqueio de PCM durante mute, retomada sem fechar reprodução e liberação ao encerrar. Não comprova hardware ou API ao vivo.

Compilação de produção aprovada; permanecem os dois avisos anteriores de rastreamento dinâmico de filesystem em `src/lib/audio.ts`. Lint do LiveConsultation ainda aponta problemas preexistentes de hooks/refs; não foi declarado lint global aprovado.

Conferência de layout na fixture em Chrome headless, 1440×900 e 390×844, confirmou carregamento da nova cena e ausência de transbordo horizontal. Capturas em `docs/testes/2026-11-03-final/`. É simulação de viewport, não aparelho físico. Não houve nova geração paga, teste real de Live API ou publicação. A chamada real com microfone e ruído de fundo permanece necessária para validação operacional.
