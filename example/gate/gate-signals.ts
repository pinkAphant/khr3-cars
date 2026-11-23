import { computed, signal } from "@preact/signals-core";
import {
  ALL_PANELS_ATTACHED_MASK,
  type PaperShellPresetId,
  type ShadingMode,
  type ShellPartId,
} from "../../src/paper-shell.js";

export type GateStep = 1 | 2;
export type EraMode = "dreamcast-60" | "psx-1-3";
export type FreqBucket = "TRUCK" | "STREET" | "SPORT";
export type DampBucket = "PLUSH" | "BALANCED" | "STIFF";
export type WrenchMode = "UNLATCH_200" | "RIP_1800";
export type PanelLifecycleState = "LATCHED" | "UNLATCHED" | "DETACHED";

export const FREQ_HZ: Readonly<Record<FreqBucket, number>> = Object.freeze({
  TRUCK: 1.4,
  STREET: 1.9,
  SPORT: 2.8,
});

export const DAMP_ZETA: Readonly<Record<DampBucket, number>> = Object.freeze({
  PLUSH: 0.65,
  BALANCED: 0.75,
  STIFF: 0.85,
});

export interface CalibrationMetrics {
  readonly wheelbase: number;
  readonly trackWidth: number;
  readonly wheelRadii: readonly [number, number, number, number];
  readonly minWheelY: number;
  readonly aabbSize: readonly [number, number, number];
  readonly isSingleMeshProxy: boolean;
}

export interface DetachedDebrisItem {
  readonly id: string;
  readonly partId: ShellPartId;
  readonly massKg: number;
  readonly position: [number, number, number];
  readonly quaternion: [number, number, number, number];
  readonly linvel: [number, number, number];
  readonly angvel: [number, number, number];
  readonly aabbSize: [number, number, number];
  readonly colorHex: number;
}

export const gateStepSignal = signal<GateStep>(1);
export const activePresetSignal = signal<PaperShellPresetId>("coupe_86");
export const shadingModeSignal = signal<ShadingMode>("psx-flat");
export const eraModeSignal = signal<EraMode>("dreamcast-60");
export const freqBucketSignal = signal<FreqBucket>("STREET");
export const dampBucketSignal = signal<DampBucket>("BALANCED");
export const wrenchModeSignal = signal<WrenchMode>("UNLATCH_200");

export const attachedMaskSignal = signal<number>(ALL_PANELS_ATTACHED_MASK);
export const unlatchedMaskSignal = signal<number>(0);
export const massDirtySignal = signal<boolean>(true);
export const fuelLitersSignal = signal<number>(42);
export const dropTriggerSignal = signal<number>(0);

export const calibrationSignal = signal<CalibrationMetrics>({
  wheelbase: 2.40,
  trackWidth: 1.36,
  wheelRadii: [0.31, 0.31, 0.31, 0.31],
  minWheelY: 0.0,
  aabbSize: [1.62, 1.28, 4.18],
  isSingleMeshProxy: false,
});

export const gate1UnlockedComputed = computed(() => {
  const c = calibrationSignal.value;
  const wbOk = c.wheelbase >= 1.6 && c.wheelbase <= 4.8;
  const rOk = c.wheelRadii.every((r) => r >= 0.20 && r <= 0.55);
  const yOk = Math.abs(c.minWheelY) <= 0.005;
  return wbOk && rOk && yOk;
});

export const telemetryMassKgSignal = signal<number>(780);
export const telemetryComSignal = signal<[number, number, number]>([0, 0.42, 0.08]);
export const telemetryFrontSplitSignal = signal<number>(0.53);
export const telemetryCornerKSignal = signal<[number, number]>([28500, 26200]);
export const telemetrySpeedKmhSignal = signal<number>(0);
export const telemetryRpmSignal = signal<number>(850);
export const sparkBurstSignal = signal<[number, number, number] | null>(null);
export const detachedDebrisSignal = signal<readonly DetachedDebrisItem[]>([]);

export function resetAllPanels(): void {
  attachedMaskSignal.value = ALL_PANELS_ATTACHED_MASK;
  unlatchedMaskSignal.value = 0;
  detachedDebrisSignal.value = [];
  massDirtySignal.value = true;
}
