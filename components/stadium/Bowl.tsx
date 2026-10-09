'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ThreeEvent } from '@react-three/fiber';
import { BOWL_TIERS, tierCaps, type LevelId, type TierSeats } from '@/lib/stadium/bowl';
import { CONCOURSE } from '@/lib/stadium/dimensions';
import { PALETTE } from '@/lib/stadium/palette';
import { profileCap, ribbonStrip, sweepProfile, type Span } from '@/lib/stadium/ring';
import { ribbonTexture } from './textures';

export type LevelFilter = 'all' | LevelId;

type BowlProps = {
  selectedKey: string | null;
  hoveredKey: string | null;
  levelFilter: LevelFilter;
  onHover: (key: string | null) => void;
  onSelect: (key: string) => void;
};

const FULL_RING: Span[] = Array.from({ length: 8 }, (_, piece) => ({ piece, from: 0, to: 1 }));

function seatGeometry() {
  const pan = new THREE.BoxGeometry(0.44, 0.07, 0.4).translate(0, 0.42, 0.02);
  const back = new THREE.BoxGeometry(0.44, 0.44, 0.06).translate(0, 0.66, 0.22);
  const stand = new THREE.BoxGeometry(0.06, 0.4, 0.06).translate(0, 0.2, 0.08);
  return mergeGeometries([pan, back, stand])!;
}

function useBowlGeometry() {
  return useMemo(() => {
    const sections = BOWL_TIERS.flatMap((tier) =>
      tier.sections.map((s) => ({
        key: s.key,
        geometry: sweepProfile(tier.layout.profile, [{ piece: s.piece, from: s.from, to: s.to }]),
      })),
    );
    const caps = mergeGeometries(
      BOWL_TIERS.flatMap((tier) =>
        tierCaps(tier.layout.spec).map((c) => profileCap(tier.layout.profile, c.piece, c.f)),
      ),
    )!;
    const ribbons = mergeGeometries(
      BOWL_TIERS.filter((t) => t.layout.spec.fasciaDrop !== null).map((t) => {
        const { spec } = t.layout;
        const bottom = spec.y0 - spec.fasciaDrop! + 0.6;
        return ribbonStrip(spec.spans, spec.d0 - 0.1, bottom, bottom + 1.2);
      }),
    )!;
    const lower = BOWL_TIERS[0].layout;
    const y = lower.yTop;
    const concourse = sweepProfile(
      [
        [lower.dEnd - 0.3, y],
        [CONCOURSE.outer, y],
        [CONCOURSE.outer, y + 1.1],
        [CONCOURSE.outer + 0.3, y + 1.1],
        [CONCOURSE.outer + 0.3, 0],
        [lower.dEnd - 0.3, 0],
      ],
      FULL_RING,
    );
    // Dark strip along the field wall where the padding and field-level boards sit.
    const fieldWall = ribbonStrip(FULL_RING, -0.1, 1.0, 2.6);
    return { sections, caps, ribbons, concourse, fieldWall };
  }, []);
}

function TierSeatsMesh({
  tier,
  selectedKey,
  hoveredKey,
  levelFilter,
  geometry,
  material,
}: {
  tier: TierSeats;
  selectedKey: string | null;
  hoveredKey: string | null;
  levelFilter: LevelFilter;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(tier.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [tier]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const base = new THREE.Color(PALETTE.seat);
    const dim = new THREE.Color(PALETTE.seatDim);
    const sel = new THREE.Color(PALETTE.highlight);
    const hov = new THREE.Color(PALETTE.hover);
    for (const s of tier.sections) {
      const color =
        s.key === selectedKey
          ? sel
          : s.key === hoveredKey
            ? hov
            : levelFilter !== 'all' && levelFilter !== s.level
              ? dim
              : base;
      for (let i = s.seatStart; i < s.seatStart + s.seats; i++) mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [tier, selectedKey, hoveredKey, levelFilter]);

  return <instancedMesh ref={ref} args={[geometry, material, tier.count]} receiveShadow frustumCulled={false} />;
}

export default function Bowl({ selectedKey, hoveredKey, levelFilter, onHover, onSelect }: BowlProps) {
  const geo = useBowlGeometry();

  const mats = useMemo(() => {
    const concrete = new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.92, side: THREE.DoubleSide });
    const hover = concrete.clone();
    hover.color.set('#dfe8fb');
    const selected = concrete.clone();
    selected.color.set('#c6d8ff');
    const ribbonMap = ribbonTexture();
    return {
      concrete,
      hover,
      selected,
      seat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }),
      ribbon: new THREE.MeshStandardMaterial({
        map: ribbonMap,
        emissive: '#ffffff',
        emissiveMap: ribbonMap,
        emissiveIntensity: 0.55,
        roughness: 0.4,
        side: THREE.DoubleSide,
      }),
      wall: new THREE.MeshStandardMaterial({ color: '#2f3a33', roughness: 0.8, side: THREE.DoubleSide }),
      // Box faces: +x, -x, +y, -y, +z, -z (the tunnel mouth faces the field).
      vomitory: [
        new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: PALETTE.concreteDark, roughness: 0.95 }),
        new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: PALETTE.tunnel, roughness: 1 }),
      ],
    };
  }, []);

  const seatGeo = useMemo(() => seatGeometry(), []);
  const vomGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const vomRef = useRef<THREE.InstancedMesh>(null);
  const vomitories = useMemo(() => BOWL_TIERS.flatMap((t) => t.vomitories), []);

  useLayoutEffect(() => {
    const mesh = vomRef.current;
    if (!mesh) return;
    vomitories.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [vomitories]);

  const handlers = (key: string) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(key);
    },
    onPointerOut: () => onHover(null),
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return;
      e.stopPropagation();
      onSelect(key);
    },
  });

  return (
    <group>
      {geo.sections.map((s) => (
        <mesh
          key={s.key}
          geometry={s.geometry}
          material={s.key === selectedKey ? mats.selected : s.key === hoveredKey ? mats.hover : mats.concrete}
          castShadow
          receiveShadow
          {...handlers(s.key)}
        />
      ))}
      <mesh geometry={geo.caps} material={mats.concrete} castShadow receiveShadow />
      <mesh geometry={geo.concourse} material={mats.concrete} castShadow receiveShadow />
      <mesh geometry={geo.ribbons} material={mats.ribbon} />
      <mesh geometry={geo.fieldWall} material={mats.wall} receiveShadow />
      {BOWL_TIERS.map((tier) => (
        <TierSeatsMesh
          key={tier.layout.spec.id}
          tier={tier}
          selectedKey={selectedKey}
          hoveredKey={hoveredKey}
          levelFilter={levelFilter}
          geometry={seatGeo}
          material={mats.seat}
        />
      ))}
      <instancedMesh ref={vomRef} args={[vomGeo, mats.vomitory, vomitories.length]} castShadow receiveShadow />
    </group>
  );
}
