# @khr3/cars

Where every ecctrl2 + KHR car lives, how to address it on R2, and (soon) one import pipeline. The runtime is `@khr3/core/vehicle` `<KhrVehicle>`.

**Spec stage.** The catalog is built and tested. Read [SPEC.md](./SPEC.md).

```ts
import { carUrl, pendingUpload } from "@khr3/cars";
carUrl("https://khr3.optimuspi.workers.dev", "lexus_is300");
pendingUpload(); // S15, R34, Supra, bike, craft
```

## Define a car from its parts

This works like the Armory, but for cars. A car is a list of named parts, each with its own box and its own authored mass. Mass, centre of mass and the full inertia tensor (principal axes plus `inertiaOrientation`) are summed from the pieces.

- **4-door:** `Door_FL`, `Door_FR`, `Door_RL` (the driver-side rear door on a left-hand-drive car), `Door_RR`, with `Pillar_B_L` and `Pillar_B_R` separating the front and rear cabin.
- **2-door:** long front doors, B-pillars, fixed `Quarter_L` and `Quarter_R`.
- **Both:** a hinged hood and trunk, plus tub, roof, engine, gearbox, seats and tank.

```ts
import { planCar, SEDAN_4DOOR } from "@khr3/cars";
const plan = planCar(SEDAN_4DOOR);
plan.total.massKg;   // the sum of every piece
plan.specs;          // KhrExportNodeSpec[] for @khr3/core exportKhrGlb: Chassis + hinged panels with limits and drives
```
