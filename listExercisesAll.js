// listExercisesAll.js
const fs = require("fs");
const catalog = require("./exerciseCatalog");

function pad(s, n) {
  s = String(s ?? "");
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function arr(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

/* ---------- PART 1: EXERCISE CATALOG ---------- */
function listCatalog() {
  let exercises = null;

  if (catalog.CATALOG) exercises = catalog.CATALOG;
  else if (catalog.EXERCISES) exercises = catalog.EXERCISES;
  else if (catalog.exercises) exercises = catalog.exercises;

  if (!exercises) {
    console.error("❌ Kan ikke finde exercises i exerciseCatalog");
    return;
  }

  const rows = Object.entries(exercises).map(([key, ex]) => ({
    key,
    label: ex.label || "",
    tags: arr(ex.tags).join(", "),
    aliases: arr(ex.aliases).join(", "),
  })).sort((a, b) => a.key.localeCompare(b.key));

  const wKey = Math.max(6, ...rows.map(r => r.key.length));
  const wLab = Math.max(5, ...rows.map(r => r.label.length));

  console.log("\n==================== ALLE ØVELSER I SYSTEMET ====================\n");
  console.log(`${pad("KEY", wKey)}  ${pad("LABEL", wLab)}  TAGS  |  ALIASES`);
  console.log(`${"-".repeat(wKey)}  ${"-".repeat(wLab)}  ----- |  -------`);

  rows.forEach(r => {
    console.log(`${pad(r.key, wKey)}  ${pad(r.label, wLab)}  ${r.tags}  |  ${r.aliases}`);
  });

  console.log(`\nTotal øvelser i kataloget: ${rows.length}\n`);
}

/* ---------- PART 2: BASELINES ---------- */
function listBaselines() {
  const file = "baselineWorkouts.json";
  if (!fs.existsSync(file)) {
    console.log("❌ baselineWorkouts.json findes ikke endnu");
    return;
  }

  const baselines = JSON.parse(fs.readFileSync(file, "utf8"));

  console.log("\n==================== ØVELSER I DINE BASELINES ====================\n");

  for (const [day, data] of Object.entries(baselines)) {
    console.log(`${day.toUpperCase()} — ${data.workoutTitle}`);
    (data.exercises || []).forEach((ex, i) => {
      const sets = (ex.sets || []).length;
      console.log(`  ${i + 1}) ${ex.name}  (${sets} sæt)`);
    });
    console.log("");
  }
}

/* ---------- RUN ---------- */
listCatalog();
listBaselines();

