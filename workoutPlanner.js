// workoutPlanner.js
import fs from "fs";
import path from "path";
import { getBaselinePrescription } from "./baselineVault.js";
import { resolveExerciseKey } from "./exerciseCatalog.js";
import { getRM } from "./agent-data/rm.js";
import { roundTo } from "./lib/weights.js";

const LAST_FILE = path.join(process.cwd(), "lastWorkout.json");

function loadLast() {
  if (!fs.existsSync(LAST_FILE)) return {};
  const raw = fs.readFileSync(LAST_FILE, "utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function getLastForExercise(last, exerciseKey) {
  if (!last || !Array.isArray(last.exercises)) return null;

  for (const ex of last.exercises) {
    const key = resolveExerciseKey(ex.name);
    if (key === exerciseKey && Array.isArray(ex.sets) && ex.sets.length > 0) {
      // brug sidste sæt som reference
      const lastSet = ex.sets[ex.sets.length - 1];
      return {
        type: "last",
        sets: ex.sets.length,
        reps: lastSet.reps,
        weight: lastSet.kg
      };
    }
  }
  return null;
}

function getRMPrescription(exerciseKey, goal = "hypertrophy") {
  const rm = getRM(exerciseKey);
  if (!rm || !Number.isFinite(rm.trainingMax)) return { ok: false };

  let sets = 3;
  let reps = 8;
  let pct = 0.75;

  if (goal === "strength") {
    sets = 4; reps = 5; pct = 0.85;
  } else if (goal === "technique") {
    sets = 3; reps = 6; pct = 0.65;
  }

  const weight = roundTo(rm.trainingMax * pct, 2.5);

  return {
    ok: true,
    type: "tm",
    sets,
    reps,
    weight,
    meta: { tm: roundTo(rm.trainingMax, 0.1), pct },
  };
}

export function planExercise(exerciseKey, goal = "hypertrophy") {
  const last = loadLast();
  const prev = getLastForExercise(last, exerciseKey);

  if (prev) {
    return { source: "lastWorkout", exerciseKey, prescription: prev };
  }

  const rmPres = getRMPrescription(exerciseKey, goal);
    if (rmPres.ok) {
    return { source: "rm", exerciseKey, prescription: rmPres };
  }

  const baseline = getBaselinePrescription(exerciseKey, goal);
  if (baseline.ok) {
    return { source: "baseline", exerciseKey, prescription: baseline };
  }

  return { source: "none", exerciseKey, reason: baseline.reason || "No data" };
}
