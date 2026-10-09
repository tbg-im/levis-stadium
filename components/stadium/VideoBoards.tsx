'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { VIDEO_BOARD } from '@/lib/stadium/dimensions';
import { PALETTE } from '@/lib/stadium/palette';
import { boardTexture, signTexture } from './textures';

/** One 200 × 48 ft board on its steel frame, facing the field (+z in local space). */
function Board({ position, rotation, home }: { position: [number, number, number]; rotation: number; home: boolean }) {
  const { width, height, bottom } = VIDEO_BOARD;
  const mats = useMemo(() => {
    const screen = boardTexture(home);
    const sign = signTexture();
    return {
      screen: new THREE.MeshStandardMaterial({
        map: screen,
        emissive: '#ffffff',
        emissiveMap: screen,
        emissiveIntensity: 0.9,
        roughness: 0.35,
      }),
      sign: new THREE.MeshStandardMaterial({ map: sign, emissive: '#ffffff', emissiveMap: sign, emissiveIntensity: 0.25 }),
      back: new THREE.MeshStandardMaterial({ color: PALETTE.boardBack, roughness: 0.7 }),
      steel: new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.55 }),
    };
  }, [home]);

  const cy = bottom + height / 2;
  const legs = [-width / 2 + 4, -width / 6, width / 6, width / 2 - 4];
  const signY = bottom + height + 3.4;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, cy, -1.2]} material={mats.back} castShadow receiveShadow>
        <boxGeometry args={[width + 1.2, height + 1.2, 2.4]} />
      </mesh>
      <mesh position={[0, cy, 0.1]} material={mats.screen}>
        <planeGeometry args={[width, height]} />
      </mesh>
      {legs.map((x) => (
        <group key={x}>
          <mesh position={[x, bottom / 2, -2.4]} material={mats.steel} castShadow>
            <boxGeometry args={[1.4, bottom, 1.4]} />
          </mesh>
          <mesh position={[x, bottom / 2, -7]} material={mats.steel} castShadow>
            <boxGeometry args={[1, bottom, 1]} />
          </mesh>
        </group>
      ))}
      {[bottom * 0.35, bottom * 0.7, bottom - 0.6].map((y) => (
        <mesh key={y} position={[0, y, -4.7]} material={mats.steel} castShadow>
          <boxGeometry args={[width - 6, 0.8, 5.4]} />
        </mesh>
      ))}
      <mesh position={[0, signY, -1.2]} material={mats.steel} castShadow>
        <boxGeometry args={[24, 5, 1.2]} />
      </mesh>
      {[-0.5, -1.9].map((z, i) => (
        <mesh key={z} position={[0, signY, z]} rotation={[0, i === 0 ? 0 : Math.PI, 0]} material={mats.sign}>
          <planeGeometry args={[23, 4.6]} />
        </mesh>
      ))}
    </group>
  );
}

export default function VideoBoards() {
  return (
    <group>
      <Board position={[-14, 0, -112]} rotation={0} home />
      <Board position={[14, 0, 112]} rotation={Math.PI} home={false} />
    </group>
  );
}
