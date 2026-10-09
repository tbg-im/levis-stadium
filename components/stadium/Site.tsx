'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAR_COLORS, PALETTE } from '@/lib/stadium/palette';
import {
  MAJOR_ROADS,
  PATHS,
  SITE,
  extrudedBuildings,
  flatPolygons,
  mainAxis,
  pointInPolygon,
  polygonArea,
  ribbons,
  rng,
  shapeOf,
} from '@/lib/stadium/site';
import { parkingTexture, practiceFieldTexture, solarTexture } from './textures';

type P = [number, number];
const RADIUS = 1000;
const within = (p: P[]) => p.some(([x, z]) => Math.abs(x) < RADIUS && Math.abs(z) < RADIUS);

function pitchGeometry(poly: P[], y: number) {
  const g = new THREE.ShapeGeometry(shapeOf(poly));
  const a = mainAxis(poly);
  const ax = Math.cos(a);
  const az = Math.sin(a);
  const pos = g.getAttribute('position');
  const along: number[] = [];
  const across: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = -pos.getY(i);
    along.push(x * ax + z * az);
    across.push(-x * az + z * ax);
  }
  const [a0, a1] = [Math.min(...along), Math.max(...along)];
  const [c0, c1] = [Math.min(...across), Math.max(...across)];
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (across[i] - c0) / (c1 - c0), (along[i] - a0) / (a1 - a0));
  return g.rotateX(-Math.PI / 2).translate(0, y, 0);
}

function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, matrices: THREE.Matrix4[], colors?: THREE.Color[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    colors?.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, matrices, colors]);
}

function buildTrees() {
  const rand = rng(42);
  const outline = SITE.stadiumOutline;
  const blocked = (p: P) =>
    Math.hypot(p[0], p[1]) > RADIUS ||
    pointInPolygon(p, outline) ||
    SITE.buildings.some((b) => pointInPolygon(p, b.p)) ||
    SITE.pitches.some((b) => pointInPolygon(p, b.p));
  const pts: P[] = [];
  const along = (line: P[], spacing: number, offset: () => number) => {
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, z0] = line[i];
      const [x1, z1] = line[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const nx = -(z1 - z0) / len;
      const nz = (x1 - x0) / len;
      for (let t = rand() * spacing; t < len; t += spacing) {
        const bx = x0 + ((x1 - x0) * t) / len;
        const bz = z0 + ((z1 - z0) * t) / len;
        for (const side of [-1, 1]) {
          const o = offset() * side;
          pts.push([bx + nx * o, bz + nz * o]);
        }
      }
    }
  };
  for (const w of SITE.water) if (w.w >= 8) along(w.p, 9, () => 9 + rand() * 9);
  for (const r of SITE.roads) if (MAJOR_ROADS.has(r.k) && within(r.p)) along(r.p, 15, () => r.w / 2 + 4);
  for (const lot of SITE.parking) if (within(lot.p)) along(lot.p, 16, () => (rand() < 0.5 ? -2.5 : 2.5));
  for (const g of SITE.green) {
    if (!within(g.p)) continue;
    const xs = g.p.map((p) => p[0]);
    const zs = g.p.map((p) => p[1]);
    const n = Math.min(260, Math.floor(polygonArea(g.p) / 450));
    for (let i = 0; i < n * 3 && i < 900; i++) {
      const p: P = [
        Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs)),
        Math.min(...zs) + rand() * (Math.max(...zs) - Math.min(...zs)),
      ];
      if (pointInPolygon(p, g.p) && rand() < 0.35) pts.push(p);
    }
  }
  const trunks: THREE.Matrix4[] = [];
  const crowns: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const greens = [PALETTE.tree, PALETTE.treeDark, '#7cb862', '#86b86a'].map((c) => new THREE.Color(c));
  for (const p of pts) {
    if (blocked(p)) continue;
    const s = 0.8 + rand() * 0.6;
    const yaw = rand() * Math.PI;
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(p[0], 1.4 * s, p[1]), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
    crowns.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(p[0], 4.6 * s, p[1]),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
        new THREE.Vector3(2.9 * s, 3.4 * s, 2.9 * s),
      ),
    );
    colors.push(greens[Math.floor(rand() * greens.length)]);
  }
  return { trunks, crowns, colors };
}

