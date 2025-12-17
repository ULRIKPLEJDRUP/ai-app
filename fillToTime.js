// fillToTime.js (ESM)
// Fill workout with allowed accessory exercises until it hits a target range.

import { resolveExerciseKey, getTags, getLabel } from "./exerciseCatalog.js";
import { DAY_RULES } from "./dayRules.js";

// Simple time model (same assumptions as index.js)
function estimateWorkoutMinutes(workout, { setMinutes, transitionMin }) {
  let baseMin = 0;
  for (const ex of workout.exercises || []) {
    const setsCount = (ex.sets || []).length;
    baseMin += (setsCount * setMinutes) + transitionMin;
  }
  return baseMin;
}

function canAddExerciseToDay(dayKey, exerciseName) {
  const rule = DAY_RULES[dayKey];
  if (!rule) return true;

  const key = resolveExerciseKey(exerciseName);
  if (!key) return true; // unknown => allow (but better to catalog it)

  const tags = getTags(key) || [];
  const allowAny = rule.allowAnyOf || [];
  const disallowAny = rule.disallowAnyOf || [];

  const okAllowed = allowAny.some((t) => tags.includes(t));
  const badDisallowed = disallowAny.some((t) => tags.includes(t));

  return okAllowed && !badDisallowed;
}

// Default “fill” candidates (priority order)
const FILL_CANDIDATES = {
  day1: [
    { name: "Incline dumbbell press", sets: [{ reps: 10, kg: 30 }, { reps: 10, kg: 30 }, { reps: 10, kg: 30 }] },
    { name: "Triceps pushdown", sets: [{ reps: 12, kg: 25 }, { reps: 12, kg: 25 }, { reps: 12, kg: 25 }] },
    { name: "Dips", sets: [{ reps: 8, kg: 0 }, { reps: 8, kg: 0 }, { reps: 8, kg: 0 }] },
    { name: "Skull crushers", sets: [{ reps: 10, kg: 25 }, { reps: 10, kg: 25 }, { reps: 10, kg: 25 }] },
    { name: "Lateral raises", sets: [{ reps: 12, kg: 10 }, { reps: 12, kg: 10 }] },
  ],
  day2: [
    { name: "Lat pulldown", sets: [{ reps: 10, kg: 60 }, { reps: 10, kg: 60 }, { reps: 10, kg: 60 }] },
    { name: "Face pulls", sets: [{ reps: 12, kg: 20 }, { reps: 12, kg: 20 }, { reps: 12, kg: 20 }] },
    { name: "Biceps curls", sets: [{ reps: 10, kg: 14 }, { reps: 10, kg: 14 }, { reps: 10, kg: 14 }] },
    { name: "Hammer curls", sets: [{ reps: 10, kg: 14 }, { reps: 10, kg: 14 }, { reps: 10, kg: 14 }] },
  ],
  day3: [
    { name: "Walking lunges", sets: [{ reps: 10, kg: 20 }, { reps: 10, kg: 20 }, { reps: 10, kg: 20 }] },
    { name: "Calf raises", sets: [{ reps: 12, kg: 40 }, { reps: 12, kg: 40 }, { reps: 12, kg: 40 }] },
    { name: "Plank", sets: [{ reps: 1, kg: 60 }, { reps: 1, kg: 60 }, { reps: 1, kg: 60 }] },
    { name: "Ab wheel", sets: [{ reps: 8, kg: 0 }, { reps: 8, kg: 0 }, { reps: 8, kg: 0 }] },
  ],
};

function alreadyHasExercise(workout, name) {
  const n = String(name || "").toLowerCase();
  return (workout.exercises || []).some((e) => String(e.name || "").toLowerCase() === n);
}

/**
 * Fill workout with allowed accessory exercises until it hits a target range.
 * minutes: target minutes (e.g., 55)
 * aimPct: aim for >= minutes*aimPct
 * capPct: do not exceed minutes*capPct
 */
export function fillWorkoutToTime(dayKey, workout, minutes, opts) {
  const {
    setMinutes = 1,
    transitionMin = 0.5,
    aimPct = 0.92,
    capPct = 0.98,
  } = opts || {};

  const targetMin = Number(minutes || 0);
  if (!targetMin || targetMin <= 0) {
    return { workout, notes: ["Ingen tid angivet -> ingen fill."] };
  }

  const aimMin = targetMin * aimPct;
  const capMin = targetMin * capPct;

  const out = { ...workout, exercises: [...(workout.exercises || [])] };
  const notes = [];

  const candidates = FILL_CANDIDATES[dayKey] || [];
  let currentMin = estimateWorkoutMinutes(out, { setMinutes, transitionMin });

  for (const cand of candidates) {
    if (currentMin >= aimMin) break;
    if (alreadyHasExercise(out, cand.name)) continue;
    if (!canAddExerciseToDay(dayKey, cand.name)) continue;

    const simulated = { ...out, exercises: [...out.exercises, cand] };
    const simMin = estimateWorkoutMinutes(simulated, { setMinutes, transitionMin });

    if (simMin <= capMin) {
      const label = getLabel(cand.name) || cand.name;
      out.exercises.push({ ...cand, name: label });
      currentMin = simMin;
      notes.push(`Tilføjede '${label}' for at ramme tiden bedre.`);
    }
  }

  return { workout: out, notes };
}
