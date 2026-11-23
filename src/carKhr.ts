/**
 * Turn a parametric car into the node plan and `KhrExportNodeSpec[]` that `@khr3/core` `exportKhrGlb` consumes.
 * Fixed parts are lumped into the `Chassis` body; articulated parts keep their own mass and a revolute joint to `Chassis`.
 * Four `Wheel_*` nodes sit at static ride-height center (`y = radius`) with `extras.ecctrlWheel`, matching `solveWheelLoads`.
 * The spec shape is a structural copy of `@khr3/core` `KhrExportNodeSpec`, so this package stays dependency-free.
 */
import {
  axleZ,
  buildCarParts,
  DEFAULT_CAR_TUNE,
  DEFAULT_WHEEL_SPEC,
  type CarPart,
  type CarRecipe,
  type CarTune,
  type WheelSpec,
} from "./carParts.js";
import { principalAboutX, sumMass, type MassProps, type Vec3 } from "./massProps.js";

export interface DoorDrive {
  readonly stiffness: number;
  readonly damping: number;
}

/** Authored drive gains for hinged panels (used by `setJointTarget` / `setRoleTarget`). */
export const PANEL_DRIVE: DoorDrive = Object.freeze({ stiffness: 60, damping: 12 });

export type WheelNodeName = "Wheel_FL" | "Wheel_FR" | "Wheel_RL" | "Wheel_RR";

export interface PlannedWheel {
  readonly nodeName: WheelNodeName;
  /** Static ride-height wheel center (`y = radius`). */
  readonly position: Vec3;
  /** Unloaded `<ShapeCastWheel>` mount origin (`y = radius + travel - sag`). */
  readonly mountPos: Vec3;
  readonly radius: number;
  readonly width: number;
  readonly travel: number;
  readonly sag: number;
  readonly steer: boolean;
  readonly drive: boolean;
  readonly brake: boolean;
  readonly ecctrlWheel: Record<string, unknown>;
}

export interface CarNode {
  name: string;
  /** "root", "Chassis", or the hinged part that carries this panel collider. */
  parent: string;
  /** Node origin in its parent frame: the hinge for articulated parts, the box/wheel centre otherwise. */
  position: Vec3;
  /** Visual/collider bounding box size `[x, y, z]`. */
  size: Vec3;
  colliderOffset: Vec3;
}

export interface KhrExportNodeSpecLike {
  nodeName: string;
  motion?: { isKinematic?: boolean; mass?: number; centerOfMass?: Vec3; inertiaDiagonal?: Vec3; inertiaOrientation?: [number, number, number, number] };
  collider?: { shape: { type: "box"; size: Vec3 }; friction?: number };
  joint?: {
    connectedNodeName: string;
    kind: "revolute";
    axis: Vec3;
    limits: [number, number];
    drive: { mode: "acceleration"; stiffness: number; damping: number; positionTarget: number };
  };
  extras?: Record<string, unknown>;
}

