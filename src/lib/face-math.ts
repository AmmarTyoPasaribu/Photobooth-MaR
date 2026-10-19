/**
 * Geometri wajah untuk efek (telinga, topi, kacamata). Murni matematika, tanpa DOM atau MediaPipe,
 * jadi bisa diuji dengan `node --test`.
 *
 * Wajah dinyatakan lewat beberapa titik yang dinormalisasi (0–1) terhadap gambar sumber:
 * - t: puncak dahi, c: dagu, l/r: pipi kiri/kanan (l selalu di sisi x lebih kecil)
 * - n: ujung hidung, m: tengah mulut, e: tengah kedua mata
 * - open: seberapa lebar mulut terbuka (0–1, relatif terhadap tinggi wajah)
 */

export type Pt = [number, number];
export type Face = { t: Pt; c: Pt; l: Pt; r: Pt; n: Pt; m: Pt; e: Pt; open: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** Indeks titik pada face mesh MediaPipe (468 titik). */
export const LM = { top: 10, chin: 152, cheekA: 234, cheekB: 454, nose: 1, lipUpper: 13, lipLower: 14, eyeA: 33, eyeB: 263 };

type Landmark = { x: number; y: number };

const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Ubah daftar titik face mesh menjadi `Face`; null bila titiknya tidak lengkap. */
export function faceFromLandmarks(lm: Landmark[] | undefined): Face | null {
  if (!lm || lm.length <= LM.eyeB) return null;
  const p = (i: number): Pt => [lm[i].x, lm[i].y];
  const cheekA = p(LM.cheekA);
  const cheekB = p(LM.cheekB);
  const [l, r] = cheekA[0] <= cheekB[0] ? [cheekA, cheekB] : [cheekB, cheekA];
  const t = p(LM.top);
  const c = p(LM.chin);
  const height = dist(t, c) || 1;
  const open = Math.min(1, dist(p(LM.lipUpper), p(LM.lipLower)) / height);
  return { t, c, l, r, n: p(LM.nose), m: mid(p(LM.lipUpper), p(LM.lipLower)), e: mid(p(LM.eyeA), p(LM.eyeB)), open };
}

/** Cermin kiri-kanan (tampilan selfie). Titik l dan r bertukar supaya l tetap di sisi kiri. */
export function flipFace(f: Face): Face {
  const fl = (q: Pt): Pt => [1 - q[0], q[1]];
  return { t: fl(f.t), c: fl(f.c), l: fl(f.r), r: fl(f.l), n: fl(f.n), m: fl(f.m), e: fl(f.e), open: f.open };
}

/**
 * Dari koordinat frame video ke koordinat foto yang dipotret: crop tengah ke rasio `aspect`,
 * sama persis dengan `captureFrame`. Arah (cermin atau tidak) tidak diubah di sini.
 */
export function cropToPhoto(f: Face, vw: number, vh: number, aspect = 4 / 3): Face {
  let sw = vw;
  let sh = vw / aspect;
  if (sh > vh) {
    sh = vh;
    sw = vh * aspect;
  }
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  const cv = (q: Pt): Pt => [(q[0] * vw - sx) / sw, (q[1] * vh - sy) / sh];
  return { t: cv(f.t), c: cv(f.c), l: cv(f.l), r: cv(f.r), n: cv(f.n), m: cv(f.m), e: cv(f.e), open: f.open };
}

/** Wajah dalam piksel pada sebuah kotak tampilan. */
export type PxFace = { t: Pt; c: Pt; l: Pt; r: Pt; n: Pt; m: Pt; e: Pt; open: number };

/**
 * Petakan wajah (ternormalisasi terhadap gambar `srcW`×`srcH`) ke piksel pada `cell`,
 * dengan aturan "cover" yang sama seperti `drawCover` (gambar memenuhi kotak, bagian lebih dipotong di tengah).
 */
export function mapFace(f: Face, srcW: number, srcH: number, cell: Rect): PxFace {
  const scale = Math.max(cell.w / srcW, cell.h / srcH);
  const sx = (srcW - cell.w / scale) / 2;
  const sy = (srcH - cell.h / scale) / 2;
  const px = (q: Pt): Pt => [cell.x + (q[0] * srcW - sx) * scale, cell.y + (q[1] * srcH - sy) * scale];
  return { t: px(f.t), c: px(f.c), l: px(f.l), r: px(f.r), n: px(f.n), m: px(f.m), e: px(f.e), open: f.open };
}

/** Kerangka koordinat wajah: titik awal di puncak dahi, satuan = lebar wajah, sumbu x mengikuti kemiringan kepala. */
export function faceFrame(f: PxFace) {
  const dx = f.r[0] - f.l[0];
  const dy = f.r[1] - f.l[1];
  const width = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy, dx);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  /** Titik piksel ke koordinat wajah (satuan lebar wajah). */
  const local = (q: Pt): Pt => {
    const x = q[0] - f.t[0];
    const y = q[1] - f.t[1];
    return [(x * cos - y * sin) / width, (x * sin + y * cos) / width];
  };
  return { origin: f.t, angle, width, local };
}

const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

function sanitizePt(v: unknown): Pt | null {
  return Array.isArray(v) && v.length === 2 && inRange(v[0], -1, 2) && inRange(v[1], -1, 2) ? [v[0], v[1]] : null;
}

/** Wajah dari teman bisa berasal dari versi lain atau pengirim rusak, jadi diperiksa dulu. */
export function sanitizeFace(v: unknown): Face | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const t = sanitizePt(o.t);
  const c = sanitizePt(o.c);
  const l = sanitizePt(o.l);
  const r = sanitizePt(o.r);
  const n = sanitizePt(o.n);
  const m = sanitizePt(o.m);
  const e = sanitizePt(o.e);
  if (!t || !c || !l || !r || !n || !m || !e || !inRange(o.open, 0, 1)) return null;
  return { t, c, l, r, n, m, e, open: o.open };
}

/** Bulatkan titik supaya pesan ke teman kecil (±150 byte). */
export function compactFace(f: Face): Face {
  const rd = (q: Pt): Pt => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000];
  return { t: rd(f.t), c: rd(f.c), l: rd(f.l), r: rd(f.r), n: rd(f.n), m: rd(f.m), e: rd(f.e), open: Math.round(f.open * 100) / 100 };
}
