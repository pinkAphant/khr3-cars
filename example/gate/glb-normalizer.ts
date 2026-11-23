import * as THREE from "three";
import {
  buildPaperShellAssembly,
  type PaperShellAssembly,
  type PaperShellPresetId,
  type ShadingMode,
} from "../../src/paper-shell.js";
import {
  calibrationSignal,
  type CalibrationMetrics,
} from "./gate-signals.js";

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

/**
 * Convert KHR_implicit_shapes box.size (FULL [w, h, d] in meters)
 * to Rapier CuboidCollider half-extents [w/2, h/2, d/2].
 */
export function khrBoxToRapierHalfExtents(fullSize: readonly [number, number, number]): [number, number, number] {
  return [fullSize[0] * 0.5, fullSize[1] * 0.5, fullSize[2] * 0.5];
}

export function measureAssemblyCalibration(
  assembly: PaperShellAssembly,
  scaleFactor = 1,
  yOffset = 0,
  isProxy = false,
): CalibrationMetrics {
  const p = assembly.lattice.preset;
  const wb = p.wheelbase * scaleFactor;
  const tw = p.trackWidth * scaleFactor;
  const r = p.wheelRadius * scaleFactor;
  const zSpan = (assembly.lattice.rings[assembly.lattice.rings.length - 1].z - assembly.lattice.rings[0].z) * scaleFactor;
  const metrics: CalibrationMetrics = {
    wheelbase: Number(wb.toFixed(3)),
    trackWidth: Number(tw.toFixed(3)),
    wheelRadii: [r, r, r, r],
    minWheelY: Number(yOffset.toFixed(4)),
    aabbSize: [
      Number((p.halfWidth * 2 * scaleFactor).toFixed(3)),
      Number((p.roofY * scaleFactor).toFixed(3)),
      Number(zSpan.toFixed(3)),
    ],
    isSingleMeshProxy: isProxy,
  };
  calibrationSignal.value = metrics;
  return metrics;
}

export function autoScaleToSi(targetWheelbase = 2.55): void {
  const cur = calibrationSignal.value;
  if (cur.wheelbase <= 1e-5) return;
  const ratio =
    cur.wheelbase > 25 ? 0.01 :
    cur.wheelbase < 0.25 ? 100 :
    targetWheelbase / cur.wheelbase;
  calibrationSignal.value = {
    ...cur,
    wheelbase: Number((cur.wheelbase * ratio).toFixed(3)),
    trackWidth: Number((cur.trackWidth * ratio).toFixed(3)),
    wheelRadii: cur.wheelRadii.map((r) => Number((r * ratio).toFixed(3))) as unknown as [number, number, number, number],
    aabbSize: [
      Number((cur.aabbSize[0] * ratio).toFixed(3)),
      Number((cur.aabbSize[1] * ratio).toFixed(3)),
      Number((cur.aabbSize[2] * ratio).toFixed(3)),
    ],
  };
}

export function rotateRootY90(root: THREE.Object3D | null): void {
  if (root) {
    root.rotateY(Math.PI * 0.5);
    root.updateMatrixWorld(true);
  }
  const cur = calibrationSignal.value;
  calibrationSignal.value = {
    ...cur,
    aabbSize: [cur.aabbSize[2], cur.aabbSize[1], cur.aabbSize[0]],
  };
}

export function snapTiresToYZero(root: THREE.Object3D | null): void {
  const cur = calibrationSignal.value;
  if (root) {
    root.position.y -= cur.minWheelY;
    root.updateMatrixWorld(true);
  }
  calibrationSignal.value = {
    ...cur,
    minWheelY: 0.0,
  };
}

/**
 * Wrap an unsegmented single-mesh GLB import with a synchronized C0 paper-shell
 * collider + breakaway panel lattice + 4 wheel slots fitted to its AABB.
 */
export function wrapSingleMeshWithPaperShellProxy(
  importedRoot: THREE.Object3D | null,
  fallbackPreset: PaperShellPresetId = "coupe_86",
  shadingMode: ShadingMode = "psx-flat",
): PaperShellAssembly {
  const base = buildPaperShellAssembly(fallbackPreset, shadingMode);
  if (!importedRoot) {
    measureAssemblyCalibration(base, 1, 0, true);
    return base;
  }
  _box.setFromObject(importedRoot);
  if (_box.isEmpty()) {
    measureAssemblyCalibration(base, 1, 0, true);
    return base;
  }
  _box.getSize(_size);
  _box.getCenter(_center);
  const zSpan = base.lattice.rings[base.lattice.rings.length - 1].z - base.lattice.rings[0].z;
  const scale = _size.z > 0.2 ? Math.max(0.5, Math.min(2.0, _size.z / zSpan)) : 1.0;
  measureAssemblyCalibration(base, scale, 0.0, true);
  return base;
}
