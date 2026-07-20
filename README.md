# mba-telegram-bot

Bot do Telegram do MBA em Gestão Educacional em Saúde com IA (São Leopoldo Mandic, turma 2026).

Três funções, em fases:

| Fase | Função | Estado |
|---|---|---|
| 1 | **Lembretes do checklist** ao time de gestão (D-3, D-1, D0 de cada marco do Termo de Compromisso: exercício pré-encontro na quinta, sábado presencial, reflexão D+10, atividade em grupo D+15, demo no módulo seguinte) | ativo |
| 2 | **Q&A em modo sombra**: o bot observa o grupo dos alunos; dúvidas de conteúdo geram resposta técnica enviada em DM ao curador com botões de feedback (✅/❌/📤). Nada é postado no grupo sem aprovação explícita. Feedback e correções viram few-shot das próximas respostas. Após 2–3 disciplinas, avalia-se liberar resposta direta no grupo. | ativo (sombra) |
| 3 | **Engajamento agregado**: relatório semanal à gestão (mensagens substantivas, respostas a colegas, alunos em silêncio 14+ dias). Sem análise de conteúdo individual. Alunos cientes do monitoramento por IA (Termo de Compromisso). | ativo |

## Roteamento de modelos

- `claude-haiku-4-5` — classificação de mensagens (barato, alto volume)
- `claude-sonnet-5` — geração de respostas técnicas

## Guardrails pedagógicos

- O bot **nunca faz a entrega do aluno** (reflexão, exercício, atividade). Pedidos disfarçados recebem andaime socrático — coerente com o Princípio 1 do sistema de avaliação (entrega que qualquer LLM escreveria é devolvida).
- Toda resposta aponta a **seção específica do conteúdo** (módulo/aula/capítulo) via metadados do material em `content/`.
- Livros não são reproduzidos — são referenciados.

## Setup

1. Crie o bot no [@BotFather](https://t.me/BotFather) (`/newbot`). Guarde o token.
2. No BotFather: `/setprivacy` → **Disable** (o bot precisa ler todas as mensagens do grupo para engajamento).
3. Adicione o bot ao grupo dos alunos e ao grupo da gestão. Envie `/chatid` em cada chat (e no privado com o bot) para descobrir os IDs.
4. Copie `.env.example` → `.env` e preencha.
5. Coloque o material da 1ª disciplina em `content/` (ver `content/README.md`).
6. Preencha as datas reais em `config/calendar.json`.
7. `npm install && npm start`

## Deploy (Railway)

- Conecte o repo; Railway detecta Node automaticamente (`npm start`).
- Configure as variáveis do `.env` no painel.
- Monte um **volume** em `/data` e defina `DB_PATH=/data/bot.db` (o SQLite guarda engajamento, curadoria e lembretes enviados — sem volume, tudo se perde a cada deploy).
- Suba o conteúdo de `content/` junto (está no .gitignore por direito autoral — usar volume ou variável de build).

## Comandos

- `/chatid` — mostra o chat_id (setup)
- `/checklist` — próximos marcos (gestão/curador)
- `/status` — saúde do bot (curador)
