import * as THREE from 'three';
import { SEAT } from './dimensions';
import { PIECE_NAMES, pieceLength, ringFrame, yawFromNormal, type Span } from './ring';

export type LevelId = 'lower' | 'club' | 'upper';

export const LEVELS: { id: LevelId; label: string; short: string }[] = [
  { id: 'lower', label: 'Lower bowl', short: '100s' },
  { id: 'club', label: 'Club level', short: '200s' },
  { id: 'upper', label: 'Upper deck', short: '400s' },
];

type TierSpec = {
  id: string;
  level: LevelId;
  numberStart: number;
  spans: (Span & { sections: number })[];
  /** Offset of the front wall from the bowl's inner edge. */
  d0: number;
  rows: number;
  rowDepth: number;
  /** Height of the first tread above the field. */
  y0: number;
  /** Riser heights grow front to back, which gives the bowl its progressive rake. */
  riserStart: number;
  riserEnd: number;
  /** Depth of the front fascia below the first tread; null runs it down to the ground. */
  fasciaDrop: number | null;
  /** Rows taken by a vomitory tunnel mouth at the middle of each section. */
  vomitory?: [number, number];
};

const full = (piece: number, sections: number) => ({ piece, from: 0, to: 1, sections });

/**
 * The bowl, tier by tier. Lower bowl: 35 rows, first row ≈ 10 ft above the field. The east
 * upper deck wraps both east corners; the west upper deck sits inside the suite tower under
 * its roof canopy. Section numbers run clockwise from the north end zone.
 */
export const TIERS: TierSpec[] = [
  {
    id: 'lower',
    level: 'lower',
    numberStart: 101,
    spans: [full(0, 6), full(1, 4), full(2, 8), full(3, 4), full(4, 6), full(5, 4), full(6, 8), full(7, 4)],
    d0: 0,
    rows: 35,
    rowDepth: 0.82,
    y0: 3,
    riserStart: 0.3,
    riserEnd: 0.5,
    fasciaDrop: null,
    vomitory: [18, 22],
  },
  {
    id: 'club-east',
    level: 'club',
    numberStart: 201,
    spans: [
      { piece: 1, from: 0.45, to: 1, sections: 2 },
      full(2, 7),
      { piece: 3, from: 0, to: 0.55, sections: 2 },
    ],
    d0: 24,
    rows: 14,
    rowDepth: 0.9,
    y0: 21,
    riserStart: 0.42,
    riserEnd: 0.52,
    fasciaDrop: 3,
  },
  {
    id: 'club-west',
    level: 'club',
    numberStart: 212,
    spans: [full(6, 7)],
    d0: 24,
    rows: 14,
    rowDepth: 0.9,
    y0: 21,
    riserStart: 0.42,
    riserEnd: 0.52,
    fasciaDrop: 3,
  },
  {
    id: 'upper-east',
    level: 'upper',
    numberStart: 401,
    spans: [
      { piece: 1, from: 0.25, to: 1, sections: 5 },
      full(2, 10),
      { piece: 3, from: 0, to: 0.75, sections: 5 },
    ],
    d0: 37.5,
    rows: 38,
    rowDepth: 0.86,
    y0: 31.5,
    riserStart: 0.44,
    riserEnd: 0.56,
    fasciaDrop: 3.5,
  },
  {
    id: 'upper-west',
    level: 'upper',
    numberStart: 421,
    spans: [full(6, 8)],
    d0: 35.5,
    rows: 14,
    rowDepth: 0.85,
    y0: 35.5,
    riserStart: 0.55,
    riserEnd: 0.62,
    fasciaDrop: 3.5,
  },
];

export type TierLayout = {
  spec: TierSpec;
  /** Tread heights, one per row. */
  rowY: number[];
  /** Front edge offset of each row's tread. */
  rowD: number[];
  dEnd: number;
  yTop: number;
  profile: [number, number][];
};

const FRONT_WALL = 0.3;
const RAIL = 1.05;

export function layoutTier(spec: TierSpec): TierLayout {
  const rowY: number[] = [];
  const rowD: number[] = [];
  let y = spec.y0;
  for (let i = 0; i < spec.rows; i++) {
    rowY.push(y);
    rowD.push(spec.d0 + FRONT_WALL + i * spec.rowDepth);
    const t = spec.rows > 1 ? i / (spec.rows - 1) : 0;
    y += spec.riserStart + (spec.riserEnd - spec.riserStart) * t;
  }
  const yTop = rowY[rowY.length - 1];
  const backD = spec.d0 + FRONT_WALL + spec.rows * spec.rowDepth;
  const dEnd = backD + FRONT_WALL;
  const bottomFront = spec.fasciaDrop === null ? 0 : spec.y0 - spec.fasciaDrop;
  const bottomBack = spec.fasciaDrop === null ? 0 : yTop - 1.6;

  const profile: [number, number][] = [
    [spec.d0, bottomFront],
    [spec.d0, spec.y0 + RAIL],
    [spec.d0 + FRONT_WALL, spec.y0 + RAIL],
  ];
  for (let i = 0; i < spec.rows; i++) {
    profile.push([rowD[i], rowY[i]]);
    const next = i + 1 < spec.rows ? rowD[i + 1] : backD;
    profile.push([next, rowY[i]]);
  }
  profile.push([backD, yTop + RAIL], [dEnd, yTop + RAIL], [dEnd, bottomBack]);
  return { spec, rowY, rowD, dEnd, yTop, profile };
}

