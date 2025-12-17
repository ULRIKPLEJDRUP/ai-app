// dayRules.js
// Day rules define what tags are allowed on each day.

export const DAY_RULES = {
  day1: {
    label: "Dag 1: Bryst, Skulder & Triceps",
    allowAnyOf: ["push"],                 // must include at least one of these
    disallowAnyOf: ["pull", "legs"],      // optional safety
  },
  day2: {
    label: "Dag 2: Ryg & Biceps",
    allowAnyOf: ["pull"],
    disallowAnyOf: ["push", "legs"],
  },
  day3: {
    label: "Dag 3: Ben, Core & Mave",
    allowAnyOf: ["legs", "core"],
    disallowAnyOf: ["push", "pull"],
  }
};
