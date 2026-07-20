// Modo sombra: o bot observa o grupo; dúvidas de conteúdo geram resposta técnica
// enviada em DM ao curador (Rodrigo) com botões de feedback. No grupo, nada é
// postado automaticamente — o estímulo ao debate só vai com aprovação explícita.
import { Bot, Context, InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import { config } from "./config.js";
import { db } from "./db.js";
import { classify, draftAnswer } from "./claude.js";

const insertMessage = db.prepare(
  `INSERT INTO messages (tg_message_id, chat_id, user_id, user_name, ts, char_count, is_reply, is_substantive)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

const insertAnswer = db.prepare(
  `INSERT INTO answers (created_at, group_message_id, student_name, question, technical_answer, group_nudge, sources)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

function isSubstantive(text: string): boolean {
  const stripped = text.replace(/[\p{Emoji}\s.,!?👍❤️]+/gu, "");
  return stripped.length >= 15;
}

async function handleGroupMessage(bot: Bot, ctx: Context, text: string) {
  const msg = ctx.message!;
  const user = ctx.from!;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  insertMessage.run(
    msg.message_id,
    ctx.chat!.id,
    user.id,
    name,
    DateTime.now().setZone(config.timezone).toISO(),
    text.length,
    msg.reply_to_message ? 1 : 0,
    isSubstantive(text) ? 1 : 0
  );

  if (!isSubstantive(text)) return;

  const cls = await classify(text);
  if (!cls || (cls.tipo !== "duvida_conteudo" && cls.tipo !== "pedido_de_entrega")) return;

  const draft = await draftAnswer(name, text);
  if (!draft) return;

  const info = insertAnswer.run(
    DateTime.now().setZone(config.timezone).toISO(),
    msg.message_id,
    name,
    text,
    draft.resposta_tecnica,
    draft.estimulo_grupo,
    draft.fontes
  );
  const answerId = Number(info.lastInsertRowid);

  const kb = new InlineKeyboard()
    .text("✅ Boa", `fb:boa:${answerId}`)
    .text("❌ Ruim", `fb:ruim:${answerId}`)
    .row()
    .text("📤 Postar estímulo no grupo", `post:${answerId}`);

  const flag =
    cls.tipo === "pedido_de_entrega"
      ? "\n⚠️ Classificada como pedido de entrega — resposta em modo andaime."
      : "";
  await bot.api.sendMessage(
    config.curatorChatId,
    `🎓 Dúvida de ${name}:${flag}\n\n"${text}"\n\n` +
      `📝 Resposta técnica proposta:\n${draft.resposta_tecnica}\n\n` +
      `📚 Fontes: ${draft.fontes || "nenhuma no material indexado"}\n\n` +
      `💬 Estímulo proposto para o grupo:\n${draft.estimulo_grupo}\n\n` +
      `Para corrigir: responda esta mensagem com o texto da correção.`,
    { reply_markup: kb }
  );
  console.log(`shadow: dúvida de ${name} → DM curador (answer ${answerId})`);
}

async function handleCuratorReply(ctx: Context, text: string) {
  const replied = ctx.message?.reply_to_message?.text ?? "";
  const match = replied.match(/Dúvida de (.+?):/);
  if (!match) return;
  const row = db
    .prepare(`SELECT id FROM answers WHERE student_name = ? ORDER BY id DESC LIMIT 1`)
    .get(match[1]) as { id: number } | undefined;
  if (!row) return;
  db.prepare(`UPDATE answers SET feedback = 'ruim', correction = ? WHERE id = ?`).run(text, row.id);
  await ctx.reply(`Correção registrada para a resposta ${row.id}. Entra no few-shot das próximas.`);
  console.log(`correction: answer ${row.id}`);
}

export function registerShadowMode(bot: Bot) {
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;

    // Utilitário de setup: em qualquer chat, /chatid revela o ID
    if (text === "/chatid") {
      await ctx.reply(`chat_id: ${chatId}`);
      return;
    }

    if (chatId === config.groupChatId) {
      await handleGroupMessage(bot, ctx, text);
    } else if (chatId === config.curatorChatId && ctx.message.reply_to_message) {
      await handleCuratorReply(ctx, text);
    }
  });

  // Feedback do curador via botões
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const [action, ...rest] = data.split(":");

    if (action === "fb") {
      const [verdict, id] = rest;
      db.prepare(`UPDATE answers SET feedback = ? WHERE id = ?`).run(verdict, Number(id));
      await ctx.answerCallbackQuery({ text: `Feedback registrado: ${verdict}` });
      console.log(`feedback: answer ${id} → ${verdict}`);
    }

    if (action === "post") {
      const id = Number(rest[0]);
      const row = db
        .prepare(`SELECT group_message_id, group_nudge, posted_to_group FROM answers WHERE id = ?`)
        .get(id) as
        | { group_message_id: number; group_nudge: string; posted_to_group: number }
        | undefined;
      if (!row) return;
      if (row.posted_to_group) {
        await ctx.answerCallbackQuery({ text: "Já postado." });
        return;
      }
      await ctx.api.sendMessage(config.groupChatId, row.group_nudge, {
        reply_parameters: { message_id: row.group_message_id },
      });
      db.prepare(`UPDATE answers SET posted_to_group = 1 WHERE id = ?`).run(id);
      await ctx.answerCallbackQuery({ text: "Estímulo postado no grupo." });
      console.log(`post: estímulo do answer ${id} → grupo`);
    }
  });
}
