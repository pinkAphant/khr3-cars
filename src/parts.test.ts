import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCarParts, COUPE_2DOOR, offDiagonalRatio, planCar, SEDAN_4DOOR, sumMass, boxInertia, tensorFromPrincipal } from "./index.js";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);
const names = (r: typeof SEDAN_4DOOR) => buildCarParts(r).map((p) => p.name).sort();

describe("@khr3/cars mass from pieces", () => {
  it("matches the textbook solid box", () => {
    const [ix, iy, iz] = boxInertia(12, [1, 2, 3]);
    near(ix, 13); near(iy, 10); near(iz, 5);
  });

  it("applies the parallel-axis theorem", () => {
    const p = sumMass([
      { massKg: 1, center: [1, 0, 0], size: [1e-6, 1e-6, 1e-6] },
      { massKg: 1, center: [-1, 0, 0], size: [1e-6, 1e-6, 1e-6] },
    ]);
    near(p.massKg, 2); near(p.centerOfMass[0], 0);
    near(p.inertiaDiagonal[1], 2, 1e-9); near(p.inertiaDiagonal[0], 0, 1e-9);
  });

  it("throws on a massless or degenerate piece", () => {
    assert.throws(() => sumMass([{ massKg: 0, center: [0, 0, 0], size: [1, 1, 1] }]), RangeError);
    assert.throws(() => sumMass([{ massKg: 1, center: [0, 0, 0], size: [1, 0, 1] }]), RangeError);
  });
});

