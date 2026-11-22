# `@khr3/cars` Spec: every ecctrl2 + KHR car, in one place

Status: **catalog + spec**. The `<Car>` component and the merged importer are not built yet. Not published.

## 1. Where the cars are (2026-11-22)

| Vehicle | Kind | R2 (`khr3.optimuspi.workers.dev`) | `PMNDRS-Engine/fixtures/` | `Kolmo/public/fleet/` |
| --- | --- | --- | --- | --- |
| `kolmogorov_hatchback` | car | `cars/` ✅ | ✅ | — |
| `lexus_is300` (20 MB) | car | `cars/` ✅ | ✅ | ✅ |
| `nissan_silvia_s15` | car | ❌ | — | ✅ |
| `nissan_skyline_r34` | car | ❌ | — | ✅ |
| `toyota_supra_a80` | car | ❌ | — | ✅ |
| `crotch_rocket` | motorcycle | ❌ (target `bikes/`) | — | ✅ |
| `starfox_rocket` | starcraft | ❌ (target `craft/`) | — | ✅ |

- **Source meshes:** `~/Documents/hf-buckets-pull/objaverse-car-models-240` (240 cars, 86 unique models).
- **Kolmo fleet catalog:** `~/Documents/hf-buckets-pull/kolmo_catalog.json`.

The same table is `FLEET` in `src/index.ts`, and the tests keep it honest.

## 2. Layer line

| Layer | Package | Status |
| --- | --- | --- |
| Runtime: `.glb` to `<EcctrlVehicle>` + `<ShapeCastWheel>` + `<ThrustPropeller>` | `@khr3/core/vehicle` `<KhrVehicle>` | **Done.** Do not rebuild it here. |
| Curves: Pacejka, torque, steer LUTs | `@khr3/core/curves` | Done, except `heavy6x6AntiRollover` (missing). |
| Catalog, R2 addressing, recipes, importer pipeline | **`@khr3/cars`** (this package) | Started |
| Game: seats, telemetry, HUD | Kolmo / game layer | Kolmo already mounts `KhrVehicle` (`src/engine/kolmoVehicle.tsx:7`), so it needs no re-wiring. |

`PMNDRS-Engine/site/DriveArena.tsx` also mounts `KhrVehicle` inside `<PhysicsWorld>`. Both consumers already sit on the same runtime, so the migration is about **data and importers**, not the vehicle code.

## 3. What moves in

1. **Recipes.** Move these from `Kolmo/scripts/fleetSpecs.mts` into `src/recipes/`:
   - `JdmCarSpec` (mass, drive type, hp, max RPM, turns, length)
   - `buildJdmTune`, `buildWheeledKhrSpecs`
   - `CROTCH_ROCKET_*`, `STARFOX_*`

   Keep the Kolmo-specific `KOLMO_emitter` patches in Kolmo.
2. **One importer pipeline from three:**
   - `PMNDRS-Engine/site/gate/` (`meshIslands.ts`, `carRig.ts`, `gateBake.ts`): browser wizard.
   - `PMNDRS-Engine/scripts/import-car.mjs`: CLI.
   - `Kolmo/scripts/whip-hf-fleet.mts` + `Kolmo/src/importer/`: batch whipper.

   Target: `importCar(bytes, recipe) -> ArrayBuffer`. The steps are Orient (+Y up, +Z fwd), then SI scale `[1,1,1]`, then pop wheel islands, then tag `ecctrlWheel`, then `scene.extras.tune`, then `exportKhrGlb`. Pure, headless, and shared by the CLI and the browser.
3. **`<Car id base>`.** Resolve the URL with `carUrl(base, id)`, then `useKhrGlb`, then `<KhrVehicle bundle carConfig>`. It is about 30 lines.
4. **Per-car research.** 84 of 86 per-car tire, torque and steer LUTs are not run yet. Each result becomes a recipe file.

## 4. Upload rule

Before any `npm run upload:r2` of fleet cars:
- Load each `.glb` headless through `loadKhrGlb`. It must not throw, must have identity scale, and drive wheels must have `engineHorsepower`.
- Upload with the prefix from `R2_PREFIX`: `cars/`, `bikes/`, `craft/`.

`scripts/upload-r2.mjs` rewrites `manifest.json`, so check the categories afterwards.

## 5. Done means these tests fail before and pass after

1. The catalog is unique, each prefix is correct, and it matches the live manifest (`src/cars.test.ts`). **Done.**
2. Every `FLEET` entry marked `r2` returns 200 with `Content-Type: model/gltf-binary`.
3. Every fleet `.glb` loads through `loadKhrGlb` with no `KhrValidationError`.
4. `importCar` reproduces `fixtures/lexus_is300.glb` wheel tags within 1 mm from the raw source.
5. In a headless `<PhysicsWorld>`, each car settles on flat ground within 1 s with all four wheels in contact, and 1 s of `forward` moves it toward +Z (steering-direction guard).