export const TIER_LAYOUTS = TIERS.map(layoutTier);

export type Section = {
  key: string;
  number: number;
  tierId: string;
  level: LevelId;
  piece: number;
  side: string;
  from: number;
  to: number;
  rows: number;
  seats: number;
  /** Index range into the tier's instanced seats. */
  seatStart: number;
  frontY: number;
  topY: number;
  center: [number, number, number];
  distanceToMidfield: number;
  exposure: string;
};

export type TierSeats = {
  layout: TierLayout;
  sections: Section[];
  matrices: Float32Array;
  count: number;
  vomitories: THREE.Matrix4[];
};

/** The east side has no overhang and faces the afternoon sun; the tower shades the west. */
function exposureFor(level: LevelId, piece: number) {
  if (piece === 6 && level !== 'lower') return 'Shaded by the suite tower';
  if (piece >= 5) return 'Shade from mid-afternoon';
  if (piece >= 1 && piece <= 3) return 'Full afternoon sun';
  return 'Sun and shade';
}

/** Places every seat of a tier and slices it into sections. */
export function buildTier(layout: TierLayout): TierSeats {
  const { spec, rowY, rowD } = layout;
  const sections: Section[] = [];
  const mats: number[] = [];
  const vomitories: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  let number = spec.numberStart;
  let count = 0;

  for (const span of spec.spans) {
    const width = (span.to - span.from) / span.sections;
    for (let s = 0; s < span.sections; s++) {
      const from = span.from + s * width;
      const to = from + width;
      const seatStart = count;
      for (let r = 0; r < spec.rows; r++) {
        const d = rowD[r] + 0.42;
        const length = pieceLength(span.piece, d) * width;
        const n = Math.floor((length - SEAT.aisle) / SEAT.width);
        const start = (length - n * SEAT.width) / 2 + SEAT.width / 2;
        const inVom = spec.vomitory && r >= spec.vomitory[0] && r < spec.vomitory[1];
        for (let k = 0; k < n; k++) {
          const along = start + k * SEAT.width;
          if (inVom && Math.abs(along - length / 2) < 1.5) continue;
          const fr = ringFrame(span.piece, from + (along / length) * width, d);
          m.makeRotationY(yawFromNormal(fr.nx, fr.nz)).setPosition(fr.x, rowY[r], fr.z);
          mats.push(...m.elements);
          count++;
        }
      }
      if (spec.vomitory) {
        const [r0, r1] = spec.vomitory;
        const dFront = rowD[r0];
        const dBack = rowD[r1];
        const fr = ringFrame(span.piece, (from + to) / 2, (dFront + dBack) / 2);
        const yBase = rowY[r0] - 0.6;
        const height = rowY[r1] + 0.05 - yBase;
        vomitories.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(fr.x, yBase + height / 2, fr.z),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawFromNormal(fr.nx, fr.nz)),
            new THREE.Vector3(2.6, height, dBack - dFront),
          ),
        );
      }
      const mid = (rowD[0] + rowD[spec.rows - 1]) / 2;
      const c = ringFrame(span.piece, (from + to) / 2, mid);
      const cy = (rowY[0] + rowY[spec.rows - 1]) / 2;
      sections.push({
        key: `${spec.id}-${number}`,
        number,
        tierId: spec.id,
        level: spec.level,
        piece: span.piece,
        side: PIECE_NAMES[span.piece],
        from,
        to,
        rows: spec.rows,
        seats: count - seatStart,
        seatStart,
        frontY: rowY[0],
        topY: rowY[spec.rows - 1],
        center: [c.x, cy, c.z],
        distanceToMidfield: Math.hypot(c.x, cy, c.z),
        exposure: exposureFor(spec.level, span.piece),
      });
      number++;
    }
  }
  return { layout, sections, matrices: new Float32Array(mats), count, vomitories };
}

export const BOWL_TIERS = TIER_LAYOUTS.map(buildTier);

export const ALL_SECTIONS = BOWL_TIERS.flatMap((t) => t.sections);

export const SEAT_TOTALS = LEVELS.map((level) => ({
  ...level,
  seats: ALL_SECTIONS.filter((s) => s.level === level.id).reduce((n, s) => n + s.seats, 0),
  sections: ALL_SECTIONS.filter((s) => s.level === level.id).length,
}));

export const MODELED_SEATS = SEAT_TOTALS.reduce((n, l) => n + l.seats, 0);

/** Where a partial tier needs its open end filled: span ends not met by a neighbouring span. */
export function tierCaps(spec: TierSpec) {
  const caps: { piece: number; f: number }[] = [];
  const has = (piece: number, f: number) =>
    spec.spans.some((s) => (s.piece === piece && (s.from === f || s.to === f)));
  for (const span of spec.spans) {
    const prev = (span.piece + 7) % 8;
    const next = (span.piece + 1) % 8;
    if (span.from > 0 || !has(prev, 1)) caps.push({ piece: span.piece, f: span.from });
    if (span.to < 1 || !has(next, 0)) caps.push({ piece: span.piece, f: span.to });
  }
  return caps;
}
