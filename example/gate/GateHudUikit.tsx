import { computed, effect } from "@preact/signals-core";
import { Container, Fullscreen, Text } from "@react-three/uikit";
import { useEffect, useState } from "react";
import type * as THREE from "three";
import {
  exportPaperShellKhrGlb,
  type PaperShellAssembly,
  type PaperShellPresetId,
} from "../../src/paper-shell.js";
import {
  activePresetSignal,
  attachedMaskSignal,
  calibrationSignal,
  dampBucketSignal,
  dropTriggerSignal,
  eraModeSignal,
  freqBucketSignal,
  fuelLitersSignal,
  gate1UnlockedComputed,
  gateStepSignal,
  resetAllPanels,
  shadingModeSignal,
  telemetryComSignal,
  telemetryCornerKSignal,
  telemetryFrontSplitSignal,
  telemetryMassKgSignal,
  telemetrySpeedKmhSignal,
  wrenchModeSignal,
  type DampBucket,
  type FreqBucket,
} from "./gate-signals.js";
import {
  autoScaleToSi,
  rotateRootY90,
  snapTiresToYZero,
  wrapSingleMeshWithPaperShellProxy,
} from "./glb-normalizer.js";

const C_CHASSIS = "#0A0C0E";
const C_GRID = "#1C2229";
const C_AMBER = "#FFB000";
const C_CYAN = "#00E5FF";
const C_RED = "#FF3B30";
const C_PAPER = "#E6EDF3";

/** Direct @preact/signals-core computed text signals passed straight into @react-three/uikit <Text> (0 React renders at 60Hz). */
const calibrationTextSignal = computed(() => {
  const cal = calibrationSignal.value;
  return `WB=${cal.wheelbase.toFixed(2)}M  R=${cal.wheelRadii[0].toFixed(2)}M  MIN_Y=${cal.minWheelY.toFixed(4)}M  AABB=[${cal.aabbSize.join("x")}]M`;
});

const telemetryTextSignal = computed(() => {
  const mass = telemetryMassKgSignal.value.toFixed(0);
  const com = telemetryComSignal.value.map((v) => v.toFixed(2)).join(",");
  const split = telemetryFrontSplitSignal.value;
  const fPct = (split * 100).toFixed(0);
  const rPct = ((1 - split) * 100).toFixed(0);
  const [kf, kr] = telemetryCornerKSignal.value;
  const spd = telemetrySpeedKmhSignal.value.toFixed(0);
  return `MASS=${mass}KG  COM=[${com}]  F/R=${fPct}/${rPct}  K=[${kf.toFixed(0)},${kr.toFixed(0)}]  ${spd} KM/H`;
});

interface CadButtonProps {
  readonly label: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly accent?: string;
  readonly onClick: () => void;
}

function CadButton({ label, active = false, disabled = false, accent = C_AMBER, onClick }: CadButtonProps) {
  return (
    <Container
      backgroundColor={active ? accent : C_CHASSIS}
      borderColor={disabled ? C_GRID : active ? accent : C_CYAN}
      borderWidth={1}
      borderRadius={2}
      paddingX={8}
      paddingY={4}
      cursor={disabled ? undefined : "pointer"}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      <Text fontSize={10} color={disabled ? "#55606E" : active ? C_CHASSIS : C_PAPER}>
        {label}
      </Text>
    </Container>
  );
}

export interface GateHudUikitProps {
  readonly assembly: PaperShellAssembly;
  readonly rootObjRef: React.RefObject<THREE.Object3D | null>;
  readonly onWrapProxy: (proxy: PaperShellAssembly) => void;
}

