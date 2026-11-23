import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { VfxEmitterMount } from "../../src/paper-shell.js";
import { sparkBurstSignal, telemetryRpmSignal } from "./gate-signals.js";

const POOL_SIZE = 256;
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _qA = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();
const _col = new THREE.Color();

export interface VfxEmitterPoolProps {
  readonly chassisObjRef: React.RefObject<THREE.Object3D | null>;
  readonly emitters: readonly VfxEmitterMount[];
}

export function VfxEmitterPool({ chassisObjRef, emitters }: VfxEmitterPoolProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const headRef = useRef(0);
  const spawnAccRef = useRef(0);

  const buffers = useMemo(() => {
    const pos = new Float32Array(POOL_SIZE * 3);
    const vel = new Float32Array(POOL_SIZE * 3);
    const age = new Float32Array(POOL_SIZE);
    const life = new Float32Array(POOL_SIZE);
    const sizeStartEnd = new Float32Array(POOL_SIZE * 2);
    const colorStart = new Float32Array(POOL_SIZE * 3);
    const colorEnd = new Float32Array(POOL_SIZE * 3);
    age.fill(999);
    life.fill(1);
    return { pos, vel, age, life, sizeStartEnd, colorStart, colorEnd };
  }, []);

  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const vfxMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }),
    [],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    _m4.makeScale(0, 0, 0);
    _col.setRGB(1, 1, 1);
    for (let i = 0; i < POOL_SIZE; i++) {
      mesh.setMatrixAt(i, _m4);
      mesh.setColorAt(i, _col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  const spawnOne = (
    wx: number, wy: number, wz: number, dx: number, dy: number, dz: number,
    speedMin: number, speedMax: number, cone: number, s0: number, s1: number, lifetime: number,
    c0: readonly [number, number, number, number], c1: readonly [number, number, number, number],
  ) => {
    const idx = headRef.current;
    headRef.current = (idx + 1) & (POOL_SIZE - 1);
    const i3 = idx * 3, i2 = idx * 2;
    buffers.pos[i3] = wx; buffers.pos[i3 + 1] = wy; buffers.pos[i3 + 2] = wz;
    const spd = speedMin + Math.random() * (speedMax - speedMin);
    buffers.vel[i3] = (dx + (Math.random() - 0.5) * cone) * spd;
    buffers.vel[i3 + 1] = (dy + (Math.random() - 0.5) * cone) * spd + 0.35;
    buffers.vel[i3 + 2] = (dz + (Math.random() - 0.5) * cone) * spd;
    buffers.age[idx] = 0;
    buffers.life[idx] = Math.max(0.05, lifetime);
    buffers.sizeStartEnd[i2] = s0; buffers.sizeStartEnd[i2 + 1] = s1;
    buffers.colorStart[i3] = c0[0]; buffers.colorStart[i3 + 1] = c0[1]; buffers.colorStart[i3 + 2] = c0[2];
    buffers.colorEnd[i3] = c1[0]; buffers.colorEnd[i3 + 1] = c1[1]; buffers.colorEnd[i3 + 2] = c1[2];
  };

  useFrame((state, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const clampedDt = Math.min(0.05, dt);
    const chassis = chassisObjRef.current;
    if (chassis) { chassis.getWorldPosition(_vA); chassis.getWorldQuaternion(_qA); }
    else { _vA.set(0, 0, 0); _qA.identity(); }

    const exhaust = emitters[0];
    if (exhaust) {
      const rpmRatio = Math.max(0.15, Math.min(1.0, telemetryRpmSignal.value / 6500));
      spawnAccRef.current += exhaust.desc.rateHz * rpmRatio * clampedDt;
      while (spawnAccRef.current >= 1) {
        spawnAccRef.current -= 1;
        _vB.set(exhaust.position[0], exhaust.position[1], exhaust.position[2]).applyQuaternion(_qA).add(_vA);
        _vC.set(0, 0, -1).applyQuaternion(_qA);
        const d = exhaust.desc;
        spawnOne(_vB.x, _vB.y, _vB.z, _vC.x, _vC.y, _vC.z, d.speedMinMax[0], d.speedMinMax[1], d.coneOuterAngle, d.sizeStartEnd[0], d.sizeStartEnd[1], d.lifetimeSec, d.colorStart, d.colorEnd);
      }
    }

    const burst = sparkBurstSignal.value;
    if (burst && emitters[1]) {
      sparkBurstSignal.value = null;
      const sp = emitters[1].desc;
      _vC.set(0, 0, -1).applyQuaternion(_qA);
      for (let b = 0; b < 18; b++) {
        spawnOne(burst[0], burst[1], burst[2], _vC.x, _vC.y + 0.4, _vC.z, sp.speedMinMax[0], sp.speedMinMax[1], sp.coneOuterAngle, sp.sizeStartEnd[0], sp.sizeStartEnd[1], sp.lifetimeSec, sp.colorStart, sp.colorEnd);
      }
    }

    const camQuat = state.camera.quaternion;
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = buffers.age[i], l = buffers.life[i];
      if (a >= l) { _m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m4); continue; }
      const nextAge = a + clampedDt;
      buffers.age[i] = nextAge;
      const t = Math.min(1, nextAge / l), i3 = i * 3, i2 = i * 2;
      buffers.pos[i3] += buffers.vel[i3] * clampedDt;
      buffers.pos[i3 + 1] += buffers.vel[i3 + 1] * clampedDt;
      buffers.pos[i3 + 2] += buffers.vel[i3 + 2] * clampedDt;
      const sz = buffers.sizeStartEnd[i2] + (buffers.sizeStartEnd[i2 + 1] - buffers.sizeStartEnd[i2]) * t;
      _vB.set(buffers.pos[i3], buffers.pos[i3 + 1], buffers.pos[i3 + 2]);
      _vC.set(sz, sz, sz);
      _m4.compose(_vB, camQuat, _vC);
      mesh.setMatrixAt(i, _m4);
      _col.setRGB(
        buffers.colorStart[i3] + (buffers.colorEnd[i3] - buffers.colorStart[i3]) * t,
        buffers.colorStart[i3 + 1] + (buffers.colorEnd[i3 + 1] - buffers.colorStart[i3 + 1]) * t,
        buffers.colorStart[i3 + 2] + (buffers.colorEnd[i3 + 2] - buffers.colorStart[i3 + 2]) * t,
      );
      mesh.setColorAt(i, _col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[planeGeo, vfxMat, POOL_SIZE]} frustumCulled={false} />;
}
