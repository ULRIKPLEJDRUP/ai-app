// validateWorkout.js
import { DAY_RULES } from "./dayRules.js";
import { resolveExerciseKey, getTags, getLabel } from "./exerciseCatalog.js";

function hasAny(tags, allowed) {
  return (allowed || []).some((t) => tags.includes(t));
}
function hasDisallowed(tags, disallowed) {
  return (disallowed || []).some((t) => tags.includes(t));
}

// Rewrite title: keep suffix like "(45 min version)" if it exists
function rewriteTitle(oldTitle, newPrefix) {
  const t = String(oldTitle || "").trim();
  if (!t) return newPrefix;

  // try to keep anything in parentheses at the end
  const m = t.match(/\s*(\(.+\))\s*$/);
  const suffix = m ? ` ${m[1]}` : "";
  return `${newPrefix}${suffix}`;
}

/**
 * Validates and filters a workout's exercises according to day rules.
 * Strategy: SAFE by default — drop mismatches, print clear warnings.
 */
export function validateAndFilterWorkout(dayKey, workout) {
  const rule = DAY_RULES[dayKey];
  if (!rule) {
    return { workout, warnings: [`WARNING: No day rule found for ${dayKey}`] };
  }

  const warnings = [];
  const out = { ...workout };

  // force consistent title/name
  const newPrefix = rule.label;
  out.title = rewriteTitle(workout.title, newPrefix);
  out.name = rewriteTitle(workout.name, newPrefix);

  const filtered = [];
  for (const ex of workout.exercises || []) {
    const name = ex.name;
    const key = resolveExerciseKey(name);

    if (!key) {
      warnings.push(
        `WARNING: Ukendt øvelse '${name}'. Tilføj den i exerciseCatalog.js (ellers kan den ikke valideres).`
      );
      // Conservative: keep unknown (so you notice it during test)
      filtered.push(ex);
      continue;
    }

    const tags = getTags(key) || [];
    const okAllowed = hasAny(tags, rule.allowAnyOf);
    const badDisallowed = hasDisallowed(tags, rule.disallowAnyOf);

    if (!okAllowed || badDisallowed) {
      const label = getLabel(key) || name;
      warnings.push(
        `WARNING: '${label}' (tags: ${tags.join(", ")}) matcher ikke ${rule.label}. Øvelsen droppes fra dagens pas.`
      );
      continue;
    }

    // Normalize label to canonical label for consistent type/rest logic
    filtered.push({ ...ex, name: getLabel(key) || ex.name });
  }

  out.exercises = filtered;
  return { workout: out, warnings };
}
