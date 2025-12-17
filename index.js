// index.js v4 (ESM)
// - Deterministic TRIM then optional FILL (base-time driven)
// - Buffer is display only
// - Warmup set per exercise (counts in time, not logged)
// - Autofill: ASK before overriding plan (Enter keep plan, Y use history, P disable for rest)

import readline from "readline";
import fs from "fs";

import { validateAndFilterWorkout } from "./validateWorkout.js";
import { fillWorkoutToTime } from "./fillToTime.js";
import { ensureLogFile, getLastExerciseEntry, appendSession } from "./lib/history.js";
import { resolveExerciseKey, getTags, getLabel } from "./exerciseCatalog.js";
import { execSync } from "child_process";
import path from "path";

function playSound(file, times = 1) {
  const p = path.resolve("sounds", file);
  for (let i = 0; i < times; i++) {
    try {
      execSync(`afplay "${p}"`);
    } catch {
      // hvis lyd fejler, skal træningen stadig køre videre
    }
  }
}


ensureLogFile();

// ===================== SETTINGS =====================
const REST_COMPOUND = 120; // sec
const REST_ISOLATION = 60; // sec

// Skift/rig + "klar før første sæt"
const BETWEEN_EXERCISES_REST_SEC = 45; // skift/rig mellem øvelser (0 = off)
const READY_COUNTDOWN_SEC = 10;        // nedtælling før 1. sæt (0 = off)

// Warmup
const WARMUP_ENABLED = true;
const WARMUP_REPS = 15;
const WARMUP_PCT = 0.50;

// Time model
const SET_MINUTES = 1.0;
const TRANSITION_MIN = 0.5;

// Buffer is ONLY display (do not drive trim/fill with it)
const DISPLAY_BUFFER_PCT = 0.12;

// Targeting
const AIM_PCT = 0.92;          // if below 92% -> allow fill
const CAP_PCT = 0.98;          // fill cap
const FIT_TOLERANCE_MIN = 1.5; // stop trimming when <= target + tol

// Autofill sanity + behavior
const AUTOFILL_MAX_DEVIATION = 0.15; // 15%

// Storage
const BASELINE_FILE = "baselineWorkouts.json";

// ===================== READLINE =====================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise((resolve) => rl.question(q, resolve)); }

// ===================== HELPERS =====================
function toNum(x, fallback) {
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function roundToIncrement(x, inc = 2.5) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / inc) * inc;
}

function guessIncrementForExercise(exName) {
  const s = String(exName || "").toLowerCase();
  // Dumbbells often move in 1 kg steps (or 2 kg). Keep it simple: 1.
  if (s.includes("dumbbell") || s.includes("db")) return 1;
  // Cable/stack can be odd, but rounding is harmless.
  return 2.5;
}

function dayKeyFromChoice(choice) {
  const c = String(choice || "").trim();
  if (c === "1") return "day1";
  if (c === "2") return "day2";
  if (c === "3") return "day3";
  return null;
}

function dayLabel(dayKey) {
  if (dayKey === "day1") return "Dag 1: Bryst, Skulder & Triceps";
  if (dayKey === "day2") return "Dag 2: Ryg & Biceps";
  if (dayKey === "day3") return "Dag 3: Ben, Core & Mave";
  return dayKey;
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function loadBaselines() {
  if (!fs.existsSync(BASELINE_FILE)) throw new Error(`Mangler ${BASELINE_FILE}`);
  return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
}

// baseline unchanged (keep for future)
function saveBaselines(b) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(b, null, 2));
}

function beep(n = 1) {
  for (let i = 0; i < n; i++) {
    process.stdout.write("\x07");
  }
}

// ===================== EXERCISE TYPE/REST =====================
const ISOLATION_KEYS = new Set([
  "lateral_raises",
  "face_pulls",
  "triceps_pushdown",
  "skull_crushers",
  "biceps_curls",
  "hammer_curls",
  "calf_raises",
  "plank",
  "ab_wheel",
]);

