/**
 * Turn a parametric car into the node plan and `KhrExportNodeSpec[]` that `@khr3/core` `exportKhrGlb` consumes.
 * Fixed parts are lumped into the `Chassis` body; articulated parts keep their own mass and a revolute joint to `Chassis`.
 * The spec shape is a structural copy of `@khr3/core` `KhrExportNodeSpec`, so this package stays dependency-free.
 */
import { buildCarParts, type CarPart, type CarRecipe } from "./carParts.js";
import { principalAboutX, sumMass, type MassProps, type Vec3 } from "./massProps.js";

export interface DoorDrive {
  readonly stiffness: number;
  readonly damping: number;
}

/** Authored drive gains for hinged panels (used by `setJointTarget` / `setRoleTarget`). */
export const PANEL_DRIVE: DoorDrive = Object.freeze({ stiffness: 60, damping: 12 });

export interface CarNode {
  name: string;
  parent: "root" | "Chassis";
  /** Node origin in its parent frame: the hinge for articulated parts, the box centre otherwise. */
  position: Vec3;
  /** Box collider size, centred `colliderOffset` from the node origin. */
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
  nodes: CarNode[];
  specs: KhrExportNodeSpecLike[];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export function planCar(recipe: CarRecipe, friction = 0.6): CarPlan {
  const parts = buildCarParts(recipe);
  const fixed = parts.filter((p) => !p.hinge);
  const moving = parts.filter((p) => p.hinge);
  const total = sumMass(parts);
  const chassis = sumMass(fixed);
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
    nodes.push({ name: p.name, parent: "Chassis", position: h.anchor, size: p.size, colliderOffset: local });
    specs.push({
      nodeName: p.name,
      motion: { isKinematic: false, mass: p.massKg, centerOfMass: own.centerOfMass, inertiaDiagonal: own.inertiaDiagonal },
      collider: { shape: { type: "box", size: p.size }, friction },
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
  return { recipeId: recipe.id, parts, total, chassis, nodes, specs };
}
