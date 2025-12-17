function toNumber(str) {
  if (typeof str === "number") return str;
  if (typeof str !== "string") return NaN;
  const s = str.replace(",", ".").trim();
  return Number(s);
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s/g, "_");
}

/**
 * Autolog format:
 *   "Bænkpres: 82,5x8, 82,5x8, 80x10"
 * Also accepts:
 *   "Bænkpres 82,5x8 82,5x8 80x10"
 * Separators: comma or spaces between sets. Uses "x" between kg and reps.
 */
export function parseAutoLogLine(line) {
  const raw = String(line ?? "").trim();
  if (!raw) return null;

  // Split into exercise part + sets part
  let exercisePart = "";
  let setsPart = "";

  const colonIdx = raw.indexOf(":");
  if (colonIdx >= 0) {
    exercisePart = raw.slice(0, colonIdx).trim();
    setsPart = raw.slice(colonIdx + 1).trim();
  } else {
    // fallback: assume first token(s) until we hit something like 80x8
    // We'll try to find first match of pattern \d+(\.\d+)?x\d+
    const m = raw.match(/\d+(?:[.,]\d+)?\s*[xX]\s*\d+/);
    if (!m || m.index == null) return null;
    exercisePart = raw.slice(0, m.index).trim();
    setsPart = raw.slice(m.index).trim();
  }

  if (!exercisePart || !setsPart) return null;

  // Guard: exercise must not be pure number
  if (/^\d+([.,]\d+)?$/.test(exercisePart)) return null;

  // Match alle forekomster af "<kg>x<reps>" uden at splitte på komma
  const re = /(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+)/g;

  const sets = [];
  let m2;
  while ((m2 = re.exec(setsPart)) !== null) {
    const kg = toNumber(m2[1]);
    const reps = Math.trunc(toNumber(m2[2]));
    if (!Number.isFinite(kg) || !Number.isFinite(reps) || reps <= 0 || kg < 0) continue;
    sets.push({ kg, reps });
  }

  if (sets.length === 0) return null;

  return {
    exerciseName: exercisePart,
    exerciseKey: slugify(exercisePart),
    sets: sets.map((s, i) => ({
      setIndex: i + 1,
      reps: s.reps,
      kg: s.kg,
      note: "",
    })),
  };
}

export function normalizeSessionInput(raw) {
  const exerciseName = String(raw.exercise ?? raw.exerciseName ?? "").trim();
  const exerciseKey = raw.exerciseKey ? String(raw.exerciseKey) : slugify(exerciseName);

  const sets = Array.isArray(raw.sets) ? raw.sets : [];
  const normSets = sets.map((s) => ({
    setIndex: Number(s.setIndex),
    reps: Math.trunc(toNumber(s.reps)),
    kg: toNumber(s.kg),
    note: String(s.note ?? "").trim(),
  }));

  return {
    createdAt: raw.createdAt ?? new Date().toISOString(),
    exerciseName,
    exerciseKey,
    sets: normSets,
  };
}

export function isValidSession(session) {
  if (!session.exerciseName || !session.exerciseKey) return false;
  if (!Array.isArray(session.sets) || session.sets.length === 0) return false;

  // Guard: exercise name can't be pure number
  if (/^\d+([.,]\d+)?$/.test(session.exerciseName)) return false;

  for (const s of session.sets) {
    if (!Number.isFinite(s.setIndex) || s.setIndex <= 0) return false;
    if (!Number.isFinite(s.reps) || s.reps <= 0) return false;
    if (!Number.isFinite(s.kg) || s.kg < 0) return false;
  }
  return true;
}
