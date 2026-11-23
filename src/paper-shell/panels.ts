import {
  RHO_GLASS_AREAL,
  RHO_POLYMER_AREAL,
  RHO_STEEL_AREAL,
  type Khr3SocketBreakaway,
  type Khr3VfxEmitterDesc,
  type OmiVehicleWheelDesc,
  type PaperShellPresetId,
  type ShadingMode,
  type ShellPartId,
  type WheelSlotId,
} from "./schema.js";
import { buildStationLattice, type PaperShellLattice, type StationTag } from "./stations.js";

export interface PanelMeshData {
  readonly partId: ShellPartId;
  readonly bitIndex: number;
  readonly arealDensity: number;
  readonly colorHex: number;
  readonly isGlass: boolean;
  readonly anchorChassis: [number, number, number];
  readonly breakaway: Khr3SocketBreakaway;
  readonly localPositions: Float32Array;
  readonly localNormals: Float32Array;
  readonly chassisPositions: Float32Array;
  readonly aabbSize: [number, number, number];
}

export interface WheelMountData {
  readonly slotId: WheelSlotId;
  readonly position: [number, number, number];
  readonly omi: OmiVehicleWheelDesc;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
}

export interface PunctualLightMount {
  readonly name: 'light_head_l' | 'light_head_r' | 'light_brake_l' | 'light_brake_r';
  readonly position: [number, number, number];
  readonly quaternion: [number, number, number, number];
  readonly color: [number, number, number];
  readonly intensity: number;
  readonly range: number;
  readonly outerConeAngle: number;
}

export interface VfxEmitterMount {
  readonly name: 'emitter_muffler_l' | 'emitter_scrape_belly';
  readonly position: [number, number, number];
  readonly quaternion: [number, number, number, number];
  readonly desc: Khr3VfxEmitterDesc;
}

export interface PaperShellAssembly {
  readonly lattice: PaperShellLattice;
  readonly shadingMode: ShadingMode;
  readonly skateboardPositions: Float32Array;
  readonly skateboardNormals: Float32Array;
  readonly skateboardBoxSize: [number, number, number];
  readonly skateboardBoxCenter: [number, number, number];
  readonly panels: readonly PanelMeshData[];
  readonly wheels: readonly WheelMountData[];
  readonly lights: readonly PunctualLightMount[];
  readonly emitters: readonly VfxEmitterMount[];
  readonly totalTriangles: number;
}

type PatchTuple = [
  ShellPartId, StationTag, StationTag, number, number, 'both' | 'left' | 'right',
  number, number, number, number, [number, number, number]?, [number, number]?
];