function exerciseType(name) {
  const key = resolveExerciseKey(name);
  if (!key) return "compound";
  if (ISOLATION_KEYS.has(key)) return "isolation";

  const tags = getTags(key) || [];
  if (tags.includes("core") && !tags.includes("legs")) return "isolation";
  if (tags.includes("push") || tags.includes("pull") || tags.includes("legs")) return "compound";
  return "compound";
}

function restSecondsForExercise(name) {
  return exerciseType(name) === "compound" ? REST_COMPOUND : REST_ISOLATION;
}

function isCompound(name) {
  return exerciseType(name) === "compound";
}

// ===================== WARMUP (counts in time, not logged) =====================
function getWarmupForExercise(ex) {
  if (!WARMUP_ENABLED) return null;

  const name = ex?.name || "";
  // Skip warmup for time-based core like plank
  if (String(name).toLowerCase() === "plank") return null;

  const sets = Array.isArray(ex?.sets) ? ex.sets : [];
  if (sets.length === 0) return null;

  const firstWorkKg = Number(sets[0].kg);
  if (!Number.isFinite(firstWorkKg) || firstWorkKg <= 0) {
    // If bodyweight (e.g., dips/pull-up kg=0): still allow a warmup, but make it "bodyweight technique"
    // Here we just return null to keep it simple (you can add BW warmup later if desired).
    return null;
  }

  const inc = guessIncrementForExercise(name);
  const warmKg = roundToIncrement(firstWorkKg * WARMUP_PCT, inc);

  return { reps: WARMUP_REPS, kg: warmKg ?? Math.max(0, firstWorkKg * WARMUP_PCT) };
}

function countWorkSets(ex) {
  // Warmup is NOT stored in ex.sets, so work sets are just ex.sets length
  return (ex.sets || []).length;
}

function countTotalSetsForTime(ex) {
  const warm = getWarmupForExercise(ex);
  return countWorkSets(ex) + (warm ? 1 : 0);
}

// ===================== TIME ESTIMATION (BASE DRIVES LOGIC) =====================
function estimateExerciseBaseMinutes(ex) {
  const totalSets = countTotalSetsForTime(ex);
  const restMin = restSecondsForExercise(ex.name) / 60;

  const work = totalSets * SET_MINUTES;
  const rest = Math.max(0, totalSets - 1) * restMin;
  const transition = TRANSITION_MIN;

  return work + rest + transition;
}

function estimateWorkoutBaseMinutes(workout) {
  return (workout.exercises || []).reduce((sum, ex) => sum + estimateExerciseBaseMinutes(ex), 0);
}

function displayBufferMinutes(targetMinutes) {
  return targetMinutes > 0 ? Math.ceil(targetMinutes * DISPLAY_BUFFER_PCT) : 0;
}

function printTimeEstimate(workout, targetMinutes, label) {
  const base = estimateWorkoutBaseMinutes(workout);
  const buffer = displayBufferMinutes(targetMinutes);
  const totalDisplay = base + buffer;

  console.log(`\n--- ${label} ---`);
  console.log(`Base (inkl. opvarmning+pauser+skift): ca. ${base.toFixed(1)} min`);
  console.log(`Display-buffer (${Math.round(DISPLAY_BUFFER_PCT * 100)}%): ca. ${buffer} min`);
  console.log(`TOTAL (display): ca. ${totalDisplay.toFixed(1)} min (mål: ${targetMinutes} min)`);
}

// ===================== TRIM PRIORITIES =====================
// Higher number = keep longer (trim others first)
const PRIORITY_BY_DAY = {
  day1: {
    bench_press: 100,
    incline_db_press: 85,
    overhead_press: 75,
    dips: 60,
    triceps_pushdown: 50,
    lateral_raises: 40,
    skull_crushers: 35,
  },
  day2: {
    pull_up: 100,
    barbell_row: 90,
    lat_pulldown: 80,
    face_pulls: 60,
    biceps_curls: 55,
    hammer_curls: 50,
  },
  day3: {
    squat: 100,
    romanian_deadlift: 95,
    walking_lunges: 80,
    calf_raises: 55,
    plank: 45,
    ab_wheel: 45,
  },
};

