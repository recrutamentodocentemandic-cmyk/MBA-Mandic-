// Grupo de gestão: menções e replies ao bot vão para o agente Hermes — MBA
// (loop agêntico com ferramentas, ver src/agent.ts e HERMES.md). Arquivos
// enviados no grupo viram base de conhecimento. Crons seguem independentes.
import { Bot, Context } from "grammy";
import { DateTime } from "luxon";
import { config } from "./config.js";
import { db } from "./db.js";
import { saveTelegramFile, listKnowledgeFiles } from "./knowledge.js";
import { agentReply } from "./agent.js";
import { handleCurationReply } from "./shadow.js";

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

export function registerMgmtAssistant(bot: Bot) {
  // Arquivos enviados no grupo de gestão viram base de conhecimento do agente
  bot.on("message:document").filter(
    (ctx) => ctx.chat.id === config.mgmtChatId,
    async (ctx: Context) => {
      const doc = ctx.message!.document!;
      const name = doc.file_name ?? `arquivo-${doc.file_unique_id}`;
      try {
        const file = await ctx.getFile();
        const url = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;
        const result = await saveTelegramFile(url, name, doc.file_size);
        const status = result.indexed
          ? `📁 "${result.saved}" salvo e indexado — já uso como contexto nas respostas.`
          : `📁 "${result.saved}" salvo, mas não indexado: ${result.reason}.`;
        await ctx.reply(status, { reply_parameters: { message_id: ctx.message!.message_id } });
        console.log(`knowledge: ${result.saved} (indexado=${result.indexed})`);
      } catch (err) {
        console.error(`knowledge: falha ao salvar ${name}:`, err);
        await ctx.reply(`⚠️ Não consegui baixar "${name}". Tente de novo.`);
      }
    }
  );

  // /arquivos lista a base de conhecimento
  bot.command("arquivos", async (ctx) => {
    if (ctx.chat.id !== config.mgmtChatId && ctx.chat.id !== config.curatorChatId) return;
    const files = listKnowledgeFiles();
    if (files.length === 0) {
      await ctx.reply("Base vazia — envie um PDF, DOCX, TXT, MD ou CSV neste grupo para eu indexar.");
      return;
    }
    const lines = files.map((f) => `• ${f.name} ${f.indexed ? "✅" : "(não indexado)"}`);
    await ctx.reply(`📚 Base de conhecimento do agente:\n${lines.join("\n")}`);
  });

  bot.on("message:text").filter(
    (ctx) => ctx.chat.id === config.mgmtChatId,
    async (ctx: Context) => {
      const text = ctx.message!.text!;
      if (text.startsWith("/")) return; // comandos seguem o fluxo normal
      const author = [ctx.from!.first_name, ctx.from!.last_name].filter(Boolean).join(" ");
      logMsg.run(DateTime.now().setZone(config.timezone).toISO(), author, text);

      // acorda por @menção ou pelo nome "Hermes" (o time o chama assim)
      const mentioned =
        text.toLowerCase().includes(`@${ctx.me.username.toLowerCase()}`) ||
        /\bhermes\b/i.test(text);
      const repliedToBot = ctx.message!.reply_to_message?.from?.id === ctx.me.id;
      console.log(`mgmt: msg de ${author} (menção=${mentioned}, reply=${repliedToBot})`);

      // reply a uma proposta de curadoria = correção, não conversa com o agente
      if (repliedToBot && (await handleCurationReply(ctx, text))) return;

      if (!mentioned && !repliedToBot) return;

      const question = text.replace(`@${ctx.me.username}`, "").trim();
      const answer = await agentReply(question, author, recentLog());
      logMsg.run(DateTime.now().setZone(config.timezone).toISO(), "bot", answer);
      await ctx.reply(answer, { reply_parameters: { message_id: ctx.message!.message_id } });
      console.log(`mgmt: resposta a ${author}`);
    }
  );
}
