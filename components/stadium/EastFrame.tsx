'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TIER_LAYOUTS } from '@/lib/stadium/bowl';
import { CONCOURSE, EAST_FRAME } from '@/lib/stadium/dimensions';
import { PALETTE } from '@/lib/stadium/palette';
import { pointsAlong, ringFrame, sweepProfile, yawFromNormal } from '@/lib/stadium/ring';

const UP = new THREE.Vector3(0, 1, 0);

function beam(a: THREE.Vector3, b: THREE.Vector3, size: number) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  return new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
    q,
    new THREE.Vector3(size, len, size),
  );
}

/**
 * The east side's exposed steel: concourse decks stacked under the upper deck, column lines
 * at the back of the deck and on the outer frame, X-bracing between outer columns, three
 * stair cores, and the light rig on the upper deck's rim.
 */
export default function EastFrame() {
  const upper = TIER_LAYOUTS.find((t) => t.spec.id === 'upper-east')!;
  const club = TIER_LAYOUTS.find((t) => t.spec.id === 'club-east')!;
  const lower = TIER_LAYOUTS[0];
  const spans = upper.spec.spans.map(({ piece, from, to }) => ({ piece, from, to }));
  const { inner, outer, top } = EAST_FRAME;

  const decks = useMemo(() => {
    const slab = (d0: number, d1: number, y: number) =>
      sweepProfile(
        [
          [d0, y - 0.7],
          [d1, y - 0.7],
          [d1, y + 1.1],
          [d1 + 0.2, y + 1.1],
          [d1 + 0.2, y],
          [d0, y],
        ],
        spans,
      );
    const soffitAt = (d: number) =>
      upper.spec.y0 -
      upper.spec.fasciaDrop! +
      ((d - upper.spec.d0) / (upper.dEnd - upper.spec.d0)) * (upper.yTop - 1.6 - (upper.spec.y0 - upper.spec.fasciaDrop!));
    const crown = sweepProfile(
      [
        [inner - 0.3, top - 1.4],
        [outer + 0.4, top - 1.4],
        [outer + 0.4, top],
        [inner - 0.3, top],
      ],
      spans,
    );
    return {
      geometry: mergeGeometries([
        slab(CONCOURSE.outer + 0.3, outer, lower.yTop),
        slab(club.dEnd, outer, club.yTop + 0.2),
        slab(48, outer, soffitAt(48) - 1.2),
        crown,
      ])!,
    };
  }, [spans, upper, club, lower, inner, outer, top]);

  const frame = useMemo(() => {
    const cols = pointsAlong(spans, outer, 9);
    const back = cols.map((c) => ringFrame(c.piece, c.f, inner));
    const matrices: THREE.Matrix4[] = [];
    for (const c of cols) matrices.push(beam(new THREE.Vector3(c.x, 0, c.z), new THREE.Vector3(c.x, top, c.z), 1.1));
    for (const c of back) {
      matrices.push(beam(new THREE.Vector3(c.x, 0, c.z), new THREE.Vector3(c.x, upper.yTop - 1.6, c.z), 1.2));
    }
    // Rakers: from the outer column top down to the deck's back edge.
    for (let i = 0; i < cols.length; i++) {
      const o = cols[i];
      const b = back[i];
      matrices.push(beam(new THREE.Vector3(o.x, top - 0.7, o.z), new THREE.Vector3(b.x, upper.yTop, b.z), 0.8));
    }
    // X-bracing between outer columns in alternate bays.
    const bands = [0, lower.yTop, club.yTop + 0.2, 38, top - 1.4];
    for (let i = 0; i < cols.length - 1; i += 2) {
      const a = cols[i];
      const b = cols[i + 1];
      for (let k = 0; k < bands.length - 1; k++) {
        const y0 = bands[k];
        const y1 = bands[k + 1];
        matrices.push(beam(new THREE.Vector3(a.x, y0, a.z), new THREE.Vector3(b.x, y1, b.z), 0.45));
        matrices.push(beam(new THREE.Vector3(b.x, y0, b.z), new THREE.Vector3(a.x, y1, a.z), 0.45));
      }
    }
    return matrices;
  }, [spans, outer, inner, top, upper, lower, club]);

  const lights = useMemo(() => {
    const pts = pointsAlong(spans, upper.dEnd - 0.2, 6.5);
    return pts.map((p) => {
      const yaw = yawFromNormal(p.nx, p.nz);
      return new THREE.Matrix4().compose(
        new THREE.Vector3(p.x, upper.yTop + 2.4, p.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, yaw, 0, 'YXZ')),
        new THREE.Vector3(2.4, 1.4, 0.4),
      );
    });
  }, [spans, upper]);

  const cores = useMemo(
    () =>
      [0.12, 0.5, 0.88].map((f) => {
        const p = ringFrame(2, f, outer + 5);
        return { position: [p.x, top / 2 - 2, p.z] as [number, number, number] };
      }),
    [outer, top],
  );

  const mats = useMemo(
    () => ({
      deck: new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.9, side: THREE.DoubleSide }),
      steel: new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.55, metalness: 0.1 }),
      light: new THREE.MeshStandardMaterial({ color: '#f5f3ea', emissive: '#fff6dc', emissiveIntensity: 0.6 }),
      core: new THREE.MeshStandardMaterial({ color: PALETTE.facade, roughness: 0.8 }),
    }),
    [],
  );

  const frameRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    for (const [ref, list] of [
      [frameRef, frame],
      [lightRef, lights],
    ] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [frame, lights]);

  return (
    <group>
      <mesh geometry={decks.geometry} material={mats.deck} castShadow receiveShadow />
      <instancedMesh ref={frameRef} args={[undefined, mats.steel, frame.length]} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, mats.light, lights.length]}>
        <boxGeometry />
      </instancedMesh>
      {cores.map((c, i) => (
        <group key={i} position={c.position}>
          <mesh material={mats.core} castShadow receiveShadow>
            <boxGeometry args={[8, top - 4, 9]} />
          </mesh>
          <mesh position={[0, (top - 4) / 2 + 0.4, 0]} material={mats.steel} castShadow>
            <boxGeometry args={[8.6, 0.8, 9.6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
