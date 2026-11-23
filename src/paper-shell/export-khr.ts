import { Document, Extension, ExtensionProperty, WebIO } from "@gltf-transform/core";
import { ALL_PANELS_ATTACHED_MASK, PaperShellMassMemo, type CompositeMassState } from "./mass-com.js";
import type { PaperShellAssembly } from "./panels.js";
import type { KhrImplicitShape, KhrNodePhysics, KhrPhysicsJointDesc } from "./schema.js";

const EXT_NAMES = [
  "KHR_implicit_shapes", "KHR_physics_rigid_bodies", "KHR_lights_punctual",
  "OMI_vehicle_wheel", "KHR3_vfx_emitter", "KHR3_socket_breakaway",
] as const;

class PassthroughProp extends ExtensionProperty {
  static EXTENSION_NAME = "KHR3_passthrough";
  declare extensionName: string;
  declare propertyType: string;
  declare parentTypes: string[];
  protected init(): void {
    this.extensionName = "KHR3_passthrough";
    this.propertyType = "Passthrough";
    this.parentTypes = ["Node", "Root"];
  }
}

const makeExt = (name: string): typeof Extension & (new (doc: Document) => Extension) =>
  class extends Extension {
    static readonly EXTENSION_NAME = name;
    readonly extensionName = name;
    read(): this { return this; }
    write(): this { return this; }
    createProp(): PassthroughProp { return new PassthroughProp(this.document.getGraph()); }
  };

function patchGlbExtensions(
  glb: Uint8Array,
  payload: {
    shapes: KhrImplicitShape[];
    physicsJoints: KhrPhysicsJointDesc[];
    lights: Record<string, unknown>[];
    wheels: Record<string, unknown>[];
    emitters: Record<string, unknown>[];
    nodeExt: Record<string, Record<string, any>>;
    nodeExtras: Record<string, Record<string, unknown>>;
  },
): Uint8Array {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLen = view.getUint32(12, true);
  const doc = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLen))) as Record<string, any>;
  const binChunk = glb.subarray(20 + jsonLen);

  doc.extensionsUsed = Array.from(new Set([...(doc.extensionsUsed ?? []), ...EXT_NAMES]));
  delete doc.extensionsRequired;
  doc.extensions = {
    ...(doc.extensions ?? {}),
    KHR_implicit_shapes: { shapes: payload.shapes },
    KHR_physics_rigid_bodies: {
      physicsMaterials: [{ staticFriction: 0.6, dynamicFriction: 0.55, restitution: 0.1 }],
      physicsJoints: payload.physicsJoints,
    },
    KHR_lights_punctual: { lights: payload.lights },
    OMI_vehicle_wheel: { wheels: payload.wheels },
    KHR3_vfx_emitter: { emitters: payload.emitters },
  };

  const nodes: Record<string, any>[] = doc.nodes ?? [];
  const rootIdx = Math.max(0, nodes.findIndex((n) => n.name === "chassis_skateboard"));
  for (const n of nodes) {
    const nm = n.name as string | undefined;
    if (!nm) continue;
    const ext = payload.nodeExt[nm];
    if (ext) {
      if (ext.KHR_physics_rigid_bodies?.joint) ext.KHR_physics_rigid_bodies.joint.connectedNode = rootIdx;
      n.extensions = { ...(n.extensions ?? {}), ...ext };
    }
    const xtr = payload.nodeExtras[nm];
    if (xtr) n.extras = { ...(n.extras ?? {}), ...xtr };
  }

  const encoded = new TextEncoder().encode(JSON.stringify(doc));
  const pad = (4 - (encoded.byteLength & 3)) & 3;
  const paddedJsonLen = encoded.byteLength + pad;
  const totalLen = 20 + paddedJsonLen + binChunk.byteLength;
  const out = new Uint8Array(totalLen);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, 0x46546c67, true);
  outView.setUint32(4, 2, true);
  outView.setUint32(8, totalLen, true);
  outView.setUint32(12, paddedJsonLen, true);
  outView.setUint32(16, 0x4e4f534a, true);
  out.set(encoded, 20);
  for (let i = 0; i < pad; i++) out[20 + encoded.byteLength + i] = 0x20;
  out.set(binChunk, 20 + paddedJsonLen);
  return out;
}

