import { copyFileSync } from "node:fs";
import { retrieveKnowledge, listKnowledgeFiles } from "./src/knowledge.js";

// simula um arquivo já baixado: copia o PDF de teste e extrai
const src = "/private/tmp/claude-501/-Users-rodrigopaiva/c47e2384-be72-4066-813d-1b37fd51858f/scratchpad/teste.pdf";
copyFileSync(src, "./knowledge/teste.pdf");

const { PDFParse } = await import("pdf-parse");
import { readFileSync, writeFileSync } from "node:fs";
const parser = new PDFParse({ data: new Uint8Array(readFileSync("./knowledge/teste.pdf")) });
const result = await parser.getText();
writeFileSync("./knowledge/_extracted/teste.pdf.txt", result.text);
console.log("extraído:", JSON.stringify(result.text.trim()));

console.log("arquivos:", listKnowledgeFiles());
console.log("retrieve('playbook gestão'):", retrieveKnowledge("o que diz o playbook de gestão?").map((c) => c.file));
process.exit(0);
