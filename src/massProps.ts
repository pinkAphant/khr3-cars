/**
 * Rigid-body mass properties summed from solid boxes.
 * Mass, centre of mass and the full inertia tensor all come from the pieces; nothing is guessed.
 */

export type Vec3 = [number, number, number];

export interface MassBox {
  readonly massKg: number;
  /** Box centre in the parent frame (metres). */
  readonly center: Vec3;
  /** Full box size along X, Y and Z (metres). */
  readonly size: Vec3;
}

export interface MassProps {
  massKg: number;
  centerOfMass: Vec3;
  /** Row-major symmetric 3x3 inertia about the centre of mass (kg m^2). */
  tensor: [number, number, number, number, number, number, number, number, number];
  inertiaDiagonal: Vec3;
}

function assertBox(b: MassBox, i: number): void {
  if (!(Number.isFinite(b.massKg) && b.massKg > 0)) throw new RangeError(`massProps: piece ${i} massKg must be > 0, got ${b.massKg}`);
  for (const v of [...b.center, ...b.size]) {
    if (!Number.isFinite(v)) throw new RangeError(`massProps: piece ${i} has a non-finite coordinate`);
  }
  if (b.size.some((s) => !(s > 0))) throw new RangeError(`massProps: piece ${i} size must be positive on every axis`);
}

/** Solid-box inertia diagonal about its own centre. */
export function boxInertia(massKg: number, size: Vec3): Vec3 {
  const [x, y, z] = size;
  const k = massKg / 12;
  return [k * (y * y + z * z), k * (x * x + z * z), k * (x * x + y * y)];
}

/** Sum pieces into one rigid body (parallel-axis theorem, full tensor). */
export function sumMass(pieces: readonly MassBox[]): MassProps {
  if (pieces.length === 0) throw new RangeError("massProps: need at least one piece");
  pieces.forEach(assertBox);
  let m = 0;
  const c: Vec3 = [0, 0, 0];
  for (const p of pieces) {
    m += p.massKg;
    for (let a = 0; a < 3; a++) c[a] += p.massKg * p.center[a];
  }
  for (let a = 0; a < 3; a++) c[a] /= m;
  const t = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of pieces) {
    const own = boxInertia(p.massKg, p.size);
    const d: Vec3 = [p.center[0] - c[0], p.center[1] - c[1], p.center[2] - c[2]];
    const d2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        t[i * 3 + j] += (i === j ? own[i] : 0) + p.massKg * ((i === j ? d2 : 0) - d[i] * d[j]);
      }
    }
  }
  return {
    massKg: m,
    centerOfMass: c,
    tensor: t as MassProps["tensor"],
    inertiaDiagonal: [t[0], t[4], t[8]],
  };
}

/** Largest off-diagonal term relative to the smallest diagonal term (0 = principal axes are X, Y and Z). */
export function offDiagonalRatio(p: MassProps): number {
  const t = p.tensor;
  const off = Math.max(Math.abs(t[1]), Math.abs(t[2]), Math.abs(t[5]));
  return off / Math.min(t[0], t[4], t[8]);
}

export interface PrincipalInertia {
  inertiaDiagonal: Vec3;
  /** `[x, y, z, w]` rotation from the principal frame to the body frame (glTF `inertiaOrientation`). */
  inertiaOrientation: [number, number, number, number];
}

/**
 * Principal axes for a body that is mirror-symmetric across X = 0 (every car).
 * Then Ixy = Ixz = 0 and only the Y/Z pitch coupling remains, solved exactly by one rotation about X.
 */
export function principalAboutX(p: MassProps, tol = 1e-9): PrincipalInertia {
  const t = p.tensor;
  const scale = Math.max(t[0], t[4], t[8]);
  if (Math.abs(t[1]) > tol * scale || Math.abs(t[2]) > tol * scale) {
    throw new RangeError("massProps: body is not mirror-symmetric across X = 0; principalAboutX does not apply");
  }
  const iyy = t[4], izz = t[8], iyz = t[5];
  const phi = 0.5 * Math.atan2(2 * iyz, iyy - izz);
  const c = Math.cos(phi), s = Math.sin(phi);
  const a = c * c * iyy + 2 * c * s * iyz + s * s * izz;
  const b = s * s * iyy - 2 * c * s * iyz + c * c * izz;
  return { inertiaDiagonal: [t[0], a, b], inertiaOrientation: [Math.sin(phi / 2), 0, 0, Math.cos(phi / 2)] };
}

/** Rebuild the body-frame tensor from principal values and orientation (used to verify the solve). */
export function tensorFromPrincipal(pi: PrincipalInertia): MassProps["tensor"] {
  const [x, y, z, w] = pi.inertiaOrientation;
  const R = [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
  const d = pi.inertiaDiagonal;
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let v = 0;
    for (let k = 0; k < 3; k++) v += R[i * 3 + k] * d[k] * R[j * 3 + k];
    out[i * 3 + j] = v;
  }
  return out as MassProps["tensor"];
}