function prio(dayKey, exName) {
  const key = resolveExerciseKey(exName);
  const map = PRIORITY_BY_DAY[dayKey] || {};
  if (key && map[key] != null) return map[key];
  return 30; // unknown => medium-low
}

function minSets(name) {
  // compound keep 2 sets minimum, isolation keep 1
  return isCompound(name) ? 2 : 1;
}

function sortIndicesLowPrioFirst(dayKey, exercises) {
  return exercises
    .map((ex, idx) => ({ idx, p: prio(dayKey, ex.name), name: ex.name }))
    .sort((a, b) => a.p - b.p);
}

function canRemoveExercise(workout, idx) {
  // keep at least 2 exercises overall
  if ((workout.exercises || []).length <= 2) return false;

  // ensure at least 1 compound remains
  const remaining = workout.exercises.filter((_, i) => i !== idx);
  if (remaining.filter((e) => isCompound(e.name)).length === 0) return false;

  return true;
}

function trimToTarget(dayKey, baseline, targetMinutes) {
  const plan = clone(baseline);
  plan.workoutTitle = `${dayLabel(dayKey)} (I DAG)`;

  const notes = [];
  let safety = 600;

  while (safety-- > 0) {
    const base = estimateWorkoutBaseMinutes(plan);
    if (base <= targetMinutes + FIT_TOLERANCE_MIN) break;

    // 1) reduce sets on lowest priority exercises (down to minSets)
    const ranked = sortIndicesLowPrioFirst(dayKey, plan.exercises || []);
    const reducible = ranked.find((r) => {
      const ex = plan.exercises[r.idx];
      return ex && (ex.sets || []).length > minSets(ex.name);
    });

    if (reducible) {
      const ex = plan.exercises[reducible.idx];
      ex.sets = ex.sets.slice(0, ex.sets.length - 1);
      notes.push(`Trim: -1 sæt på '${getLabel(ex.name) || ex.name}'.`);
      continue;
    }

    // 2) remove lowest priority exercises (if needed)
    const removable = ranked.find((r) => canRemoveExercise(plan, r.idx));
    if (!removable) break;

    const ex = plan.exercises[removable.idx];
    plan.exercises.splice(removable.idx, 1);
    notes.push(`Trim: fjernede '${getLabel(ex.name) || ex.name}'.`);
  }

  return { plan, notes };
}

// ===================== PRINT =====================
function printWorkout(w) {
  console.log(`\n=== ${w.workoutTitle || w.title || w.name || "Workout"} ===`);
  (w.exercises || []).forEach((ex, i) => {
    const display = getLabel(ex.name) || ex.name;
    console.log(`\n${i + 1}) ${display}`);

    // Print ONLY work sets (warmup is runtime-only)
    (ex.sets || []).forEach((s, idx) => {
      if (String(display).toLowerCase() === "plank") {
        console.log(`   Sæt ${idx + 1}: ${s.kg} sek`);
      } else {
        console.log(`   Sæt ${idx + 1}: ${s.reps} reps @ ${s.kg} kg`);
      }
    });
  });
}

// ===================== TIMER (skippable) =====================
function countdown(seconds) {
  return new Promise((resolve) => {
    let remaining = seconds;
    let did30 = false, did10 = false, did0 = false;

    const render = () => {
      process.stdout.write(`\rPause: ${remaining}s (tryk Enter for at skippe) `);
    };
    render();

    const onData = (chunk) => {
      if (chunk.toString().includes("\n")) cleanup("Pause skippet – klar\n");
    };

    const cleanup = (msg) => {
      clearInterval(timer);
      process.stdin.off("data", onData);
      process.stdout.write(`\r${msg}`);
      resolve();
    };

    process.stdin.on("data", onData);

    const timer = setInterval(() => {
      remaining--;

      if (!did30 && remaining === 30) { did30 = true; playSound("beep1.aiff", 1); }
      if (!did10 && remaining === 10) { did10 = true; playSound("beep2.aiff", 2); }

      if (!did0 && remaining <= 0) {
        did0 = true;
        playSound("beep3.aiff", 3);
        cleanup("Pause færdig – klar\n");
        return;
      }

      render();
    }, 1000);
  });
}

