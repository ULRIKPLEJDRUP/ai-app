// baselineVault.js
import fs from "fs";
import path from "path";

const BASELINE_FILE = path.join(process.cwd(), "baseline.json");

function loadBaselineDB() {
  if (!fs.existsSync(BASELINE_FILE)) return {};
  const raw = fs.readFileSync(BASELINE_FILE, "utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function roundToIncrement(x, inc = 2.5) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / inc) * inc;
}

function getExercise(db, key) {
  return db[key] || null;
}

function getActiveEntry(ex) {
  if (!ex || !ex.entries || ex.entries.length === 0) return null;
  if (ex.activeEntryId) {
    const hit = ex.entries.find((e) => e.id === ex.activeEntryId);
    if (hit) return hit;
  }
  return ex.entries[ex.entries.length - 1];
}

/**
 * Baseline -> prescription
 * goal: "hypertrophy" | "strength" | "technique"
 */
export function getBaselinePrescription(exerciseKey, goal = "hypertrophy") {
  const db = loadBaselineDB();
  const ex = getExercise(db, exerciseKey);
  if (!ex) return { ok: false, reason: `No baseline for '${exerciseKey}'` };

  const entry = getActiveEntry(ex);
  if (!entry) return { ok: false, reason: `No baseline entries for '${exerciseKey}'` };

  // Bodyweight-style baseline (maxreps)
  if (entry.method === "maxreps") {
    const baselineReps = Number(entry.input?.reps || 0);
    const baselineAddedKg = Number(entry.input?.addedKg || 0);

    if (!Number.isFinite(baselineReps) || baselineReps <= 0) {
      return { ok: false, reason: `Invalid maxreps baseline for '${exerciseKey}'` };
    }

    if (goal === "strength") {
      const reps = Math.max(3, Math.min(6, Math.round(baselineReps * 0.6)));
      return { ok: true, type: "maxreps", sets: 4, reps, addedKg: baselineAddedKg };
    }

    if (goal === "technique") {
      const reps = Math.max(3, Math.min(8, Math.round(baselineReps * 0.5)));
      return { ok: true, type: "maxreps", sets: 3, reps, addedKg: 0 };
    }

    // hypertrophy
    const reps = Math.max(6, Math.min(12, Math.round(baselineReps * 0.7)));
    return { ok: true, type: "maxreps", sets: 3, reps, addedKg: baselineAddedKg };
  }

  // 1RM-based baseline
  const e1rm = entry.estimated1rm;
  if (!Number.isFinite(e1rm)) {
    return { ok: false, reason: `Active baseline for '${exerciseKey}' has no 1RM estimate` };
  }

  let sets = 3;
  let reps = 8;
  let pct = 0.72;

  if (goal === "strength") {
    sets = 4;
    reps = 5;
    pct = 0.8;
  } else if (goal === "technique") {
    sets = 3;
    reps = 6;
    pct = 0.6;
  } else {
    sets = 3;
    reps = 8;
    pct = 0.72;
  }

  const weight = roundToIncrement(e1rm * pct, 2.5);

  return {
    ok: true,
    type: "1rm",
    sets,
    reps,
    weight,
    meta: { e1rm: roundToIncrement(e1rm, 0.1), pct },
  };
}
