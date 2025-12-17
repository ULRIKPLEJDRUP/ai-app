#!/usr/bin/env node
/**
 * Baseline Vault (øvelse-specifikt) — ekstra lækker CLI med Wizard
 *
 * Kommandoer:
 *   node baseline.js
 *   node baseline.js list
 *   node baseline.js wizard
 *   node baseline.js wizard <exercise_key>
 *   node baseline.js add <exercise_key> "<name>"
 *   node baseline.js show <exercise_key>
 *   node baseline.js log <exercise_key> <method> <weight> <reps> [note]
 *   node baseline.js log <exercise_key> direct1rm <one_rm> [note]
 *   node baseline.js set-active <exercise_key> <entry_number>
 *   node baseline.js delete-entry <exercise_key> <entry_number>
 *
 * Estimation methods:
 *   epley | brzycki | lombardi
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const BASELINE_FILE = path.join(process.cwd(), "baseline.json");

// -------------------- storage --------------------
function loadDB() {
  if (!fs.existsSync(BASELINE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
  } catch {
    console.error("Kunne ikke læse baseline.json (ugyldigt JSON). Ret filen eller slet den og prøv igen.");
    process.exit(1);
  }
}

function saveDB(db) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(db, null, 2), "utf8");
}

function nowISO() {
  const d = new Date();
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(tz) / 60)).padStart(2, "0");
  const mm = String(Math.abs(tz) % 60).padStart(2, "0");
  return d.toISOString().replace("Z", `${sign}${hh}:${mm}`);
}

function nextEntryId(entries) {
  return `e_${entries.length + 1}`;
}

// -------------------- estimation --------------------
function estimate1RM(method, weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!Number.isFinite(w) || w <= 0) throw new Error("weight skal være > 0");
  if (!Number.isFinite(r) || r <= 0) throw new Error("reps skal være > 0");

  switch (method) {
    case "epley":
      // e1RM = w * (1 + r/30)
      return w * (1 + r / 30);
    case "brzycki":
      // e1RM = w * 36 / (37 - r)
      if (r >= 37) throw new Error("reps for højt til brzycki");
      return (w * 36) / (37 - r);
    case "lombardi":
      // e1RM = w * r^0.10
      return w * Math.pow(r, 0.10);
    default:
      throw new Error(`Ukendt metode: ${method}`);
  }
}

function methodLabel(m) {
  if (m === "direct1rm") return "Direkte 1RM";
  if (m === "epley") return "Epley (w*(1+reps/30))";
  if (m === "brzycki") return "Brzycki (w*36/(37-reps))";
  if (m === "lombardi") return "Lombardi (w*reps^0.10)";
  return m;
}

// -------------------- CLI helpers --------------------
function usage() {
  console.log(`
Baseline-rum (øvelse-specifikt) — kommandoer

  node baseline.js list
  node baseline.js wizard
  node baseline.js wizard <exercise_key>

  node baseline.js add <exercise_key> "<name>"
  node baseline.js show <exercise_key>

  node baseline.js log <exercise_key> epley|brzycki|lombardi <weight> <reps> [note]
  node baseline.js log <exercise_key> direct1rm <one_rm> [note]

  node baseline.js set-active <exercise_key> <entry_number>
  node baseline.js delete-entry <exercise_key> <entry_number>

  node baseline.js delete-exercise <exercise_key> [--force]


Tip:
  Wizard er nemmest: node baseline.js wizard
`.trim());
}

function ensureExercise(db, key) {
  const ex = db[key];
  if (!ex) throw new Error(`Ukendt øvelse: ${key} (opret den først)`);
  return ex;
}

function printExercise(db, key) {
  const ex = ensureExercise(db, key);

  console.log(`\n${key} — ${ex.name}`);
  if (!ex.entries.length) {
    console.log("Ingen entries endnu. Brug wizard eller log.");
    return;
  }

  console.log(`Aktiv entry: ${ex.activeEntryId || "ingen"}`);
  console.log("Entries:");

  ex.entries.forEach((e, idx) => {
    const n = idx + 1;
    const active = e.id === ex.activeEntryId ? " ✅" : "";

    const input =
      e.method === "direct1rm"
        ? `1RM=${e.input.oneRM}`
        : e.method === "maxreps"
          ? `reps=${e.input.reps}, addedKg=${e.input.addedKg}`
          : `w=${e.input.weight}, reps=${e.input.reps}`;

    const note = e.note ? ` — note: ${e.note}` : "";

    const estStr =
      e.estimated1rm === null || e.estimated1rm === undefined
        ? "n/a"
        : e.estimated1rm.toFixed(1);

    console.log(
      `  #${n} ${e.id}${active} | ${methodLabel(e.method)} | ${input} | est1RM=${estStr} | ${e.date}${note}`
    );
  });

  console.log("");
}


function cmdList(db) {
  const keys = Object.keys(db);
  if (!keys.length) {
    console.log("Ingen øvelser endnu. Start med: node baseline.js wizard");
    return;
  }
  console.log("Øvelser i baseline:");
  keys.forEach((k) => {
    const ex = db[k];
    const active = ex.activeEntryId ? ` (aktiv: ${ex.activeEntryId})` : "";
    console.log(`- ${k}: ${ex.name}${active}`);
  });
}

function cmdAdd(db, key, name) {
  if (!key || !name) throw new Error('Brug: add <exercise_key> "<name>"');
  if (db[key]) throw new Error(`Øvelse findes allerede: ${key}`);
  db[key] = { name, activeEntryId: null, entries: [] };
  saveDB(db);
  console.log(`Oprettet: ${key} (${name})`);
}

function cmdDeleteExercise(db, key, force) {
  const ex = db[key];
  if (!ex) throw new Error(`Ukendt øvelse: ${key}`);

  const hasEntries = ex.entries && ex.entries.length > 0;
  if (hasEntries && !force) {
    throw new Error(
      `Øvelsen '${key}' har ${ex.entries.length} entries. Brug --force for at slette alligevel.`
    );
  }

  delete db[key];
  saveDB(db);
  console.log(`Slettet øvelse: ${key}`);
}


function cmdRenameKey(db, oldKey, newKey) {
  if (!oldKey || !newKey) throw new Error("Brug: rename-key <old_key> <new_key>");

  if (!db[oldKey]) throw new Error(`Ukendt øvelse: ${oldKey}`);
  if (db[newKey]) throw new Error(`new_key findes allerede: ${newKey}`);

  db[newKey] = db[oldKey];
  delete db[oldKey];

  saveDB(db);
  console.log(`Flyttet key: ${oldKey} -> ${newKey}`);
}


function cmdShow(db, key) {
  printExercise(db, key);
}

function cmdLog(db, key, method, a, b, note) {
  const ex = ensureExercise(db, key);
  const entries = ex.entries;

  let entry;

  // BODYWEIGHT / OPTIONAL WEIGHT (pull-ups, dips, push-ups)
  if (method === "maxreps") {
    const reps = Number(a);
    const addedKg = b === undefined || b === "" ? 0 : Number(b);

    if (!Number.isFinite(reps) || reps <= 0) {
      throw new Error("reps skal være > 0");
    }
    if (!Number.isFinite(addedKg)) {
      throw new Error("addedKg skal være et tal (brug 0 eller ENTER)");
    }

    entry = {
      id: nextEntryId(entries),
      method: "maxreps",
      input: { reps, addedKg },
      estimated1rm: null,
      note: note || "",
      date: nowISO()
    };

    entries.push(entry);
    if (!ex.activeEntryId) ex.activeEntryId = entry.id;

    saveDB(db);
    console.log(`Tilføjet ${entry.id} til ${key}. Aktiv: ${ex.activeEntryId}`);
    return;
  }

  if (method === "direct1rm") {
    const oneRM = Number(a);
    if (!Number.isFinite(oneRM) || oneRM <= 0) throw new Error("oneRM skal være > 0");
    entry = {
      id: nextEntryId(entries),
      method,
      input: { oneRM },
      estimated1rm: oneRM,
      note: note || "",
      date: nowISO()
    };
  } else {
    const weight = Number(a);
    const reps = Number(b);
    const est = estimate1RM(method, weight, reps);
    entry = {
      id: nextEntryId(entries),
      method,
      input: { weight, reps },
      estimated1rm: est,
      note: note || "",
      date: nowISO()
    };
  }

  entries.push(entry);

  // Auto-set active hvis første entry
  if (!ex.activeEntryId) ex.activeEntryId = entry.id;

  saveDB(db);
  console.log(`Tilføjet ${entry.id} til ${key}. Aktiv: ${ex.activeEntryId}`);
}

function cmdSetActive(db, key, entryNumber) {
  const ex = ensureExercise(db, key);
  const n = Number(entryNumber);
  if (!Number.isFinite(n) || n < 1 || n > ex.entries.length) {
    throw new Error(`entry_number skal være mellem 1 og ${ex.entries.length}`);
  }
  ex.activeEntryId = ex.entries[n - 1].id;
  saveDB(db);
  console.log(`Aktiv baseline for ${key} er nu ${ex.activeEntryId}`);
}

function cmdRename(db, key, newName) {
  const ex = ensureExercise(db, key);
  if (!newName) throw new Error('Brug: rename <exercise_key> "<new name>"');
  ex.name = newName;
  saveDB(db);
  console.log(`Omdøbt: ${key} -> ${newName}`);
}

function cmdDeleteEntry(db, key, entryNumber) {
  const ex = ensureExercise(db, key);
  const n = Number(entryNumber);
  if (!Number.isFinite(n) || n < 1 || n > ex.entries.length) {
    throw new Error(`entry_number skal være mellem 1 og ${ex.entries.length}`);
  }

  const removed = ex.entries.splice(n - 1, 1)[0];

  // Re-id entries så de forbliver e_1, e_2... (simpelt og læsbart)
  ex.entries = ex.entries.map((e, idx) => ({ ...e, id: `e_${idx + 1}` }));

  // Fix activeEntryId
  if (!ex.entries.length) {
    ex.activeEntryId = null;
  } else if (removed.id === ex.activeEntryId) {
    ex.activeEntryId = ex.entries[0].id; // fallback til første
  } else {
    // activeId kan have ændret navn ved re-id. Find "samme position" hvis muligt:
    const oldIndex = n - 1;
    const fallbackIndex = Math.min(oldIndex, ex.entries.length - 1);
    // hvis active var et andet entry, prøv at bevare det ved at matche dato+metode+est1rm
    const maybeSame = ex.entries.find((e) => e.date === removed.date && e.method === removed.method);
    if (!maybeSame && ex.activeEntryId) {
      // active var ikke removed, men id'er er re-lavet; sæt bare aktiv til entry #1 hvis usikkert
      // (vil være sjældent relevant – og wizard gør det nemt at set-active igen)
      ex.activeEntryId = ex.activeEntryId.startsWith("e_") ? ex.activeEntryId : ex.entries[fallbackIndex].id;
    }
  }

  saveDB(db);
  console.log(`Slettet entry #${n} fra ${key}.`);
}

// -------------------- Wizard --------------------
function makeRL() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));
}

function normalizeKey(s) {
  // Stable keys: only a-z, 0-9 and underscore.
  // Danish letters are transliterated: æ->ae, ø->oe, å->aa
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    // remove anything not a-z, 0-9, underscore, or space/hyphen (we convert those)
    .replace(/[^a-z0-9_\s-]+/g, "")
    // convert spaces & hyphens to underscore
    .replace(/[\s-]+/g, "_")
    // collapse multiple underscores
    .replace(/_+/g, "_")
    // trim underscores at ends
    .replace(/^_+|_+$/g, "");
}


async function wizard(db, maybeKey) {
  const rl = makeRL();

  try {
    console.log("\n🧠 Baseline Wizard (øvelse-specifikt)\n");

    // 1) Vælg eller opret øvelse
    let key = maybeKey ? normalizeKey(maybeKey) : "";

    if (!key) {
      const existingKeys = Object.keys(db);
      if (existingKeys.length) {
        console.log("Eksisterende øvelser:");
        existingKeys.forEach((k, idx) => console.log(`  ${idx + 1}) ${k} — ${db[k].name}`));
        console.log("  N) Opret ny øvelse");
        const choice = await ask(rl, "\nVælg (nummer) eller 'N': ");
        if (choice.toLowerCase() === "n") {
          key = "";
        } else {
          const n = Number(choice);
          if (Number.isFinite(n) && n >= 1 && n <= existingKeys.length) {
            key = existingKeys[n - 1];
          } else {
            console.log("Ugyldigt valg. Vi opretter ny.");
            key = "";
          }
        }
      }
    }

    if (!key) {
      const rawKey = await ask(rl, "Skriv øvelse-key (fx bench_press): ");
      key = normalizeKey(rawKey);
      const name = await ask(rl, "Skriv visningsnavn (fx Bænkpres): ");

      if (!key) throw new Error("Key må ikke være tom.");
      if (!name) throw new Error("Navn må ikke være tomt.");

      if (!db[key]) {
        db[key] = { name, activeEntryId: null, entries: [] };
        saveDB(db);
        console.log(`✅ Oprettet øvelse: ${key} (${name})`);
      } else {
        console.log(`(Øvelse fandtes allerede: ${key} — ${db[key].name})`);
      }
    } else {
      console.log(`\nValgt øvelse: ${key} — ${db[key].name}`);
    }

    const ex = ensureExercise(db, key);

    // 2) Vælg type af baseline-entry
    console.log("\nVælg metode til baseline-entry:");
    console.log("  1) Direkte 1RM (du kender din 1RM)");
    console.log("  2) e1RM via Epley (vægt + reps)");
    console.log("  3) e1RM via Brzycki (vægt + reps)");
    console.log("  4) e1RM via Lombardi (vægt + reps)");
    console.log("  5) Afslut (ingen ændringer)");

    const methodChoice = await ask(rl, "\nVælg (1-5): ");
    if (methodChoice === "5") {
      console.log("Afslutter wizard.");
      return;
    }

    let method;
    if (methodChoice === "1") method = "direct1rm";
    else if (methodChoice === "2") method = "epley";
    else if (methodChoice === "3") method = "brzycki";
    else if (methodChoice === "4") method = "lombardi";
    else throw new Error("Ugyldigt valg (1-5).");

    // 3) Indtast data
    let note = await ask(rl, "Note (valgfrit, tryk ENTER for tom): ");

    if (method === "direct1rm") {
      const oneRM = await ask(rl, "Din 1RM (kg): ");
      cmdLog(db, key, method, oneRM, null, note);
    } else {
      const weight = await ask(rl, "Vægt (kg): ");
      const reps = await ask(rl, "Reps: ");
      cmdLog(db, key, method, weight, reps, note);
    }

    // 4) Skal entry sættes aktiv?
    printExercise(db, key);

    if (ex.entries.length > 1) {
      const yn = await ask(rl, "Vil du vælge hvilken entry der er AKTIV? (y/n): ");
      if (yn.toLowerCase() === "y") {
        const n = await ask(rl, `Skriv entry-nummer (1-${ex.entries.length}): `);
        cmdSetActive(db, key, n);
      }
    } else {
      console.log("Aktiv baseline er sat automatisk (første entry).");
    }

    // 5) Hurtig loop: Tilføj flere entries?
    while (true) {
      const more = await ask(rl, "\nTilføj en entry mere til samme øvelse? (y/n): ");
      if (more.toLowerCase() !== "y") break;

      console.log("\nMetode:");
      console.log("  1) Direkte 1RM");
      console.log("  2) Epley");
      console.log("  3) Brzycki");
      console.log("  4) Lombardi");
      const c = await ask(rl, "Vælg (1-4): ");

      let m;
      if (c === "1") m = "direct1rm";
      else if (c === "2") m = "epley";
      else if (c === "3") m = "brzycki";
      else if (c === "4") m = "lombardi";
      else {
        console.log("Ugyldigt valg — prøv igen.");
        continue;
      }

      note = await ask(rl, "Note (valgfrit): ");

      if (m === "direct1rm") {
        const oneRM = await ask(rl, "1RM (kg): ");
        cmdLog(db, key, m, oneRM, null, note);
      } else {
        const w = await ask(rl, "Vægt (kg): ");
        const r = await ask(rl, "Reps: ");
        cmdLog(db, key, m, w, r, note);
      }

      printExercise(db, key);

      const yn2 = await ask(rl, "Skal du ændre aktiv entry nu? (y/n): ");
      if (yn2.toLowerCase() === "y") {
        const nn = await ask(rl, `Skriv entry-nummer (1-${ex.entries.length}): `);
        cmdSetActive(db, key, nn);
      }
    }

    console.log("\n✅ Wizard færdig.\n");
  } finally {
    rl.close();
  }
}

// -------------------- main --------------------
(function main() {
  const db = loadDB();
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd) {
    usage();
    process.exit(0);
  }

  try {
    if (cmd === "list") return cmdList(db);

    if (cmd === "wizard") return wizard(db, args[0]);

    if (cmd === "add") return cmdAdd(db, args[0], args[1]);

if (cmd === "rename") return cmdRename(db, args[0], args[1]);

if (cmd === "rename-key") return cmdRenameKey(db, args[0], args[1]);


    if (cmd === "show") return cmdShow(db, args[0]);

    if (cmd === "log") {
      const key = args[0];
      const method = args[1];
      const a = args[2];
      const b = args[3];
      const note = args.slice(4).join(" ");
      return cmdLog(db, key, method, a, b, note);
    }

    if (cmd === "set-active") return cmdSetActive(db, args[0], args[1]);

    if (cmd === "delete-entry") return cmdDeleteEntry(db, args[0], args[1]);

if (cmd === "delete-exercise") return cmdDeleteExercise(db, args[0], args.includes("--force"));


    usage();
    process.exit(1);
  } catch (err) {
    console.error("Fejl:", err.message);
    process.exit(1);
  }
})();
