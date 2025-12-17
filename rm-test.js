import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function estimate1RM_Brzycki(kg, reps) {
  return kg * 36 / (37 - reps);
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

const rmPath = path.join(__dirname, "agent-data", "data", "rm.json");
const rm = JSON.parse(fs.readFileSync(rmPath, "utf8"));

const key = "bench_press"; // test-øvelse
const entry = rm[key];

if (!entry || !entry.measured) {
  console.log(`Ingen RM-data for "${key}".`);
  process.exit(0);
}

const { kg, reps } = entry.measured;

const est1rm = estimate1RM_Brzycki(kg, reps);
const trainingMax = est1rm * 0.9;

entry.est1rm = round2(est1rm);
entry.trainingMax = round2(trainingMax);
entry.updatedAt = new Date().toISOString();

rm[key] = entry;

fs.writeFileSync(rmPath, JSON.stringify(rm, null, 2), "utf8");

console.log("Opdateret rm.json ✅");
console.log(`Øvelse: ${key}`);
console.log(`Målt: ${reps} x ${kg} kg`);
console.log(`Estimeret 1RM: ${entry.est1rm} kg`);
console.log(`Training Max (90%): ${entry.trainingMax} kg`);
