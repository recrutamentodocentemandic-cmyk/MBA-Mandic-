import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

mkdirSync(dirname(config.dbPath), { recursive: true });
export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_message_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  ts TEXT NOT NULL,             -- ISO 8601
  char_count INTEGER NOT NULL,
  is_reply INTEGER NOT NULL,    -- respondeu a mensagem de colega
  is_substantive INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  group_message_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  question TEXT NOT NULL,
  technical_answer TEXT NOT NULL,
  group_nudge TEXT NOT NULL,
  sources TEXT NOT NULL,        -- citações de conteúdo usadas
  feedback TEXT,                -- 'boa' | 'ruim' | NULL
  correction TEXT,              -- texto de correção do curador
  posted_to_group INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reminders_sent (
  key TEXT PRIMARY KEY,         -- ex.: M02:reflexao:D-3
  sent_at TEXT NOT NULL
);
`);
