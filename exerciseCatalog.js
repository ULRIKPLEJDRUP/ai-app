// exerciseCatalog.js
// Canonical catalog: key -> { label, aliases, tags }
//
// Tags (movement):
// - push, pull, legs, core
//
// Tags (muscles / regions):
// - chest, back, upper_back, lats, shoulders, front_delts, rear_delts
// - triceps, biceps, forearms
// - quads, hamstrings, glutes, calves
// - abs
//
// Notes:
// - Keep labels English (stable keys + stable display labels).
// - Add aliases freely (Danish/variants) so older data still resolves.

export const CATALOG = {
  // ===================== PUSH (Chest/Shoulders/Triceps) =====================
  bench_press: {
    label: "Bench press",
    aliases: [
      "Bench press", "Bench Press", "Barbell bench press",
      "Bænkpres", "Bænkpres (barbell)", "Bænkpres barbell"
    ],
    tags: ["push", "chest", "triceps", "front_delts"]
  },

  incline_db_press: {
    label: "Incline dumbbell press",
    aliases: [
      "Incline dumbbell press", "Incline DB press", "Incline dumbbell", "Incline press",
      "Incline håndvægt pres", "Incline håndvægtpres"
    ],
    tags: ["push", "chest", "triceps", "front_delts"]
  },

  overhead_press: {
    label: "Overhead press",
    aliases: [
      "Overhead press", "OHP", "Military press", "Shoulder press",
      "Skulderpres", "Skulderpres (barbell)", "Military press (barbell)"
    ],
    tags: ["push", "shoulders", "triceps", "front_delts"]
  },

  lateral_raises: {
    label: "Lateral raises",
    aliases: [
      "Lateral raises", "Lateral raise", "Side lateral raises", "Laterals",
      "Lateral raises (dumbbell)", "Side raises",
      "Lateral løft", "Sideløft"
    ],
    tags: ["push", "shoulders"]
  },

  triceps_pushdown: {
    label: "Triceps pushdown",
    aliases: [
      "Triceps pushdown", "Triceps pressdown", "Cable pushdown", "Rope pushdown",
      "Triceps nedpres", "Triceps pushdown (kabel)"
    ],
    tags: ["push", "triceps"]
  },

  skull_crushers: {
    label: "Skull crushers",
    aliases: [
      "Skull crushers", "Lying triceps extension", "French press",
      "Skullcrushers", "EZ bar skull crushers",
      "Fransk pres", "Lying triceps extension (EZ)"
    ],
    tags: ["push", "triceps"]
  },

  dips: {
    label: "Dips",
    aliases: ["Dips", "Dip", "Parallel bar dips", "Triceps dips"],
    tags: ["push", "chest", "triceps"]
  },

  // ===================== PULL (Back/Biceps/Rear delts) =====================
  barbell_row: {
    label: "Barbell row",
    aliases: [
      "Barbell row", "Bent-over row", "BB row", "Bent over row",
      "Stang row", "Stangroning", "Barbell row (bent over)"
    ],
    tags: ["pull", "back", "upper_back", "biceps"]
  },

  face_pulls: {
    label: "Face pulls",
    aliases: ["Face pulls", "Face pull", "Cable face pull", "Face pull (rope)", "Facepulls"],
    tags: ["pull", "upper_back", "rear_delts"]
  },

  pull_up: {
    label: "Pull-up",
    aliases: [
      "Pull-up", "Pull ups", "Pull-ups",
      "Chin-up", "Chin ups", "Chin-ups",
      "Pullup", "Chinup",
      "Pull-ups (bodyweight)"
    ],
    tags: ["pull", "back", "lats", "biceps"]
  },

  lat_pulldown: {
    label: "Lat pulldown",
    aliases: [
      "Lat pulldown", "Lat pull-down", "Pulldown", "Cable pulldown",
      "Lat pulldown (wide grip)", "Lat pulldown (close grip)",
      "Nedtræk", "Lat nedtræk", "Lat pulldown (kabel)"
    ],
    tags: ["pull", "back", "lats", "biceps"]
  },

  biceps_curls: {
    label: "Biceps curls",
    aliases: [
      "Biceps curls", "Biceps curl", "Dumbbell curls", "DB curls", "Barbell curls",
      "Biceps curls (dumbbell)",
      "Biceps curls", "Biceps curl (håndvægt)", "Biceps curl"
    ],
    tags: ["pull", "biceps"]
  },

  hammer_curls: {
    label: "Hammer curls",
    aliases: ["Hammer curls", "Hammer curl", "DB hammer curls", "Hammercurls", "Hammer curl (dumbbell)"],
    tags: ["pull", "biceps", "forearms"]
  },

  // ===================== LEGS (Quads/Hamstrings/Glutes/Calves) =====================
  squat: {
    label: "Squat",
    aliases: [
      "Squat", "Squats", "Back squat", "Front squat",
      "Barbell squat", "Back squats",
      "Squat (stang)", "Squat stang", "Back squat (barbell)"
    ],
    tags: ["legs", "quads", "glutes", "core"]
  },

  deadlift: {
    label: "Deadlift",
    aliases: ["Deadlift", "Dead lift", "Dødløft", "DL"],
    tags: ["legs", "hamstrings", "glutes", "back", "core"]
  },

  romanian_deadlift: {
    label: "Romanian deadlift",
    aliases: ["Romanian deadlift", "RDL", "Romanian dead lift", "Stivbenet dødløft", "Rumænsk dødløft"],
    tags: ["legs", "hamstrings", "glutes", "back", "core"]
  },

  walking_lunges: {
    label: "Walking lunges",
    aliases: [
      "Walking lunges", "Walking lunge", "Lunges", "Lunge walk",
      "Gående lunges", "Walking lunges (dumbbell)"
    ],
    tags: ["legs", "quads", "glutes", "hamstrings"]
  },

  calf_raises: {
    label: "Calf raises",
    aliases: ["Calf raises", "Calf raise", "Standing calf raises", "Tåhævninger", "Calf raise (standing)"],
    tags: ["legs", "calves"]
  },

  // ===================== CORE / ABS =====================
  plank: {
    label: "Plank",
    aliases: ["Plank", "Planken"],
    tags: ["core", "abs"]
  },

  ab_wheel: {
    label: "Ab wheel",
    aliases: ["Ab wheel", "Ab-wheel", "Ab wheel rollout", "Wheel rollout", "Ab wheel rollouts", "Mavehjul", "Ab wheel (rollout)"],
    tags: ["core", "abs"]
  }
};

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'");
}

// Build alias index: aliasNorm -> key
const ALIAS_TO_KEY = (() => {
  const idx = {};
  for (const [key, def] of Object.entries(CATALOG)) {
    idx[norm(def.label)] = key;
    (def.aliases || []).forEach((a) => { idx[norm(a)] = key; });
    idx[norm(key)] = key;
  }
  return idx;
})();

export function resolveExerciseKey(nameOrKey) {
  const k = ALIAS_TO_KEY[norm(nameOrKey)];
  return k || null;
}

export function getTags(nameOrKey) {
  const key = resolveExerciseKey(nameOrKey);
  if (!key) return null;
  return CATALOG[key].tags || [];
}

export function getLabel(nameOrKey) {
  const key = resolveExerciseKey(nameOrKey);
  if (!key) return null;
  return CATALOG[key].label;
}
