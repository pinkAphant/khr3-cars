/**
 * Armory-style parametric car definition: a car is a list of named parts, each with its own box and its own mass.
 * Frame: SI metres, +Y up, +Z forward, right-handed, so +X is the car's LEFT. A left-hand-drive driver sits at +X.
 */
import type { MassBox, Vec3 } from "./massProps.js";

export type PartKind = "tub" | "roof" | "pillar" | "quarter" | "door" | "hood" | "trunk" | "engine" | "gearbox" | "seat" | "tank";

export interface Hinge {
  /** Hinge point in the car frame. The part node origin sits here. */
  readonly anchor: Vec3;
  readonly axis: Vec3;
  /** Signed opening range in radians about `axis`. */
  readonly limits: [number, number];
}

export interface CarPart extends MassBox {
  readonly name: string;
  readonly kind: PartKind;
  /** Present on doors, hood and trunk: an articulated 1-DOF part. */
  readonly hinge?: Hinge;
}

export interface CarDims {
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly wheelbase: number;
  readonly frontOverhang: number;
  readonly groundClearance: number;
}

/** Authored per-part masses in kg. Every field is required. */
export interface CarMasses {
  tub: number; roof: number; pillarB: number; quarter: number;
  doorFront: number; doorRear: number; hood: number; trunk: number;
  engine: number; gearbox: number; seatFront: number; seatRear: number; tank: number;
}

export interface CarRecipe {
  readonly id: string;
  readonly doors: 2 | 4;
  readonly dims: CarDims;
  readonly masses: CarMasses;
}

const DOOR_T = 0.12;
const PILLAR_W = 0.12;
const SKIN = 0.03;
const DOOR_OPEN = 1.2;

const box = (name: string, kind: PartKind, massKg: number, center: Vec3, size: Vec3, hinge?: Hinge): CarPart =>
  hinge ? { name, kind, massKg, center, size, hinge } : { name, kind, massKg, center, size };

function assertDims(d: CarDims): void {
  for (const [k, v] of Object.entries(d)) if (!(Number.isFinite(v) && v > 0)) throw new RangeError(`carParts: dims.${k} must be > 0`);
  if (d.wheelbase + d.frontOverhang >= d.length) throw new RangeError("carParts: wheelbase + frontOverhang must be shorter than length");
}

/** Every part of the car in the car frame. Door names use L/R as seen from the driver seat. */
export function buildCarParts(r: CarRecipe): CarPart[] {
  const d = r.dims;
  const m = r.masses;
  assertDims(d);
  const zFront = d.length / 2;
  const zFrontAxle = zFront - d.frontOverhang;
  const zRearAxle = zFrontAxle - d.wheelbase;
  const zA = zFrontAxle - 0.35; // A-pillar base: the front edge of the cabin
  const zC = zRearAxle + 0.25; // C-pillar: the rear edge of the cabin
  const sill = d.groundClearance + 0.2;
  const doorH = d.height - 0.05 - sill;
  const doorY = sill + doorH / 2;
  const xDoor = d.width / 2 - DOOR_T / 2;
  const parts: CarPart[] = [
    box("Body_Tub", "tub", m.tub, [0, d.groundClearance + 0.15, 0], [d.width, 0.3, d.length]),
    box("Body_Roof", "roof", m.roof, [0, d.height - SKIN / 2, (zA + zC) / 2], [d.width - 0.2, SKIN, zA - zC]),
    box("Engine", "engine", m.engine, [0, 0.55, zFrontAxle + 0.1], [0.6, 0.55, 0.6]),
    box("Gearbox", "gearbox", m.gearbox, [0, 0.4, zA - 0.25], [0.35, 0.3, 0.6]),
    box("Seat_FL", "seat", m.seatFront, [0.38, 0.55, zA - 0.75], [0.5, 0.9, 0.55]),
    box("Seat_FR", "seat", m.seatFront, [-0.38, 0.55, zA - 0.75], [0.5, 0.9, 0.55]),
    box("Seat_Rear", "seat", m.seatRear, [0, 0.5, zC + 0.45], [d.width - 0.3, 0.8, 0.5]),
    box("Tank", "tank", m.tank, [0, 0.35, zRearAxle + 0.15], [0.7, 0.25, 0.4]),
  ];
  const door = (name: string, side: 1 | -1, zFrontEdge: number, zRearEdge: number, mass: number) => {
    // Hinged at its front edge; opening swings the rear edge outward (+X on the left, -X on the right).
    const len = zFrontEdge - zRearEdge;
    const limits: [number, number] = side > 0 ? [-DOOR_OPEN, 0] : [0, DOOR_OPEN];
    parts.push(box(name, "door", mass, [side * xDoor, doorY, zFrontEdge - len / 2], [DOOR_T, doorH, len], {
      anchor: [side * xDoor, doorY, zFrontEdge], axis: [0, 1, 0], limits,
    }));
  };
  const pillar = (side: 1 | -1, z: number) =>
    parts.push(box(side > 0 ? "Pillar_B_L" : "Pillar_B_R", "pillar", m.pillarB, [side * xDoor, doorY, z], [DOOR_T, doorH, PILLAR_W]));
  if (r.doors === 4) {
    // The B-pillar separates the front and rear cabin; rear doors hinge on its rear face.
    const zB = (zA + zC) / 2;
    for (const s of [1, -1] as const) {
      pillar(s, zB);
      door(s > 0 ? "Door_FL" : "Door_FR", s, zA, zB + PILLAR_W / 2, m.doorFront);
      door(s > 0 ? "Door_RL" : "Door_RR", s, zB - PILLAR_W / 2, zC, m.doorRear);
    }
  } else {
    const doorLen = Math.min(1.25, (zA - zC) * 0.7);
    const zB = zA - doorLen - PILLAR_W / 2;
    for (const s of [1, -1] as const) {
      door(s > 0 ? "Door_FL" : "Door_FR", s, zA, zA - doorLen, m.doorFront);
      pillar(s, zB);
      const qLen = zB - PILLAR_W / 2 - zC;
      parts.push(box(s > 0 ? "Quarter_L" : "Quarter_R", "quarter", m.quarter, [s * xDoor, doorY, zC + qLen / 2], [DOOR_T, doorH, qLen]));
    }
  }
  const hoodLen = zFront - zA;
  parts.push(box("Hood", "hood", m.hood, [0, 0.95, zA + hoodLen / 2], [d.width - 0.1, SKIN, hoodLen], {
    anchor: [0, 0.95, zA], axis: [1, 0, 0], limits: [-1.1, 0], // front edge lifts
  }));
  const zRear = -d.length / 2;
  const trunkLen = zC - zRear;
  parts.push(box("Trunk", "trunk", m.trunk, [0, 0.95, zC - trunkLen / 2], [d.width - 0.1, SKIN, trunkLen], {
    anchor: [0, 0.95, zC], axis: [1, 0, 0], limits: [0, 1.2], // rear edge lifts
  }));
  return parts;
}

/** Front/rear axle positions along Z (car frame). */
export function axleZ(d: CarDims): { front: number; rear: number } {
  const front = d.length / 2 - d.frontOverhang;
  return { front, rear: front - d.wheelbase };
}
