import { getRM } from "../agent-data/rm.js";

export function roundTo(x, step = 2.5) {
  if (!Number.isFinite(x) || !Number.isFinite(step) || step <= 0) return x;
  return Math.round(x / step) * step;
}

// Returns null if no RM data
export function weightFromTM(exerciseKey, pct, roundStep = 2.5) {
  const rm = getRM(exerciseKey);
  if (!rm || !Number.isFinite(rm.trainingMax)) return null;

  const raw = rm.trainingMax * pct;
  return roundTo(raw, roundStep);
}
