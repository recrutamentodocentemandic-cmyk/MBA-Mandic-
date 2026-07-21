import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

export const config = {
  telegramToken: required("TELEGRAM_BOT_TOKEN"),
  openaiApiKey: required("OPENAI_API_KEY"),
  groupChatId: Number(process.env.GROUP_CHAT_ID ?? 0),
  mgmtChatId: Number(process.env.MGMT_CHAT_ID ?? 0),
  curatorChatId: Number(process.env.CURATOR_CHAT_ID ?? 0),
  classifierModel: process.env.CLASSIFIER_MODEL ?? "gpt-5-mini",
  answerModel: process.env.ANSWER_MODEL ?? "gpt-5.1",
  dbPath: process.env.DB_PATH ?? "./data/bot.db",
  timezone: "America/Sao_Paulo",
};
