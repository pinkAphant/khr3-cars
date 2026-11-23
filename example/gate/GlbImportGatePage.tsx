import { Bounds, Bvh, Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildPaperShellAssembly, type PaperShellAssembly } from "../../src/paper-shell.js";
import { GateHudUikit } from "./GateHudUikit.js";
import { ImperativeVehicleRig } from "./ImperativeVehicleRig.js";
import { VfxEmitterPool } from "./VfxEmitterPool.js";
import {
  activePresetSignal, calibrationSignal, eraModeSignal, gateStepSignal, shadingModeSignal,
} from "./gate-signals.js";
import { measureAssemblyCalibration, wrapSingleMeshWithPaperShellProxy } from "./glb-normalizer.js";

function makeBufGeo(pos: Float32Array, nrm: Float32Array): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  return g;
}

function Step1CalibrationPlinth({
  assembly, importedRoot, rootObjRef,
}: {
  readonly assembly: PaperShellAssembly;
  readonly importedRoot: THREE.Object3D | null;
  readonly rootObjRef: React.RefObject<THREE.Group | null>;
}) {
  const cal = calibrationSignal.value;
  const panelGeos = useMemo(() => assembly.panels.map((p) => makeBufGeo(p.localPositions, p.localNormals)), [assembly]);
  const wheelGeo = useMemo(() => makeBufGeo(assembly.wheels[0].positions, assembly.wheels[0].normals), [assembly]);

  return (
    <Bounds fit clip observe margin={1.35}>
      <Bvh firstHitOnly>
        <group ref={rootObjRef}>
          {importedRoot && <primitive object={importedRoot} />}
          {assembly.panels.map((p, idx) => (
            <mesh key={p.partId} position={p.anchorChassis} geometry={panelGeos[idx]}>
              <meshStandardMaterial
                color={p.colorHex} roughness={p.isGlass ? 0.15 : 0.88}
                transparent={p.isGlass || Boolean(importedRoot)} opacity={importedRoot ? 0.28 : p.isGlass ? 0.32 : 1.0}
                wireframe={Boolean(importedRoot)} flatShading={assembly.shadingMode === "psx-flat"}
              />
            </mesh>
          ))}
          {assembly.wheels.map((w) => (
            <group key={w.slotId} position={w.position}>
              <mesh geometry={wheelGeo}><meshStandardMaterial color={0x1c2229} roughness={0.9} flatShading /></mesh>
              <mesh position={[0, -w.omi.radius, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
                <ringGeometry args={[w.omi.radius * 0.75, w.omi.radius * 0.95, 16]} />
                <meshBasicMaterial color={0x00e5ff} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, cal.aabbSize[1] * 0.5, 0]}>
            <boxGeometry args={[cal.aabbSize[0], cal.aabbSize[1], cal.aabbSize[2]]} />
            <meshBasicMaterial color={0x00e5ff} wireframe />
          </mesh>
          {assembly.lights.map((l) => (
            <group key={l.name} position={l.position} quaternion={l.quaternion}>
              <mesh position={[0, 0, -0.25]} rotation={[Math.PI * 0.5, 0, 0]}>
                <coneGeometry args={[0.14, 0.5, 8, 1, true]} /><meshBasicMaterial color={0xffb000} wireframe />
              </mesh>
            </group>
          ))}
          {assembly.emitters.map((e) => (
            <group key={e.name} position={e.position} quaternion={e.quaternion}>
              <mesh position={[0, 0, -0.25]} rotation={[Math.PI * 0.5, 0, 0]}>
                <coneGeometry args={[0.14, 0.5, 8, 1, true]} /><meshBasicMaterial color={0x00e5ff} wireframe />
              </mesh>
            </group>
          ))}
        </group>
        <mesh position={[0, 0.01, 2.8]} rotation={[-Math.PI * 0.5, 0, 0]}>
          <coneGeometry args={[0.25, 0.6, 3]} /><meshBasicMaterial color={0x00e5ff} wireframe />
        </mesh>
        <mesh position={[1.6, 0.01, 0]} rotation={[-Math.PI * 0.5, 0, -Math.PI * 0.5]}>
          <coneGeometry args={[0.2, 0.45, 3]} /><meshBasicMaterial color={0xffb000} wireframe />
        </mesh>
      </Bvh>
    </Bounds>
  );
}

export function GlbImportGatePage() {
  const [proxyAssembly, setProxyAssembly] = useState<PaperShellAssembly | null>(null);
  const [importedRoot, setImportedRoot] = useState<THREE.Object3D | null>(null);
  const [, setVersion] = useState(0);
  const rootObjRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const id = setInterval(() => setVersion((v) => (v + 1) & 0xffff), 100);
    return () => clearInterval(id);
  }, []);

  const presetId = activePresetSignal.value;
  const shading = shadingModeSignal.value;
  const step = gateStepSignal.value;
  const era = eraModeSignal.value;

  const assembly = useMemo(() => {
    if (proxyAssembly) return proxyAssembly;
    const built = buildPaperShellAssembly(presetId, shading);
    measureAssemblyCalibration(built, 1, 0, false);
    return built;
  }, [presetId, shading, proxyAssembly]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    file.arrayBuffer().then((buf) => {
      new GLTFLoader().parse(buf, "", (gltf) => {
        setImportedRoot(gltf.scene);
        setProxyAssembly(wrapSingleMeshWithPaperShellProxy(gltf.scene, presetId, shading));
      });
    });
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        width: "100vw", height: "100vh", margin: 0, overflow: "hidden",
        background: "#0A0C0E", imageRendering: era === "psx-1-3" ? "pixelated" : "auto",
      }}
    >
      <Canvas
        dpr={era === "psx-1-3" ? 0.333 : [1, 1.5]}
        gl={{ localClippingEnabled: true, antialias: false }}
        camera={{ position: [3.6, 2.2, 4.4], fov: 45 }}
      >
        <color attach="background" args={["#0A0C0E"]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 10, 8]} intensity={1.35} />
        <directionalLight position={[-6, 4, -6]} intensity={0.45} color="#00E5FF" />
        <Grid infiniteGrid cellSize={0.5} sectionSize={2.0} sectionColor="#1C2229" cellColor="#12161B" fadeDistance={40} />
        <OrbitControls makeDefault enableDamping />

        {step === 1 ? (
          <Step1CalibrationPlinth assembly={assembly} importedRoot={importedRoot} rootObjRef={rootObjRef} />
        ) : (
          <Physics interpolate timeStep={1 / 60}>
            <RigidBody type="fixed" position={[0, -0.25, 0]} colliders={false}>
              <CuboidCollider args={[60, 0.25, 60]} friction={0.85} />
            </RigidBody>
            <ImperativeVehicleRig assembly={assembly} chassisGroupRef={rootObjRef} />
          </Physics>
        )}

        <VfxEmitterPool chassisObjRef={rootObjRef} emitters={assembly.emitters} />
        <GateHudUikit assembly={assembly} rootObjRef={rootObjRef} onWrapProxy={(p) => setProxyAssembly(p)} />
      </Canvas>
    </div>
  );
}
