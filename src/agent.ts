// Agente da gestão (Hermes — MBA): loop agêntico com ferramentas sobre o
// mesmo Sonnet. Identidade em HERMES.md; escritas restritas a calendário e
// notas; SQL somente leitura.
import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DateTime } from "luxon";
import { config } from "./config.js";
import { db } from "./db.js";
import { upcomingChecklist } from "./reminders.js";
import { listKnowledgeFiles } from "./knowledge.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });
const roDb = new Database(config.dbPath, { readonly: true, fileMustExist: true });

db.exec(`
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  author TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL
);
`);

const HERMES = readFileSync("./HERMES.md", "utf-8");

const SCHEMA_DOC = `Tabelas disponíveis (SQLite):
- messages: mensagens do grupo dos ALUNOS — user_id, user_name, ts (ISO 8601), char_count, is_reply (0/1, respondeu colega), is_substantive (0/1), chat_id
- answers: dúvidas detectadas e curadoria — student_name, question, technical_answer, group_nudge, sources, feedback ('boa'/'ruim'/NULL), correction, posted_to_group, created_at
- mgmt_log: conversa do grupo de gestão — ts, author, text
- notes: notas salvas pelo agente — created_at, author, titulo, conteudo
- reminders_sent: lembretes já enviados — key, sent_at`;

const tools: Anthropic.Tool[] = [
  {
    name: "consultar_banco",
    description: `Executa uma consulta SQL SOMENTE LEITURA (SELECT) no banco do bot. Use para qualquer número sobre engajamento dos alunos, dúvidas, curadoria ou histórico. ${SCHEMA_DOC}`,
    input_schema: {
      type: "object",
      properties: { sql: { type: "string", description: "Consulta SELECT (uma única instrução, sem ponto e vírgula)" } },
      required: ["sql"],
    },
  },
  {
    name: "atualizar_calendario",
    description:
      "Substitui o calendário oficial dos módulos do curso (fonte dos lembretes automáticos e do /checklist). Envie a lista COMPLETA de módulos — o arquivo é sobrescrito. Use apenas quando o time pedir/confirmar. Datas = sábado presencial de cada módulo.",
    input_schema: {
      type: "object",
      properties: {
        modules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Ex.: M01" },
              titulo: { type: "string" },
              presencial: { type: "string", description: "Data do sábado presencial, YYYY-MM-DD" },
            },
            required: ["id", "titulo", "presencial"],
          },
        },
      },
      required: ["modules"],
    },
  },
  {
    name: "salvar_nota",
    description:
      "Grava uma nota permanente na base do agente (sobrevive entre conversas). Use para fatos duráveis: links, decisões do time, contatos, acordos.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        conteudo: { type: "string" },
      },
      required: ["titulo", "conteudo"],
    },
  },
  {
    name: "ler_notas",
    description: "Lista todas as notas permanentes salvas (título + conteúdo).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "listar_documentos",
    description: "Lista os documentos da base de conhecimento da gestão (arquivos enviados no grupo).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "ler_documento",
    description: "Lê o texto extraído de um documento da base de conhecimento (nome exato de listar_documentos).",
    input_schema: {
      type: "object",
      properties: { nome: { type: "string" } },
      required: ["nome"],
    },
  },
];

function execConsulta(sql: string): string {
  const q = sql.trim().replace(/;+\s*$/, "");
  if (!/^(select|with)\s/i.test(q) || q.includes(";")) {
    throw new Error("apenas uma única consulta SELECT é permitida");
  }
  const rows = roDb.prepare(q).all().slice(0, 100);
  return JSON.stringify(rows);
}

function execCalendario(input: { modules: { id: string; titulo: string; presencial: string }[] }, author: string): string {
  if (!Array.isArray(input.modules) || input.modules.length === 0) throw new Error("lista de módulos vazia");
  for (const m of input.modules) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.presencial) || !DateTime.fromISO(m.presencial).isValid) {
      throw new Error(`data inválida em ${m.id}: ${m.presencial}`);
    }
  }
  const sorted = [...input.modules].sort((a, b) => a.presencial.localeCompare(b.presencial));
  writeFileSync(
    "./config/calendar.json",
    JSON.stringify(
      {
        _comment: `Atualizado pelo agente em ${DateTime.now().setZone(config.timezone).toISO()} a pedido de ${author}.`,
        timezone: config.timezone,
        modules: sorted,
      },
      null,
      2
    )
  );
  return `Calendário gravado com ${sorted.length} módulos: ${sorted.map((m) => `${m.id} ${m.presencial}`).join(", ")}`;
}

async function execute(name: string, input: unknown, author: string): Promise<string> {
  const inp = input as Record<string, unknown>;
  switch (name) {
    case "consultar_banco":
      return execConsulta((inp as { sql: string }).sql);
    case "atualizar_calendario":
      return execCalendario(inp as { modules: { id: string; titulo: string; presencial: string }[] }, author);
    case "salvar_nota": {
      const { titulo, conteudo } = inp as { titulo: string; conteudo: string };
      db.prepare(`INSERT INTO notes (created_at, author, titulo, conteudo) VALUES (?, ?, ?, ?)`).run(
        DateTime.now().setZone(config.timezone).toISO(),
        author,
        titulo,
        conteudo
      );
      return `Nota salva: "${titulo}"`;
    }
    case "ler_notas": {
      const rows = db.prepare(`SELECT created_at, author, titulo, conteudo FROM notes ORDER BY id`).all();
      return rows.length ? JSON.stringify(rows) : "(nenhuma nota salva)";
    }
    case "listar_documentos": {
      const files = listKnowledgeFiles();
      return files.length
        ? files.map((f) => `${f.name}${f.indexed ? "" : " (não indexado)"}`).join("\n")
        : "(base de conhecimento vazia)";
    }
    case "ler_documento": {
      const { nome } = inp as { nome: string };
      const path = join("./knowledge/_extracted", `${nome}.txt`);
      if (!existsSync(path)) return `Documento "${nome}" não encontrado ou não indexado.`;
      return readFileSync(path, "utf-8").slice(0, 12000);
    }
    default:
      throw new Error(`ferramenta desconhecida: ${name}`);
  }
}

const MAX_STEPS = 8;

export async function agentReply(question: string, author: string, recentLog: string): Promise<string> {
  const system =
    `${HERMES}\n\n## Estado atual\n` +
    `Data/hora: ${DateTime.now().setZone(config.timezone).toFormat("cccc, dd/LL/yyyy HH:mm", { locale: "pt-BR" })}\n` +
    `<checklist_proximos_marcos>\n${upcomingChecklist(10)}\n</checklist_proximos_marcos>\n` +
    `<conversa_recente_do_grupo>\n${recentLog}\n</conversa_recente_do_grupo>`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `${author} disse no grupo de gestão:\n"${question}"` },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({
      model: config.answerModel,
      max_tokens: 2048,
      system,
      tools,
      messages,
    });

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          const out = await execute(block.name, block.input, author);
          console.log(`agente: ${block.name} ok`);
          results.push({ type: "tool_result", tool_use_id: block.id, content: out });
        } catch (err) {
          console.log(`agente: ${block.name} ERRO: ${String(err)}`);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Erro: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    const text = response.content.find((b) => b.type === "text");
    return text && text.type === "text" ? text.text : "Não consegui formular resposta.";
  }
  return "Passei do limite de passos sem concluir — reformule ou divida o pedido.";
}