function buildCars() {
  const rand = rng(7);
  const matrices: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const palette = CAR_COLORS.map((c) => new THREE.Color(c));
  for (const lot of SITE.parking) {
    if (!within(lot.p) || polygonArea(lot.p) < 300) continue;
    const a = mainAxis(lot.p);
    const ax = Math.cos(a);
    const az = Math.sin(a);
    const local = lot.p.map(([x, z]) => [x * ax + z * az, -x * az + z * ax]);
    const u0 = Math.min(...local.map((p) => p[0]));
    const u1 = Math.max(...local.map((p) => p[0]));
    const v0 = Math.min(...local.map((p) => p[1]));
    const v1 = Math.max(...local.map((p) => p[1]));
    const fill = 0.45 + rand() * 0.4;
    for (let v = v0 + 3; v < v1 - 2; v += 9) {
      const rowOffset = Math.floor((v - v0) / 9) % 2 === 0 ? 0 : 0.5;
      for (let u = u0 + 2 + rowOffset; u < u1 - 1.5; u += 2.6) {
        if (rand() > fill) continue;
        const x = u * ax - v * az;
        const z = u * az + v * ax;
        if (!pointInPolygon([x, z], lot.p)) continue;
        const yaw = -a + (rand() - 0.5) * 0.06;
        matrices.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, 0, z),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
            new THREE.Vector3(1, 1, 1),
          ),
        );
        colors.push(palette[Math.floor(rand() * palette.length)]);
      }
    }
  }
  return { matrices, colors };
}

