import { RHO_FUEL_LITER, type ShellPartId } from "./schema.js";
import type { PanelMeshData, PaperShellAssembly } from "./panels.js";

export interface PanelIntrinsicMass {
  readonly partId: ShellPartId;
  readonly bitIndex: number;
  readonly areaM2: number;
  readonly massKg: number;
  readonly centroidChassis: [number, number, number];
}

export interface CompositeMassState {
  readonly attachedMask: number;
  readonly fuelKg: number;
  readonly totalMassKg: number;
  readonly centerOfMass: [number, number, number];
  readonly inertiaTensor: [number, number, number, number, number, number, number, number, number];
  readonly inertiaDiagonal: [number, number, number];
  readonly inertiaOrientation: [number, number, number, number];
  readonly frontAxleRatio: number;
}

export const ALL_PANELS_ATTACHED_MASK = (1 << 27) - 1;

/**
 * Exact triangle cross-product area, mass, and chassis-space centroid for each panel:
 * A_tri = 0.5 * |(v1 - v0) x (v2 - v0)|, c_tri = (v0 + v1 + v2) / 3.
 */
export function computePanelIntrinsics(panels: readonly PanelMeshData[]): PanelIntrinsicMass[] {
  return panels.map((p) => {
    const pos = p.chassisPositions;
    let area = 0, cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < pos.length; i += 9) {
      const x0 = pos[i], y0 = pos[i + 1], z0 = pos[i + 2];
      const ux = pos[i + 3] - x0, uy = pos[i + 4] - y0, uz = pos[i + 5] - z0;
      const vx = pos[i + 6] - x0, vy = pos[i + 7] - y0, vz = pos[i + 8] - z0;
      const triArea = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      area += triArea;
      cx += triArea * ((x0 + pos[i + 3] + pos[i + 6]) / 3);
      cy += triArea * ((y0 + pos[i + 4] + pos[i + 7]) / 3);
      cz += triArea * ((z0 + pos[i + 5] + pos[i + 8]) / 3);
    }
    const safeArea = Math.max(1e-6, area);
    return {
      partId: p.partId,
      bitIndex: p.bitIndex,
      areaM2: safeArea,
      massKg: Math.max(0.25, safeArea * p.arealDensity),
      centroidChassis: [cx / safeArea, cy / safeArea, cz / safeArea],
    };
  });
}

/**
 * Deterministic 6-sweep 3x3 symmetric Jacobi eigensolver extracting principal
 * inertiaDiagonal [Ix, Iy, Iz] and unit quaternion inertiaOrientation [qx, qy, qz, qw].
 */
export function solveJacobiPrincipalInertia(
  tensor: readonly [number, number, number, number, number, number, number, number, number],
): { inertiaDiagonal: [number, number, number]; inertiaOrientation: [number, number, number, number] } {
  const A = [
    [tensor[0], tensor[1], tensor[2]],
    [tensor[3], tensor[4], tensor[5]],
    [tensor[6], tensor[7], tensor[8]],
  ];
  let qx = 0, qy = 0, qz = 0, qw = 1;
  const pairs: readonly [0 | 1 | 2, 0 | 1 | 2][] = [[0, 1], [0, 2], [1, 2]];

  for (let sweep = 0; sweep < 6; sweep++) {
    for (const [p, q] of pairs) {
      const apq = A[p][q];
      if (Math.abs(apq) < 1e-11) continue;
      const app = A[p][p], aqq = A[q][q];
      const tau = (aqq - app) / (2 * apq);
      const t = tau >= 0 ? 1 / (tau + Math.hypot(1, tau)) : -1 / (-tau + Math.hypot(1, tau));
      const c = 1 / Math.hypot(1, t), s = t * c;
      A[p][p] = app - t * apq; A[q][q] = aqq + t * apq; A[p][q] = A[q][p] = 0;
      const r = (3 - p - q) as 0 | 1 | 2;
      const apr = A[p][r], aqr = A[q][r];
      A[p][r] = A[r][p] = c * apr - s * aqr;
      A[q][r] = A[r][q] = s * apr + c * aqr;

      const half = 0.5 * Math.atan2(s, c), sh = Math.sin(half), ch = Math.cos(half);
      const gx = p === 1 && q === 2 ? sh : 0, gy = p === 0 && q === 2 ? -sh : 0, gz = p === 0 && q === 1 ? sh : 0;
      const nx = qw * gx + qx * ch + qy * gz - qz * gy;
      const ny = qw * gy - qx * gz + qy * ch + qz * gx;
      const nz = qw * gz + qx * gy - qy * gx + qz * ch;
      const nw = qw * ch - qx * gx - qy * gy - qz * gz;
      const nLen = Math.hypot(nx, ny, nz, nw) || 1;
      qx = nx / nLen; qy = ny / nLen; qz = nz / nLen; qw = nw / nLen;
    }
  }
  return {
    inertiaDiagonal: [Math.max(1e-3, A[0][0]), Math.max(1e-3, A[1][1]), Math.max(1e-3, A[2][2])],
    inertiaOrientation: [qx || 0, qy || 0, qz || 0, qw],
  };
}

