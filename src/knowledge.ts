// Base de conhecimento do agente de gestão: arquivos enviados no grupo de
// gestão são baixados para knowledge/, o texto é extraído para
// knowledge/_extracted/ e entra no contexto das respostas por scoring lexical.
// A pasta fica fora do git (documentos internos não sobem ao GitHub).
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { config } from "./config.js";

const DIR = "./knowledge";
const EXTRACTED = join(DIR, "_extracted");
mkdirSync(EXTRACTED, { recursive: true });

const CHUNK_CHARS = 2000;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // limite de download da Bot API

export interface KChunk {
  file: string;
  text: string;
}

let cache: KChunk[] | null = null;

function safeName(name: string): string {
  return basename(name).replace(/[^\w.\-()À-ſ ]/g, "_");
}

async function extractText(path: string, ext: string): Promise<string | null> {
  if ([".txt", ".md", ".csv"].includes(ext)) return readFileSync(path, "utf-8");
  if (ext === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(readFileSync(path)) });
    const result = await parser.getText();
    return result.text;
  }
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path });
    return result.value;
  }
  return null; // formato não indexado (fica salvo, mas fora do contexto)
}

export async function saveTelegramFile(
  fileUrl: string,
  originalName: string,
  fileSize: number | undefined
): Promise<{ saved: string; indexed: boolean; reason?: string }> {
  const name = safeName(originalName);
  if (fileSize && fileSize > MAX_FILE_BYTES) {
    return { saved: name, indexed: false, reason: "arquivo acima de 20MB (limite do Telegram para bots)" };
  }
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`download falhou: HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const dest = join(DIR, name);
  writeFileSync(dest, buf);

  const ext = extname(name).toLowerCase();
  const text = await extractText(dest, ext);
  if (text && text.trim().length > 0) {
    writeFileSync(join(EXTRACTED, `${name}.txt`), text);
    cache = null; // recarrega chunks na próxima consulta
    return { saved: name, indexed: true };
  }
  return {
    saved: name,
    indexed: false,
    reason: text === null ? `formato ${ext || "desconhecido"} salvo mas não indexado (indexo pdf, docx, txt, md, csv)` : "não consegui extrair texto",
  };
}

function loadChunks(): KChunk[] {
  if (!existsSync(EXTRACTED)) return [];
  const chunks: KChunk[] = [];
  for (const f of readdirSync(EXTRACTED)) {
    if (!f.endsWith(".txt")) continue;
    const body = readFileSync(join(EXTRACTED, f), "utf-8");
    const file = f.replace(/\.txt$/, "");
    for (let i = 0; i < body.length; i += CHUNK_CHARS) {
      chunks.push({ file, text: body.slice(i, i + CHUNK_CHARS) });
    }
  }
  return chunks;
}

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function retrieveKnowledge(query: string, limit = 4): KChunk[] {
  cache ??= loadChunks();
  const terms = normalize(query).split(/\W+/).filter((t) => t.length > 3);
  if (terms.length === 0) return [];
  return cache
    .map((c) => {
      const hay = normalize(c.text);
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score += 1;
      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.c);
}

export function listKnowledgeFiles(): { name: string; indexed: boolean }[] {
  if (!existsSync(DIR)) return [];
  const indexed = new Set(
    existsSync(EXTRACTED) ? readdirSync(EXTRACTED).map((f) => f.replace(/\.txt$/, "")) : []
  );
  return readdirSync(DIR)
    .filter((f) => f !== "_extracted" && !f.startsWith("."))
    .map((f) => ({ name: f, indexed: indexed.has(f) }));
}