const PATCH_RECIPES: readonly PatchTuple[] = [
  ['bumper_rear', 'z0', 'z1', 2, 5, 'both', RHO_POLYMER_AREAL, 0x2b333c, 140, 900],
  ['trunk_lid', 'z1', 'z2', 0, 2, 'both', RHO_STEEL_AREAL, 0xdce2dd, 150, 1200, [1, 0, 0], [0, 1.15]],
  ['quarter_rl', 'z1', 'z2', 2, 5, 'left', RHO_STEEL_AREAL, 0xdce2dd, 260, 1700],
  ['quarter_rr', 'z1', 'z2', 2, 5, 'right', RHO_STEEL_AREAL, 0xdce2dd, 260, 1700],
  ['windshield_frame_r', 'z2', 'z_roof_r', 0, 1, 'both', RHO_STEEL_AREAL, 0x23282d, 350, 2200],
  ['glass_windshield_r', 'z2', 'z_roof_r', 1, 2, 'both', RHO_GLASS_AREAL, 0x6ec6ff, 110, 650],
  ['pillar_c_l', 'z2', 'z_roof_r', 2, 3, 'left', RHO_STEEL_AREAL, 0xdce2dd, 400, 2400],
  ['pillar_c_r', 'z2', 'z_roof_r', 2, 3, 'right', RHO_STEEL_AREAL, 0xdce2dd, 400, 2400],
  ['roof_panel', 'z_roof_r', 'z3', 0, 2, 'both', RHO_STEEL_AREAL, 0xdce2dd, 380, 2300],
  ['glass_moonroof', 'z3', 'z_roof_f', 0, 2, 'both', RHO_GLASS_AREAL, 0x56b4e9, 120, 700],
  ['pillar_b_l', 'z_roof_r', 'z_roof_f', 2, 3, 'left', RHO_STEEL_AREAL, 0x23282d, 420, 2500],
  ['pillar_b_r', 'z_roof_r', 'z_roof_f', 2, 3, 'right', RHO_STEEL_AREAL, 0x23282d, 420, 2500],
  ['windshield_frame_f', 'z_roof_f', 'z4', 0, 1, 'both', RHO_STEEL_AREAL, 0x23282d, 350, 2200],
  ['glass_windshield_f', 'z_roof_f', 'z4', 1, 2, 'both', RHO_GLASS_AREAL, 0x6ec6ff, 110, 650],
  ['pillar_a_l', 'z_roof_f', 'z4', 2, 3, 'left', RHO_STEEL_AREAL, 0xdce2dd, 400, 2400],
  ['pillar_a_r', 'z_roof_f', 'z4', 2, 3, 'right', RHO_STEEL_AREAL, 0xdce2dd, 400, 2400],
  ['door_rl', 'z2', 'z3', 3, 4, 'left', RHO_STEEL_AREAL, 0xdce2dd, 180, 1450, [0, 1, 0], [-1.15, 0]],
  ['door_rr', 'z2', 'z3', 3, 4, 'right', RHO_STEEL_AREAL, 0xdce2dd, 180, 1450, [0, 1, 0], [0, 1.15]],
  ['door_fl', 'z3', 'z4', 3, 4, 'left', RHO_STEEL_AREAL, 0xdce2dd, 180, 1500, [0, 1, 0], [-1.2, 0]],
  ['door_fr', 'z3', 'z4', 3, 4, 'right', RHO_STEEL_AREAL, 0xdce2dd, 180, 1500, [0, 1, 0], [0, 1.2]],
  ['skirt_l', 'z2', 'z4', 4, 5, 'left', RHO_POLYMER_AREAL, 0x2b333c, 210, 1100],
  ['skirt_r', 'z2', 'z4', 4, 5, 'right', RHO_POLYMER_AREAL, 0x2b333c, 210, 1100],
  ['hood', 'z4', 'z6', 0, 2, 'both', RHO_STEEL_AREAL, 0xd85a2a, 160, 1250, [1, 0, 0], [-1.1, 0]],
  ['fender_fl', 'z4', 'z6', 2, 5, 'left', RHO_STEEL_AREAL, 0xdce2dd, 220, 1500],
  ['fender_fr', 'z4', 'z6', 2, 5, 'right', RHO_STEEL_AREAL, 0xdce2dd, 220, 1500],
  ['grille_core_support', 'z6', 'z7', 0, 3, 'both', RHO_STEEL_AREAL, 0x23282d, 200, 1300],
  ['bumper_front', 'z6', 'z7', 3, 5, 'both', RHO_POLYMER_AREAL, 0x2b333c, 130, 850],
];

function computeNormals(pos: Float32Array, smooth: boolean): Float32Array {
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i], uy = pos[i + 4] - pos[i + 1], uz = pos[i + 5] - pos[i + 2];
    const vx = pos[i + 6] - pos[i], vy = pos[i + 7] - pos[i + 1], vz = pos[i + 8] - pos[i + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (let k = 0; k < 9; k += 3) { nrm[i + k] = nx; nrm[i + k + 1] = ny; nrm[i + k + 2] = nz; }
  }
  if (!smooth) return nrm;
  const map = new Map<string, [number, number, number]>();
  const keyAt = (i: number) => `${Math.round(pos[i] * 1000)},${Math.round(pos[i + 1] * 1000)},${Math.round(pos[i + 2] * 1000)}`;
  for (let i = 0; i < pos.length; i += 3) {
    const k = keyAt(i), cur = map.get(k) ?? [0, 0, 0];
    cur[0] += nrm[i]; cur[1] += nrm[i + 1]; cur[2] += nrm[i + 2];
    map.set(k, cur);
  }
  for (let i = 0; i < pos.length; i += 3) {
    const [sx, sy, sz] = map.get(keyAt(i))!;
    const l = Math.hypot(sx, sy, sz) || 1;
    nrm[i] = sx / l; nrm[i + 1] = sy / l; nrm[i + 2] = sz / l;
  }
  return nrm;
}