/** The three solar-roofed pedestrian bridges over San Tomas Aquino Creek on the west side. */
function Bridges() {
  const mats = useMemo(() => {
    const solar = solarTexture();
    solar.repeat.set(16, 3);
    return {
      deck: new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.5 }),
      solar: new THREE.MeshStandardMaterial({ map: solar, roughness: 0.3, metalness: 0.4 }),
    };
  }, []);
  const x0 = -122;
  const x1 = -192;
  const len = x0 - x1;
  return (
    <group>
      {[-62, 2, 66].map((z) => (
        <group key={z} position={[(x0 + x1) / 2, 0, z]}>
          <mesh position={[0, 2.4, 0]} material={mats.deck} castShadow receiveShadow>
            <boxGeometry args={[len, 0.8, 9]} />
          </mesh>
          <mesh position={[0, 7.6, 0]} rotation={[0, 0, 0.04]} material={mats.solar} castShadow>
            <boxGeometry args={[len - 4, 0.3, 11]} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => -len / 2 + 6 + (i * (len - 12)) / 5).map((x) => (
            <group key={x}>
              {[-4, 4].map((zz) => (
                <mesh key={zz} position={[x, 4.4, zz]} material={mats.steel} castShadow>
                  <boxGeometry args={[0.4, 6.6, 0.4]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

export default function Site() {
  const geo = useMemo(() => {
    const plinth = new THREE.ExtrudeGeometry(shapeOf(SITE.stadiumOutline), {
      depth: 0.5,
      bevelEnabled: false,
    }).rotateX(-Math.PI / 2);
    const roads = SITE.roads.filter((r) => within(r.p));
    const pitches = SITE.pitches.filter((p) => within(p.p));
    return {
      plinth,
      green: flatPolygons(SITE.green.filter((g) => within(g.p)).map((g) => g.p), 0.06),
      waterAreas: flatPolygons(SITE.waterAreas.filter(within), 0.12),
      creekBanks: ribbons(SITE.water.filter((w) => w.w >= 8).map((w) => ({ w: 34, p: w.p })), 0.09),
      creek: ribbons(SITE.water, 0.15),
      parking: flatPolygons(SITE.parking.filter((p) => within(p.p)).map((p) => p.p), 0.18),
      plazas: flatPolygons(SITE.plazas.filter(within), 0.21),
      football: mergeGeometries(
        pitches.filter((p) => p.s === 'american_football' || p.s === 'soccer').map((p) => pitchGeometry(p.p, 0.24)),
      ),
      courts: flatPolygons(
        pitches.filter((p) => p.s !== 'american_football' && p.s !== 'soccer').map((p) => p.p),
        0.24,
      ),
      majorRoads: ribbons(roads.filter((r) => MAJOR_ROADS.has(r.k)), 0.36),
      minorRoads: ribbons(roads.filter((r) => !MAJOR_ROADS.has(r.k) && !PATHS.has(r.k)), 0.3),
      paths: ribbons(roads.filter((r) => PATHS.has(r.k)), 0.33),
      rail: ribbons(SITE.rail.filter((r) => within(r.p)).map((r) => ({ w: 4.2, p: r.p })), 0.4),
      buildings: extrudedBuildings(SITE.buildings.filter((b) => within(b.p))),
    };
  }, []);

  const mats = useMemo(() => {
    const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide, ...extra });
    return {
      ground: flat(PALETTE.ground),
      plinth: new THREE.MeshStandardMaterial({ color: PALETTE.plinth, roughness: 0.95 }),
      green: flat(PALETTE.park),
      water: flat(PALETTE.water, { roughness: 0.15, metalness: 0.1 }),
      parking: flat('#ffffff', { map: parkingTexture() }),
      plaza: flat('#ebe6dd'),
      football: flat('#ffffff', { map: practiceFieldTexture() }),
      courts: flat('#8fbf73'),
      major: flat(PALETTE.road),
      minor: flat(PALETTE.asphalt),
      path: flat('#efebe4'),
      rail: flat(PALETTE.rail),
      building: new THREE.MeshStandardMaterial({ color: PALETTE.building, roughness: 0.85 }),
      trunk: new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1 }),
      crown: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
      car: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.3 }),
    };
  }, []);

  const trees = useMemo(() => buildTrees(), []);
  const cars = useMemo(() => buildCars(), []);
  const carGeo = useMemo(
    () =>
      mergeGeometries([
        new THREE.BoxGeometry(1.8, 0.75, 4.5).translate(0, 0.55, 0),
        new THREE.BoxGeometry(1.6, 0.6, 2.4).translate(0, 1.2, -0.2),
      ])!,
    [],
  );
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const carRef = useRef<THREE.InstancedMesh>(null);
  useInstances(trunkRef, trees.trunks);
  useInstances(crownRef, trees.crowns, trees.colors);
  useInstances(carRef, cars.matrices, cars.colors);

  const flat = (g: THREE.BufferGeometry | null, m: THREE.Material) =>
    g && <mesh geometry={g} material={m} receiveShadow />;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.ground} receiveShadow>
        <planeGeometry args={[8000, 8000]} />
      </mesh>
      {flat(geo.green, mats.green)}
      {flat(geo.creekBanks, mats.green)}
      {flat(geo.waterAreas, mats.water)}
      {flat(geo.creek, mats.water)}
      {flat(geo.parking, mats.parking)}
      {flat(geo.plazas, mats.plaza)}
      {flat(geo.football, mats.football)}
      {flat(geo.courts, mats.courts)}
      {flat(geo.minorRoads, mats.minor)}
      {flat(geo.paths, mats.path)}
      {flat(geo.majorRoads, mats.major)}
      {flat(geo.rail, mats.rail)}
      <mesh geometry={geo.plinth} material={mats.plinth} receiveShadow />
      {geo.buildings && <mesh geometry={geo.buildings} material={mats.building} castShadow receiveShadow />}
      <instancedMesh ref={trunkRef} args={[undefined, mats.trunk, trees.trunks.length]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 2.8, 6]} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, mats.crown, trees.crowns.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
      </instancedMesh>
      <instancedMesh ref={carRef} args={[carGeo, mats.car, cars.matrices.length]} castShadow receiveShadow />
      <Bridges />
    </group>
  );
}
