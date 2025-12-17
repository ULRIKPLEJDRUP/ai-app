import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { CATALOG } from "./exerciseCatalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function estimate1RM_Brzycki(kg, reps) {
  return kg * 36 / (37 - reps);
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

const rmPath = path.join(__dirname, "agent-data", "data", "rm.json");
const rm = fs.existsSync(rmPath) ? JSON.parse(fs.readFileSync(rmPath, "utf8")) : {};

const keys = Object.keys(CATALOG);
console.log("\nVælg øvelse (skriv nummer):");
keys.slice(0, 30).forEach((k, i) => console.log(`${String(i + 1).padStart(2, " ")}. ${k}  —  ${CATALOG[k].label}`));
if (keys.length > 30) console.log(`... (${keys.length - 30} flere)\n`);

const nStr = await ask("\nNummer (eller skriv key direkte): ");
let key = nStr.trim();

if (/^\d+$/.test(key)) {
  const idx = Number(key) - 1;
  if (idx < 0 || idx >= keys.length) {
    console.log("Ugyldigt nummer.");
    process.exit(1);
  }
  key = keys[idx];
} else {
  // allow direct key
  if (!CATALOG[key]) {
    console.log("Ukendt key. Tip: kopier en key fra listen.");
    process.exit(1);
  }
}

const repsStr = await ask("Reps (fx 10): ");
const kgStr = await ask("Kg (fx 110): ");

const reps = Number(repsStr.trim().replace(",", "."));
const kg = Number(kgStr.trim().replace(",", "."));

if (!Number.isFinite(reps) || !Number.isFinite(kg) || reps <= 0 || kg <= 0 || reps >= 37) {
  console.log("Ugyldige tal. (reps skal være 1-36, kg > 0)");
  process.exit(1);
}

const est1rm = estimate1RM_Brzycki(kg, reps);
const trainingMax = est1rm * 0.9;

rm[key] = {
  updatedAt: new Date().toISOString(),
  measured: { reps, kg },
  est1rm: round2(est1rm),
  trainingMax: round2(trainingMax)
};

fs.writeFileSync(rmPath, JSON.stringify(rm, null, 2), "utf8");

console.log("\nGemt ✅");
console.log(`Øvelse: ${key} — ${CATALOG[key].label}`);
console.log(`Målt: ${reps} x ${kg} kg`);
console.log(`Estimeret 1RM: ${rm[key].est1rm} kg`);
console.log(`Training Max (90%): ${rm[key].trainingMax} kg\n`);