export class PaperShellMassMemo {
  private readonly intrinsics: readonly PanelIntrinsicMass[];
  private readonly cache = new Map<string, CompositeMassState>();

  constructor(private readonly assembly: PaperShellAssembly) {
    this.intrinsics = computePanelIntrinsics(assembly.panels);
  }

  getPanelIntrinsics(): readonly PanelIntrinsicMass[] {
    return this.intrinsics;
  }

  evaluate(attachedMask = ALL_PANELS_ATTACHED_MASK, fuelLiters = this.assembly.lattice.preset.defaultFuelLiters): CompositeMassState {
    const fuelKg = Math.max(0, fuelLiters) * RHO_FUEL_LITER;
    const fuelBucket = Math.round(fuelKg * 2);
    const key = `${attachedMask}:${fuelBucket}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const p = this.assembly.lattice.preset;
    const qFuelKg = fuelBucket * 0.5;
    const lumps: Array<{ m: number; r: [number, number, number] }> = [
      { m: p.chassisMassKg, r: [0, p.groundClearance + 0.14, 0] },
      { m: p.engineMassKg, r: [0, p.groundClearance + 0.34, this.assembly.lattice.zFrontAxle - 0.15] },
      { m: qFuelKg, r: [0, p.groundClearance + 0.18, this.assembly.lattice.zRearAxle + 0.15] },
    ];
    for (const pi of this.intrinsics) {
      if ((attachedMask & (1 << pi.bitIndex)) !== 0) lumps.push({ m: pi.massKg, r: pi.centroidChassis });
    }
    let M = 0, cx = 0, cy = 0, cz = 0;
    for (const l of lumps) { M += l.m; cx += l.m * l.r[0]; cy += l.m * l.r[1]; cz += l.m * l.r[2]; }
    cx /= M; cy /= M; cz /= M;

    const [wx, wy, wz] = this.assembly.skateboardBoxSize;
    const k0 = p.chassisMassKg / 12;
    const I: [number, number, number, number, number, number, number, number, number] = [
      k0 * (wy * wy + wz * wz), 0, 0, 0, k0 * (wx * wx + wz * wz), 0, 0, 0, k0 * (wx * wx + wy * wy),
    ];
    for (const l of lumps) {
      const dx = l.r[0] - cx, dy = l.r[1] - cy, dz = l.r[2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      I[0] += l.m * (d2 - dx * dx); I[1] -= l.m * dx * dy; I[2] -= l.m * dx * dz;
      I[3] -= l.m * dy * dx; I[4] += l.m * (d2 - dy * dy); I[5] -= l.m * dy * dz;
      I[6] -= l.m * dz * dx; I[7] -= l.m * dz * dy; I[8] += l.m * (d2 - dz * dz);
    }
    const { inertiaDiagonal, inertiaOrientation } = solveJacobiPrincipalInertia(I);
    const frontAxleRatio = Math.max(0.15, Math.min(0.85, (cz - this.assembly.lattice.zRearAxle) / p.wheelbase));
    const state: CompositeMassState = {
      attachedMask, fuelKg: qFuelKg, totalMassKg: M, centerOfMass: [cx, cy, cz],
      inertiaTensor: I, inertiaDiagonal, inertiaOrientation, frontAxleRatio,
    };
    this.cache.set(key, state);
    return state;
  }
}