export interface CarPlan {
  recipeId: string;
  parts: CarPart[];
  /** Whole car, every part included: the number a scale would read (wheels excluded). */
  total: MassProps;
  /** The `Chassis` body: fixed parts only. */
  chassis: MassProps;
  wheels: PlannedWheel[];
  tune: CarTune;
  /** Pass directly as the 3rd argument (`sceneExtras`) to `@khr3/core` `exportKhrGlb(root, plan.specs, plan.sceneExtras)`. */
  sceneExtras: { tune: CarTune };
  nodes: CarNode[];
  specs: KhrExportNodeSpecLike[];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function assertWheelSpec(w: WheelSpec): void {
  if (!(Number.isFinite(w.radius) && w.radius > 0)) throw new RangeError("carKhr: wheels.radius must be > 0");
  if (!(Number.isFinite(w.width) && w.width > 0)) throw new RangeError("carKhr: wheels.width must be > 0");
  if (!(Number.isFinite(w.travel) && w.travel >= 0)) throw new RangeError("carKhr: wheels.travel must be >= 0");
  if (!(Number.isFinite(w.sag) && w.sag > 0 && w.sag <= w.travel)) {
    throw new RangeError(`carKhr: wheels.sag (${w.sag}) must be in (0, travel=${w.travel}]`);
  }
}

export function buildPlannedWheels(recipe: CarRecipe): PlannedWheel[] {
  const w: WheelSpec = recipe.wheels ?? DEFAULT_WHEEL_SPEC;
  assertWheelSpec(w);
  const { front: zF, rear: zR } = axleZ(recipe.dims);
  const xTrack = (recipe.dims.width - w.width) / 2;
  const layout = w.driveLayout ?? "rwd";
  const frontDrive = layout === "fwd" || layout === "awd";
  const rearDrive = layout === "rwd" || layout === "awd";
  const lift = w.travel - w.sag;
  const slots: Array<{ nodeName: WheelNodeName; x: number; z: number; steer: boolean; drive: boolean }> = [
    { nodeName: "Wheel_FL", x: xTrack, z: zF, steer: true, drive: frontDrive },
    { nodeName: "Wheel_FR", x: -xTrack, z: zF, steer: true, drive: frontDrive },
    { nodeName: "Wheel_RL", x: xTrack, z: zR, steer: false, drive: rearDrive },
    { nodeName: "Wheel_RR", x: -xTrack, z: zR, steer: false, drive: rearDrive },
  ];
  return slots.map((s) => {
    const position: Vec3 = [s.x, w.radius, s.z];
    const mountPos: Vec3 = [s.x, w.radius + lift, s.z];
    const ecctrlWheel: Record<string, unknown> = {
      radius: w.radius,
      width: w.width,
      travel: w.travel,
      sag: w.sag,
      steer: s.steer,
      drive: s.drive,
      brake: true,
      ...(w.springK !== undefined ? { springK: w.springK } : {}),
      ...(w.dampingC !== undefined ? { dampingC: w.dampingC } : {}),
      ...(w.maxBrakeTorque !== undefined ? { maxBrakeTorque: w.maxBrakeTorque } : {}),
      ...(w.rollingResistanceCoef !== undefined ? { rollingResistanceCoef: w.rollingResistanceCoef } : {}),
      ...(w.wheelDensity !== undefined ? { wheelDensity: w.wheelDensity } : {}),
      ...(w.tireGripFactor !== undefined ? { tireGripFactor: w.tireGripFactor } : {}),
      ...(w.latFrictionEllipseScale !== undefined ? { latFrictionEllipseScale: w.latFrictionEllipseScale } : {}),
      ...(w.relaxLngRate !== undefined ? { relaxLngRate: w.relaxLngRate } : {}),
      ...(w.relaxLatRate !== undefined ? { relaxLatRate: w.relaxLatRate } : {}),
    };
    return {
      nodeName: s.nodeName,
      position,
      mountPos,
      radius: w.radius,
      width: w.width,
      travel: w.travel,
      sag: w.sag,
      steer: s.steer,
      drive: s.drive,
      brake: true,
      ecctrlWheel,
    };
  });
}

export function planCar(recipe: CarRecipe, friction = 0.6): CarPlan {
  const parts = buildCarParts(recipe);
  const fixed = parts.filter((p) => !p.hinge);
  const moving = parts.filter((p) => p.hinge);
  const total = sumMass(parts);
  const chassis = sumMass(fixed);
  const wheels = buildPlannedWheels(recipe);
  const tune: CarTune = recipe.tune ?? DEFAULT_CAR_TUNE;
  const nodes: CarNode[] = [{ name: "Chassis", parent: "root", position: [0, 0, 0], size: [0, 0, 0], colliderOffset: [0, 0, 0] }];
  const principal = principalAboutX(chassis);
  const specs: KhrExportNodeSpecLike[] = [{
    nodeName: "Chassis",
    motion: { isKinematic: false, mass: chassis.massKg, centerOfMass: chassis.centerOfMass, ...principal },
    extras: { role: "chassis", carRecipe: recipe.id },
  }];
  for (const p of fixed) {
    nodes.push({ name: p.name, parent: "Chassis", position: p.center, size: p.size, colliderOffset: [0, 0, 0] });
    specs.push({ nodeName: p.name, collider: { shape: { type: "box", size: p.size }, friction }, extras: { role: p.kind } });
  }
  for (const p of moving) {
    const h = p.hinge!;
    const local = sub(p.center, h.anchor);
    const own = sumMass([{ massKg: p.massKg, center: local, size: p.size }]);
    nodes.push({ name: p.name, parent: "Chassis", position: h.anchor, size: [0, 0, 0], colliderOffset: [0, 0, 0] });
    nodes.push({ name: `${p.name}_Panel`, parent: p.name, position: local, size: p.size, colliderOffset: [0, 0, 0] });
    specs.push({ nodeName: `${p.name}_Panel`, collider: { shape: { type: "box", size: p.size }, friction } });
    specs.push({
      nodeName: p.name,
      motion: { isKinematic: false, mass: p.massKg, centerOfMass: own.centerOfMass, inertiaDiagonal: own.inertiaDiagonal },
      joint: {
        connectedNodeName: "Chassis",
        kind: "revolute",
        axis: h.axis,
        limits: h.limits,
        drive: { mode: "acceleration", stiffness: PANEL_DRIVE.stiffness, damping: PANEL_DRIVE.damping, positionTarget: 0 },
      },
      extras: { role: p.kind === "door" ? p.name.toLowerCase() : p.kind },
    });
  }
  for (const w of wheels) {
    const d = w.radius * 2;
    nodes.push({ name: w.nodeName, parent: "root", position: w.position, size: [w.width, d, d], colliderOffset: [0, 0, 0] });
    specs.push({ nodeName: w.nodeName, extras: { role: "wheel", ecctrlWheel: w.ecctrlWheel } });
  }
  return { recipeId: recipe.id, parts, total, chassis, wheels, tune, sceneExtras: { tune }, nodes, specs };
}
