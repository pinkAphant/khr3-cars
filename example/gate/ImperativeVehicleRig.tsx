import { useFrame } from "@react-three/fiber";
import {
  CuboidCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRevoluteJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PaperShellMassMemo, type PanelMeshData, type PaperShellAssembly } from "../../src/paper-shell.js";
import { EcctrlVehicle, ShapeCastWheel, type EcctrlVehicleHandle } from "../shims/ecctrl-compat.js";
import {
  DAMP_ZETA, FREQ_HZ, attachedMaskSignal, dampBucketSignal, detachedDebrisSignal,
  dropTriggerSignal, freqBucketSignal, fuelLitersSignal, massDirtySignal, sparkBurstSignal,
  telemetryComSignal, telemetryCornerKSignal, telemetryFrontSplitSignal, telemetryMassKgSignal,
  telemetryRpmSignal, telemetrySpeedKmhSignal, unlatchedMaskSignal, wrenchModeSignal,
} from "./gate-signals.js";
import { khrBoxToRapierHalfExtents } from "./glb-normalizer.js";

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _qA = new THREE.Quaternion();

function makeBufGeo(pos: Float32Array, nrm: Float32Array): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  return g;
}

function UnlatchedHingePanel({
  chassisBodyRef, panel, massKg, geometry, onWrenchHit,
}: {
  readonly chassisBodyRef: React.RefObject<RapierRigidBody | null>;
  readonly panel: PanelMeshData;
  readonly massKg: number;
  readonly geometry: THREE.BufferGeometry;
  readonly onWrenchHit: (panel: PanelMeshData) => void;
}) {
  const childRef = useRef<RapierRigidBody | null>(null);
  const axis = panel.breakaway.hingeAxisLocal ?? [1, 0, 0];
  const limits = panel.breakaway.swingMinMaxRad ?? [-1.1, 1.1];
  useRevoluteJoint(chassisBodyRef as React.RefObject<RapierRigidBody>, childRef as React.RefObject<RapierRigidBody>, [
    panel.anchorChassis, [0, 0, 0], axis, limits,
  ]);
  return (
    <RigidBody ref={childRef} position={panel.anchorChassis} mass={massKg} colliders={false} canSleep={false}>
      <CuboidCollider args={khrBoxToRapierHalfExtents(panel.aabbSize)} />
      <mesh geometry={geometry} onClick={(e) => { e.stopPropagation(); onWrenchHit(panel); }}>
        <meshStandardMaterial color={panel.colorHex} roughness={0.85} flatShading />
      </mesh>
    </RigidBody>
  );
}

export interface ImperativeVehicleRigProps {
  readonly assembly: PaperShellAssembly;
  readonly chassisGroupRef: React.RefObject<THREE.Group | null>;
}

