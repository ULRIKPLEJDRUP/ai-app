import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { normalizeSessionInput, isValidSession, parseAutoLogLine } from "./schema.js";
import { appendSessionLog, loadBaseline, saveBaseline } from "./storage.js";
import { updateBaselineWithSession } from "./baseline.js";

async function runGuided(rl) {
  let exercise = "";
  while (true) {
    exercise = (await rl.question("Øvelse (fx 'Bænkpres'): ")).trim();
    if (!exercise) {
      console.log("❌ Øvelse må ikke være tom.");
      continue;
    }
    if (/^\d+([.,]\d+)?$/.test(exercise)) {
      console.log("❌ Det ligner et tal. Skriv navnet på øvelsen (fx 'Bænkpres').");
      continue;
    }
    break;
  }

  const setsStr = (await rl.question("Antal sæt (fx 4): ")).trim();
  const setsN = Number(setsStr);
  if (!Number.isFinite(setsN) || setsN <= 0) {
    console.log("\n❌ Antal sæt skal være et positivt tal.\n");
    return null;
  }

  const sets = [];
  for (let i = 1; i <= setsN; i++) {
    const repsStr = (await rl.question(`Sæt ${i} reps: `)).trim();
    const kgStr = (await rl.question(`Sæt ${i} kg: `)).trim();
    const note = (await rl.question(`Sæt ${i} note (valgfri): `)).trim();
    sets.push({ setIndex: i, reps: repsStr, kg: kgStr, note });
  }

  return { exercise, sets, createdAt: new Date().toISOString() };
}

export async function runAgent() {
  const rl = readline.createInterface({ input, output });

  console.log("\n=== Data-agent v1 (autolog): log → baseline ===\n");
  console.log("Skriv én linje fx:  Bænkpres: 82,5x8, 82,5x8, 80x10");
  console.log("Tryk Enter for guided mode.\n");

  const oneLine = (await rl.question("Autolog (valgfri): ")).trim();

  let sessionRaw = null;

  if (oneLine) {
    const parsed = parseAutoLogLine(oneLine);
    if (!parsed) {
      console.log("\n❌ Kunne ikke parse autolog-linjen. Faldt tilbage til guided mode.\n");
      sessionRaw = await runGuided(rl);
    } else {
      sessionRaw = { ...parsed, createdAt: new Date().toISOString() };
    }
  } else {
    sessionRaw = await runGuided(rl);
  }

  if (!sessionRaw) {
    rl.close();
    return;
  }

  const session = normalizeSessionInput(sessionRaw);

  if (!isValidSession(session)) {
    console.log("\n❌ Ugyldigt input. Tjek øvelse, reps og kg.\n");
    rl.close();
    return;
  }

  await appendSessionLog(session);

  const baseline = await loadBaseline();
  const updated = updateBaselineWithSession(baseline, session);
  await saveBaseline(updated);

  const top = updated[session.exerciseKey];
  console.log("\n✅ Gemte session + opdaterede baseline.\n");
  console.log("Resumé:");
  console.log(`- Øvelse: ${session.exerciseName}`);
  console.log(`- Sæt: ${session.sets.length}`);
  console.log(`- Baseline (nu): ${top?.baselineKg ?? "?"} kg x ${top?.baselineReps ?? "?"} reps`);
  console.log(`- Senest: ${top?.lastKg ?? "?"} kg x ${top?.lastReps ?? "?"} reps`);
  console.log("");

  rl.close();
}
