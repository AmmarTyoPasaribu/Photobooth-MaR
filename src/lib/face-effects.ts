/**
 * Efek wajah (telinga, topi, kacamata) yang digambar dari bentuk vektor di canvas, jadi tampilannya
 * sama di semua perangkat dan tidak butuh berkas gambar. Dipakai oleh hasil foto (`strip.ts`)
 * dan oleh tampilan kamera langsung (`VideoTile`).
 *
 * Semua bentuk digambar dalam koordinat wajah: titik awal di puncak dahi, satuan = lebar wajah (pipi ke pipi),
 * sumbu x mengikuti kemiringan kepala, sumbu y ke arah dagu.
 */
import { faceFrame, type PxFace } from "./face-math";

export type EffectDef = { id: string; label: string };

export const NO_EFFECT = "none";

export const EFFECT_LIST: EffectDef[] = [
  { id: "dog", label: "Telinga anjing" },
  { id: "cat", label: "Telinga kucing" },
  { id: "bunny", label: "Telinga kelinci" },
  { id: "bear", label: "Telinga beruang" },
  { id: "party", label: "Topi pesta" },
  { id: "crown", label: "Mahkota" },
  { id: "tophat", label: "Topi sulap" },
  { id: "shades", label: "Kacamata hitam" },
  { id: "hearts", label: "Kacamata hati" },
  { id: "flowers", label: "Mahkota bunga" },
  { id: "songkok", label: "Songkok / peci hitam" },
  { id: "kopiah", label: "Peci putih (kopiah haji)" },
  { id: "mukena", label: "Mukena" },
  { id: "hijab-pink", label: "Hijab pink" },
  { id: "hijab-biru", label: "Hijab biru" },
  { id: "hijab-hijau", label: "Hijab hijau" },
  { id: "hijab-ungu", label: "Hijab ungu" },
  { id: "santa", label: "Topi Santa" },
  { id: "beard", label: "Jenggot" },
  { id: "round", label: "Kacamata bulat" },
  { id: "stars", label: "Kacamata bintang" },
  { id: "square", label: "Kacamata kotak" },
];

export const EFFECTS: Record<string, EffectDef> = Object.fromEntries(EFFECT_LIST.map((e) => [e.id, e]));

export function isEffect(id: string | undefined): id is string {
  return !!id && id !== NO_EFFECT && Object.prototype.hasOwnProperty.call(EFFECTS, id);
}

type Ctx = CanvasRenderingContext2D;
type Local = (q: [number, number]) => [number, number];

const INK = "#2a1633";

/** Telinga turun di kedua sisi kepala (dua sisi dicerminkan). */
function eachSide(ctx: Ctx, draw: (side: 1 | -1) => void) {
  for (const side of [-1, 1] as const) {
    ctx.save();
    draw(side);
    ctx.restore();
  }
}