function readyCountdown(seconds, label = "Klar om") {
  return new Promise((resolve) => {
    if (!seconds || seconds <= 0) return resolve();

    let remaining = seconds;
    let did30 = false, did10 = false, did0 = false;

    const render = () => {
      process.stdout.write(`\r${label}: ${remaining}s (Enter = skip) `);
    };
    render();

    const onData = (chunk) => {
      if (chunk.toString().includes("\n")) cleanup(`${label}: skippet – go!\n`);
    };

    const cleanup = (msg) => {
      clearInterval(timer);
      process.stdin.off("data", onData);
      process.stdout.write(`\r${msg}`);
      resolve();
    };

    process.stdin.on("data", onData);

    const timer = setInterval(() => {
      remaining--;

      if (!did30 && remaining === 30) { did30 = true; beep(1); }
      if (!did10 && remaining === 10) { did10 = true; beep(2); }

      if (!did0 && remaining <= 0) {
        did0 = true;
        beep(3);
        cleanup(`${label}: go!\n`);
        return;
      }

      render();
    }, 1000);
  });
}

async function transitionPause(seconds) {
  if (!seconds || seconds <= 0) return { skipForever: false, skipped: false };

  while (true) {
    const cmd = (await ask(`(Enter)=skift ${seconds}s | (S)=skip | (P)=skip resten af passet: `))
      .trim()
      .toLowerCase();

    if (cmd === "") {
      await readyCountdown(seconds, "Skift");
      return { skipForever: false, skipped: false };
    }

    if (cmd === "s") {
      console.log("Skift skippet.\n");
      return { skipForever: false, skipped: true };
    }

    if (cmd === "p") {
      console.log("Skift slås fra resten af passet.\n");
      return { skipForever: true, skipped: true };
    }

    console.log("❓ Ukendt valg. Brug Enter, S eller P.");
  }
}



// ===================== RUN WORKOUT =====================
function ensureExerciseKeyAndLabel(ex) {
  const key = resolveExerciseKey(ex.name);
  ex.exerciseKey = key || ex.exerciseKey || null;
  ex.name = getLabel(ex.name) || ex.name;
  return ex.exerciseKey;
}

async function maybeApplyAutofillFromHistory(ex, state) {
  const key = ensureExerciseKeyAndLabel(ex);
  if (!key) return;

  if (state.autofillDisabled) return;

  const last = getLastExerciseEntry(key);
  if (!last) return;

  const weights = Array.isArray(last.weights) ? last.weights : [];
  if (weights.length === 0) return;

  // Compare against CURRENT PLAN (not baseline file)
  const planKg = (ex.sets && ex.sets[0]) ? Number(ex.sets[0].kg) : null;
  const lastTop = Number(weights[weights.length - 1]);

  if (planKg && lastTop) {
    const dev = Math.abs(lastTop - planKg) / planKg;
    if (dev > AUTOFILL_MAX_DEVIATION) {
      console.log(`(Autofyld IGNORERET) Historik virker skæv: ${weights.join(", ")} kg vs plan ${planKg} kg`);
      return;
    }
  }

  console.log(`(Autofyld) Sidste gang: ${last.sets || weights.length} sæt @ ${weights.join(", ")} kg`);

  const cmd = (await ask(`(Enter)=behold plan | (Y)=brug historik | (P)=slå autofyld fra resten: `))
    .trim()
    .toLowerCase();

  if (cmd === "") {
    console.log("(Autofyld) Beholder plan.\n");
    return;
  }

  if (cmd === "p") {
    state.autofillDisabled = true;
    console.log("(Autofyld) Slået fra resten af passet.\n");
    return;
  }

  if (cmd !== "y") {
    console.log("(Autofyld) Ukendt valg -> beholder plan.\n");
    return;
  }

  // Apply weights to existing sets count (do NOT change reps by default)
  const baseSets = Array.isArray(ex.sets) ? ex.sets : [];
  const setsCount = baseSets.length;

  ex.sets = Array.from({ length: setsCount }, (_, idx) => {
    const prevKg = weights[idx] ?? weights[weights.length - 1] ?? (baseSets[idx]?.kg ?? 0);
    const prev = baseSets[idx] || {};
    return { reps: prev.reps ?? 8, kg: prevKg };
  });

  console.log("✅ (Autofyld) Historik anvendt.\n");
}

