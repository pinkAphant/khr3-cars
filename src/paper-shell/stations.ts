import type { PaperShellPresetId } from "./schema.js";

export interface PaperShellPreset {
  readonly id: PaperShellPresetId;
  readonly label: string;
  readonly doorCount: 2 | 4;
  readonly wheelbase: number;
  readonly trackWidth: number;
  readonly halfWidth: number;
  readonly rearOverhang: number;
  readonly frontOverhang: number;
  readonly groundClearance: number;
  readonly bumperRearY: number;
  readonly trunkDeckY: number;
  readonly beltlineY: number;
  readonly roofY: number;
  readonly cowlY: number;
  readonly noseY: number;
  readonly archRadius: number;
  readonly wheelRadius: number;
  readonly wheelWidth: number;
  readonly chassisMassKg: number;
  readonly engineMassKg: number;
  readonly defaultFuelLiters: number;
}

export const PAPER_SHELL_PRESETS: Readonly<Record<PaperShellPresetId, PaperShellPreset>> = Object.freeze({
  coupe_86: Object.freeze({
    id: 'coupe_86', label: 'COUPE 86', doorCount: 2,
    wheelbase: 2.40, trackWidth: 1.36, halfWidth: 0.81, rearOverhang: 0.92, frontOverhang: 0.86,
    groundClearance: 0.14, bumperRearY: 0.56, trunkDeckY: 0.84, beltlineY: 0.86, roofY: 1.28, cowlY: 0.82, noseY: 0.54,
    archRadius: 0.37, wheelRadius: 0.31, wheelWidth: 0.21, chassisMassKg: 480, engineMassKg: 145, defaultFuelLiters: 42,
  }),
  sedan_92: Object.freeze({
    id: 'sedan_92', label: 'SEDAN 92', doorCount: 4,
    wheelbase: 2.70, trackWidth: 1.54, halfWidth: 0.89, rearOverhang: 0.95, frontOverhang: 0.95,
    groundClearance: 0.15, bumperRearY: 0.60, trunkDeckY: 0.92, beltlineY: 0.90, roofY: 1.40, cowlY: 0.88, noseY: 0.58,
    archRadius: 0.39, wheelRadius: 0.33, wheelWidth: 0.22, chassisMassKg: 590, engineMassKg: 180, defaultFuelLiters: 55,
  }),
  kei_van: Object.freeze({
    id: 'kei_van', label: 'KEI VAN', doorCount: 4,
    wheelbase: 1.98, trackWidth: 1.24, halfWidth: 0.70, rearOverhang: 0.64, frontOverhang: 0.68,
    groundClearance: 0.16, bumperRearY: 0.55, trunkDeckY: 1.62, beltlineY: 0.96, roofY: 1.78, cowlY: 1.04, noseY: 0.72,
    archRadius: 0.33, wheelRadius: 0.27, wheelWidth: 0.17, chassisMassKg: 420, engineMassKg: 95, defaultFuelLiters: 32,
  }),
});

export type StationTag =
  | 'z0' | 'z1' | 'z_ra_0' | 'z_ra_1' | 'z_ra_2' | 'z_ra_3' | 'z_ra_4' | 'z_ra_5' | 'z_ra_6'
  | 'z2' | 'z_roof_r' | 'z3' | 'z_roof_f' | 'z4'
  | 'z_fa_0' | 'z_fa_1' | 'z_fa_2' | 'z_fa_3' | 'z_fa_4' | 'z_fa_5' | 'z_fa_6'
  | 'z6' | 'z7';

export interface StationRing {
  readonly index: number;
  readonly tag: StationTag;
  readonly z: number;
  /** 6 symmetric lateral knots p in [0..5] for x >= 0: [x, y, z]. */
  readonly knotsRight: readonly [number, number, number][];
  /** 6 mirrored lateral knots p in [0..5] for x <= 0: [-x, y, z]. */
  readonly knotsLeft: readonly [number, number, number][];
}

