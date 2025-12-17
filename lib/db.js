const fs = require("fs");
const path = require("path");

const EX_PATH = path.join(__dirname, "..", "data", "exercises.json");
const LOG_PATH = path.join(__dirname, "..", "data", "training_log.json");

function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

// Exercises
function getExercises() {
  const db = safeReadJson(EX_PATH, { exercises: [] });
  return db.exercises || [];
}

// Training log
function getLog() {
  return safeReadJson(LOG_PATH, { sessions: [] });
}

function saveLog(log) {
  safeWriteJson(LOG_PATH, log);
}

// Find last performed sets for an exerciseKey
function getLastPerformance(exerciseKey) {
  const log = getLog();
  const sessions = log.sessions || [];
  // scan from end for most recent containing exerciseKey
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    const ex = (s.exercises || []).find((x) => x.exerciseKey === exerciseKey);
    if (ex) return ex;
  }
  return null;
}

function appendSession(session) {
  const log = getLog();
  log.sessions = log.sessions || [];
  log.sessions.push(session);
  saveLog(log);
}

module.exports = {
  getExercises,
  getLastPerformance,
  appendSession,
};