function buildCylinderWheel(r: number, w: number, segs = 12): { positions: Float32Array; normals: Float32Array } {
  const tris: number[] = [];
  const hx = w * 0.5;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const y0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, y1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    tris.push(-hx, y0, z0, hx, y0, z0, hx, y1, z1, -hx, y0, z0, hx, y1, z1, -hx, y1, z1);
    tris.push(hx, 0, 0, hx, y0, z0, hx, y1, z1, -hx, 0, 0, -hx, y1, z1, -hx, y0, z0);
  }
  const positions = new Float32Array(tris);
  return { positions, normals: computeNormals(positions, false) };
}

export function buildPaperShellAssembly(presetOrId: PaperShellPresetId = 'coupe_86', shadingMode: ShadingMode = 'psx-flat'): PaperShellAssembly {
  const lattice = buildStationLattice(presetOrId);
  const { rings, tagToIndex, preset: p, zRearAxle, zFrontAxle } = lattice;
  const smooth = shadingMode === 'dc-smooth';

  const panels: PanelMeshData[] = PATCH_RECIPES.map(([partId, zStart, zEnd, pStart, pEnd, side, rho, color, latchNs, breakNs, hingeAxis, swing], bitIndex) => {
    const ia = tagToIndex[zStart], ib = tagToIndex[zEnd];
    const verts: number[] = [];
    const pushQuad = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number], flip: boolean) => {
      if (!flip) verts.push(...a, ...b, ...c, ...a, ...c, ...d);
      else verts.push(...a, ...c, ...b, ...a, ...d, ...c);
    };
    for (let iz = ia; iz < ib; iz++) {
      const r0 = rings[iz], r1 = rings[iz + 1];
      for (let ip = pStart; ip < pEnd; ip++) {
        if (side === 'right' || side === 'both') pushQuad(r0.knotsRight[ip], r1.knotsRight[ip], r1.knotsRight[ip + 1], r0.knotsRight[ip + 1], false);
        if (side === 'left' || side === 'both') pushQuad(r0.knotsLeft[ip], r1.knotsLeft[ip], r1.knotsLeft[ip + 1], r0.knotsLeft[ip + 1], true);
      }
    }
    const anchorRing = partId === 'hood' || partId.startsWith('door_f') ? rings[ib] : rings[ia];
    const anchorKnot = side === 'right' ? anchorRing.knotsRight[pStart] : side === 'left' ? anchorRing.knotsLeft[pStart] : [0, anchorRing.knotsRight[0][1], anchorRing.z] as [number, number, number];
    const anchorChassis: [number, number, number] = [anchorKnot[0], anchorKnot[1], anchorKnot[2]];
    const chassisPositions = new Float32Array(verts);
    const localPositions = new Float32Array(verts.length);
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < verts.length; i += 3) {
      const lx = verts[i] - anchorChassis[0], ly = verts[i + 1] - anchorChassis[1], lz = verts[i + 2] - anchorChassis[2];
      localPositions[i] = lx; localPositions[i + 1] = ly; localPositions[i + 2] = lz;
      minX = Math.min(minX, lx); maxX = Math.max(maxX, lx);
      minY = Math.min(minY, ly); maxY = Math.max(maxY, ly);
      minZ = Math.min(minZ, lz); maxZ = Math.max(maxZ, lz);
    }
    return {
      partId, bitIndex, arealDensity: rho, colorHex: color, isGlass: rho === RHO_GLASS_AREAL, anchorChassis,
      breakaway: {
        partId, c12Tick: [Math.round(anchorChassis[0] * 12), Math.round(anchorChassis[1] * 12), Math.round(anchorChassis[2] * 12)],
        ...(hingeAxis ? { hingeAxisLocal: hingeAxis } : {}), ...(swing ? { swingMinMaxRad: swing } : {}),
        latchImpulseNs: latchNs, breakImpulseNs: breakNs,
      },
      localPositions, localNormals: computeNormals(localPositions, smooth), chassisPositions,
      aabbSize: [Math.max(0.06, maxX - minX), Math.max(0.06, maxY - minY), Math.max(0.06, maxZ - minZ)],
    };
  });

  const sbVerts: number[] = [];
  const hw = p.halfWidth * 0.88, h0 = p.groundClearance, h1 = h0 + 0.14;
  for (let i = 0; i < rings.length - 1; i++) {
    const zA = rings[i].z, zB = rings[i + 1].z;
    const yA = h1 + (rings[i].knotsRight[5][1] - h0), yB = h1 + (rings[i + 1].knotsRight[5][1] - h0);
    sbVerts.push(-hw, yA, zA, hw, yA, zA, hw, yB, zB, -hw, yA, zA, hw, yB, zB, -hw, yB, zB);
  }
  const skateboardPositions = new Float32Array(sbVerts);
  const zMin = rings[0].z, zMax = rings[rings.length - 1].z;
  const skateboardBoxSize: [number, number, number] = [p.halfWidth * 1.9, 0.28, zMax - zMin];
  const skateboardBoxCenter: [number, number, number] = [0, p.groundClearance + 0.14, (zMin + zMax) * 0.5];
  const wheelGeo = buildCylinderWheel(p.wheelRadius, p.wheelWidth);
  const tx = p.trackWidth * 0.5;
  const wheels: WheelMountData[] = (
    [['wheel_fl', tx, zFrontAxle, true], ['wheel_fr', -tx, zFrontAxle, true], ['wheel_rl', tx, zRearAxle, false], ['wheel_rr', -tx, zRearAxle, false]] as const
  ).map(([slotId, x, z, steer]) => ({
    slotId, position: [x, p.wheelRadius, z],
    omi: { radius: p.wheelRadius, width: p.wheelWidth, maxForce: 6500, steering: steer, propulsion: !steer, suspensionStiffness: 28000, suspensionDampingCompression: 2400, suspensionDampingRebound: 2800, suspensionTravel: 0.20 },
    positions: wheelGeo.positions, normals: wheelGeo.normals,
  }));
  const lights: PunctualLightMount[] = [
    { name: 'light_head_l', position: [p.halfWidth * 0.62, p.noseY + 0.08, zMax - 0.02], quaternion: [0, 1, 0, 0], color: [1.0, 0.96, 0.84], intensity: 900, range: 28, outerConeAngle: 0.58 },
    { name: 'light_head_r', position: [-p.halfWidth * 0.62, p.noseY + 0.08, zMax - 0.02], quaternion: [0, 1, 0, 0], color: [1.0, 0.96, 0.84], intensity: 900, range: 28, outerConeAngle: 0.58 },
    { name: 'light_brake_l', position: [p.halfWidth * 0.62, p.bumperRearY + 0.10, zMin + 0.02], quaternion: [0, 0, 0, 1], color: [1.0, 0.12, 0.08], intensity: 220, range: 8, outerConeAngle: 0.85 },
    { name: 'light_brake_r', position: [-p.halfWidth * 0.62, p.bumperRearY + 0.10, zMin + 0.02], quaternion: [0, 0, 0, 1], color: [1.0, 0.12, 0.08], intensity: 220, range: 8, outerConeAngle: 0.85 },
  ];
  const emitters: VfxEmitterMount[] = [
    { name: 'emitter_muffler_l', position: [p.halfWidth * 0.48, p.groundClearance + 0.06, zMin - 0.02], quaternion: [0, 0, 0, 1], desc: { name: 'emitter_muffler_l', kind: 'smoke', trigger: 'rpm_load', rateHz: 42, speedMinMax: [2.2, 5.5], coneOuterAngle: 0.38, sizeStartEnd: [0.09, 0.38], lifetimeSec: 0.75, colorStart: [0.72, 0.76, 0.8, 0.65], colorEnd: [0.22, 0.25, 0.28, 0.0] } },
    { name: 'emitter_scrape_belly', position: [0, p.groundClearance, 0], quaternion: [0, 0, 0, 1], desc: { name: 'emitter_scrape_belly', kind: 'spark', trigger: 'chassis_contact_impulse', rateHz: 90, speedMinMax: [4.5, 11.0], coneOuterAngle: 0.65, sizeStartEnd: [0.06, 0.02], lifetimeSec: 0.35, colorStart: [1.0, 0.78, 0.15, 1.0], colorEnd: [1.0, 0.23, 0.05, 0.0] } },
  ];
  const totalTriangles = (skateboardPositions.length + panels.reduce((s, x) => s + x.localPositions.length, 0) + wheels.length * wheelGeo.positions.length) / 9;
  return { lattice, shadingMode, skateboardPositions, skateboardNormals: computeNormals(skateboardPositions, smooth), skateboardBoxSize, skateboardBoxCenter, panels, wheels, lights, emitters, totalTriangles };
}
