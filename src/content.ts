// Recuperação simples por palavras-chave sobre os materiais em content/*.md.
// Decisão simple-first: sem embeddings; um livro por disciplina torna o scoring
// lexical suficiente. Metadados do frontmatter viram a citação da resposta.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface Chunk {
  modulo: string;
  fonte: string;
  titulo: string;
  capitulo: string;
  text: string;
}

const CONTENT_DIR = "./content";
const CHUNK_CHARS = 2500;

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  return { meta, body: m[2] };
}

function loadChunks(): Chunk[] {
  if (!existsSync(CONTENT_DIR)) return [];
  const chunks: Chunk[] = [];
  for (const file of readdirSync(CONTENT_DIR)) {
    if (!file.endsWith(".md") || file === "README.md") continue;
    const { meta, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, file), "utf-8"));
    for (let i = 0; i < body.length; i += CHUNK_CHARS) {
      chunks.push({
        modulo: meta.modulo ?? "?",
        fonte: meta.fonte ?? "material",
        titulo: meta.titulo ?? file,
        capitulo: meta.capitulo ?? "",
        text: body.slice(i, i + CHUNK_CHARS),
      });
    }
  }
  return chunks;
}

let cache: Chunk[] | null = null;

export function retrieve(query: string, limit = 4): Chunk[] {
  cache ??= loadChunks();
  const terms = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\W+/)
    .filter((t) => t.length > 3);
  const scored = cache.map((c) => {
    const hay = c.text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    let score = 0;
    for (const t of terms) if (hay.includes(t)) score += 1;
    return { c, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.c);
}
