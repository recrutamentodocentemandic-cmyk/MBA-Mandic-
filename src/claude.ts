import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { db } from "./db.js";
import { retrieve } from "./content.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// ---------- Classificação (Haiku) ----------

export interface Classification {
  tipo: "duvida_conteudo" | "logistica" | "pedido_de_entrega" | "conversa";
  resumo: string;
}

export async function classify(text: string): Promise<Classification | null> {
  const response = await client.messages.create({
    model: config.classifierModel,
    max_tokens: 256,
    system:
      "Você classifica mensagens do grupo de alunos de um MBA em gestão educacional em saúde com IA. " +
      "Tipos: duvida_conteudo (pergunta sobre teoria/conteúdo do curso), logistica (datas, prazos, plataforma), " +
      "pedido_de_entrega (o aluno pede que façam a entrega/reflexão/exercício por ele), conversa (social, sem pergunta).",
    messages: [{ role: "user", content: text }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            tipo: {
              type: "string",
              enum: ["duvida_conteudo", "logistica", "pedido_de_entrega", "conversa"],
            },
            resumo: { type: "string" },
          },
          required: ["tipo", "resumo"],
          additionalProperties: false,
        },
      },
    },
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  try {
    return JSON.parse(block.text) as Classification;
  } catch {
    return null;
  }
}

// ---------- Geração de resposta (Sonnet) ----------

export interface DraftAnswer {
  resposta_tecnica: string;
  estimulo_grupo: string;
  fontes: string;
}

// Feedback do curador vira few-shot: respostas aprovadas ancoram o padrão,
// correções mostram o que evitar.
function feedbackExamples(): string {
  const rows = db
    .prepare(
      `SELECT question, technical_answer, feedback, correction
       FROM answers WHERE feedback IS NOT NULL
       ORDER BY id DESC LIMIT 6`
    )
    .all() as { question: string; technical_answer: string; feedback: string; correction: string | null }[];
  if (rows.length === 0) return "";
  const parts = rows.map((r) => {
    const verdict =
      r.feedback === "boa"
        ? "APROVADA pelo curador"
        : `REPROVADA pelo curador${r.correction ? ` — correção: ${r.correction}` : ""}`;
    return `Pergunta: ${r.question}\nResposta dada: ${r.technical_answer}\nAvaliação: ${verdict}`;
  });
  return `\n\n<historico_de_curadoria>\n${parts.join("\n---\n")}\n</historico_de_curadoria>`;
}

const ANSWER_SYSTEM = `Você é o assistente pedagógico do MBA em Gestão Educacional em Saúde com IA da São Leopoldo Mandic. Você responde dúvidas de conteúdo dos alunos, sob curadoria humana.

Regras invioláveis:
1. NUNCA faça a entrega do aluno (reflexão individual, exercício pré-encontro, atividade em grupo, documentação do agente). Se a "dúvida" na prática pede a entrega pronta, responda com andaime: perguntas socráticas + ponteiro de onde estudar. O sistema de avaliação do curso devolve entregas que qualquer LLM escreveria — você não pode ser o atalho que viola esse princípio.
2. Toda resposta técnica deve apontar a seção específica do conteúdo onde o tema está (módulo, aula ou capítulo), usando os trechos fornecidos em <conteudo>. Se não houver trecho relevante, diga explicitamente que o tema não está no material indexado e responda com base geral, sinalizando isso.
3. Não reproduza trechos longos de livros — referencie ("o cap. X de Y trata disso") e explique com suas palavras.
4. Além do ponto técnico, produza um estímulo curto para o grupo: uma provocação que ancore a dúvida no conteúdo e convide os colegas a debater e ajudar quem perguntou. Varie a formulação — nunca soe como carimbo repetido.

Responda em português brasileiro, denso e direto, nível pós-graduação.`;

export async function draftAnswer(
  studentName: string,
  question: string
): Promise<DraftAnswer | null> {
  const chunks = retrieve(question);
  const contentBlock =
    chunks.length > 0
      ? chunks
          .map(
            (c) =>
              `<trecho modulo="${c.modulo}" fonte="${c.fonte}" titulo="${c.titulo}" capitulo="${c.capitulo}">\n${c.text}\n</trecho>`
          )
          .join("\n")
      : "(nenhum trecho relevante encontrado no material indexado)";

  const response = await client.messages.create({
    model: config.answerModel,
    max_tokens: 2048,
    system: ANSWER_SYSTEM + feedbackExamples(),
    messages: [
      {
        role: "user",
        content: `<conteudo>\n${contentBlock}\n</conteudo>\n\nAluno ${studentName} perguntou no grupo:\n"${question}"`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            resposta_tecnica: { type: "string" },
            estimulo_grupo: { type: "string" },
            fontes: {
              type: "string",
              description: "Citações usadas, ex.: 'M02 · livro · cap. 1'. Vazio se nenhuma.",
            },
          },
          required: ["resposta_tecnica", "estimulo_grupo", "fontes"],
          additionalProperties: false,
        },
      },
    },
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  try {
    return JSON.parse(block.text) as DraftAnswer;
  } catch {
    return null;
  }
}
