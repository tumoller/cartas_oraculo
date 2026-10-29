# 🌌 Oráculo Galáctico — Baralho Cigano MVP

Web app completo de tiragem de cartas do Baralho Cigano (Lenormand 36 cartas) com leitura combinada via IA (Gemini 2.5 Flash), paywall seguro no back-end (PostgreSQL via Prisma), checkout Pix simulado e upsell com agendamento via WhatsApp.

---

## ⚡ 4 Comandos para Rodar Localmente

Certifique-se de preencher a variável `DATABASE_URL` no seu arquivo `.env` com a senha do banco do Supabase antes de rodar os comandos:

```bash
# 1. Instalar dependências
npm install

# 2. Gerar cliente do Prisma e sincronizar tabelas com o PostgreSQL
npx prisma db push

# 3. Iniciar o servidor de desenvolvimento local
npm run dev

# 4. Acessar no seu navegador
# Abra http://localhost:3000
```

*(Opcional) Para visualizar e gerenciar as leituras diretamente no banco: `npx prisma studio`*

---

## 🚀 4 Comandos para Deploy no Railway

1. Crie um repositório no GitHub e faça o push do código:
   ```bash
   git init
   git add .
   git commit -m "feat: MVP Oraculo Baralho Cigano Railway Ready"
   git branch -M main
   git remote add origin <URL_DO_SEU_REPOSITORIO>
   git push -u origin main
   ```
