function bestSet(sets) {
  let best = null;
  for (const s of sets) {
    if (!best) best = s;
    else if (s.kg > best.kg) best = s;
    else if (s.kg === best.kg && s.reps > best.reps) best = s;
  }
  return best;
}

export function updateBaselineWithSession(baseline, session) {
  const copy = { ...baseline };
  const key = session.exerciseKey;

  const best = bestSet(session.sets);
  const last = session.sets[session.sets.length - 1];

  const prev = copy[key] ?? {
    exerciseName: session.exerciseName,
    baselineKg: best.kg,
    baselineReps: best.reps,
    lastKg: last.kg,
    lastReps: last.reps,
    updatedAt: session.createdAt,
    historyCount: 0,
  };

  const stronger =
    best.kg > prev.baselineKg ||
    (best.kg === prev.baselineKg && best.reps > prev.baselineReps);

  copy[key] = {
    exerciseName: session.exerciseName,
    baselineKg: stronger ? best.kg : prev.baselineKg,
    baselineReps: stronger ? best.reps : prev.baselineReps,
    lastKg: last.kg,
    lastReps: last.reps,
    updatedAt: session.createdAt,
    historyCount: (prev.historyCount ?? 0) + 1,
  };

  return copy;
}