async function runWorkout(workout) {
  console.log("\nKØRSEL: Enter når et sæt er DONE. Pause starter automatisk. Enter under pause = skip.\n");

  const state = {
    skipTransitions: false,
    autofillDisabled: false,
  };

  let isFirstExercise = true;

  for (const ex of workout.exercises || []) {
    // --- Skift/rig mellem øvelser (ikke før første) ---
    if (!isFirstExercise && BETWEEN_EXERCISES_REST_SEC > 0 && !state.skipTransitions) {
      console.log(`\n--- Skift/rig ---`);
      const res = await transitionPause(BETWEEN_EXERCISES_REST_SEC);
      if (res.skipForever) state.skipTransitions = true;
    }
    isFirstExercise = false;

    // --- Autofill (ASK before override) ---
    try {
      await maybeApplyAutofillFromHistory(ex, state);
    } catch {
      console.log("(Autofyld) Fejl — fortsætter uden autofyld.\n");
    }

    const rest = restSecondsForExercise(ex.name);
    console.log(`\n=== ${ex.name} (${exerciseType(ex.name)} | pause ${rest}s) ===`);

    // --- Klar-nedtælling før første sæt ---
    if (READY_COUNTDOWN_SEC > 0) {
      await readyCountdown(READY_COUNTDOWN_SEC, "Klar til 1. sæt");
    }

    // --- Warmup (B: based on PLAN's first work set) ---
    const warm = getWarmupForExercise(ex);
    if (warm) {
      await ask(`Opvarmning: ${warm.reps} reps @ ${warm.kg} kg  (Enter når DONE) `);
    }

    // --- Work sets ---
    const sets = ex.sets || [];
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];

      if ((ex.name || "").toLowerCase() === "plank") {
        await ask(`Sæt ${i + 1}: ${s.kg} sek  (Enter når DONE) `);
      } else {
        await ask(`Sæt ${i + 1}: ${s.reps} reps @ ${s.kg} kg  (Enter når DONE) `);
      }

      if (i < sets.length - 1) {
        while (true) {
          const cmd = (await ask(`(Enter)=pause ${rest}s | (A)=adjust næste sæt | (S)=skip pause: `))
            .trim()
            .toLowerCase();

          if (cmd === "") {
            await countdown(rest);
            break;
          }

          if (cmd === "s") {
            break;
          }

          if (cmd === "a") {
            const newKgStr = await ask(`Ny kg for resten af øvelsen (fra sæt ${i + 2})? `);
            const v = newKgStr.trim();
            if (v === "") {
              console.log("Ingen ændring.");
              continue;
            }

            const newKg = Number(v.replace(",", "."));
            if (Number.isNaN(newKg)) {
              console.log("❌ Ugyldigt tal – prøv igen.");
              continue;
            }

            for (let j = i + 1; j < sets.length; j++) {
              sets[j].kg = newKg;
            }

            console.log(`✅ Resten af øvelsen er nu sat til ${newKg} kg`);
            continue;
          }

          console.log("❓ Ukendt valg. Brug Enter, A eller S.");
        }
      }
    }
  }
}

