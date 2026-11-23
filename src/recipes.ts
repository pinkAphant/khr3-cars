/**
 * Authored body recipes. Every mass is a named number per piece; the car's mass is their sum.
 * Wheel and tire assemblies are not parts in `masses`: `ShapeCastWheel` carries them (`extras.ecctrlWheel`).
 */
import { DEFAULT_CAR_TUNE, DEFAULT_WHEEL_SPEC, type CarRecipe } from "./carParts.js";

/** Mid-size 4-door sedan (about 1.27 t body-in-white plus drivetrain, before wheels). */
export const SEDAN_4DOOR: CarRecipe = Object.freeze({
  id: "sedan_4door",
  doors: 4,
  dims: Object.freeze({ length: 4.6, width: 1.78, height: 1.42, wheelbase: 2.7, frontOverhang: 0.95, groundClearance: 0.15 }),
  masses: Object.freeze({
    tub: 560, roof: 28, pillarB: 7, quarter: 0,
    doorFront: 28, doorRear: 24, hood: 16, trunk: 12,
    engine: 180, gearbox: 70, seatFront: 18, seatRear: 26, tank: 48,
  }),
  wheels: DEFAULT_WHEEL_SPEC,
  tune: DEFAULT_CAR_TUNE,
});

/** Compact 2-door coupe: longer, heavier doors and fixed rear quarter panels behind the B-pillar. */
export const COUPE_2DOOR: CarRecipe = Object.freeze({
  id: "coupe_2door",
  doors: 2,
  dims: Object.freeze({ length: 4.45, width: 1.75, height: 1.3, wheelbase: 2.55, frontOverhang: 0.9, groundClearance: 0.13 }),
  masses: Object.freeze({
    tub: 520, roof: 24, pillarB: 7, quarter: 14,
    doorFront: 34, doorRear: 0, hood: 15, trunk: 11,
    engine: 170, gearbox: 65, seatFront: 17, seatRear: 20, tank: 45,
  }),
  wheels: Object.freeze({
    ...DEFAULT_WHEEL_SPEC,
    radius: 0.32,
    width: 0.23,
    travel: 0.20,
    sag: 0.07,
    tireGripFactor: 1.65,
  }),
  tune: Object.freeze({
    ...DEFAULT_CAR_TUNE,
    engineHorsepower: 225,
    engineMaxRPM: 7200,
    shiftUpRPM: 6500,
    rollCenterHeight: 0.23,
    antiRollStiffness: 3200,
  }),
});

export const BODY_RECIPES: readonly CarRecipe[] = Object.freeze([SEDAN_4DOOR, COUPE_2DOOR]);
