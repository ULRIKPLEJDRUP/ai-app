import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "agent-data", "data");
const BASELINE_PATH = path.join(DATA_DIR, "baseline.json");
const LOG_PATH = path.join(DATA_DIR, "session_log.jsonl");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function loadBaseline() {
  await ensureDataDir();
  try {
    const txt = await fs.readFile(BASELINE_PATH, "utf8");
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

export async function saveBaseline(obj) {
  await ensureDataDir();
  await fs.writeFile(BASELINE_PATH, JSON.stringify(obj, null, 2), "utf8");
}

export async function appendSessionLog(session) {
  await ensureDataDir();
  const line = JSON.stringify(session);
  await fs.appendFile(LOG_PATH, line + "\n", "utf8");
}
