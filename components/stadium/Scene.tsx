'use client';

import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { PALETTE } from '@/lib/stadium/palette';
import Bowl, { type LevelFilter } from './Bowl';
import EastFrame from './EastFrame';
import Field from './Field';
import Site from './Site';
import Tower from './Tower';
import VideoBoards from './VideoBoards';

export type SceneProps = {
  controlsRef: RefObject<CameraControls | null>;
  selectedKey: string | null;
  hoveredKey: string | null;
  levelFilter: LevelFilter;
  showSurroundings: boolean;
  onHover: (key: string | null) => void;
  onSelect: (key: string) => void;
  onAzimuth: (radians: number) => void;
  labels: ScreenLabel[];
  labelElements: RefObject<Map<string, HTMLElement>>;
};

function Environment() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [get]);
  return null;
}

function Sun() {
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <hemisphereLight args={['#f1f5ff', '#d8d0c2', 1.15]} />
      <primitive object={target} position={[0, 0, 0]} />
      <directionalLight
        color="#fff3e2"
        intensity={2.7}
        position={[-320, 420, 190]}
        target={target}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-340}
        shadow-camera-right={340}
        shadow-camera-top={340}
        shadow-camera-bottom={-340}
        shadow-camera-near={50}
        shadow-camera-far={1400}
        shadow-bias={-0.0004}
        shadow-normalBias={0.5}
      />
    </>
  );
}

export type ScreenLabel = { id: string; position: [number, number, number] };

/**
 * Projects world-space label anchors onto the DOM overlay every frame. Writing transforms
 * straight to the elements keeps labels in sync with the camera without React renders.
 */
function LabelProjector({
  labels,
  elements,
}: {
  labels: ScreenLabel[];
  elements: RefObject<Map<string, HTMLElement>>;
}) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const label of labels) {
      const el = elements.current.get(label.id);
      if (!el) continue;
      v.set(...label.position).project(camera);
      if (v.z > 1 || v.z < -1) {
        el.style.visibility = 'hidden';
        continue;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      el.style.visibility = 'visible';
    }
  });
  return null;
}

export const VIEWS = {
  overview: { label: 'Overview', position: [-330, 230, 250], target: [0, 8, 0] },
  aerial: { label: 'Aerial', position: [0, 760, 1], target: [0, 0, 0] },
  sideline: { label: '50-yard line', position: [58, 12, 0], target: [0, 9, 0] },
  endzone: { label: 'End zone', position: [0, 26, -94], target: [0, 0, 18] },
  tower: { label: 'Tower facade', position: [-260, 38, 120], target: [-92, 22, 0] },
} as const satisfies Record<string, { label: string; position: number[]; target: number[] }>;

export type ViewName = keyof typeof VIEWS;

export default function Scene({
  controlsRef,
  selectedKey,
  hoveredKey,
  levelFilter,
  showSurroundings,
  onHover,
  onSelect,
  onAzimuth,
  labels,
  labelElements,
}: SceneProps) {
  return (
    <>
      <color attach="background" args={[PALETTE.background]} />
      <fog attach="fog" args={[PALETTE.background, 1500, 4200]} />
      <Environment />
      <Sun />
      <Field />
      <Bowl
        selectedKey={selectedKey}
        hoveredKey={hoveredKey}
        levelFilter={levelFilter}
        onHover={onHover}
        onSelect={onSelect}
      />
      <Tower />
      <EastFrame />
      <VideoBoards />
      {showSurroundings && <Site />}
      <LabelProjector labels={labels} elements={labelElements} />
      <CameraControls
        ref={controlsRef}
        makeDefault
        minDistance={8}
        maxDistance={2400}
        maxPolarAngle={Math.PI * 0.48}
        dollyToCursor
        smoothTime={0.35}
        onChange={() => {
          const c = controlsRef.current;
          if (c) onAzimuth(c.azimuthAngle);
        }}
      />
      <EffectComposer multisampling={0}>
        <N8AO quality="medium" aoRadius={4} distanceFalloff={1} intensity={2.2} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <SMAA />
      </EffectComposer>
    </>
  );
}