export function ImperativeVehicleRig({ assembly, chassisGroupRef }: ImperativeVehicleRigProps) {
  const vehicleRef = useRef<EcctrlVehicleHandle | null>(null);
  const chassisRbRef = useRef<RapierRigidBody | null>(null);
  const lastDropRef = useRef(dropTriggerSignal.value);
  const keysRef = useRef({ w: false, s: false, a: false, d: false, space: false });
  const [, setMaskTick] = useState(0);

  const memo = useMemo(() => new PaperShellMassMemo(assembly), [assembly]);
  const intrinsics = useMemo(() => memo.getPanelIntrinsics(), [memo]);
  const panelGeos = useMemo(() => assembly.panels.map((p) => makeBufGeo(p.localPositions, p.localNormals)), [assembly]);
  const skateboardGeo = useMemo(() => makeBufGeo(assembly.skateboardPositions, assembly.skateboardNormals), [assembly]);
  const wheelGeo = useMemo(() => makeBufGeo(assembly.wheels[0].positions, assembly.wheels[0].normals), [assembly]);

  useEffect(() => {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "ArrowUp") keysRef.current.w = down;
      if (e.code === "KeyS" || e.code === "ArrowDown") keysRef.current.s = down;
      if (e.code === "KeyA" || e.code === "ArrowLeft") keysRef.current.a = down;
      if (e.code === "KeyD" || e.code === "ArrowRight") keysRef.current.d = down;
      if (e.code === "Space") keysRef.current.space = down;
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  const massState = memo.evaluate(attachedMaskSignal.value, fuelLitersSignal.value);
  const omega = 2 * Math.PI * FREQ_HZ[freqBucketSignal.value];
  const zeta = DAMP_ZETA[dampBucketSignal.value];
  const mfCorner = (massState.totalMassKg * 0.5) * massState.frontAxleRatio;
  const mrCorner = (massState.totalMassKg * 0.5) - mfCorner;
  const kf = mfCorner * omega * omega, kr = mrCorner * omega * omega;
  const cf = 2 * zeta * Math.sqrt(kf * mfCorner), cr = 2 * zeta * Math.sqrt(kr * mrCorner);

  useBeforePhysicsStep(() => {
    const rb = vehicleRef.current?.body ?? null;
    chassisRbRef.current = rb;
    if (!rb) return;
    if (dropTriggerSignal.value !== lastDropRef.current) {
      lastDropRef.current = dropTriggerSignal.value;
      rb.setTranslation({ x: 0, y: 1.2, z: 0 }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    if (massDirtySignal.value) {
      massDirtySignal.value = false;
      const st = memo.evaluate(attachedMaskSignal.value, fuelLitersSignal.value);
      rb.setAdditionalMassProperties(
        st.totalMassKg,
        { x: st.centerOfMass[0], y: st.centerOfMass[1], z: st.centerOfMass[2] },
        { x: st.inertiaDiagonal[0], y: st.inertiaDiagonal[1], z: st.inertiaDiagonal[2] },
        { x: st.inertiaOrientation[0], y: st.inertiaOrientation[1], z: st.inertiaOrientation[2], w: st.inertiaOrientation[3] },
        true,
      );
      telemetryMassKgSignal.value = st.totalMassKg;
      telemetryComSignal.value = st.centerOfMass;
      telemetryFrontSplitSignal.value = st.frontAxleRatio;
      telemetryCornerKSignal.value = [kf, kr];
    }
  });

  useFrame(() => {
    const veh = vehicleRef.current;
    if (!veh) return;
    const k = keysRef.current;
    veh.setMovement({ forward: k.w, backward: k.s, steerLeft: k.a, steerRight: k.d, brake: k.space });
    telemetrySpeedKmhSignal.value = veh.currLinVel.length() * 3.6;
    telemetryRpmSignal.value = Math.max(850, veh.engineRPM);
  });

  const handlePanelWrench = (panel: PanelMeshData) => {
    const bit = 1 << panel.bitIndex;
    const impulseNs = wrenchModeSignal.value === "UNLATCH_200" ? 200 : 1800;
    const rb = vehicleRef.current?.body;
    const pInt = intrinsics[panel.bitIndex];
    if (rb) {
      const tr = rb.translation();
      sparkBurstSignal.value = [tr.x + panel.anchorChassis[0], tr.y + panel.anchorChassis[1], tr.z + panel.anchorChassis[2]];
    }
    if (impulseNs <= panel.breakaway.breakImpulseNs && panel.breakaway.hingeAxisLocal && (unlatchedMaskSignal.value & bit) === 0) {
      unlatchedMaskSignal.value |= bit;
      setMaskTick((t) => t + 1);
      return;
    }
    attachedMaskSignal.value &= ~bit;
    unlatchedMaskSignal.value &= ~bit;
    massDirtySignal.value = true;
    setMaskTick((t) => t + 1);
    if (!rb) return;
    const tr = rb.translation(), rot = rb.rotation(), lv = rb.linvel(), av = rb.angvel(), com = rb.worldCom();
    _qA.set(rot.x, rot.y, rot.z, rot.w);
    _vA.set(panel.anchorChassis[0], panel.anchorChassis[1], panel.anchorChassis[2]).applyQuaternion(_qA).add(tr);
    _vB.set(_vA.x - com.x, _vA.y - com.y, _vA.z - com.z);
    _vC.set(av.x, av.y, av.z).cross(_vB);
    const jScale = Math.min(8, impulseNs / Math.max(15, pInt.massKg * 18));
    detachedDebrisSignal.value = [
      ...detachedDebrisSignal.value,
      {
        id: `${panel.partId}_${Date.now()}`, partId: panel.partId, massKg: pInt.massKg,
        position: [_vA.x, _vA.y, _vA.z], quaternion: [rot.x, rot.y, rot.z, rot.w],
        linvel: [lv.x + _vC.x + (panel.anchorChassis[0] >= 0 ? 1 : -1) * jScale, lv.y + _vC.y + 0.65 * jScale, lv.z + _vC.z + (panel.anchorChassis[2] >= 0 ? 0.5 : -0.5) * jScale],
        angvel: [av.x, av.y, av.z], aabbSize: panel.aabbSize, colorHex: panel.colorHex,
      },
    ];
  };

  const carConfig = useMemo(() => ({ engineHorsepower: 190, gearRatios: [3.5, 2.1, 1.4, 1.0], finalDriveRatio: 3.9, rollCenterHeight: 0.24, antiRollStiffness: 2400 }), []);

  return (
    <>
      <EcctrlVehicle ref={vehicleRef} position={[0, 0.35, 0]} colliders={false} carConfig={carConfig} canSleep={false}>
        <CuboidCollider args={khrBoxToRapierHalfExtents(assembly.skateboardBoxSize)} position={assembly.skateboardBoxCenter} />
        <group ref={chassisGroupRef}>
          <mesh geometry={skateboardGeo}>
            <meshStandardMaterial color={0x23282d} roughness={0.9} flatShading />
          </mesh>
          {assembly.panels.map((p, idx) => {
            const bit = 1 << p.bitIndex;
            if ((attachedMaskSignal.value & bit) === 0 || (unlatchedMaskSignal.value & bit) !== 0) return null;
            return (
              <mesh key={p.partId} position={p.anchorChassis} geometry={panelGeos[idx]} onClick={(e) => { e.stopPropagation(); handlePanelWrench(p); }}>
                <meshStandardMaterial color={p.colorHex} roughness={p.isGlass ? 0.15 : 0.88} transparent={p.isGlass} opacity={p.isGlass ? 0.32 : 1.0} flatShading={assembly.shadingMode === "psx-flat"} />
              </mesh>
            );
          })}
        </group>

        {assembly.wheels.map((w) => {
          const isFront = w.slotId.includes("_f"), travel = w.omi.suspensionTravel ?? 0.2;
          return (
            <ShapeCastWheel
              key={w.slotId} name={w.slotId} position={[w.position[0], w.position[1] + (travel - 0.07), w.position[2]]}
              rayShapeR={w.omi.radius} rayShapeH={w.omi.width * 0.5} rayLength={travel} wheelModelRadius={w.omi.radius}
              springK={isFront ? kf : kr} dampingC={isFront ? cf : cr}
              steerWheel={w.omi.steering} driveWheel={w.omi.propulsion} brakeWheel maxBrakeTorque={1600}
            >
              <mesh geometry={wheelGeo}>
                <meshStandardMaterial color={0x1c2229} roughness={0.9} flatShading />
              </mesh>
            </ShapeCastWheel>
          );
        })}
      </EcctrlVehicle>

      {assembly.panels.map((p, idx) => {
        const bit = 1 << p.bitIndex;
        if ((attachedMaskSignal.value & bit) === 0 || (unlatchedMaskSignal.value & bit) === 0) return null;
        return <UnlatchedHingePanel key={`unlatched_${p.partId}`} chassisBodyRef={chassisRbRef} panel={p} massKg={intrinsics[idx].massKg} geometry={panelGeos[idx]} onWrenchHit={handlePanelWrench} />;
      })}

      {detachedDebrisSignal.value.map((d) => (
        <RigidBody key={d.id} position={d.position} mass={d.massKg} linearVelocity={d.linvel} angularVelocity={d.angvel} colliders={false}>
          <CuboidCollider args={khrBoxToRapierHalfExtents(d.aabbSize)} />
          <mesh><boxGeometry args={d.aabbSize} /><meshStandardMaterial color={d.colorHex} roughness={0.88} flatShading /></mesh>
        </RigidBody>
      ))}
    </>
  );
}
