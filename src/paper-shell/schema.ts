export const RHO_STEEL_AREAL = 11.8;   // kg/m^2 sheet steel
export const RHO_GLASS_AREAL = 13.5;   // kg/m^2 laminated glass
export const RHO_POLYMER_AREAL = 5.5;  // kg/m^2 bumper polymer
export const RHO_FUEL_LITER = 0.74;    // kg/L gasoline

export type PaperShellPresetId = 'coupe_86' | 'sedan_92' | 'kei_van';
export type ShadingMode = 'psx-flat' | 'dc-smooth';

export type ShellPartId =
  | 'bumper_front' | 'grille_core_support' | 'hood' | 'fender_fl' | 'fender_fr'
  | 'pillar_a_l' | 'pillar_a_r' | 'windshield_frame_f' | 'glass_windshield_f'
  | 'roof_panel' | 'glass_moonroof' | 'pillar_b_l' | 'pillar_b_r'
  | 'pillar_c_l' | 'pillar_c_r' | 'windshield_frame_r' | 'glass_windshield_r'
  | 'door_fl' | 'door_fr' | 'door_rl' | 'door_rr' | 'skirt_l' | 'skirt_r'
  | 'quarter_rl' | 'quarter_rr' | 'trunk_lid' | 'bumper_rear';

export const SHELL_PART_IDS: readonly ShellPartId[] = Object.freeze([
  'bumper_front', 'grille_core_support', 'hood', 'fender_fl', 'fender_fr',
  'pillar_a_l', 'pillar_a_r', 'windshield_frame_f', 'glass_windshield_f',
  'roof_panel', 'glass_moonroof', 'pillar_b_l', 'pillar_b_r',
  'pillar_c_l', 'pillar_c_r', 'windshield_frame_r', 'glass_windshield_r',
  'door_fl', 'door_fr', 'door_rl', 'door_rr', 'skirt_l', 'skirt_r',
  'quarter_rl', 'quarter_rr', 'trunk_lid', 'bumper_rear',
]);

export type WheelSlotId = 'wheel_fl' | 'wheel_fr' | 'wheel_rl' | 'wheel_rr';

/** KHR_implicit_shapes (glTF 2.0):
 *  NOTE: box.size is FULL [width, height, depth] in meters (divide by 2 for Rapier CuboidCollider!).
 *  cylinder & capsule align along local +Y; capsule.height is cylindrical middle section only. */
export type KhrImplicitShape =
  | { type: 'box'; box: { size: [number, number, number] } }
  | { type: 'sphere'; sphere: { radius: number } }
  | { type: 'cylinder'; cylinder: { height: number; radiusBottom: number; radiusTop: number } }
  | { type: 'capsule'; capsule: { height: number; radiusBottom: number; radiusTop: number } };

/** KHR_physics_rigid_bodies exact node.motion schema (PR #2424) */
export interface KhrPhysicsMotion {
  isKinematic?: boolean;
  mass?: number;
  centerOfMass?: [number, number, number];
  inertiaDiagonal?: [number, number, number];          // EXACT Khronos key
  inertiaOrientation?: [number, number, number, number]; // xyzw unit quaternion
  linearVelocity?: [number, number, number];
  angularVelocity?: [number, number, number];
  gravityFactor?: number;
}

/** KHR_physics_rigid_bodies 6-DoF joint constraint (NO "hinge" type string exists in spec).
 *  Lock linearAxes [0,1,2] to min:0,max:0 + lock 2 angularAxes + bound 1 angular axis for hinges. */
export interface KhrJointLimit {
  linearAxes?: (0 | 1 | 2)[];
  angularAxes?: (0 | 1 | 2)[];
  min?: number;
  max?: number;
  stiffness?: number;
  damping?: number;
}

export interface KhrJointDrive {
  type: 'linear' | 'angular';
  mode: 'force' | 'acceleration';
  axis: 0 | 1 | 2;
  positionTarget?: number;
  velocityTarget?: number;
  stiffness?: number;
  damping?: number;
  maxForce?: number;
}

export interface KhrPhysicsJointDesc {
  limits?: KhrJointLimit[];
  drives?: KhrJointDrive[];
}

export interface KhrNodePhysics {
  motion?: KhrPhysicsMotion;
  collider?: {
    geometry: { shape?: number; mesh?: number; convexHull?: boolean };
    physicsMaterial?: number;
    collisionFilter?: number;
  };
  joint?: {
    connectedNode: number;
    joint: number;
    enableCollision?: boolean;
  };
}

/** OMI_vehicle_wheel: wheel sits on local YZ plane, rotates around local X */
export interface OmiVehicleWheelDesc {
  radius: number;
  width: number;
  maxForce: number;
  steering: boolean;
  propulsion: boolean;
  suspensionStiffness?: number;
  suspensionDampingCompression?: number;
  suspensionDampingRebound?: number;
  suspensionTravel?: number;
}

/** Custom vendor extension: quantized 1/12m C12 socket + 2-threshold latch/breakaway impulse */
export interface Khr3SocketBreakaway {
  partId: ShellPartId;
  c12Tick: [number, number, number]; // round(coord * 12)
  hingeAxisLocal?: [number, number, number];
  swingMinMaxRad?: [number, number];
  latchImpulseNs: number;  // Closed -> Unlatched live Rapier revolute joint
  breakImpulseNs: number;  // -> Detached standalone debris RigidBody
}

/** Custom vendor extension: emits strictly down node local -Z (0, 0, -1) */
export interface Khr3VfxEmitterDesc {
  name: string;
  kind: 'smoke' | 'spark' | 'backfire' | 'tire_smoke' | 'coolant_steam';
  trigger: 'always' | 'rpm_load' | 'chassis_contact_impulse' | 'wheel_slip' | 'overheat';
  rateHz: number;
  speedMinMax: [number, number];
  coneOuterAngle: number; // radians, matches KHR_lights_punctual.spot.outerConeAngle
  sizeStartEnd: [number, number];
  lifetimeSec: number;
  colorStart: [number, number, number, number];
  colorEnd: [number, number, number, number];
}
