// Relatório semanal de engajamento ao time de gestão — métricas AGREGADAS,
// alinhadas ao Termo de Compromisso (participação ativa na comunidade online).
// Sem análise de conteúdo individual: contagens, respostas a colegas e silêncio.
import { Bot } from "grammy";
import { DateTime } from "luxon";
import { config } from "./config.js";
import { db } from "./db.js";

interface WeeklyRow {
  user_name: string;
  total: number;
  substantive: number;
  replies: number;
}

interface LastSeenRow {
  user_name: string;
  last_ts: string;
}

export async function runWeeklyReport(bot: Bot) {
  const now = DateTime.now().setZone(config.timezone);
  const weekAgo = now.minus({ days: 7 }).toISO();

  const weekly = db
    .prepare(
      `SELECT user_name, COUNT(*) AS total,
              SUM(is_substantive) AS substantive,
              SUM(is_reply) AS replies
       FROM messages WHERE chat_id = ? AND ts >= ?
       GROUP BY user_id ORDER BY substantive DESC`
    )
    .all(config.groupChatId, weekAgo) as WeeklyRow[];

  const lastSeen = db
    .prepare(
      `SELECT user_name, MAX(ts) AS last_ts
       FROM messages WHERE chat_id = ? GROUP BY user_id`
    )
    .all(config.groupChatId) as LastSeenRow[];

  const silent = lastSeen.filter(
    (r) => DateTime.fromISO(r.last_ts) < now.minus({ days: 14 })
  );

  const top = weekly
    .slice(0, 10)
    .map(
      (r, i) =>
        `${i + 1}. ${r.user_name}: ${r.substantive} substantivas, ${r.replies} respostas a colegas`
    )
    .join("\n");

  const silentBlock =
    silent.length > 0
      ? `\n\n🔕 Sem participação há 14+ dias (checar antes que vire evasão — diagnóstico antes de intervenção):\n` +
        silent.map((s) => `• ${s.user_name} (última: ${DateTime.fromISO(s.last_ts).toFormat("dd/LL")})`).join("\n")
      : "\n\n🔕 Nenhum aluno em silêncio prolongado.";

  await bot.api.sendMessage(
    config.mgmtChatId,
    `📊 Engajamento semanal do grupo (últimos 7 dias):\n` +
      `${weekly.length} alunos ativos\n\n${top || "Sem mensagens no período."}${silentBlock}`
  );
  console.log(`engagement: relatório semanal → gestão (${weekly.length} ativos, ${silent.length} silentes)`);
}