// ===================== LOGGING =====================
function buildSession(dayKey, workout) {
  const exercises = (workout.exercises || []).map((ex) => {
    const key = ex.exerciseKey || resolveExerciseKey(ex.name) || null;

    // IMPORTANT: log only work sets (warmup is runtime-only)
    const weights = (ex.sets || []).map((s) => Number(s.kg) || 0);

    return {
      exerciseKey: key || String(ex.name || "").toLowerCase().replace(/\s+/g, "_"),
      sets: (ex.sets || []).length,
      weights,
    };
  });

  return {
    createdAt: new Date().toISOString(),
    dayKey,
    title: workout.workoutTitle || workout.title || workout.name || dayLabel(dayKey),
    exercises,
  };
}

// ===================== MAIN =====================
(async () => {
  console.log("\nVælg program:");
  console.log("1) Dag 1: Bryst, Skulder & Triceps");
  console.log("2) Dag 2: Ryg & Biceps");
  console.log("3) Dag 3: Ben, Core & Mave\n");

  const dayChoice = await ask("Vælg 1/2/3: ");
  const dayKey = dayKeyFromChoice(dayChoice);
  if (!dayKey) {
    console.log("Ugyldigt valg. Afslutter.");
    rl.close();
    return;
  }

  const minutesStr = await ask("Hvor mange minutter har du til træning i dag? ");
  const minutes = toNum(minutesStr.trim() || "0", 0);

  const baselines = loadBaselines();
  let baseline = baselines[dayKey];
  if (!baseline) {
    console.log(`Ingen baseline fundet for ${dayLabel(dayKey)}.`);
    rl.close();
    return;
  }

  // Validate baseline (drop mismatches)
  const validated = validateAndFilterWorkout(dayKey, baseline);
  baseline = validated.workout;

  if (validated.warnings?.length) {
    console.log("\nValidering (øvelser på forkert dag droppes):");
    validated.warnings.forEach((w) => console.log(w));
    console.log("");
  }

  console.log(`\nTop! Du har ${minutes || "?"} minutter.`);
  console.log(`\nBaseline — ${dayLabel(dayKey)}:\n`);
  printWorkout(baseline);

  if (minutes > 0) printTimeEstimate(baseline, minutes, "TIDS-ESTIMAT (BASELINE vs i dag)");

  // === BUILD TODAY PLAN ===
  let todayPlan = clone(baseline);
  todayPlan.workoutTitle = `${dayLabel(dayKey)} (I DAG)`;

  let trimNotes = [];
  if (minutes > 0) {
    const trimmed = trimToTarget(dayKey, todayPlan, minutes);
    todayPlan = trimmed.plan;
    trimNotes = trimmed.notes;
  }

  // Fill ONLY if clearly under (base-time)
  let fillNotes = [];
  if (minutes > 0) {
    const baseNow = estimateWorkoutBaseMinutes(todayPlan);
    const aimMin = minutes * AIM_PCT;

    if (baseNow < aimMin) {
      const filled = fillWorkoutToTime(dayKey, todayPlan, minutes, {
        setMinutes: SET_MINUTES,
        transitionMin: TRANSITION_MIN,
        aimPct: AIM_PCT,
        capPct: CAP_PCT,
      });
      todayPlan = filled.workout;
      fillNotes = filled.notes || [];
    }
  }

  console.log("\nPLAN I DAG:\n");
  printWorkout(todayPlan);

  if (minutes > 0) printTimeEstimate(todayPlan, minutes, "TIDS-ESTIMAT (I DAG)");

  if (trimNotes.length) {
    console.log("\n--- Trim (auto) ---");
    trimNotes.forEach((n) => console.log("- " + n));
  }
  if (fillNotes.length) {
    console.log("\n--- Fill (auto) ---");
    fillNotes.forEach((n) => console.log("- " + n));
  }

  await runWorkout(todayPlan);

  appendSession(buildSession(dayKey, todayPlan));
  saveBaselines(baselines);

  console.log("\nLogget ✅");
  console.log("Done 👍");
  rl.close();
})();
