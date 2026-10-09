import * as THREE from 'three';
import { BOWL, FIELD, TOWER } from '@/lib/stadium/dimensions';
import { PALETTE } from '@/lib/stadium/palette';

const FONT = 'Geist, "Helvetica Neue", Arial, sans-serif';
const RED = '#a5111f';
const GOLD = '#c9a24a';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function toTexture(c: HTMLCanvasElement, anisotropy = 8, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * The floor inside the bowl, drawn to scale: canvas x is world x (east right), canvas y is
 * world z (north at the top).
 */
export function fieldTexture(anisotropy: number) {
  const PX = 24;
  const W = BOWL.hx * 2;
  const H = BOWL.hz * 2;
  const [c, g] = canvas(W * PX, H * PX);
  const X = (x: number) => (x + W / 2) * PX;
  const Z = (z: number) => (z + H / 2) * PX;
  const yd = FIELD.yard;
  const hl = FIELD.length / 2;
  const hw = FIELD.width / 2;

  for (let i = -16; i < 16; i++) {
    g.fillStyle = (i & 1) === 0 ? PALETTE.grass : PALETTE.grassLight;
    g.fillRect(0, Z(i * 5 * yd), c.width, 5 * yd * PX + 1);
  }

  // 6 ft white border around the field of play.
  const border = 1.83;
  g.fillStyle = '#f7f7f2';
  g.fillRect(X(-hw - border), Z(-hl - border), (FIELD.width + 2 * border) * PX, border * PX);
  g.fillRect(X(-hw - border), Z(hl), (FIELD.width + 2 * border) * PX, border * PX);
  g.fillRect(X(-hw - border), Z(-hl), border * PX, FIELD.length * PX);
  g.fillRect(X(hw), Z(-hl), border * PX, FIELD.length * PX);

  // End zones.
  const ez = FIELD.endZone;
  for (const sign of [-1, 1]) {
    const z0 = sign < 0 ? -hl : hl - ez;
    g.fillStyle = RED;
    g.fillRect(X(-hw), Z(z0), FIELD.width * PX, ez * PX);
    g.save();
    g.translate(X(0), Z(sign * (hl - ez / 2)));
    if (sign > 0) g.rotate(Math.PI);
    g.font = `900 ${6.2 * PX}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 0.35 * PX;
    g.strokeStyle = GOLD;
    g.strokeText('49ERS', 0, 0);
    g.fillStyle = '#ffffff';
    g.fillText('49ERS', 0, 0);
    g.restore();
  }

  // Yard lines every 5 yd, goal lines doubled in width.
  g.fillStyle = '#ffffff';
  for (let k = -10; k <= 10; k++) {
    const z = k * 5 * yd;
    const lw = Math.abs(k) === 10 ? 0.2 : 0.1;
    g.fillRect(X(-hw), Z(z - lw / 2), FIELD.width * PX, lw * PX);
  }
  // Hash marks every yard: sidelines and the inbounds lines 70′9″ in from each sideline.
  for (let k = -49; k <= 49; k++) {
    if (k % 5 === 0) continue;
    const z = k * yd;
    for (const x of [-hw + 0.15, hw - 0.76, -hw + 21.56 - 0.3, hw - 21.56 - 0.3]) {
      g.fillRect(X(x), Z(z - 0.05), 0.61 * PX, 0.1 * PX);
    }
  }
  // Two-point conversion marks.
  for (const sign of [-1, 1]) g.fillRect(X(-0.3), Z(sign * (hl - ez - 2 * yd)), 0.61 * PX, 0.1 * PX);

  // Numbers every 10 yd, read from the nearer sideline, with arrows toward the nearer goal.
  g.font = `700 ${1.83 * PX}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let n = 10; n <= 90; n += 10) {
    const label = String(n <= 50 ? n : 100 - n);
    const z = -hl + ez + n * yd;
    for (const side of [-1, 1]) {
      g.save();
      g.translate(X(side * (hw - 11 * yd)), Z(z));
      g.rotate(side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const [a, b] = label.split('');
      g.fillText(a, -0.75 * PX, 0);
      g.fillText(b, 0.75 * PX, 0);
      if (n !== 50) {
        const toward = (n < 50 ? -1 : 1) * (side > 0 ? 1 : -1);
        g.beginPath();
        g.moveTo(toward * 1.9 * PX, -0.75 * PX);
        g.lineTo(toward * 2.5 * PX, -0.45 * PX);
        g.lineTo(toward * 1.9 * PX, -0.15 * PX);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
  }

  // Midfield oval, reading from the west (press box) sideline.
  g.save();
  g.translate(X(0), Z(0));
  g.rotate(Math.PI / 2);
  g.save();
  g.scale(1, 0.68);
  g.beginPath();
  g.arc(0, 0, 4.6 * PX, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
  g.beginPath();
  g.arc(0, 0, 4.2 * PX, 0, Math.PI * 2);
  g.fillStyle = RED;
  g.fill();
  g.restore();
  g.font = `900 italic ${4 * PX}px ${FONT}`;
  g.fillStyle = '#ffffff';
  g.fillText('SF', 0, 0.15 * PX);
  g.restore();

  // Team bench areas between the 32-yard lines, outside the border.
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 0.1 * PX;
  g.setLineDash([0.6 * PX, 0.6 * PX]);
  for (const side of [-1, 1]) {
    const x = side > 0 ? hw + border + 1.8 : -hw - border - 1.8;
    g.beginPath();
    g.moveTo(X(x), Z(-18 * yd));
    g.lineTo(X(x), Z(18 * yd));
    g.stroke();
  }
  g.setLineDash([]);

  const t = toTexture(c, anisotropy);
  t.generateMipmaps = true;
  return t;
}

/** West (exterior) face of the suite tower: canvas left is the north end. */
export function towerFacadeTexture(anisotropy: number) {
  const length = TOWER.south - TOWER.north;
  const height = TOWER.roof;
  const PX = 22;
  const [c, g] = canvas(Math.round(length * PX), Math.round(height * PX));
  const X = (z: number) => z * PX;
  const Y = (y: number) => (height - y) * PX;

  g.fillStyle = PALETTE.facade;
  g.fillRect(0, 0, c.width, c.height);

  const floors = [0, 5.2, 10.4, 16, 21.5, 27.1, 31.6, 36.4, 41.4, height];
  for (let i = 0; i < floors.length - 1; i++) {
    const y0 = floors[i];
    const y1 = floors[i + 1];
    const glass = g.createLinearGradient(0, Y(y1), 0, Y(y0));
    glass.addColorStop(0, '#5f7687');
    glass.addColorStop(1, '#8aa1b0');
    g.fillStyle = glass;
    g.fillRect(0, Y(y1 - 0.9), c.width, (y1 - y0 - 2.1) * PX);
    g.fillStyle = '#f7f6f3';
    g.fillRect(0, Y(y0 + 1.2), c.width, 1.2 * PX);
  }
  // Mullions and structural piers.
  g.fillStyle = 'rgba(240,240,236,0.55)';
  for (let z = 0; z < length; z += 1.5) g.fillRect(X(z), 0, 0.12 * PX, c.height);
  g.fillStyle = '#f4f3ef';
  for (let z = 4; z < length; z += 9) g.fillRect(X(z), 0, 1.3 * PX, c.height);

  // Central curtain wall.
  const mid = length / 2;
  const cw = 54;
  const curtain = g.createLinearGradient(0, 0, 0, c.height);
  curtain.addColorStop(0, '#a9c3cd');
  curtain.addColorStop(1, '#7e9cab');
  g.fillStyle = curtain;
  g.fillRect(X(mid - cw / 2), Y(height - 1), cw * PX, (height - 3) * PX);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  for (let z = mid - cw / 2; z <= mid + cw / 2; z += 2.25) {
    g.beginPath();
    g.moveTo(X(z), Y(height - 1));
    g.lineTo(X(z), Y(2));
    g.stroke();
  }
  for (let y = 2; y < height - 1; y += 3) {
    g.beginPath();
    g.moveTo(X(mid - cw / 2), Y(y));
    g.lineTo(X(mid + cw / 2), Y(y));
    g.stroke();
  }
  // Entry canopy band at the base of the curtain wall.
  g.fillStyle = '#e1dfda';
  g.fillRect(X(mid - cw / 2 - 2), Y(6), (cw + 4) * PX, 1.2 * PX);

  // Levi's Stadium sign on the curtain wall.
  const signW = 26;
  g.fillStyle = '#c41230';
  g.fillRect(X(mid - signW / 2), Y(height - 3), 10 * PX, 4.6 * PX);
  g.font = `italic 800 ${3.2 * PX}px ${FONT}`;
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText("Levi's", X(mid - signW / 2 + 5), Y(height - 5.3));
  g.font = `800 ${3 * PX}px ${FONT}`;
  g.fillStyle = '#f5f5f5';
  g.textAlign = 'left';
  g.fillText('STADIUM', X(mid - signW / 2 + 10.8), Y(height - 5.3));

  // Banners either side of the curtain wall.
  for (const [z, word] of [
    [mid - 50, 'THEN'],
    [mid + 50, 'NOW'],
  ] as const) {
    const bw = 13;
    const top = height - 10;
    g.fillStyle = '#b8142a';
    g.fillRect(X(z - bw / 2), Y(top), bw * PX, 17 * PX);
    g.strokeStyle = '#f2d7d9';
    g.lineWidth = 0.25 * PX;
    g.strokeRect(X(z - bw / 2 + 0.6), Y(top - 0.6), (bw - 1.2) * PX, 15.8 * PX);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.font = `italic 600 ${2.6 * PX}px Georgia, serif`;
    g.fillText('Faithful', X(z), Y(top - 4));
    g.font = `800 ${4.4 * PX}px ${FONT}`;
    g.fillText(word, X(z), Y(top - 10));
  }
  return toTexture(c, anisotropy);
}

/** Tower ends: stacked balconies and stair glass. */
export function towerEndTexture(anisotropy: number) {
  const PX = 20;
  const width = TOWER.front - TOWER.back;
  const height = TOWER.roof;
  const [c, g] = canvas(Math.round(width * PX), Math.round(height * PX));
  g.fillStyle = PALETTE.facade;
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < height - 2; y += 3.6) {
    const top = (height - y - 3.6) * PX;
    g.fillStyle = '#6f8796';
    g.fillRect(2 * PX, top + 0.7 * PX, (width - 4) * PX, 2.2 * PX);
    g.fillStyle = '#fbfbf9';
    g.fillRect(0, top + 2.9 * PX, c.width, 0.7 * PX);
  }
  g.fillStyle = '#f4f3ef';
  for (let x = 0; x < width; x += 6) g.fillRect(x * PX, 0, 0.8 * PX, c.height);
  return toTexture(c, anisotropy);
}

export function ribbonTexture() {
  const [c, g] = canvas(2048, 64);
  const bg = g.createLinearGradient(0, 0, 0, 64);
  bg.addColorStop(0, '#0b1a4a');
  bg.addColorStop(0.5, '#123a9c');
  bg.addColorStop(1, '#0b1a4a');
  g.fillStyle = bg;
  g.fillRect(0, 0, 2048, 64);
  g.font = `800 34px ${FONT}`;
  g.textBaseline = 'middle';
  g.fillStyle = '#e8efff';
  const words = ['LEVI’S STADIUM', 'FAITHFUL TO THE BAY', 'SANTA CLARA', 'GO NINERS'];
  let x = 24;
  for (const w of words) {
    g.fillText(w, x, 34);
    x += g.measureText(w).width + 40;
    g.fillStyle = '#ff4d5e';
    g.fillText('◆', x - 28, 33);
    g.fillStyle = '#e8efff';
  }
  const t = toTexture(c, 4, true);
  // One canvas tile spans 38 m of a 1.2 m-tall ribbon.
  t.repeat.set(1 / 38, 1);
  return t;
}

export function boardTexture(home: boolean) {
  const [c, g] = canvas(2048, 490);
  g.fillStyle = '#05070c';
  g.fillRect(0, 0, 2048, 490);
  const panel = (x: number, w: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(x, 24, w, 442);
  };
  panel(24, 520, '#7d0d19');
  panel(1504, 520, '#1b2a4a');
  const center = g.createLinearGradient(560, 0, 1488, 490);
  center.addColorStop(0, '#2b6c36');
  center.addColorStop(1, '#4f9b44');
  g.fillStyle = center;
  g.fillRect(560, 24, 928, 442);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.font = `800 64px ${FONT}`;
  g.fillText('49ERS', 284, 110);
  g.fillText('GUEST', 1764, 110);
  g.font = `800 200px ${FONT}`;
  g.fillText('24', 284, 300);
  g.fillText('17', 1764, 300);
  g.font = `800 120px ${FONT}`;
  g.fillText(home ? 'TOUCHDOWN' : '4TH  2:13', 1024, 190);
  g.font = `600 52px ${FONT}`;
  g.fillStyle = '#f3e7c0';
  g.fillText(home ? 'LEVI’S STADIUM · SANTA CLARA' : '1ST & 10 · BALL ON SF 35', 1024, 340);
  return toTexture(c, 4);
}

export function signTexture() {
  const [c, g] = canvas(1024, 220);
  g.fillStyle = '#f4f4f2';
  g.fillRect(0, 0, 1024, 220);
  g.fillStyle = '#c41230';
  g.fillRect(16, 16, 400, 188);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `italic 800 120px ${FONT}`;
  g.fillText("Levi's", 216, 112);
  g.fillStyle = '#c41230';
  g.font = `800 112px ${FONT}`;
  g.fillText('STADIUM', 718, 116);
  return toTexture(c, 4);
}

export function solarTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#c9ccd2';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 2; x++) {
      const px = x * 128 + 4;
      const py = y * 64 + 4;
      const grad = g.createLinearGradient(px, py, px + 120, py + 56);
      grad.addColorStop(0, '#2c4170');
      grad.addColorStop(1, PALETTE.solar);
      g.fillStyle = grad;
      g.fillRect(px, py, 120, 56);
      g.strokeStyle = 'rgba(160,180,220,0.35)';
      g.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        g.beginPath();
        g.moveTo(px + i * 20, py);
        g.lineTo(px + i * 20, py + 56);
        g.stroke();
      }
    }
  }
  return toTexture(c, 8, true);
}