export interface PaperShellLattice {
  readonly preset: PaperShellPreset;
  readonly zRearAxle: number;
  readonly zFrontAxle: number;
  readonly rings: readonly StationRing[];
  readonly tagToIndex: Readonly<Record<StationTag, number>>;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.max(0, Math.min(1, t));

function evalUpperY(p: PaperShellPreset, z: number, z0: number, z1: number, z2: number, zRr: number, zRf: number, z4: number, z6: number, z7: number): number {
  if (z <= z1) return lerp(p.bumperRearY, p.trunkDeckY, (z - z0) / Math.max(1e-5, z1 - z0));
  if (z <= z2) return lerp(p.trunkDeckY, p.beltlineY + 0.04, (z - z1) / Math.max(1e-5, z2 - z1));
  if (z <= zRr) return lerp(p.beltlineY + 0.04, p.roofY, (z - z2) / Math.max(1e-5, zRr - z2));
  if (z <= zRf) return p.roofY;
  if (z <= z4) return lerp(p.roofY, p.cowlY, (z - zRf) / Math.max(1e-5, z4 - zRf));
  if (z <= z6) return lerp(p.cowlY, p.noseY + 0.14, (z - z4) / Math.max(1e-5, z6 - z4));
  return lerp(p.noseY + 0.14, p.noseY, (z - z6) / Math.max(1e-5, z7 - z6));
}

/**
 * Build the C0 watertight (z, p) station lattice with 5 intermediate wheel-arch rings
 * across [zRearAxle - R, zRearAxle + R] and [zFrontAxle - R, zFrontAxle + R].
 */
export function buildStationLattice(presetOrId: PaperShellPreset | PaperShellPresetId): PaperShellLattice {
  const p = typeof presetOrId === 'string' ? PAPER_SHELL_PRESETS[presetOrId] : presetOrId;
  const zRearAxle = -p.wheelbase * 0.5;
  const zFrontAxle = p.wheelbase * 0.5;
  const R = p.archRadius;
  const z0 = zRearAxle - p.rearOverhang;
  const z1 = Math.min(zRearAxle - R - 0.08, z0 + 0.20);
  const z2 = Math.max(zRearAxle + R + 0.06, zRearAxle + 0.36);
  const z4 = Math.min(zFrontAxle - R - 0.06, zFrontAxle - 0.36);
  const z3 = (z2 + z4) * 0.5;
  const zRr = lerp(z2, z3, 0.42);
  const zRf = lerp(z3, z4, 0.58);
  const z7 = zFrontAxle + p.frontOverhang;
  const z6 = Math.max(zFrontAxle + R + 0.08, z7 - 0.18);

  const archSlices = (zAxle: number, prefix: 'z_ra' | 'z_fa'): Array<[StationTag, number]> =>
    Array.from({ length: 7 }, (_, i) => [`${prefix}_${i}` as StationTag, zAxle + (-1 + (2 * i) / 6) * R]);

  const ordered: Array<[StationTag, number]> = [
    ['z0', z0], ['z1', z1], ...archSlices(zRearAxle, 'z_ra'),
    ['z2', z2], ['z_roof_r', zRr], ['z3', z3], ['z_roof_f', zRf], ['z4', z4],
    ...archSlices(zFrontAxle, 'z_fa'), ['z6', z6], ['z7', z7],
  ];

  const rings: StationRing[] = [];
  const tagToIndex = {} as Record<StationTag, number>;

  ordered.forEach(([tag, z], index) => {
    tagToIndex[tag] = index;
    const yTop = evalUpperY(p, z, z0, z1, z2, zRr, zRf, z4, z6, z7);
    const yBelt = lerp(p.beltlineY + 0.03, p.cowlY - 0.04, (z - z0) / Math.max(1e-5, z7 - z0));
    const isCabin = z >= z2 - 1e-4 && z <= z4 + 1e-4;
    const W = p.halfWidth * (Math.abs(z) > p.wheelbase * 0.5 ? 0.92 : 1.0);
    const dRear = Math.abs(z - zRearAxle), dFront = Math.abs(z - zFrontAxle);
    const archDy =
      dRear <= R + 1e-6 ? Math.sqrt(Math.max(0, R * R - dRear * dRear)) :
      dFront <= R + 1e-6 ? Math.sqrt(Math.max(0, R * R - dFront * dFront)) : 0;
    const knotsRight: [number, number, number][] = [
      [0, yTop, z],
      [W * (isCabin ? 0.68 : 0.58), yTop - (isCabin ? 0.02 : 0.03), z],
      [W * 0.84, isCabin ? lerp(yTop, yBelt, 0.85) : yBelt + 0.03, z],
      [W * 0.97, yBelt, z],
      [W + (archDy > 0 ? 0.025 : 0), p.groundClearance + 0.16 + archDy * 0.82, z],
      [W * 0.94, p.groundClearance + archDy * 0.45, z],
    ];
    rings.push({
      index,
      tag,
      z,
      knotsRight,
      knotsLeft: knotsRight.map(([x, y, kz]) => [-x || 0, y, kz]),
    });
  });

  return { preset: p, zRearAxle, zFrontAxle, rings, tagToIndex };
}
