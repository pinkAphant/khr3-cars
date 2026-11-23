import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import { exportKhrGlb, loadKhrGlb, type KhrExportNodeSpec } from "@khr3/core";
import { solveWheelLoads } from "@khr3/core/vehicle";
import { COUPE_2DOOR, SEDAN_4DOOR, planCar, type CarPlan } from "../src/index.js";

function sceneFor(plan: CarPlan): THREE.Group {
  const root = new THREE.Group();
  const byName = new Map<string, THREE.Object3D>();
  for (const n of plan.nodes) {
    const obj = n.size.every((v) => v > 0)
      ? new THREE.Mesh(new THREE.BoxGeometry(...n.size), new THREE.MeshStandardMaterial())
      : new THREE.Group();
    obj.name = n.name;
    obj.position.set(...n.position);
    (n.parent === "root" ? root : byName.get(n.parent)!).add(obj);
    byName.set(n.name, obj);
  }
  root.updateMatrixWorld(true);
  return root;
}

describe("@khr3/cars bodies round-trip through @khr3/core .glb", () => {
  for (const recipe of [SEDAN_4DOOR, COUPE_2DOOR]) {
    it(`${recipe.id}: exportKhrGlb -> loadKhrGlb keeps mass, doors, limits, wheels & tune`, async () => {
      const plan = planCar(recipe);
      const glb = await exportKhrGlb(
        sceneFor(plan),
        plan.specs as unknown as KhrExportNodeSpec[],
        plan.sceneExtras as unknown as Record<string, unknown>,
      );
      const bundle = await loadKhrGlb(glb);
      const chassis = bundle.bodies.find((b) => b.nodeName === "Chassis");
      assert.ok(chassis, `bodies: ${bundle.bodies.map((b) => b.nodeName).join(",")}`);
      assert.equal(chassis.isKinematic, false);
      assert.ok(Math.abs(chassis.mass - plan.chassis.massKg) < 1e-3, `chassis mass ${chassis.mass}`);
      assert.ok(Math.abs(bundle.totalDynamicMass - plan.total.massKg) < 1e-2, `total ${bundle.totalDynamicMass} vs ${plan.total.massKg}`);
      const hinged = plan.specs.filter((s) => s.joint);
      for (const s of hinged) {
        const body = bundle.bodies.find((b) => b.nodeName === s.nodeName);
        assert.ok(body?.joint, `${s.nodeName} lost its joint`);
        assert.equal(body.joint.kind, "revolute");
        assert.equal(body.joint.connectedNodeName, "Chassis");
        assert.ok(body.joint.limits, `${s.nodeName} lost its limits`);
        assert.ok(Math.abs(body.joint.limits[0] - s.joint!.limits[0]) < 1e-5 && Math.abs(body.joint.limits[1] - s.joint!.limits[1]) < 1e-5);
        assert.ok((body.joint.drive?.stiffness ?? 0) > 0, `${s.nodeName} drive`);
        assert.ok(body.colliders.length + chassis.colliders.length > 0);
      }
      const doors = hinged.filter((s) => s.nodeName.startsWith("Door_")).map((s) => s.nodeName).sort();
      assert.deepEqual(doors, recipe.doors === 4 ? ["Door_FL", "Door_FR", "Door_RL", "Door_RR"] : ["Door_FL", "Door_FR"]);

      assert.equal(bundle.wheels.length, 4);
      const solved = solveWheelLoads(bundle.wheels, bundle.totalDynamicMass, bundle.centerOfMass);
      assert.equal(solved.length, 4);
      const sumCornerMass = solved.reduce((acc, w) => acc + w.cornerMassKg, 0);
      assert.ok(Math.abs(sumCornerMass - bundle.totalDynamicMass) < 1e-3);
      for (const sw of solved) {
        const pw = plan.wheels.find((w) => w.nodeName === sw.tag.nodeName)!;
        assert.ok(Math.abs(sw.mountPos[1] - pw.mountPos[1]) < 1e-5, `${sw.tag.nodeName} mountY ${sw.mountPos[1]} !== ${pw.mountPos[1]}`);
        assert.ok(sw.springK > 0 && sw.dampingC > 0);
      }
      assert.equal(bundle.tune?.engineHorsepower, plan.tune.engineHorsepower);
      assert.equal(bundle.tune?.rollCenterHeight, plan.tune.rollCenterHeight);
      assert.equal(bundle.tune?.antiRollStiffness, plan.tune.antiRollStiffness);
    });
  }
});
