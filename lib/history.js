import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_PATH = path.join(__dirname, "..", "data", "training_log.json");

function readLog() {
  try {
    if (!fs.existsSync(LOG_PATH)) return { sessions: [] };
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  } catch {
    return { sessions: [] };
  }
}

function writeLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2), "utf8");
}

export function ensureLogFile() {
  if (!fs.existsSync(LOG_PATH)) {
    writeLog({ sessions: [] });
  }
}

export function getLastExerciseEntry(exerciseKey) {
  const log = readLog();
  const sessions = log.sessions || [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    const ex = (sessions[i].exercises || []).find((x) => x.exerciseKey === exerciseKey);
    if (ex) return ex;
  }
  return null;
}

export function appendSession(session) {
  ensureLogFile();
  const log = readLog();
  log.sessions = log.sessions || [];
  log.sessions.push(session);
  writeLog(log);
}
