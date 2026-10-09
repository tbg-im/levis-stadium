'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BOWL, FIELD } from '@/lib/stadium/dimensions';
import { PALETTE } from '@/lib/stadium/palette';
import { fieldTexture } from './textures';

/** Rounded-rectangle outline of the bowl's inner edge, in shape space (x, -z). */
export function bowlFloorShape(inset = 0) {
  const hx = BOWL.hx - inset;
  const hz = BOWL.hz - inset;
  const r = BOWL.r - inset;
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hz);
  s.lineTo(hx - r, -hz);
  s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hx, hz - r);
  s.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hx + r, hz);
  s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hx, -hz + r);
  s.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function Goalpost({ z }: { z: number }) {
  const back = Math.sign(z);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.goalpost, roughness: 0.45 }), []);
  const crossbar = 3.05;
  const half = 5.64 / 2;
  const offset = 1.8;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 1.4, back * offset]} material={mat} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 2.8, 12]} />
      </mesh>
      <mesh position={[0, 2.8, back * offset * 0.5]} rotation={[Math.PI / 2, 0, 0]} material={mat} castShadow>
        <cylinderGeometry args={[0.1, 0.1, offset, 10]} />
      </mesh>
      <mesh position={[0, (2.8 + crossbar) / 2, 0]} material={mat} castShadow>
        <cylinderGeometry args={[0.1, 0.1, crossbar - 2.8, 10]} />
      </mesh>
      <mesh position={[0, crossbar, 0]} rotation={[0, 0, Math.PI / 2]} material={mat} castShadow>
        <cylinderGeometry args={[0.08, 0.08, half * 2, 10]} />
      </mesh>
      {[-half, half].map((x) => (
        <mesh key={x} position={[x, crossbar + 5.33, 0]} material={mat} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 10.67, 8]} />
        </mesh>
      ))}
    </group>
  );
}

export default function Field() {
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const { geometry, material } = useMemo(() => {
    const g = new THREE.ShapeGeometry(bowlFloorShape(), 24);
    // Shape space is (x, -z); map uv so the canvas covers the whole floor, north at the top.
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / (BOWL.hx * 2) + 0.5, pos.getY(i) / (BOWL.hz * 2) + 0.5);
    }
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({ map: fieldTexture(anisotropy), roughness: 0.95 });
    return { geometry: g, material: m };
  }, [anisotropy]);

  return (
    <group>
      <mesh geometry={geometry} material={material} position={[0, 0.8, 0]} receiveShadow />
      <group position={[0, 0.8, 0]}>
        <Goalpost z={-FIELD.length / 2} />
        <Goalpost z={FIELD.length / 2} />
      </group>
    </group>
  );
}
