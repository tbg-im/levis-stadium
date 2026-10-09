import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import raw from './site.json';

/**
 * Surroundings from OpenStreetMap, already projected into the stadium frame (meters, x/z
 * as in dimensions.ts) by the build script. Data © OpenStreetMap contributors, ODbL.
 */
type P = [number, number];
type SiteData = {
  roads: { w: number; k: string; n: string | null; p: P[] }[];
  rail: { k: string; p: P[] }[];
  water: { w: number; p: P[] }[];
  waterAreas: P[][];
  parking: { n: string | null; p: P[] }[];
  buildings: { h: number; n: string | null; p: P[] }[];
  pitches: { s: string | null; p: P[] }[];
  green: { k: string; p: P[] }[];
  plazas: P[][];
  stadiumOutline: P[];
};

export const SITE = raw as unknown as SiteData;

export const MAJOR_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
export const PATHS = new Set(['footway', 'cycleway', 'path', 'steps', 'pedestrian']);

export function pointInPolygon([x, z]: P, poly: P[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(poly: P[]) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return Math.abs(a / 2);
}

export function centroid(poly: P[]) {
  const n = poly.length;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n] as P;
}

/** Shape in (x, -z) so that rotateX(-π/2) lays it flat with an upward normal. */
export function shapeOf(poly: P[], holes: THREE.Path[] = []) {
  const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  s.holes.push(...holes);
  return s;
}

export function flatPolygons(polys: P[][], y: number) {
  const geos = polys
    .filter((p) => p.length >= 4)
    .map((p) => new THREE.ShapeGeometry(shapeOf(p)).rotateX(-Math.PI / 2).translate(0, y, 0));
  return geos.length ? mergeGeometries(geos)! : null;
}

/** Polylines as flat ribbons, with discs at the joints so bends don't crack. */
export function ribbons(lines: { w: number; p: P[] }[], y: number) {
  const pos: number[] = [];
  for (const { w, p } of lines) {
    const h = w / 2;
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, z0] = p[i];
      const [x1, z1] = p[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.01) continue;
      const nx = (-(z1 - z0) / len) * h;
      const nz = ((x1 - x0) / len) * h;
      pos.push(x0 + nx, y, z0 + nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz);
      pos.push(x0 + nx, y, z0 + nz, x1 - nx, y, z1 - nz, x0 - nx, y, z0 - nz);
    }
    if (w >= 5) {
      for (const [cx, cz] of p) {
        const seg = 10;
        for (let k = 0; k < seg; k++) {
          const a0 = (k / seg) * Math.PI * 2;
          const a1 = ((k + 1) / seg) * Math.PI * 2;
          pos.push(cx, y, cz, cx + Math.cos(a1) * h, y, cz + Math.sin(a1) * h, cx + Math.cos(a0) * h, y, cz + Math.sin(a0) * h);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return g;
}

export function extrudedBuildings(buildings: { h: number; p: P[] }[]) {
  const geos = buildings
    .filter((b) => b.p.length >= 4)
    .map((b) =>
      new THREE.ExtrudeGeometry(shapeOf(b.p), { depth: b.h, bevelEnabled: false }).rotateX(-Math.PI / 2),
    );
  return geos.length ? mergeGeometries(geos)! : null;
}

/** Long axis of a polygon (its longest edge), for lining things up with a lot or pitch. */
export function mainAxis(poly: P[]) {
  let best = 0;
  let angle = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const dx = poly[i + 1][0] - poly[i][0];
    const dz = poly[i + 1][1] - poly[i][1];
    const len = Math.hypot(dx, dz);
    if (len > best) {
      best = len;
      angle = Math.atan2(dz, dx);
    }
  }
  return angle;
}

/** Deterministic PRNG so trees and cars land in the same places on every load. */
export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const named = (list: { n: string | null; p: P[] }[], name: string) => {
  const hit = list.find((x) => x.n === name);
  return hit ? centroid(hit.p) : null;
};

/** Landmark labels: [x, y, z] in the stadium frame. */
export const LANDMARKS = (
  [
    ['Tasman Drive', [-40, -182], 6],
    ['San Tomas Aquino Creek', [-162, -150], 6],
    ['SAP Performance Facility', [270, 98], 6],
    ['Santa Clara Convention Center', named(SITE.buildings, 'Santa Clara Convention Center'), 12],
    ['Red Lot 1', named(SITE.parking, 'Red Lot 1'), 6],
    ['SAP Tower', [-92, 0], 52],
  ] as [string, P | null, number][]
)
  .filter((l): l is [string, P, number] => l[1] !== null)
  .map(([name, [x, z], y]) => ({ id: `landmark-${name}`, name, position: [x, y, z] as [number, number, number] }));
