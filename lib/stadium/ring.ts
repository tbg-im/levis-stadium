import * as THREE from 'three';
import { BOWL } from './dimensions';

/**
 * The bowl ring is eight pieces walked clockwise from above, starting at the north end:
 * 0 N straight, 1 NE corner, 2 E straight, 3 SE corner, 4 S straight, 5 SW corner,
 * 6 W straight, 7 NW corner. A point is (piece, f, d): f ∈ [0, 1] along the piece and d the
 * distance out from the bowl's inner edge. Offsets of a rounded rectangle are exact, so the
 * same f lines up radially at every d.
 */
export type Span = { piece: number; from: number; to: number };

export type RingFrame = { x: number; z: number; nx: number; nz: number };

const A = BOWL.hx - BOWL.r;
const B = BOWL.hz - BOWL.r;
const STRAIGHT_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const CORNER_CENTER: [number, number][] = [
  [A, -B],
  [A, B],
  [-A, B],
  [-A, -B],
];

export const PIECE_NAMES = [
  'North end zone',
  'Northeast corner',
  'East sideline',
  'Southeast corner',
  'South end zone',
  'Southwest corner',
  'West sideline',
  'Northwest corner',
];

export function ringFrame(piece: number, f: number, d: number): RingFrame {
  if (piece % 2 === 0) {
    const k = piece / 2;
    const phi = STRAIGHT_ANGLE[k];
    const nx = Math.cos(phi);
    const nz = Math.sin(phi);
    const along = k % 2 === 0;
    const H = along ? BOWL.hz : BOWL.hx;
    const L = along ? A : B;
    const s = -L + 2 * L * f;
    return { x: nx * (H + d) - nz * s, z: nz * (H + d) + nx * s, nx, nz };
  }
  const k = (piece - 1) / 2;
  const [cx, cz] = CORNER_CENTER[k];
  const th = STRAIGHT_ANGLE[k] + (f * Math.PI) / 2;
  const nx = Math.cos(th);
  const nz = Math.sin(th);
  const R = BOWL.r + d;
  return { x: cx + nx * R, z: cz + nz * R, nx, nz };
}

export function pieceLength(piece: number, d: number) {
  if (piece % 2 === 0) return 2 * ((piece / 2) % 2 === 0 ? A : B);
  return ((BOWL.r + d) * Math.PI) / 2;
}

function sampleFs(span: Span, dMax: number, step = 2.5) {
  if (span.piece % 2 === 0) return [span.from, span.to];
  const len = (span.to - span.from) * pieceLength(span.piece, dMax);
  const n = Math.max(2, Math.ceil(len / step));
  return Array.from({ length: n + 1 }, (_, i) => span.from + ((span.to - span.from) * i) / n);
}

/** Seat-facing yaw for an outward normal: local +z (the seat back) points away from the field. */
export function yawFromNormal(nx: number, nz: number) {
  return Math.atan2(nx, nz);
}

/**
 * Sweeps a (d, y) cross-section along ring spans. Faces are flat-shaded so stepped treads
 * read crisply; materials using this geometry should be double sided because the winding
 * follows the profile order.
 */
export function sweepProfile(
  profile: [number, number][],
  spans: Span[],
  options: { closed?: boolean; step?: number } = {},
) {
  const closed = options.closed ?? true;
  const pos: number[] = [];
  const dMax = Math.max(...profile.map((p) => p[0]));
  const segs = closed ? profile.length : profile.length - 1;
  for (const span of spans) {
    const fs = sampleFs(span, dMax, options.step);
    const frames = fs.map((f) => profile.map(([d]) => ringFrame(span.piece, f, d)));
    for (let j = 0; j < fs.length - 1; j++) {
      for (let k = 0; k < segs; k++) {
        const k1 = (k + 1) % profile.length;
        const a = frames[j][k];
        const b = frames[j + 1][k];
        const c = frames[j + 1][k1];
        const e = frames[j][k1];
        const y0 = profile[k][1];
        const y1 = profile[k1][1];
        pos.push(a.x, y0, a.z, b.x, y0, b.z, c.x, y1, c.z);
        pos.push(a.x, y0, a.z, c.x, y1, c.z, e.x, y1, e.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Fills a closed profile at one ring position (the open end of a partial tier). */
export function profileCap(profile: [number, number][], piece: number, f: number) {
  const contour = profile.map(([d, y]) => new THREE.Vector2(d, y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const pos: number[] = [];
  for (const tri of tris) {
    for (const i of tri) {
      const [d, y] = profile[i];
      const fr = ringFrame(piece, f, d);
      pos.push(fr.x, y, fr.z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A flat ribbon on a vertical face at offset d between two heights, with u running along
 * the ring in meters (so a repeating texture keeps its aspect).
 */
export function ribbonStrip(spans: Span[], d: number, yBottom: number, yTop: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  let u = 0;
  for (const span of spans) {
    const fs = sampleFs(span, d, 2);
    for (let j = 0; j < fs.length - 1; j++) {
      const a = ringFrame(span.piece, fs[j], d);
      const b = ringFrame(span.piece, fs[j + 1], d);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const u1 = u + len;
      pos.push(a.x, yBottom, a.z, b.x, yBottom, b.z, b.x, yTop, b.z);
      pos.push(a.x, yBottom, a.z, b.x, yTop, b.z, a.x, yTop, a.z);
      uv.push(u, 0, u1, 0, u1, 1, u, 0, u1, 1, u, 1);
      u = u1;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Evenly spaced positions along spans at offset d, spaced roughly `spacing` meters apart. */
export function pointsAlong(spans: Span[], d: number, spacing: number) {
  const out: (RingFrame & { piece: number; f: number })[] = [];
  for (const span of spans) {
    const len = pieceLength(span.piece, d) * (span.to - span.from);
    const n = Math.max(1, Math.round(len / spacing));
    for (let i = 0; i <= n; i++) {
      if (i === 0 && out.length > 0) continue;
      const f = span.from + ((span.to - span.from) * i) / n;
      out.push({ ...ringFrame(span.piece, f, d), piece: span.piece, f });
    }
  }
  return out;
}
