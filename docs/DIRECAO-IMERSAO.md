# Direção de imersão (proposta 04/11/2026)

Princípio: a pessoa está **sentada à mesa diante da oráculo**. A tela é a cena, não um painel com cena dentro. Nada de grade de cartas como ponto de partida.

## Celular (prioridade)

Tela cheia 9:16, sem barras. A oráculo ocupa os 60% superiores; a borda da mesa, com o baralho, fica embaixo.

1. **Chegada:** loop "parada" e saudação em voz. A pergunta é feita como mensagem de chat, não como formulário.
2. **Embaralhar:** toque no baralho. As cartas se embaralham em 3D e a oráculo passa ao loop "concentrada".
3. **Tirar:**
   - a carta voa do baralho para a mão;
   - um toque a vira, com flip 3D, brilho dourado e vibração curta;
   - a carta amplia no centro com o nome;
   - a oráculo entra no loop "falando" e a legenda corre embaixo, frase a frase, em vez de blocos de texto.
4. **Mesas grandes (9/36):** as cartas tiradas viram uma faixa compacta. Ao completar uma linha, a mesa completa sobe como folha inferior, com zoom de pinça, e depois volta para a cena.
5. **Fechamento:** síntese narrada e convite para a conversa ao vivo, com cara de ligação: botão grande de microfone e a oráculo olhando para a pessoa.
6. **Paywall dentro da cena:** depois de 3 cartas, a própria oráculo convida a abrir o resto da mesa, e o botão leva direto ao checkout.

Os controles ficam num único botão flutuante, que abre uma folha com: texto completo, volume, fonte, nova leitura e ajuda.

## Desktop

Palco 16:9 em tela cheia:

- oráculo à esquerda, mesa em perspectiva 3D em primeiro plano com a tiragem real;
- partículas leves (poeira, chama de vela) e parallax suave com o mouse;
- legendas embaixo.

Há espaço para efeitos mais pesados, mas o fluxo é o mesmo do celular: um único código, com camadas extras no desktop.

## Técnica

- Loops em `<video muted playsinline loop>`, com dois elementos fazendo crossfade entre estados. O próximo estado é pré-carregado e uma imagem estática serve de reserva.
- A reação à voz usa o nível de áudio que já existe (`oracle-voice-level`).
- Com `prefers-reduced-motion`, a cena fica estática.
- Partículas em canvas leve, desligadas em aparelho fraco.

## Pedido de arte (GPT/Codex)

Para cada personagem (cigana, cósmico, umbanda), um loop por estado: **parada, concentrada, falando, revelando**.

- 3 a 5 s, com o último quadro igual ao primeiro (loop perfeito); câmera fixa, só a personagem se movendo.
- Duas versões: vertical 1080×1920 e horizontal 1920×1080.
- MP4 (H.264) e, se possível, WebM, sem som, até 1,5 MB cada.
- Mesmo enquadramento, luz e roupa em todos os estados, para o crossfade não "pular".
- Verso da carta e textura da mesa em PNG separado, alta resolução.

### Pagamento (close no rosto)

Para cada personagem, mais três vídeos em close do rosto, com o mesmo enquadramento entre eles:

- **aguardando** (loop de 3 a 5 s): olha para a pessoa e espera, com respiração e piscar;
- **recusa** (2 a 3 s, sem loop): fica triste ou decepcionada e termina parada;
- **aceite** (2 a 3 s, sem loop): sorri e acena, e termina parada.

Formato: vertical 1080×1920, MP4 ou WebM, sem som (a fala é gerada pelo app).