2. No painel do [Railway](https://railway.app), clique em **New Project** > **Deploy from GitHub repo** e selecione o repositório.
3. Adicione uma instância **PostgreSQL** no mesmo projeto do Railway (ou conecte o mesmo Supabase).
4. Em **Variables** do serviço Next.js no Railway, configure:
   - `DATABASE_URL`: URL de conexão do PostgreSQL
   - `GEMINI_API_KEY`: Sua chave do Google AI Studio
   - `NEXT_PUBLIC_READING_PRICE`: `R$ 14,90`
   - `NEXT_PUBLIC_WHATSAPP_NUMBER`: Seu número com DDD (ex: `5511999999999`)

O Railway executará automaticamente o script `npm run build` (que já inclui `prisma generate && next build`) e subirá a aplicação em produção.

---

## 🛡️ Arquitetura de Segurança (Paywall no Servidor)
- Enquanto `isPaid === false`, a API sanitiza o payload retornando `null` nos nomes, números e textos das Cartas 4 e 5, no final da Carta 3 e na Síntese Geral.
- Os campos bloqueados não são enviados ao navegador. O pagamento ainda é simulado: a rota de desbloqueio não verifica um provedor Pix e não está pronta para cobrança real.
- Se a chave do Gemini estiver ausente, o sistema ativa um **Fallback Oracular Local** inteligente, impedindo falhas na experiência do usuário.

## Evolução da leitura — 22/10/2026

- Novas sessões usam linha de cinco cartas: centro, pares adjacentes e espelhos 1–5 / 2–4, sem pontuação de polaridade.
- Pergunta opcional de até 500 caracteres, preparação breve e página `/como-funciona`.
- As três abordagens compartilham as 36 cartas. As artes cósmicas estão completas. Umbanda e Cigano têm agora 36 arquivos cada após incluir as três imagens anexadas pelo usuário. A arte cigana 28 segue desativada por trazer o rótulo "O Culpado"; ela usa apresentação provisória.
- Metadados `question` e `methodVersion` são salvos no JSON já existente; sem alteração de tabela. Sessões antigas conservam seus textos e rótulos.
- Retirados selos de polaridade e palavras-chave das cartas.
- Voz, Pix real, revisão editorial completa das 36 definições e mapa astral continuam pendentes. Nenhuma fonte histórica comprova previsões; a experiência oferece interpretação simbólica.

## Apresentação no celular

- Abaixo de 640 px, cada carta aparece no mesmo painel da sua interpretação, em sequência vertical. No desktop, a mesa de cartas permanece no topo.
- Cartas bloqueadas continuam sem nome, imagem ou interpretação no retorno público.
- A página Como funciona apresenta inspiração e experiência, sem detalhar o motor ou os mecanismos de contingência.

## Demonstração na rede local

- Endereço atual: http://192.168.15.70:3000 (mesma rede doméstica).
- Servidor Next em segundo plano com `next start -H 0.0.0.0 -p 3000`.
- Regra Windows `Cartas Oraculo - Rede local 3000`: TCP 3000, IP local 192.168.15.70, origem LocalSubnet.
- Logs em `.next/oraculo-server.stdout.log` e `.next/oraculo-server.stderr.log`.

## Conferência dos novos ZIPs — 22/10/2026

- Downloads atuais: cigano 35 arquivos, Umbanda 34, sem números duplicados.
- Cigano: imagem original 15 (Cachorro) associada ao símbolo interno 18; imagem original 18 (Urso) ao símbolo interno 15. Os números impressos nas artes originais precisam de correção para coincidir com a base Lenormand do projeto.
- Cigano 28 (O Culpado) permanece no acervo, mas usa apresentação provisória até corrigir a arte para Homem/Cigano.
- Faltam arquivos: cigano 26 (Livros); Umbanda 7 (Serpente), 12 (Pássaros).
- Nenhuma alteração adicional nas regras de leitura nesta atualização de artes.

## Complemento de imagens — 22/10/2026

- Cigano 26: Livro (PNG recebido na conversa).
- Umbanda 7: Cobra; 12: Passarinhos (PNGs recebidos na conversa).
- A seleção da imagem usa JPG ou PNG existente para o número sorteado.

## Experiência mobile — rodada visual

- Ritual de abertura com pilha de cartas e revelação sequencial das três cartas públicas; interpretação disponível após a abertura.
- Cartas maiores ajustadas à altura do aparelho, ampliação em diálogo nativo e faixa com miniatura/nome que acompanha cada capítulo.
- Texto de leitura em 16 px; identidade de cores para cósmico, cigano e Umbanda, com movimento por CSS e respeito à redução de movimento.
- Após o desbloqueio simulado, cartas restantes e panorama continuam disponíveis; mesa compacta das cinco cartas para rever as artes.
- Sem dependências novas. Retratos de um avatar por baralho aguardam arquivos do usuário; voz e animação do avatar ficam em etapa separada.

## Consulta salva, cena e áudio — 23/10/2026

- Novas modalidades: linha de três, linha de cinco (compatível com o fluxo anterior), quadro 3x3 e mesa de 36 em quatro linhas de nove. As modalidades completas exigem confirmação de acesso simulado e ORACLE_DEMO_MODE=true; não existe pagamento real integrado.
- O cliente cria uma identidade de tentativa, e o servidor persiste o sorteio antes da chamada de interpretação. Uma tentativa pronta é devolvida sem novo sorteio ou chamada de IA. Retentativa de uma geração que falhou preserva a mesa. Uma geração textual interrompida com processo encerrado ainda exige recuperação operacional (não é job de texto em background).
- Acesso às novas consultas protegido por cookie HttpOnly assinado (30 dias) e segredo estável ORACLE_ACCESS_SECRET. Histórico do navegador guarda referências, não substitui cadastro nem recuperação por e-mail. Sessões antigas sem prova de acesso não recebem acesso retroativo automaticamente.
- Cena ilustrada com os três avatares fornecidos, movimento de câmera CSS e redução de movimento. Acolhimentos genéricos em public/audio são gerados uma vez por scripts/prepare-welcomes.cjs; o script preserva arquivos existentes. Sem sincronização labial, novos frames de pose ou música ambiente nesta versão.
- Narração individual por capítulo e síntese final: POST enfileira apenas texto salvo, nunca texto enviado pelo cliente. GET consulta estado; arquivos privados exigem acesso à mesma leitura completa. Reproduzir/baixar um arquivo pronto não chama o Gemini novamente.
- Worker separado: npm run audio:worker. Fila, estados e WAVs em .data/audio; 3 tentativas limitadas para falhas transitórias e nenhuma repetição automática para falhas permanentes. O worker continua se a aba fechar; precisa de processo supervisor e volume persistente na hospedagem. Armazenamento privado compartilhado e compressão de áudio para distribuição são evolução para produção. Não guardar áudio no banco.
- Teste Gemini Live de três minutos, um início por consulta, token efêmero de uma utilização preso ao modelo e ao contexto da mesa salva. Liberado somente com ORACLE_LIVE_ENABLED=true. A chave permanente permanece no servidor. Texto funciona na LAN; microfone requer HTTPS ou localhost e clique explícito. O cronômetro fecha o cliente; isto não é um teto de cobrança inviolável contra um cliente modificado, que exigiria proxy/controlador de sessão no servidor antes da venda por tempo.
- A Live tem quotas e preço conforme o projeto. Não há promessa de uso gratuito ilimitado. A conversa não é gravada nem enviada por e-mail nesta versão. Pagamento, cadastro por e-mail, envio transacional, agendamento de horário e recuperação entre dispositivos continuam pendentes.
- Verificações novas: nove testes focados de fila/cache/retentativas, posições/imutabilidade/acesso e token Live; compilação Next; amostra real de TTS e teste de protocolo Live. Conferência de uma mesa real de 36 cartas com reabertura e capítulos na interface.

Conferência final: mesa de 36 reaberta pelo histórico; texto exportável 200, áudio com Range 206, acesso sem cookie 403; dois capítulos de áudio prontos com uma tentativa cada. Live vinculada à mesa salva conectou e respondeu sobre as cartas vizinhas do Coração. Layout conferido em 320/390 px e 1280 px. Microfone não validado em HTTPS nesta rodada. Prévias em docs/mesa36-mobile.png e docs/mesa36-desktop.png.

Ajustes de 23/10/2026: carta 11 usa A Vassoura na Cigana Tradicional e O Chicote nos outros dois baralhos, conforme as artes. Nome corrigido na apresentação de consultas anteriores sem reescrever interpretações ou áudios salvos; novas consultas já enviam o nome correto ao gerador. Mesa de cinco cartas sem rolagem horizontal no desktop. Live configurada com Gacrux e orientação de cadência natural; conexão real aceitou a configuração sem gerar áudio. O gemini-3.8-live removeu enable_affective_dialog: não enviar esse campo. Os áudios gravados mantêm suas vozes anteriores. Seis testes focados e compilação passaram nesta correção.

Correção de áudio Live e linguagem: reserva inicial/retomada de 180 ms, trechos contínuos enquanto há áudio na fila, limite de resposta ampliado de 512 para 2048 tokens, cancelamento imediato preservado para interrupção manual e fim natural da conexão aguarda onended dos trechos recebidos (sem depender de relógio de parede). Microfone pede cancelamento de eco. Mensagens posteriores ao encerramento são ignoradas. Sem atribuir retrospectivamente a causa do relato do usuário: teste unitário valida agendamento/configuração, e compilação valida integração; resposta longa em dispositivo real ainda deve ser conferida. Textos públicos sem fornecedor/API/custo interno, linguagem simples e sem promessa de recuperação por e-mail. WhatsApp oculto sem número válido. Antes de venda: gateway e confirmação segura, hospedagem com HTTPS e armazenamento persistente, acesso recuperável, termos/privacidade e suporte, controle de tempo/quantidade no servidor e validação de áudio real.