export function greenRoofTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#8a8f74';
  g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let row = 0; row < 8; row++) {
    for (let i = 0; i < 40; i++) {
      g.fillStyle = ['#6f9a4c', '#86b05a', '#5d8a43', '#9cbf6a'][Math.floor(rnd() * 4)];
      g.beginPath();
      g.arc(rnd() * 256, row * 32 + 8 + rnd() * 16, 4 + rnd() * 6, 0, Math.PI * 2);
      g.fill();
    }
  }
  return toTexture(c, 8, true);
}

/** Parking stalls: one module is 7 stalls (2.6 m) across and a double-loaded 18 m deep bay. */
export function parkingTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = PALETTE.parking;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  const pxPerM = 512 / 18.2;
  for (let i = 0; i <= 7; i++) {
    const x = Math.round(i * 2.6 * pxPerM);
    g.fillRect(x, 0, 2, 5.5 * pxPerM);
    g.fillRect(x, 512 - 5.5 * pxPerM, 2, 5.5 * pxPerM);
  }
  g.fillRect(0, 5.5 * pxPerM, 512, 2);
  g.fillRect(0, 512 - 5.5 * pxPerM, 512, 2);
  const t = toTexture(c, 8, true);
  t.repeat.set(1 / 18.2, 1 / 18);
  return t;
}

/** Practice pitches: an american football field with yard lines. */
export function practiceFieldTexture() {
  const [c, g] = canvas(256, 640);
  for (let i = 0; i < 24; i++) {
    g.fillStyle = i % 2 ? PALETTE.grass : PALETTE.grassLight;
    g.fillRect(0, i * (640 / 24), 256, 640 / 24 + 1);
  }
  g.fillStyle = '#ffffff';
  g.fillRect(14, 14, 228, 3);
  g.fillRect(14, 623, 228, 3);
  g.fillRect(14, 14, 3, 612);
  g.fillRect(239, 14, 3, 612);
  for (let k = 0; k <= 20; k++) g.fillRect(14, 66 + k * 25.4, 228, 2);
  return toTexture(c, 8);
}
