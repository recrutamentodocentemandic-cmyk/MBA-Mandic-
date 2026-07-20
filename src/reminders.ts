// Lembretes do checklist ao time de gestão: D-3, D-1 e D0 de cada marco do
// calendário. Idempotente via tabela reminders_sent (uma linha por marco/offset).
import { Bot } from "grammy";
import { DateTime } from "luxon";
import { config } from "./config.js";
import { db } from "./db.js";
import { allMilestones, Milestone } from "./calendar.js";

const OFFSETS = [3, 1, 0]; // dias antes do marco

function label(offset: number): string {
  if (offset === 0) return "HOJE";
  if (offset === 1) return "amanhã";
  return `em ${offset} dias`;
}

export async function runReminders(bot: Bot) {
  const today = DateTime.now().setZone(config.timezone).startOf("day");
  const wasSent = db.prepare(`SELECT 1 FROM reminders_sent WHERE key = ?`);
  const markSent = db.prepare(`INSERT INTO reminders_sent (key, sent_at) VALUES (?, ?)`);

  const due: { m: Milestone; offset: number }[] = [];
  for (const m of allMilestones()) {
    for (const offset of OFFSETS) {
      const fireDay = m.due.startOf("day").minus({ days: offset });
      if (fireDay.hasSame(today, "day")) {
        const key = `${m.moduleId}:${m.kind}:D-${offset}`;
        if (!wasSent.get(key)) due.push({ m, offset });
      }
    }
  }

  if (due.length === 0) return;

  const lines = due.map(
    ({ m, offset }) =>
      `• ${label(offset)} (${m.due.toFormat("dd/LL")}): ${m.moduleId} — ${m.label}`
  );
  await bot.api.sendMessage(
    config.mgmtChatId,
    `📋 Checklist do MBA:\n${lines.join("\n")}`
  );
  for (const { m, offset } of due) {
    const key = `${m.moduleId}:${m.kind}:D-${offset}`;
    markSent.run(key, DateTime.now().toISO());
    console.log(`reminder: ${key} → gestão`);
  }
}

export function upcomingChecklist(limit = 8): string {
  const now = DateTime.now().setZone(config.timezone);
  const next = allMilestones()
    .filter((m) => m.due >= now.startOf("day"))
    .slice(0, limit);
  if (next.length === 0) return "Nenhum marco futuro no calendário.";
  return next
    .map((m) => `• ${m.due.toFormat("dd/LL (ccc)", { locale: "pt-BR" })}: ${m.moduleId} — ${m.label}`)
    .join("\n");
}
