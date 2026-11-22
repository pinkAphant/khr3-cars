/**
 * @khr3/cars: where every ecctrl2 + KHR car lives, and how to address it on R2.
 * Runtime stays in `@khr3/core/vehicle` `<KhrVehicle>`. This package is catalog + pipeline.
 */

export type FleetKind = "car" | "motorcycle" | "starcraft";

/** Where the baked KHR `.glb` exists today. */
export type CarLocation = "r2" | "khr3-fixtures" | "kolmo-fleet";

export interface CarEntry {
  readonly id: string;
  readonly label: string;
  readonly kind: FleetKind;
  /** R2 object key under `/assets/` (target home, even if not uploaded yet). */
  readonly r2Key: string;
  /** Places the baked `.glb` currently exists. */
  readonly locations: readonly CarLocation[];
}

/** R2 prefix per kind. Bikes and ships are not filed under `cars/`. */
export const R2_PREFIX: Readonly<Record<FleetKind, string>> = Object.freeze({
  car: "cars",
  motorcycle: "bikes",
  starcraft: "craft",
});

const entry = (id: string, label: string, kind: FleetKind, locations: CarLocation[]): CarEntry =>
  Object.freeze({ id, label, kind, r2Key: `${R2_PREFIX[kind]}/${id}.glb`, locations: Object.freeze(locations) });

/** Inventory as of 2026-11-22 (R2 manifest + local fixtures + Kolmo public/fleet). */
export const FLEET: readonly CarEntry[] = Object.freeze([
  entry("kolmogorov_hatchback", "Kolmogorov Hatchback", "car", ["r2", "khr3-fixtures"]),
  entry("lexus_is300", "2004 Lexus IS 300 (XE10)", "car", ["r2", "khr3-fixtures", "kolmo-fleet"]),
  entry("nissan_silvia_s15", "Nissan Silvia S15", "car", ["kolmo-fleet"]),
  entry("nissan_skyline_r34", "Nissan Skyline R34", "car", ["kolmo-fleet"]),
  entry("toyota_supra_a80", "Toyota Supra A80", "car", ["kolmo-fleet"]),
  entry("crotch_rocket", "Sport Bike", "motorcycle", ["kolmo-fleet"]),
  entry("starfox_rocket", "Quad-Thruster Craft", "starcraft", ["kolmo-fleet"]),
]);

export function findCar(id: string): CarEntry {
  const hit = FLEET.find((c) => c.id === id);
  if (!hit) throw new RangeError(`@khr3/cars: unknown id "${id}" (known: ${FLEET.map((c) => c.id).join(", ")})`);
  return hit;
}

/** Absolute R2 URL for an entry, given the vault base (e.g. `https://khr3.optimuspi.workers.dev`). */
export function carUrl(base: string, id: string): string {
  const b = base.replace(/\/+$/, "");
  if (!/^https?:\/\//.test(b)) throw new RangeError(`@khr3/cars: base must be an http(s) origin, got "${base}"`);
  return `${b}/assets/${findCar(id).r2Key}`;
}

/** Entries that still need uploading to R2. */
export function pendingUpload(): readonly CarEntry[] {
  return FLEET.filter((c) => !c.locations.includes("r2"));
}

export * from "./massProps.js";
export * from "./carParts.js";
export * from "./carKhr.js";
export * from "./recipes.js";
