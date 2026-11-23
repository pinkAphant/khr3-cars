# `@khr3/cars` API and Configuration Guide

`@khr3/cars` provides parametric multi-body car planning, exact parallel-axis mass and principal inertia solvers, `solveWheelLoads`-compatible `Wheel_*` mount planning, `KHR_physics_rigid_bodies` / `OMI_vehicle_wheel` / `KHR3_socket_breakaway` / `KHR3_vfx_emitter` paper-shell manifold synthesis, and the R2 vehicle catalog.

---

## Import Paths

```ts
import {
  FLEET,
  R2_PREFIX,
  findCar,
  carUrl,
  pendingUpload,
  SEDAN_4DOOR,
  COUPE_2DOOR,
  BODY_RECIPES,
  buildCarParts,
  buildPlannedWheels,
  planCar,
  boxInertia,
  sumMass,
  principalAboutX,
  tensorFromPrincipal,
} from "@khr3/cars";

import {
  PAPER_SHELL_PRESETS,
  buildStationLattice,
  buildPaperShellAssembly,
  computePanelIntrinsics,
  solveJacobiPrincipalInertia,
  PaperShellMassMemo,
  exportPaperShellKhrGlb,
} from "@khr3/cars/paper-shell";
```

---

## Package Exports

| Path | Main exports |
| --- | --- |
| `@khr3/cars` | `FLEET`, `findCar`, `carUrl`, `SEDAN_4DOOR`, `COUPE_2DOOR`, `buildCarParts`, `buildPlannedWheels`, `planCar`, `sumMass`, `principalAboutX` |
| `@khr3/cars/paper-shell` | `PAPER_SHELL_PRESETS`, `buildStationLattice`, `buildPaperShellAssembly`, `PaperShellMassMemo`, `solveJacobiPrincipalInertia`, `exportPaperShellKhrGlb` |

---

## Wheel Mount & `solveWheelLoads` Contract

- Every `Wheel_*` (`Wheel_FL`, `Wheel_FR`, `Wheel_RL`, `Wheel_RR`) node is placed at the **static ride-height wheel center** (`y = radius` above ground `y = 0`).
- `buildPlannedWheels(recipe)` computes:
  - `xTrack = ±(dims.width - wheels.width) / 2`
  - `zFront = dims.length / 2 - dims.frontOverhang`, `zRear = zFront - dims.wheelbase`
  - `position = [xTrack, wheels.radius, zAxle]`
  - `mountPos = [xTrack, wheels.radius + (wheels.travel - wheels.sag), zAxle]`
- Pass `plan.specs` and `plan.sceneExtras` (`{ tune: plan.tune }`) directly to `@khr3/core` `exportKhrGlb(root, plan.specs, plan.sceneExtras)`.

---

## Interactive 2-Step GLB Gate & Drop/Drive Example (`example/`)

Run the interactive 2-Step Calibration Bay + Live Rapier/EcctrlVehicle Drop & Breakaway Pad:

```bash
npm run dev
npm run build:example
```