describe("@khr3/cars 4-door and 2-door bodies", () => {
  it("a 4-door has four doors including the driver-side rear door, split by B-pillars", () => {
    const n = names(SEDAN_4DOOR);
    for (const k of ["Door_FL", "Door_FR", "Door_RL", "Door_RR", "Pillar_B_L", "Pillar_B_R"]) assert.ok(n.includes(k), k);
    const parts = buildCarParts(SEDAN_4DOOR);
    const get = (k: string) => parts.find((p) => p.name === k)!;
    const fl = get("Door_FL"), rl = get("Door_RL"), b = get("Pillar_B_L");
    assert.ok(fl.center[0] > 0 && rl.center[0] > 0, "driver side is +X (left, LHD)");
    near(fl.center[2] - fl.size[2] / 2, b.center[2] + b.size[2] / 2, 1e-9);
    near(rl.center[2] + rl.size[2] / 2, b.center[2] - b.size[2] / 2, 1e-9);
  });

  it("a 2-door has no rear doors and fixed quarter panels", () => {
    const n = names(COUPE_2DOOR);
    assert.ok(!n.includes("Door_RL") && !n.includes("Door_RR"));
    for (const k of ["Door_FL", "Door_FR", "Pillar_B_L", "Quarter_L", "Quarter_R"]) assert.ok(n.includes(k), k);
  });

  it("left doors open toward +X, right doors toward -X", () => {
    for (const p of buildCarParts(SEDAN_4DOOR).filter((q) => q.kind === "door")) {
      const [lo, hi] = p.hinge!.limits;
      const theta = p.center[0] > 0 ? lo : hi;
      const rearEdgeX = -p.size[2] * Math.sin(theta);
      assert.ok(Math.sign(rearEdgeX) === Math.sign(p.center[0]), p.name);
    }
  });

  it("the car's mass is exactly the sum of its pieces, and chassis + panels adds back up", () => {
    for (const r of [SEDAN_4DOOR, COUPE_2DOOR]) {
      const plan = planCar(r);
      const sum = plan.parts.reduce((s, p) => s + p.massKg, 0);
      near(plan.total.massKg, sum);
      const panels = plan.specs.filter((s) => s.joint).reduce((s, x) => s + x.motion!.mass!, 0);
      near(plan.chassis.massKg + panels, sum);
    }
  });

  it("is left/right symmetric: Ixy = Ixz = 0, CoM on the centreline", () => {
    const t = planCar(SEDAN_4DOOR).total;
    near(t.centerOfMass[0], 0, 1e-9);
    near(t.tensor[1], 0, 1e-9); near(t.tensor[2], 0, 1e-9);
    assert.ok(offDiagonalRatio(t) > 0, "pitch coupling (Iyz) is real and must not be dropped");
  });

  it("solves principal axes exactly and emits inertiaOrientation", () => {
    for (const r of [SEDAN_4DOOR, COUPE_2DOOR]) {
      const plan = planCar(r);
      const m = plan.specs[0].motion!;
      const back = tensorFromPrincipal({ inertiaDiagonal: m.inertiaDiagonal!, inertiaOrientation: m.inertiaOrientation! });
      plan.chassis.tensor.forEach((v, i) => near(back[i], v, 1e-6 * plan.chassis.inertiaDiagonal[0]));
      assert.ok(m.inertiaDiagonal!.every((v) => v > 0));
    }
  });

  it("emits KHR specs: one dynamic Chassis, hinged panels with drives and limits, plus 4 Wheel_* mounts and tune", () => {
    const plan = planCar(SEDAN_4DOOR);
    const chassis = plan.specs.filter((s) => s.nodeName === "Chassis");
    assert.equal(chassis.length, 1);
    assert.equal(chassis[0].motion!.isKinematic, false);
    const jointed = plan.specs.filter((s) => s.joint).map((s) => s.nodeName).sort();
    assert.deepEqual(jointed, ["Door_FL", "Door_FR", "Door_RL", "Door_RR", "Hood", "Trunk"]);
    for (const s of plan.specs.filter((x) => x.joint)) {
      assert.ok(s.joint!.drive.stiffness > 0 && s.joint!.limits[0] < s.joint!.limits[1], s.nodeName);
    }
    assert.equal(plan.wheels.length, 4);
    const fl = plan.wheels.find((w) => w.nodeName === "Wheel_FL")!;
    const rl = plan.wheels.find((w) => w.nodeName === "Wheel_RL")!;
    near(fl.position[0], 0.78);
    near(fl.position[1], 0.33);
    near(fl.position[2], 1.35);
    near(fl.mountPos[1], 0.47);
    near(rl.position[2], -1.35);
    assert.equal(fl.steer, true);
    assert.equal(fl.drive, false);
    assert.equal(rl.steer, false);
    assert.equal(rl.drive, true);
    assert.equal(plan.tune.rollCenterHeight, 0.25);
    assert.equal(plan.tune.antiRollStiffness, 2500);
    assert.deepEqual(plan.sceneExtras, { tune: plan.tune });
  });

  it("paper-shell builds 27 watertight panels, Jacobi principal inertia, and KHR/OMI/KHR3 binary GLB", async () => {
    const { buildPaperShellAssembly, PaperShellMassMemo, exportPaperShellKhrGlb, ALL_PANELS_ATTACHED_MASK } = await import("./paper-shell.js");
    const assembly = buildPaperShellAssembly("coupe_86", "psx-flat");
    assert.equal(assembly.panels.length, 27);
    assert.ok(assembly.totalTriangles >= 400 && assembly.totalTriangles <= 900, `tris=${assembly.totalTriangles}`);
    const memo = new PaperShellMassMemo(assembly);
    const s0 = memo.evaluate(ALL_PANELS_ATTACHED_MASK, 42);
    const s0Cached = memo.evaluate(ALL_PANELS_ATTACHED_MASK, 42.1); // within 0.5 kg bucket
    assert.equal(s0, s0Cached, "memoized within 0.5 kg fuel bucket");
    const hoodBit = assembly.panels.find((p) => p.partId === "hood")!.bitIndex;
    const sNoHood = memo.evaluate(ALL_PANELS_ATTACHED_MASK & ~(1 << hoodBit), 42);
    assert.ok(sNoHood.totalMassKg < s0.totalMassKg);
    const { glb } = await exportPaperShellKhrGlb(assembly);
    assert.equal(new DataView(glb.buffer, glb.byteOffset, glb.byteLength).getUint32(0, true), 0x46546c67);
  });
});
