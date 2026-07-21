# MBA-Mandic- · Hermes — MBA (bot do Telegram)

Bot/agente do MBA em Gestão Educacional em Saúde com IA (São Leopoldo Mandic, turma 2026). Roda em produção num VPS como serviço systemd (`mba-bot`); o Telegram é a interface (grupo do time de gestão + grupo dos alunos).

## Mapa do projeto

- `src/index.ts` — entrada: bot grammY + crons (lembretes diários 09h, relatório de engajamento seg 08h)
- `src/agent.ts` — o agente "Hermes — MBA" (loop de function calling, API OpenAI): responde ao time no grupo de gestão e no privado do curador
- `src/shadow.ts` — grupo dos alunos: observa, classifica dúvidas e manda propostas de resposta para curadoria no grupo de gestão (botões aprovar/descartar)
- `src/llm.ts` — chamadas OpenAI: classificação (gpt-5-mini) e geração de respostas (gpt-5.1)
- `src/mgmt.ts` — roteamento do grupo de gestão + base de conhecimento (arquivos enviados no grupo)
- `hermes/` — **o cérebro do agente**: IDENTIDADE, CONDUTA, MISSAO, PRINCIPAIS (carregados no system prompt, nesta ordem). Editar estes arquivos muda o comportamento do agente em produção no próximo deploy.
- `config/calendar.json` — calendário oficial dos módulos (fonte dos lembretes; o agente pode reescrevê-lo via ferramenta)
- `content/` e `knowledge/` — materiais do curso e documentos da gestão (fora do git por direito autoral/confidencialidade)
- `data/bot.db` — SQLite (engajamento, curadoria, notas do agente); produção vive no VPS

## Regras para trabalhar aqui

1. **Nunca crie/commite `.env` nem segredos** — tokens do Telegram/OpenAI não vivem no repo e não devem ser pedidos a ninguém.
2. **Não rode `npm start`** — o bot de produção está no VPS; uma segunda instância com o mesmo token quebra a entrega de mensagens (conflito de polling). Validação local = `npm run typecheck`.
3. **Deploy é centralizado** — quem publica no VPS é o Rodrigo (rsync + restart do serviço). Contribuições entram por commit/push neste repo.
4. **Mudanças em `hermes/*.md` são mudanças de comportamento do agente** — trate como mudança de produto: descreva no commit o que muda e por quê.
5. Textos do agente e do produto: **português brasileiro, denso e direto**. Dado individual de aluno é sensível por padrão.

## Comandos

- `npm install` — dependências
- `npm run typecheck` — validação (use antes de commitar)
