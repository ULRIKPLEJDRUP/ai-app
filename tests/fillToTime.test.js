import { describe, expect, it } from "vitest";
import { fillWorkoutToTime } from "../fillToTime.js";

describe("fillWorkoutToTime", () => {
  it("tilføjer accessory øvelser for at nå tidsmålet", () => {
    const baseWorkout = {
      exercises: [
        {
          name: "Bench press",
          sets: [{ reps: 5 }, { reps: 5 }, { reps: 5 }],
        },
      ],
    };

    const result = fillWorkoutToTime("day1", baseWorkout, 20, {
      setMinutes: 1,
      transitionMin: 0.5,
    });

    expect(result.workout.exercises.length).toBeGreaterThan(baseWorkout.exercises.length);
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.workout.exercises.some((ex) => ex.name === "Incline dumbbell press")).toBe(true);
  });

  it("returnerer uændret workout når mål-tid ikke er sat", () => {
    const baseWorkout = { exercises: [] };
    const result = fillWorkoutToTime("day2", baseWorkout, 0);

    expect(result.workout).toEqual(baseWorkout);
    expect(result.notes).toEqual(["Ingen tid angivet -> ingen fill."]);
  });
});
