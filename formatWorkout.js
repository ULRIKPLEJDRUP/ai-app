// formatWorkout.js

function formatPrescription(exerciseLabel, prescription) {
  if (!prescription) return `${exerciseLabel}: (ingen forslag)`;

  const sets = prescription.sets;
  const reps = prescription.reps;

  // baselineVault: 1RM-baseret
  if (prescription.type === "1rm") {
    return `${sets}×${reps} @ ${prescription.weight} kg`;
  }

  // baselineVault: kropsvægt / optional vægt
  if (prescription.type === "maxreps") {
    const add = Number(prescription.addedKg || 0);
    const addStr = add > 0 ? ` (+${add} kg)` : "";
    return `${sets}×${reps} ${exerciseLabel}${addStr}`;
  }

  // fallback hvis lastWorkout-formatet er anderledes
  if (prescription.weight !== undefined) {
    return `${sets}×${reps} @ ${prescription.weight} kg`;
  }
  if (prescription.addedKg !== undefined) {
    const add = Number(prescription.addedKg || 0);
    const addStr = add > 0 ? ` (+${add} kg)` : "";
    return `${sets}×${reps} ${exerciseLabel}${addStr}`;
  }

  return `${exerciseLabel}: ${JSON.stringify(prescription)}`;
}

export function formatPlannedExercise(plan, displayNameMap = {}) {
  const label = displayNameMap[plan.exerciseKey] || plan.exerciseKey;

  if (plan.source === "none") {
    return `${label}: ingen baseline/last (${plan.reason || "ukendt"})`;
  }

  const tag = plan.source === "baseline" ? "baseline" : "sidst";
  const line = formatPrescription(label, plan.prescription);

  return `${label}: ${line}  [${tag}]`;
}
