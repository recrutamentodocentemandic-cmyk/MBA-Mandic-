// Assistente conversacional no grupo de gestão: responde a menções ao bot e a
// replies de mensagens dele, com contexto de calendário, checklist e engajamento.
// Os crons (lembretes/relatórios) seguem independentes.
import Anthropic from "@anthropic-ai/sdk";
import { Bot, Context } from "grammy";
import { DateTime } from "luxon";
import { config } from "./config.js";
import { db } from "./db.js";
import { upcomingChecklist } from "./reminders.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

db.exec(`
CREATE TABLE IF NOT EXISTS mgmt_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  author TEXT NOT NULL,       -- nome do membro ou 'bot'
  text TEXT NOT NULL
);
`);

const logMsg = db.prepare(`INSERT INTO mgmt_log (ts, author, text) VALUES (?, ?, ?)`);

function recentLog(limit = 20): string {
  const rows = db
    .prepare(`SELECT author, text FROM mgmt_log ORDER BY id DESC LIMIT ?`)
    .all(limit) as { author: string; text: string }[];
  return rows
    .reverse()
    .map((r) => `${r.author}: ${r.text}`)
    .join("\n");
}

function engagementSnapshot(): string {
  if (!config.groupChatId) return "Grupo dos alunos ainda não conectado.";
  const weekAgo = DateTime.now().setZone(config.timezone).minus({ days: 7 }).toISO();
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT user_id) AS ativos, COUNT(*) AS msgs, SUM(is_substantive) AS subst
       FROM messages WHERE chat_id = ? AND ts >= ?`
    )
    .get(config.groupChatId, weekAgo) as { ativos: number; msgs: number; subst: number };
  return `Últimos 7 dias no grupo dos alunos: ${row.ativos} alunos ativos, ${row.msgs} mensagens (${row.subst ?? 0} substantivas).`;
}

const SYSTEM = `Você é o assistente do time de gestão do MBA em Gestão Educacional em Saúde com IA da São Leopoldo Mandic (turma 2026). Você conversa num grupo de Telegram com o time de gestão do curso.

Seu papel: apoiar a operação do curso — checklist e prazos de cada módulo, engajamento dos alunos, dúvidas sobre o funcionamento do programa (Termo de Compromisso, sistema de avaliação, demos dos agentes, projeto final) e o que mais o time precisar discutir.

Contexto do programa: alunos leem 1 livro por disciplina antes do presencial, assistem 4 aulas online, entregam exercício pré-encontro até quinta anterior, participam do sábado presencial (08h-17h, 1x/mês), entregam reflexão individual em D+10 e atividade em grupo em D+15, com demo ao vivo do agente no módulo seguinte. Avaliação: reflexão 40%, agente do grupo 60%.

Estilo: português brasileiro, denso e direto, sem cerimônia. Respostas curtas — é um grupo de trabalho, não um relatório. Se não souber algo ou o dado não estiver no contexto, diga claramente. Se pedirem algo que exige ação fora do Telegram (mudar calendário, aprovar conteúdo), diga o que você faria e quem precisa decidir.`;

async function reply(question: string, author: string): Promise<string> {
  const context =
    `<checklist_proximos_marcos>\n${upcomingChecklist(10)}\n</checklist_proximos_marcos>\n` +
    `<engajamento>\n${engagementSnapshot()}\n</engajamento>\n` +
    `<conversa_recente>\n${recentLog()}\n</conversa_recente>`;

  const response = await client.messages.create({
    model: config.answerModel,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content: `${context}\n\n${author} disse: "${question}"` }],
  });
  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "Não consegui formular resposta agora.";
}

export function registerMgmtAssistant(bot: Bot) {
  bot.on("message:text").filter(
    (ctx) => ctx.chat.id === config.mgmtChatId,
    async (ctx: Context) => {
      const text = ctx.message!.text!;
      if (text.startsWith("/")) return; // comandos seguem o fluxo normal
      const author = [ctx.from!.first_name, ctx.from!.last_name].filter(Boolean).join(" ");
      logMsg.run(DateTime.now().setZone(config.timezone).toISO(), author, text);

      const mentioned = text.includes(`@${ctx.me.username}`);
      const repliedToBot = ctx.message!.reply_to_message?.from?.id === ctx.me.id;
      if (!mentioned && !repliedToBot) return;

      const question = text.replace(`@${ctx.me.username}`, "").trim();
      const answer = await reply(question, author);
      logMsg.run(DateTime.now().setZone(config.timezone).toISO(), "bot", answer);
      await ctx.reply(answer, { reply_parameters: { message_id: ctx.message!.message_id } });
      console.log(`mgmt: resposta a ${author}`);
    }
  );
}