export function GateHudUikit({ assembly, rootObjRef, onWrapProxy }: GateHudUikitProps) {
  const [, setUiRevision] = useState(0);

  // Re-render React tree ONLY when discrete UI mode buttons change, never on 60Hz physics telemetry!
  useEffect(() => {
    return effect(() => {
      void gateStepSignal.value;
      void activePresetSignal.value;
      void shadingModeSignal.value;
      void eraModeSignal.value;
      void freqBucketSignal.value;
      void dampBucketSignal.value;
      void wrenchModeSignal.value;
      void gate1UnlockedComputed.value;
      setUiRevision((r) => (r + 1) & 0xffff);
    });
  }, []);

  const step = gateStepSignal.value;
  const preset = activePresetSignal.value;
  const shading = shadingModeSignal.value;
  const era = eraModeSignal.value;
  const freq = freqBucketSignal.value;
  const damp = dampBucketSignal.value;
  const wrench = wrenchModeSignal.value;
  const unlocked = gate1UnlockedComputed.value;

  const handleDownloadGlb = async () => {
    const { glb } = await exportPaperShellKhrGlb(assembly, attachedMaskSignal.value, fuelLitersSignal.value);
    const blob = new Blob([glb as unknown as BlobPart], { type: "model/gltf-binary" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${assembly.lattice.preset.id}_khr3.glb`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Fullscreen flexDirection="column" justifyContent="space-between" padding={12} pointerEvents="none">
      <Container
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        backgroundColor={C_CHASSIS}
        borderColor={C_GRID}
        borderWidth={1}
        borderRadius={2}
        padding={8}
        pointerEvents="auto"
      >
        <Container flexDirection="row" gap={6} alignItems="center">
          <Text fontSize={11} color={C_AMBER}>
            {"@KHR3/CARS :: 2-STEP GLB GATE"}
          </Text>
          {(["coupe_86", "sedan_92", "kei_van"] as PaperShellPresetId[]).map((id) => (
            <CadButton
              key={id}
              label={`[ ${id.toUpperCase().replace("_", " ")} ]`}
              active={preset === id}
              onClick={() => {
                activePresetSignal.value = id;
                resetAllPanels();
              }}
            />
          ))}
        </Container>

        <Container flexDirection="row" gap={6} alignItems="center">
          <CadButton
            label={era === "dreamcast-60" ? "[ ERA: DREAMCAST 60FPS ]" : "[ ERA: JANK PSX++ 1/3 ]"}
            active={era === "psx-1-3"}
            accent={C_CYAN}
            onClick={() => {
              eraModeSignal.value = era === "dreamcast-60" ? "psx-1-3" : "dreamcast-60";
            }}
          />
          <CadButton
            label={`[ SHADING: ${shading === "psx-flat" ? "FLAT" : "SMOOTH"} ]`}
            active={shading === "dc-smooth"}
            onClick={() => {
              shadingModeSignal.value = shading === "psx-flat" ? "dc-smooth" : "psx-flat";
            }}
          />
          <CadButton label="[ STEP 1: CALIBRATION BAY ]" active={step === 1} onClick={() => { gateStepSignal.value = 1; }} />
          <CadButton
            label="[ -> STEP 2: LIVE DROP & BREAKAWAY PAD ]"
            active={step === 2}
            disabled={!unlocked}
            accent={unlocked ? C_AMBER : C_RED}
            onClick={() => { gateStepSignal.value = 2; }}
          />
        </Container>
      </Container>

      <Container
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        backgroundColor={C_CHASSIS}
        borderColor={C_GRID}
        borderWidth={1}
        borderRadius={2}
        padding={8}
        pointerEvents="auto"
      >
        {step === 1 ? (
          <Container flexDirection="row" gap={6} alignItems="center">
            <CadButton label="[ AUTO-SCALE SI ]" onClick={() => autoScaleToSi(assembly.lattice.preset.wheelbase)} />
            <CadButton label="[ ROTATE Y +90° ]" onClick={() => rotateRootY90(rootObjRef.current)} />
            <CadButton label="[ SNAP TIRES Y=0 ]" onClick={() => snapTiresToYZero(rootObjRef.current)} />
            <CadButton
              label="[ WRAP C0 PAPER-SHELL PROXY ]"
              onClick={() => onWrapProxy(wrapSingleMeshWithPaperShellProxy(rootObjRef.current, preset, shading))}
            />
            <Text fontSize={10} color={unlocked ? C_CYAN : C_RED}>
              {calibrationTextSignal}
            </Text>
          </Container>
        ) : (
          <Container flexDirection="row" gap={6} alignItems="center">
            <CadButton label="[ DROP 1.2M ]" accent={C_AMBER} onClick={() => { dropTriggerSignal.value += 1; }} />
            <CadButton
              label={wrench === "UNLATCH_200" ? "[ WRENCH: 200 N·S UNLATCH ]" : "[ WRENCH: 1800 N·S RIP OFF ]"}
              active={wrench === "RIP_1800"}
              accent={C_RED}
              onClick={() => { wrenchModeSignal.value = wrench === "UNLATCH_200" ? "RIP_1800" : "UNLATCH_200"; }}
            />
            {(["TRUCK", "STREET", "SPORT"] as FreqBucket[]).map((fb) => (
              <CadButton key={fb} label={fb} active={freq === fb} onClick={() => { freqBucketSignal.value = fb; }} />
            ))}
            {(["PLUSH", "BALANCED", "STIFF"] as DampBucket[]).map((db) => (
              <CadButton key={db} label={db} active={damp === db} accent={C_CYAN} onClick={() => { dampBucketSignal.value = db; }} />
            ))}
            <CadButton label="[ RESET PANELS ]" onClick={() => resetAllPanels()} />
            <CadButton label="[ SEAL & DOWNLOAD KHR3 .GLB ]" accent={C_CYAN} onClick={handleDownloadGlb} />
          </Container>
        )}

        <Container flexDirection="row" gap={10} alignItems="center">
          <Text fontSize={10} color={C_CYAN}>
            {telemetryTextSignal}
          </Text>
        </Container>
      </Container>
    </Fullscreen>
  );
}