export async function exportPaperShellKhrGlb(
  assembly: PaperShellAssembly,
  attachedMask = ALL_PANELS_ATTACHED_MASK,
  fuelLiters = assembly.lattice.preset.defaultFuelLiters,
): Promise<{ glb: Uint8Array; massState: CompositeMassState }> {
  const memo = new PaperShellMassMemo(assembly);
  const massState = memo.evaluate(attachedMask, fuelLiters);
  const intrinsics = memo.getPanelIntrinsics();

  const doc = new Document();
  const extClasses = EXT_NAMES.map((n) => makeExt(n));
  extClasses.forEach((cls) => doc.createExtension(cls));
  const buf = doc.createBuffer("paper_shell_bin");
  const scene = doc.createScene("paper_shell_scene");

  const makeMesh = (name: string, pos: Float32Array, nrm: Float32Array, colorHex: number, isGlass = false) => {
    const r = ((colorHex >> 16) & 0xff) / 255, g = ((colorHex >> 8) & 0xff) / 255, b = (colorHex & 0xff) / 255;
    const mat = doc.createMaterial(`${name}_mat`)
      .setBaseColorFactor([r, g, b, isGlass ? 0.32 : 1.0])
      .setRoughnessFactor(isGlass ? 0.15 : 0.88)
      .setMetallicFactor(0.05)
      .setAlphaMode(isGlass ? "BLEND" : "OPAQUE");
    const posAcc = doc.createAccessor(`${name}_pos`).setType("VEC3").setArray(pos).setBuffer(buf);
    const nrmAcc = doc.createAccessor(`${name}_nrm`).setType("VEC3").setArray(nrm).setBuffer(buf);
    return doc.createMesh(name).addPrimitive(doc.createPrimitive().setMaterial(mat).setAttribute("POSITION", posAcc).setAttribute("NORMAL", nrmAcc));
  };

  const rootNode = doc.createNode("chassis_skateboard")
    .setMesh(makeMesh("chassis_skateboard", assembly.skateboardPositions, assembly.skateboardNormals, 0x23282d));
  scene.addChild(rootNode);
  rootNode.addChild(doc.createNode("chassis_skateboard_collider").setTranslation(assembly.skateboardBoxCenter));

  const shapes: KhrImplicitShape[] = [{ type: "box", box: { size: assembly.skateboardBoxSize } }];
  const physicsJoints: KhrPhysicsJointDesc[] = [];
  const nodeExt: Record<string, Record<string, any>> = {
    chassis_skateboard: {
      KHR_physics_rigid_bodies: {
        motion: {
          isKinematic: false,
          mass: massState.totalMassKg,
          centerOfMass: massState.centerOfMass,
          inertiaDiagonal: massState.inertiaDiagonal,
          inertiaOrientation: massState.inertiaOrientation,
        },
      } satisfies KhrNodePhysics,
    },
    chassis_skateboard_collider: {
      KHR_physics_rigid_bodies: { collider: { geometry: { shape: 0 }, physicsMaterial: 0 } } satisfies KhrNodePhysics,
    },
  };
  const nodeExtras: Record<string, Record<string, unknown>> = {
    chassis_skateboard: { role: "chassis", presetId: assembly.lattice.preset.id },
  };

  for (let i = 0; i < assembly.panels.length; i++) {
    const p = assembly.panels[i];
    if ((attachedMask & (1 << p.bitIndex)) === 0) continue;
    rootNode.addChild(
      doc.createNode(p.partId).setTranslation(p.anchorChassis).setMesh(makeMesh(p.partId, p.localPositions, p.localNormals, p.colorHex, p.isGlass)),
    );
    const sIdx = shapes.length;
    shapes.push({ type: "box", box: { size: p.aabbSize } });
    const khrPhys: KhrNodePhysics = { collider: { geometry: { shape: sIdx }, physicsMaterial: 0 } };
    if (p.breakaway.hingeAxisLocal && p.breakaway.swingMinMaxRad) {
      const ax: 0 | 1 | 2 = Math.abs(p.breakaway.hingeAxisLocal[0]) > 0.5 ? 0 : 1;
      const locked: (0 | 1 | 2)[] = ax === 0 ? [1, 2] : [0, 2];
      const jIdx = physicsJoints.length;
      physicsJoints.push({
        limits: [
          { linearAxes: [0, 1, 2], min: 0, max: 0 },
          { angularAxes: locked, min: 0, max: 0 },
          { angularAxes: [ax], min: p.breakaway.swingMinMaxRad[0], max: p.breakaway.swingMinMaxRad[1] },
        ],
        drives: [{ type: "angular", mode: "acceleration", axis: ax, positionTarget: 0, stiffness: 60, damping: 12 }],
      });
      khrPhys.motion = { isKinematic: false, mass: intrinsics[i].massKg, centerOfMass: [0, 0, 0] };
      khrPhys.joint = { connectedNode: 0, joint: jIdx, enableCollision: false };
    }
    nodeExt[p.partId] = { KHR_physics_rigid_bodies: khrPhys, KHR3_socket_breakaway: p.breakaway };
    nodeExtras[p.partId] = { role: p.partId };
  }

  const wheels: Record<string, unknown>[] = [];
  for (const w of assembly.wheels) {
    scene.addChild(doc.createNode(w.slotId).setTranslation(w.position).setMesh(makeMesh(w.slotId, w.positions, w.normals, 0x1c2229)));
    nodeExt[w.slotId] = { OMI_vehicle_wheel: { wheel: wheels.length } };
    wheels.push({ ...w.omi });
    nodeExtras[w.slotId] = {
      role: "wheel",
      ecctrlWheel: { radius: w.omi.radius, width: w.omi.width, travel: w.omi.suspensionTravel ?? 0.2, sag: 0.07, steer: w.omi.steering, drive: w.omi.propulsion, brake: true },
    };
  }

  const lights: Record<string, unknown>[] = [];
  for (const l of assembly.lights) {
    rootNode.addChild(doc.createNode(l.name).setTranslation(l.position).setRotation(l.quaternion));
    nodeExt[l.name] = { KHR_lights_punctual: { light: lights.length } };
    lights.push({ name: l.name, type: "spot", color: l.color, intensity: l.intensity, range: l.range, spot: { innerConeAngle: l.outerConeAngle * 0.65, outerConeAngle: l.outerConeAngle } });
  }

  const emitters: Record<string, unknown>[] = [];
  for (const e of assembly.emitters) {
    rootNode.addChild(doc.createNode(e.name).setTranslation(e.position).setRotation(e.quaternion));
    nodeExt[e.name] = { KHR3_vfx_emitter: { emitter: emitters.length, ...e.desc } };
    emitters.push({ ...e.desc });
  }

  const rawGlb = await new WebIO().registerExtensions(extClasses).writeBinary(doc);
  return {
    glb: patchGlbExtensions(rawGlb, { shapes, physicsJoints, lights, wheels, emitters, nodeExt, nodeExtras }),
    massState,
  };
}
