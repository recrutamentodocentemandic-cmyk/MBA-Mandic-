import { Bot } from "grammy";
import cron from "node-cron";
import { config } from "./config.js";
import "./db.js";
import { registerShadowMode } from "./shadow.js";
import { registerMgmtAssistant } from "./mgmt.js";
import { runReminders, upcomingChecklist } from "./reminders.js";
import { runWeeklyReport } from "./engagement.js";

const bot = new Bot(config.telegramToken);

// trace de entrada: um log por update recebido, com o tipo de conteúdo
bot.use((ctx, next) => {
  const m = ctx.message;
  const kind = m?.text
    ? `texto=${m.text.slice(0, 40)}`
    : m?.document
      ? `documento=${m.document.file_name}`
      : m?.photo
        ? "foto (comprimida — enviar como Arquivo para indexar)"
        : m?.new_chat_members
          ? "serviço: membro entrou"
          : m?.left_chat_member
            ? "serviço: membro saiu"
            : "(outro)";
  console.log(`update ${ctx.update.update_id}: chat=${ctx.chat?.id} ${kind}`);
  return next();
});

bot.command("checklist", async (ctx) => {
  if (ctx.chat.id !== config.mgmtChatId && ctx.chat.id !== config.curatorChatId) return;
  await ctx.reply(`📋 Próximos marcos:\n${upcomingChecklist()}`);
});

bot.command("status", async (ctx) => {
  if (ctx.chat.id !== config.curatorChatId) return;
  await ctx.reply("✅ Bot ativo. Modo sombra ligado; lembretes 09h; relatório semanal seg 08h.");
});

registerShadowMode(bot);
registerMgmtAssistant(bot);

// Lembretes do checklist — diário 09:00 (América/São Paulo)
cron.schedule("0 9 * * *", () => void runReminders(bot).catch(logErr), {
  timezone: config.timezone,
});

// Relatório de engajamento — segunda 08:00
cron.schedule("0 8 * * 1", () => void runWeeklyReport(bot).catch(logErr), {
  timezone: config.timezone,
});

function logErr(err: unknown) {
  console.error("cron error:", err);
}

bot.catch((err) => console.error("bot error:", err.error));

void bot.start({ onStart: (me) => console.log(`bot iniciado: @${me.username}`) });