function dog(ctx: Ctx, local: Local, f: PxFace) {
  eachSide(ctx, (side) => {
    ctx.translate(side * 0.4, 0.0);
    ctx.rotate(-side * 0.55);
    ctx.fillStyle = "#8a5a2e";
    ctx.beginPath();
    ctx.ellipse(0, 0.14, 0.15, 0.31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c98f5a";
    ctx.beginPath();
    ctx.ellipse(0, 0.16, 0.08, 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  const n = local(f.n);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(n[0], n[1], 0.08, 0.058, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgb(255 255 255 / 0.6)";
  ctx.beginPath();
  ctx.ellipse(n[0] - 0.025, n[1] - 0.02, 0.022, 0.012, -0.3, 0, Math.PI * 2);
  ctx.fill();
  if (f.open > 0.1) {
    const m = local(f.m);
    const h = Math.min(0.24, 0.06 + f.open * 0.9);
    ctx.fillStyle = "#ff6f91";
    ctx.strokeStyle = "#c2446a";
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.roundRect(m[0] - 0.065, m[1], 0.13, h, 0.06);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m[0], m[1] + 0.02);
    ctx.lineTo(m[0], m[1] + h * 0.7);
    ctx.stroke();
  }
}

function cat(ctx: Ctx, local: Local, f: PxFace) {
  eachSide(ctx, (side) => {
    ctx.scale(side, 1);
    ctx.fillStyle = "#3b3b4f";
    ctx.beginPath();
    ctx.moveTo(0.5, 0.2);
    ctx.lineTo(0.38, -0.36);
    ctx.lineTo(0.1, 0.0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff9fb8";
    ctx.beginPath();
    ctx.moveTo(0.4, 0.1);
    ctx.lineTo(0.36, -0.24);
    ctx.lineTo(0.19, -0.01);
    ctx.closePath();
    ctx.fill();
  });
  const n = local(f.n);
  ctx.fillStyle = "#ff7fa3";
  ctx.beginPath();
  ctx.moveTo(n[0] - 0.04, n[1] - 0.03);
  ctx.lineTo(n[0] + 0.04, n[1] - 0.03);
  ctx.lineTo(n[0], n[1] + 0.03);
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    for (const dy of [-0.035, 0.015, 0.065]) {
      const x0 = n[0] + side * 0.15;
      const y0 = n[1] + dy;
      const x1 = n[0] + side * 0.5;
      const y1 = n[1] + dy * 2.4;
      ctx.strokeStyle = "rgb(0 0 0 / 0.35)";
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.012;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
}

function bunny(ctx: Ctx, local: Local, f: PxFace) {
  eachSide(ctx, (side) => {
    ctx.translate(side * 0.2, -0.44);
    ctx.rotate(side * 0.13);
    ctx.fillStyle = "#fff4f8";
    ctx.strokeStyle = "#e4bccd";
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.115, 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffb6c8";
    ctx.beginPath();
    ctx.ellipse(0, 0.02, 0.058, 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  const n = local(f.n);
  ctx.fillStyle = "#ff8fae";
  ctx.beginPath();
  ctx.ellipse(n[0], n[1], 0.05, 0.036, 0, 0, Math.PI * 2);
  ctx.fill();
}

function bear(ctx: Ctx, local: Local, f: PxFace) {
  eachSide(ctx, (side) => {
    ctx.translate(side * 0.37, 0.0);
    ctx.fillStyle = "#7a4b2a";
    ctx.beginPath();
    ctx.arc(0, 0, 0.155, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9a066";
    ctx.beginPath();
    ctx.arc(0, 0.005, 0.085, 0, Math.PI * 2);
    ctx.fill();
  });
  const n = local(f.n);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(n[0], n[1], 0.07, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
}

function party(ctx: Ctx) {
  ctx.fillStyle = "#ff5c8a";
  ctx.beginPath();
  ctx.moveTo(0, -0.76);
  ctx.lineTo(-0.27, -0.03);
  ctx.lineTo(0.27, -0.03);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "#ffe34d";
  ctx.lineWidth = 0.05;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 0.11 - 0.1, -0.03);
    ctx.lineTo(i * 0.11 + 0.18, -0.48);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#ffe34d";
  ctx.beginPath();
  ctx.arc(0, -0.77, 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6c4cff";
  ctx.beginPath();
  ctx.roundRect(-0.28, -0.06, 0.56, 0.05, 0.025);
  ctx.fill();
}

function crown(ctx: Ctx) {
  ctx.fillStyle = "#ffd23f";
  ctx.strokeStyle = "#d99a00";
  ctx.lineWidth = 0.02;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-0.3, -0.04);
  ctx.lineTo(-0.32, -0.34);
  ctx.lineTo(-0.16, -0.19);
  ctx.lineTo(0, -0.42);
  ctx.lineTo(0.16, -0.19);
  ctx.lineTo(0.32, -0.34);
  ctx.lineTo(0.3, -0.04);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [x, y, c] of [
    [0, -0.14, "#ff4f7b"],
    [-0.17, -0.1, "#4fc3ff"],
    [0.17, -0.1, "#4fe0a0"],
  ] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tophat(ctx: Ctx) {
  ctx.fillStyle = "#1d1d27";
  ctx.beginPath();
  ctx.roundRect(-0.27, -0.66, 0.54, 0.6, 0.03);
  ctx.fill();
  ctx.fillStyle = "#c2185b";
  ctx.fillRect(-0.27, -0.2, 0.54, 0.1);
  ctx.fillStyle = "rgb(255 255 255 / 0.14)";
  ctx.fillRect(-0.2, -0.62, 0.05, 0.5);
  ctx.fillStyle = "#1d1d27";
  ctx.beginPath();
  ctx.ellipse(0, -0.06, 0.43, 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
}

function shades(ctx: Ctx, local: Local, f: PxFace) {
  const e = local(f.e);
  ctx.fillStyle = "rgb(12 10 20 / 0.94)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(e[0] + side * 0.2 - 0.16, e[1] - 0.09, 0.32, 0.2, 0.07);
    ctx.fill();
  }
  ctx.fillRect(e[0] - 0.05, e[1] - 0.06, 0.1, 0.03);
  ctx.fillRect(e[0] - 0.5, e[1] - 0.06, 0.2, 0.025);
  ctx.fillRect(e[0] + 0.3, e[1] - 0.06, 0.2, 0.025);
  ctx.strokeStyle = "rgb(255 255 255 / 0.3)";
  ctx.lineWidth = 0.02;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(e[0] + side * 0.2 - 0.09, e[1] - 0.04);
    ctx.lineTo(e[0] + side * 0.2 - 0.03, e[1] - 0.06);
    ctx.stroke();
  }
}

function heartPath(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.3, cy + s * 0.1, cx - s * 1.0, cy - s * 0.9, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 1.0, cy - s * 0.9, cx + s * 1.3, cy + s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
}

function hearts(ctx: Ctx, local: Local, f: PxFace) {
  const e = local(f.e);
  for (const side of [-1, 1]) {
    heartPath(ctx, e[0] + side * 0.2, e[1] + 0.01, 0.15);
    ctx.fillStyle = "rgb(255 79 123 / 0.92)";
    ctx.fill();
    ctx.strokeStyle = "#c2185b";
    ctx.lineWidth = 0.014;
    ctx.stroke();
    ctx.fillStyle = "rgb(255 255 255 / 0.5)";
    ctx.beginPath();
    ctx.ellipse(e[0] + side * 0.2 - 0.07, e[1] - 0.06, 0.03, 0.017, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#c2185b";
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.moveTo(e[0] - 0.06, e[1] - 0.02);
  ctx.lineTo(e[0] + 0.06, e[1] - 0.02);
  ctx.stroke();
}

function flowers(ctx: Ctx) {
  const colors = ["#ff7aa8", "#ffd23f", "#ffffff", "#b49dff", "#ff9a5a"];
  const count = 9;
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const x = -0.46 + (0.92 * i) / (count - 1);
    points.push([x, -0.07 + 0.22 * (x / 0.5) ** 2]);
  }
  ctx.fillStyle = "#4caf6a";
  points.forEach(([x, y], i) => {
    if (i === count - 1) return;
    const [nx, ny] = points[i + 1];
    ctx.beginPath();
    ctx.ellipse((x + nx) / 2, (y + ny) / 2 - 0.02, 0.07, 0.03, Math.atan2(ny - y, nx - x) + 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
  points.forEach(([x, y], i) => {
    ctx.fillStyle = colors[i % colors.length];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 0.045, y + Math.sin(a) * 0.045, 0.036, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = i % colors.length === 1 ? "#ff7aa8" : "#ffd23f";
    ctx.beginPath();
    ctx.arc(x, y, 0.028, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Songkok (peci hitam): beludru hitam yang sedikit mengerucut ke atas, duduk di garis dahi. */
function songkok(ctx: Ctx) {
  ctx.fillStyle = "#17120f";
  ctx.beginPath();
  ctx.moveTo(-0.47, 0.07);
  ctx.bezierCurveTo(-0.52, -0.1, -0.45, -0.34, -0.35, -0.42);
  ctx.lineTo(0.35, -0.42);
  ctx.bezierCurveTo(0.45, -0.34, 0.52, -0.1, 0.47, 0.07);
  ctx.quadraticCurveTo(0, 0.17, -0.47, 0.07);
  ctx.closePath();
  ctx.fill();
  // permukaan atas
  ctx.fillStyle = "#2a221c";
  ctx.beginPath();
  ctx.ellipse(0, -0.42, 0.35, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  // kilau beludru
  ctx.fillStyle = "rgb(255 255 255 / 0.09)";
  ctx.beginPath();
  ctx.roundRect(-0.36, -0.34, 0.16, 0.33, 0.08);
  ctx.fill();
  // tepi bawah
  ctx.strokeStyle = "#3b3028";
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.moveTo(-0.47, 0.07);
  ctx.quadraticCurveTo(0, 0.17, 0.47, 0.07);
  ctx.stroke();
}

/** Mukena putih: kerudung yang membingkai wajah, melebar di bahu, dan berakhir melengkung di dada. */
function mukena(ctx: Ctx, local: Local, f: PxFace) {
  const chinY = local(f.c)[1];
  const top = 0.07;
  const bottom = chinY - 0.02;
  const cy = (top + bottom) / 2;
  const ry = (bottom - top) / 2;
  const hem = chinY + 1.05; // ujung kain di dada

  const cloth = ctx.createLinearGradient(0, -0.45, 0, hem);
  cloth.addColorStop(0, "#ffffff");
  cloth.addColorStop(0.55, "#f3eefc");
  cloth.addColorStop(1, "#ddd3f3");

  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(-0.97, hem);
    ctx.bezierCurveTo(-1.04, chinY + 0.5, -0.94, chinY + 0.1, -0.76, chinY - 0.16);
    ctx.bezierCurveTo(-0.8, 0.3, -0.72, -0.06, -0.52, -0.3);
    ctx.bezierCurveTo(-0.32, -0.52, 0.32, -0.52, 0.52, -0.3);
    ctx.bezierCurveTo(0.72, -0.06, 0.8, 0.3, 0.76, chinY - 0.16);
    ctx.bezierCurveTo(0.94, chinY + 0.1, 1.04, chinY + 0.5, 0.97, hem);
    ctx.quadraticCurveTo(0, hem + 0.22, -0.97, hem);
    ctx.closePath();
  };

  outline();
  ctx.ellipse(0, cy, 0.53, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = cloth;
  ctx.fill("evenodd");

  // lipatan kain di dada dan sisi kepala
  ctx.strokeStyle = "rgb(150 130 205 / 0.26)";
  ctx.lineWidth = 0.016;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.66, 0.2);
    ctx.quadraticCurveTo(side * 0.78, 0.7, side * 0.74, chinY - 0.16);
    ctx.stroke();
    for (const x of [0.3, 0.55, 0.8]) {
      ctx.beginPath();
      ctx.moveTo(side * x, chinY + 0.12);
      ctx.quadraticCurveTo(side * (x + 0.03), chinY + 0.55, side * (x + 0.02), hem + 0.04);
      ctx.stroke();
    }
  }
  // tepi luar kerudung
  outline();
  ctx.strokeStyle = "#cdc1ec";
  ctx.lineWidth = 0.018;
  ctx.stroke();
  // garis tepi wajah
  ctx.strokeStyle = "#cfc3ee";
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.ellipse(0, cy, 0.53, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // renda emas tipis di tepi wajah
  ctx.strokeStyle = "#e6c36a";
  ctx.lineWidth = 0.014;
  ctx.setLineDash([0.018, 0.034]);
  ctx.beginPath();
  ctx.ellipse(0, cy, 0.56, ry + 0.03, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Peci putih (kopiah haji): rajutan putih yang bulat, sedikit lebih tinggi dari songkok. */
function kopiah(ctx: Ctx) {
  ctx.fillStyle = "#f7f4ea";
  ctx.beginPath();
  ctx.moveTo(-0.46, 0.07);
  ctx.bezierCurveTo(-0.5, -0.12, -0.44, -0.38, -0.3, -0.46);
  ctx.lineTo(0.3, -0.46);
  ctx.bezierCurveTo(0.44, -0.38, 0.5, -0.12, 0.46, 0.07);
  ctx.quadraticCurveTo(0, 0.17, -0.46, 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  // rajutan: garis-garis tipis
  ctx.strokeStyle = "rgb(150 140 120 / 0.35)";
  ctx.lineWidth = 0.008;
  for (let x = -0.5; x <= 0.5; x += 0.045) {
    ctx.beginPath();
    ctx.moveTo(x, -0.5);
    ctx.lineTo(x * 1.08, 0.2);
    ctx.stroke();
  }
  for (let y = -0.45; y <= 0.1; y += 0.05) {
    ctx.beginPath();
    ctx.moveTo(-0.5, y);
    ctx.lineTo(0.5, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#ece7d8";
  ctx.beginPath();
  ctx.ellipse(0, -0.46, 0.3, 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#cfc8b4";
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.moveTo(-0.46, 0.07);
  ctx.quadraticCurveTo(0, 0.17, 0.46, 0.07);
  ctx.stroke();
}

/** Hijab berwarna: kerudung yang membingkai wajah dan jatuh membentuk segitiga di dada. */
function hijab(ctx: Ctx, local: Local, f: PxFace, light: string, dark: string) {
  const chinY = local(f.c)[1];
  const top = 0.05;
  const bottom = chinY - 0.03;
  const cy = (top + bottom) / 2;
  const ry = (bottom - top) / 2;
  const tip = chinY + 0.95;

  const cloth = ctx.createLinearGradient(0, -0.45, 0, tip);
  cloth.addColorStop(0, light);
  cloth.addColorStop(1, dark);

  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(0, tip);
    ctx.bezierCurveTo(-0.3, chinY + 0.75, -0.7, chinY + 0.4, -0.8, chinY - 0.1);
    ctx.bezierCurveTo(-0.82, 0.3, -0.72, -0.06, -0.52, -0.3);
    ctx.bezierCurveTo(-0.32, -0.5, 0.32, -0.5, 0.52, -0.3);
    ctx.bezierCurveTo(0.72, -0.06, 0.82, 0.3, 0.8, chinY - 0.1);
    ctx.bezierCurveTo(0.7, chinY + 0.4, 0.3, chinY + 0.75, 0, tip);
    ctx.closePath();
  };

  outline();
  ctx.ellipse(0, cy, 0.52, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = cloth;
  ctx.fill("evenodd");

  // lipatan
  ctx.strokeStyle = "rgb(255 255 255 / 0.22)";
  ctx.lineWidth = 0.016;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.62, 0.15);
    ctx.quadraticCurveTo(side * 0.8, 0.7, side * 0.72, chinY + 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side * 0.3, chinY + 0.1);
    ctx.quadraticCurveTo(side * 0.34, chinY + 0.5, side * 0.06, tip - 0.06);
    ctx.stroke();
  }
  outline();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.strokeStyle = "rgb(255 255 255 / 0.5)";
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.ellipse(0, cy, 0.52, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // bros kecil di dada
  ctx.fillStyle = "#ffd56b";
  ctx.beginPath();
  ctx.arc(0.34, chinY + 0.22, 0.04, 0, Math.PI * 2);
  ctx.fill();
}

/** Topi Santa: merah dengan bulu putih, ujungnya jatuh ke samping. */
function santa(ctx: Ctx) {
  ctx.fillStyle = "#d62828";
  ctx.beginPath();
  ctx.moveTo(-0.46, 0.0);
  ctx.bezierCurveTo(-0.46, -0.36, -0.2, -0.68, 0.16, -0.64);
  ctx.bezierCurveTo(0.5, -0.6, 0.66, -0.3, 0.7, 0.0);
  ctx.lineTo(0.46, 0.0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgb(0 0 0 / 0.12)";
  ctx.beginPath();
  ctx.moveTo(0.1, -0.62);
  ctx.bezierCurveTo(0.45, -0.58, 0.62, -0.3, 0.66, 0.0);
  ctx.lineTo(0.46, 0.0);
  ctx.bezierCurveTo(0.42, -0.25, 0.3, -0.5, 0.1, -0.62);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0.71, 0.04, 0.095, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-0.53, -0.1, 1.06, 0.18, 0.09);
  ctx.fill();
  ctx.strokeStyle = "#e5e5ee";
  ctx.lineWidth = 0.012;
  ctx.stroke();
}

/** Jenggot gelap: rahang hingga dagu, dengan kumis dan lubang untuk mulut. */
function beard(ctx: Ctx, local: Local, f: PxFace) {
  const chinY = local(f.c)[1];
  const l = local(f.l);
  const r = local(f.r);
  const m = local(f.m);
  const mouthRy = 0.045 + f.open * 0.6;
  ctx.fillStyle = "#2b1b14";
  ctx.beginPath();
  ctx.moveTo(l[0] - 0.01, l[1] - 0.12);
  ctx.bezierCurveTo(l[0] - 0.03, l[1] + 0.4, -0.32, chinY + 0.32, 0, chinY + 0.38);
  ctx.bezierCurveTo(0.32, chinY + 0.32, r[0] + 0.03, r[1] + 0.4, r[0] + 0.01, r[1] - 0.12);
  ctx.lineTo(0.38, m[1] - 0.05);
  ctx.bezierCurveTo(0.2, m[1] - 0.15, -0.2, m[1] - 0.15, -0.38, m[1] - 0.05);
  ctx.closePath();
  ctx.ellipse(m[0], m[1] + 0.01, 0.14, mouthRy, 0, 0, Math.PI * 2);
  ctx.fill("evenodd");
  // kumis
  ctx.beginPath();
  ctx.moveTo(m[0] - 0.3, m[1] - 0.03);
  ctx.bezierCurveTo(m[0] - 0.2, m[1] - 0.17, m[0] - 0.06, m[1] - 0.11, m[0], m[1] - 0.07);
  ctx.bezierCurveTo(m[0] + 0.06, m[1] - 0.11, m[0] + 0.2, m[1] - 0.17, m[0] + 0.3, m[1] - 0.03);
  ctx.bezierCurveTo(m[0] + 0.2, m[1] - 0.02, m[0] + 0.08, m[1] - 0.06, m[0], m[1] - 0.03);
  ctx.bezierCurveTo(m[0] - 0.08, m[1] - 0.06, m[0] - 0.2, m[1] - 0.02, m[0] - 0.3, m[1] - 0.03);
  ctx.closePath();
  ctx.fill();
  // kilau rambut
  ctx.strokeStyle = "rgb(255 255 255 / 0.1)";
  ctx.lineWidth = 0.012;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 0.1, m[1] + 0.12);
    ctx.quadraticCurveTo(i * 0.12, chinY + 0.1, i * 0.08, chinY + 0.3);
    ctx.stroke();
  }
}

function roundGlasses(ctx: Ctx, local: Local, f: PxFace) {
  const e = local(f.e);
  ctx.lineWidth = 0.03;
  ctx.strokeStyle = "#c9962b";
  ctx.fillStyle = "rgb(255 255 255 / 0.16)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(e[0] + side * 0.2, e[1], 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.lineWidth = 0.024;
  ctx.beginPath();
  ctx.arc(e[0], e[1] - 0.07, 0.07, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(e[0] + side * 0.34, e[1] - 0.02);
    ctx.lineTo(e[0] + side * 0.5, e[1] - 0.04);
    ctx.stroke();
  }
}

function starGlasses(ctx: Ctx, local: Local, f: PxFace) {
  const e = local(f.e);
  const star = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  ctx.lineWidth = 0.028;
  ctx.strokeStyle = "#ff4f8b";
  ctx.fillStyle = "rgb(255 214 10 / 0.92)";
  for (const side of [-1, 1]) {
    star(e[0] + side * 0.2, e[1] + 0.01, 0.19);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = "#ff4f8b";
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.moveTo(e[0] - 0.05, e[1] - 0.02);
  ctx.lineTo(e[0] + 0.05, e[1] - 0.02);
  ctx.stroke();
}

function squareGlasses(ctx: Ctx, local: Local, f: PxFace) {
  const e = local(f.e);
  ctx.lineWidth = 0.036;
  ctx.strokeStyle = "#16161d";
  ctx.fillStyle = "rgb(170 215 255 / 0.2)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(e[0] + side * 0.2 - 0.15, e[1] - 0.09, 0.3, 0.2, 0.035);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(e[0] - 0.05, e[1] - 0.03);
  ctx.lineTo(e[0] + 0.05, e[1] - 0.03);
  ctx.moveTo(e[0] - 0.35, e[1] - 0.04);
  ctx.lineTo(e[0] - 0.5, e[1] - 0.05);
  ctx.moveTo(e[0] + 0.35, e[1] - 0.04);
  ctx.lineTo(e[0] + 0.5, e[1] - 0.05);
  ctx.stroke();
}

/** Menggambar efek `id` pada wajah `face` (koordinat piksel ke canvas `ctx`). Tidak mengubah state canvas. */
export function drawFaceEffect(ctx: Ctx, id: string, face: PxFace) {
  if (!isEffect(id)) return;
  const { origin, angle, width, local } = faceFrame(face);
  // Titik tidak valid (mis. kotak tampilan berukuran nol) tidak digambar.
  if (![origin[0], origin[1], angle, width].every(Number.isFinite)) return;
  ctx.save();
  ctx.translate(origin[0], origin[1]);
  ctx.rotate(angle);
  ctx.scale(width, width);
  ctx.lineJoin = "round";
  switch (id) {
    case "dog":
      dog(ctx, local, face);
      break;
    case "cat":
      cat(ctx, local, face);
      break;
    case "bunny":
      bunny(ctx, local, face);
      break;
    case "bear":
      bear(ctx, local, face);
      break;
    case "party":
      party(ctx);
      break;
    case "crown":
      crown(ctx);
      break;
    case "tophat":
      tophat(ctx);
      break;
    case "shades":
      shades(ctx, local, face);
      break;
    case "hearts":
      hearts(ctx, local, face);
      break;
    case "flowers":
      flowers(ctx);
      break;
    case "songkok":
      songkok(ctx);
      break;
    case "mukena":
      mukena(ctx, local, face);
      break;
    case "kopiah":
      kopiah(ctx);
      break;
    case "hijab-pink":
      hijab(ctx, local, face, "#ffb3d1", "#e0568f");
      break;
    case "hijab-biru":
      hijab(ctx, local, face, "#a9d3ff", "#3b7fd6");
      break;
    case "hijab-hijau":
      hijab(ctx, local, face, "#a8e6c1", "#2f9a69");
      break;
    case "hijab-ungu":
      hijab(ctx, local, face, "#d2bcff", "#7a50d6");
      break;
    case "santa":
      santa(ctx);
      break;
    case "beard":
      beard(ctx, local, face);
      break;
    case "round":
      roundGlasses(ctx, local, face);
      break;
    case "stars":
      starGlasses(ctx, local, face);
      break;
    case "square":
      squareGlasses(ctx, local, face);
      break;
  }
  ctx.restore();
}
