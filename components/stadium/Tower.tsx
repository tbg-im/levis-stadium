'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { TIER_LAYOUTS } from '@/lib/stadium/bowl';
import { TOWER } from '@/lib/stadium/dimensions';
import { PALETTE } from '@/lib/stadium/palette';
import { ribbonStrip } from '@/lib/stadium/ring';
import { greenRoofTexture, solarTexture, towerEndTexture, towerFacadeTexture } from './textures';

const ROOF_FRONT = -72;
const ROOF_BOTTOM = TOWER.roof - 0.6;
const ROOF_TOP = TOWER.roof + 0.8;

/**
 * SAP Tower, the west-side suite tower: exterior facade, end blocks, the roof canopy that
 * shades the west upper deck (solar panels on the outer half, the green roof inside), and the
 * light rig along its front edge.
 */
export default function Tower() {
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const length = TOWER.south - TOWER.north;
  const midZ = (TOWER.south + TOWER.north) / 2;
  const depth = TOWER.front - TOWER.back;

  const mats = useMemo(() => {
    const solar = solarTexture();
    solar.repeat.set(length / 4, 9 / 4);
    const green = greenRoofTexture();
    green.repeat.set(length / 6, 9 / 6);
    const end = towerEndTexture(anisotropy);
    const endMat = new THREE.MeshStandardMaterial({ map: end, roughness: 0.8 });
    const plain = new THREE.MeshStandardMaterial({ color: PALETTE.facade, roughness: 0.85 });
    return {
      facade: new THREE.MeshStandardMaterial({
        map: towerFacadeTexture(anisotropy),
        roughness: 0.55,
        metalness: 0.05,
      }),
      plain,
      // Box face order: +x, -x, +y, -y, +z, -z. End blocks show balconies on every vertical face.
      endBlock: [endMat, endMat, plain, plain, endMat, endMat],
      roof: new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.7 }),
      solar: new THREE.MeshStandardMaterial({ map: solar, roughness: 0.25, metalness: 0.4 }),
      green: new THREE.MeshStandardMaterial({ map: green, roughness: 1 }),
      glass: new THREE.MeshStandardMaterial({
        color: PALETTE.glass,
        roughness: 0.08,
        metalness: 0.35,
        envMapIntensity: 1.3,
        side: THREE.DoubleSide,
      }),
      light: new THREE.MeshStandardMaterial({ color: '#f5f3ea', emissive: '#fff6dc', emissiveIntensity: 0.6 }),
      dark: new THREE.MeshStandardMaterial({ color: PALETTE.boardBack, roughness: 0.6 }),
    };
  }, [anisotropy, length]);

  // Suite glass between the west club tier and the west upper deck.
  const suiteGlass = useMemo(() => {
    const club = TIER_LAYOUTS.find((t) => t.spec.id === 'club-west')!;
    const upper = TIER_LAYOUTS.find((t) => t.spec.id === 'upper-west')!;
    return ribbonStrip(club.spec.spans, club.dEnd + 0.15, club.yTop, upper.spec.y0 - upper.spec.fasciaDrop!);
  }, []);

  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const lightCount = Math.floor(length / 5);
  useLayoutEffect(() => {
    const mesh = lightsRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, -0.5, 'YXZ'));
    for (let i = 0; i < lightCount; i++) {
      m.compose(
        new THREE.Vector3(ROOF_FRONT + 0.6, ROOF_TOP + 0.7, TOWER.north + 2.5 + i * 5),
        q,
        new THREE.Vector3(2.6, 1.3, 0.4),
      );
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [lightCount]);

  // End blocks sit just inside the facade and clear of the west tiers' end caps, so no two
  // faces share a plane (coplanar faces flicker as the camera moves).
  const block = (z0: number, z1: number) => (
    <mesh
      position={[(TOWER.front + TOWER.back + 0.3) / 2, (TOWER.roof - 0.3) / 2, (z0 + z1) / 2]}
      material={mats.endBlock}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[depth - 0.3, TOWER.roof - 0.3, Math.abs(z1 - z0)]} />
    </mesh>
  );

  return (
    <group>
      {/* Exterior wall and its facade */}
      <mesh position={[TOWER.back + 0.85, (TOWER.roof - 0.3) / 2, midZ]} material={mats.plain} castShadow receiveShadow>
        <boxGeometry args={[1.3, TOWER.roof - 0.3, length - 0.6]} />
      </mesh>
      <mesh position={[TOWER.back, TOWER.roof / 2, midZ]} rotation={[0, -Math.PI / 2, 0]} material={mats.facade}>
        <planeGeometry args={[length, TOWER.roof]} />
      </mesh>
      {/* Entry canopy over the west gates */}
      <mesh position={[TOWER.back - 4, 6.2, midZ]} material={mats.roof} castShadow receiveShadow>
        <boxGeometry args={[8, 0.5, 58]} />
      </mesh>

      {block(TOWER.north, -TOWER.blockStart - 0.2)}
      {block(TOWER.blockStart + 0.2, TOWER.south)}

      {/* Roof canopy */}
      <mesh
        position={[(ROOF_FRONT + TOWER.back - 1) / 2, (ROOF_BOTTOM + ROOF_TOP) / 2, midZ]}
        material={mats.roof}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[ROOF_FRONT - TOWER.back + 1, ROOF_TOP - ROOF_BOTTOM, length + 1]} />
      </mesh>
      <mesh position={[TOWER.back + 5, ROOF_TOP + 0.45, midZ]} rotation={[-Math.PI / 2, 0, 0]} material={mats.solar} castShadow>
        <boxGeometry args={[9, length - 4, 0.25]} />
      </mesh>
      <mesh position={[TOWER.back + 14.5, ROOF_TOP + 0.08, midZ]} rotation={[-Math.PI / 2, 0, 0]} material={mats.green}>
        <planeGeometry args={[9, length - 8]} />
      </mesh>
      {/* Roof-edge fascia and stadium lights */}
      <mesh position={[ROOF_FRONT, ROOF_TOP - 1.2, midZ]} material={mats.dark} castShadow>
        <boxGeometry args={[0.6, 2.4, length]} />
      </mesh>
      <instancedMesh ref={lightsRef} args={[undefined, mats.light, lightCount]}>
        <boxGeometry />
      </instancedMesh>

      <mesh geometry={suiteGlass} material={mats.glass} />
    </group>
  );
}
