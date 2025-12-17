import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RM_PATH = path.join(__dirname, "data", "rm.json");

function readJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

export function loadRM() {
  return readJSON(RM_PATH, {});
}

export function getRM(exerciseKey) {
  const rm = loadRM();
  return rm[exerciseKey] || null;
}

export function saveRM(exerciseKey, { reps, kg, est1rm, trainingMax }) {
  const rm = loadRM();
  rm[exerciseKey] = {
    updatedAt: new Date().toISOString(),
    measured: { reps, kg },
    est1rm,
    trainingMax
  };
  writeJSON(RM_PATH, rm);
  return rm[exerciseKey];
}
