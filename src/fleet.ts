import { FLEET, type CarEntry, type FleetKind } from "./index.js";

/**
 * Four physics-solver vehicle domains:
 * - `cars`: wheel/track raycasts against solid terrain (cars, trucks, ambulances, bikes, lunar rovers)
 * - `watercraft`: buoyancy + ballast in fluid volumes (boats, ships, jet skis, submarines)
 * - `aircraft`: aerodynamic lift, rotors, or aerostatic buoyancy in atmosphere (planes, helis, drones, balloons)
 * - `spacecraft`: 6-DoF thrusters & reaction wheels in vacuum / orbit (fighters, orbital pods)
 */
export type VehicleDomain = "cars" | "watercraft" | "aircraft" | "spacecraft";

export type VehicleSupportSolver = "wheel-raycast" | "buoyancy" | "aero-lift" | "six-dof-thruster";

export interface VehicleDomainSpec {
  readonly domain: VehicleDomain;
  readonly solver: VehicleSupportSolver;
  readonly r2Prefix: string;
  readonly examples: readonly string[];
}

export const VEHICLE_DOMAINS: readonly VehicleDomain[] = Object.freeze([
  "cars",
  "watercraft",
  "aircraft",
  "spacecraft",
]);

export const VEHICLE_DOMAIN_SPECS: Readonly<Record<VehicleDomain, VehicleDomainSpec>> = Object.freeze({
  cars: Object.freeze({
    domain: "cars",
    solver: "wheel-raycast",
    r2Prefix: "cars",
    examples: Object.freeze(["sedan", "coupe", "truck", "ambulance", "motorcycle", "lunar_rover"]),
  }),
  watercraft: Object.freeze({
    domain: "watercraft",
    solver: "buoyancy",
    r2Prefix: "watercraft",
    examples: Object.freeze(["speedboat", "ship", "jetski", "submarine"]),
  }),
  aircraft: Object.freeze({
    domain: "aircraft",
    solver: "aero-lift",
    r2Prefix: "aircraft",
    examples: Object.freeze(["airplane", "helicopter", "quadcopter", "hot_air_balloon"]),
  }),
  spacecraft: Object.freeze({
    domain: "spacecraft",
    solver: "six-dof-thruster",
    r2Prefix: "craft",
    examples: Object.freeze(["starfox_rocket", "orbital_pod", "shuttle"]),
  }),
});

/** Maps a legacy `FleetKind` to its physics-solver `VehicleDomain`. */
export function domainForKind(kind: FleetKind): VehicleDomain {
  if (kind === "starcraft") return "spacecraft";
  return "cars";
}

/** Filters `FLEET` entries belonging to a given `VehicleDomain`. */
export function fleetByDomain(domain: VehicleDomain): readonly CarEntry[] {
  return FLEET.filter((entry) => domainForKind(entry.kind) === domain);
}
