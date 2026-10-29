# Cartas Oráculo

Experiência de interpretação simbólica Lenormand com três estilos, tiragens de 3/5/9/36 cartas, texto salvo, narração sob solicitação e conversa experimental. O checkout atual é demonstrativo; cobrança real ainda não está implementada.

## Comece aqui

| Assunto | Documento responsável |
|---|---|
| Entregas, problemas conhecidos e prioridades | [Estado do projeto](docs/ESTADO-DO-PROJETO.md) |
| Fluxos, componentes, dados e integrações | [Arquitetura](docs/MAPA-ARQUITETURA-E-MODULOS.md) |
| Sorteio, prompts, revisão da base e piloto de feedback | [Motor e revisão editorial](docs/MOTOR-E-REVISAO-EDITORIAL.md) |
| Ambiente, execução e diagnóstico | [Operação](docs/OPERACAO-E-CONFIGURACAO.md) |
| Oferta inicial, revisão editorial e conteúdos | [Lançamento e conteúdos](docs/LANCAMENTO-E-CONTEUDOS.md) |
| Verificações e limites do levantamento | [Evidências de 26/10](docs/testes/2026-10-26-LEVANTAMENTO.md) |
| Registros anteriores preservados | [Arquivo histórico](docs/archive/README.md) |

## Executar localmente

Com Node.js >=20.9, npm e `.env` configurado conforme o manual de operação:

```sh
npm install
npm run dev
```

Abra o endereço informado pelo Next. Narração exige worker separado. Preparar tabelas é etapa separada: confira o banco alvo antes de qualquer mudança de esquema.

## Manter a documentação

- Um assunto tem um documento responsável. Atualize sua seção, sem acrescentar sucessivas retomadas contraditórias.
- Estado registra entrega e prioridade; arquitetura explica funcionamento; operação orienta execução; lançamento cuida de oferta e conteúdo.
- Evidência datada registra o que foi verificado. Teste local, commit, deploy e funcionamento público são estados diferentes.
- Histórico não substitui os guias atuais. Não duplicar atualizações no arquivo.
- Não registrar credenciais, dados pessoais de consultas ou URLs assinadas.
- Subtarefas de agentes usam GPT-6 Sol com esforço médio, nunca alto ou acima, conforme orientação do usuário nesta sessão.
