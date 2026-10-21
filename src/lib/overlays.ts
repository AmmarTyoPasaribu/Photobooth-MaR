/**
 * Teks dan stiker yang ditempel di hasil foto pada tahap review. Murni data dan geometri (tanpa DOM),
 * jadi bisa diuji dengan `node --test`. Digambar oleh `strip.ts`, diedit oleh `ResultGallery`.
 *
 * Stiker memakai bentuk vektor (path SVG) atau gambar SVG di `public/frames/`, bukan emoji, karena emoji
 * tampil berbeda di tiap perangkat sedangkan semua orang harus mendapat hasil yang sama persis.
 */

export type Overlay = {
  id: string;
  /** Indeks gambar hasil yang ditempeli (0 untuk format strip; nomor jepretan untuk format per jepretan). */
  image: number;
  kind: "text" | "sticker";
  text: string;
  sticker: string;
  color: string;
  font: "display" | "body";
  /** Pusat, dinormalisasi terhadap lebar dan tinggi gambar (0–1). */
  x: number;
  y: number;
  /** Lebar stiker, atau tinggi huruf teks, sebagai pecahan lebar gambar. */
  size: number;
  /** Putaran dalam radian. */
  rot: number;
};

export type StickerDef = {
  id: string;
  label: string;
  /** Lebar / tinggi. */
  aspect: number;
  /** Path SVG pada kotak 24×24; bila ada, digambar vektor berwarna `fill`. */
  path?: string;
  fill?: string;
  /** Gambar SVG di `public/`; dipakai bila tidak ada `path`. */
  src?: string;
};

export const STICKER_LIST: StickerDef[] = [
  {
    id: "hati",
    label: "Hati",
    aspect: 1,
    fill: "#FF4F7B",
    path: "M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3.5-3 7-10 13z",
  },
  {
    id: "bintang",
    label: "Bintang",
    aspect: 1,
    fill: "#FFD23F",
    path: "M12 1l3.2 7.3 7.8.7-5.9 5.2 1.8 7.7L12 17.9 5.1 21.9l1.8-7.7L1 9l7.8-.7z",
  },
  {
    id: "kilau",
    label: "Kilau",
    aspect: 1,
    fill: "#FFF7D6",
    path: "M12 1c.8 6 2.2 8.8 11 11-8.8 2.2-10.2 5-11 11-.8-6-2.2-8.8-11-11C9.8 9.8 11.2 7 12 1z",
  },
  {
    id: "bunga",
    label: "Bunga",
    aspect: 1,
    fill: "#FF8FB8",
    path: "M12 2a4 4 0 0 1 4 4 4 4 0 0 1 4 4 4 4 0 0 1-2.6 3.8A4 4 0 0 1 12 22a4 4 0 0 1-5.4-8.2A4 4 0 0 1 4 10a4 4 0 0 1 4-4 4 4 0 0 1 4-4z",
  },
  {
    id: "petir",
    label: "Petir",
    aspect: 1,
    fill: "#FFE34D",
    path: "M13 1L4 14h6l-2 9 10-14h-6z",
  },
  {
    id: "awan",
    label: "Awan",
    aspect: 1,
    fill: "#EAF6FF",
    path: "M6 19a4 4 0 0 1-.6-7.96A6 6 0 0 1 17 9a5 5 0 0 1 1 9.9z",
  },
  { id: "bulan-bintang", label: "Bulan bintang", aspect: 1, src: "/frames/bulan-bintang.svg" },
  { id: "lentera", label: "Lentera", aspect: 120 / 220, src: "/frames/lentera.svg" },
  { id: "ketupat", label: "Ketupat", aspect: 140 / 190, src: "/frames/ketupat.svg" },
  { id: "masjid", label: "Masjid", aspect: 1.5, src: "/frames/masjid.svg" },
];

export const STICKERS: Record<string, StickerDef> = Object.fromEntries(STICKER_LIST.map((s) => [s.id, s]));

export const TEXT_COLORS = ["#FFFFFF", "#1A0F2E", "#FF7A59", "#FFD23F", "#FF5C8A", "#5CD4C0"];

export const OVERLAY_LIMIT = 24;
export const TEXT_MAX = 24;
export const MIN_SIZE = 0.03;
export const MAX_SIZE = 0.8;
const HEX = /^#[0-9a-fA-F]{6}$/;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Id acak pendek untuk overlay baru. */
export function newOverlayId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeTextOverlay(image: number, text = "Tulisan"): Overlay {
  return { id: newOverlayId(), image, kind: "text", text, sticker: "", color: "#FFFFFF", font: "display", x: 0.5, y: 0.5, size: 0.1, rot: 0 };
}

export function makeStickerOverlay(image: number, sticker: string): Overlay {
  return { id: newOverlayId(), image, kind: "sticker", text: "", sticker, color: "#FFFFFF", font: "display", x: 0.5, y: 0.5, size: 0.22, rot: 0 };
}

/** Overlay dari teman bisa berasal dari versi lain atau pengirim rusak, jadi diperiksa dan dibatasi dulu. */
export function sanitizeOverlays(value: unknown): Overlay[] | null {
  if (!Array.isArray(value)) return null;
  const out: Overlay[] = [];
  for (const raw of value.slice(0, OVERLAY_LIMIT)) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const kind = o.kind === "text" ? "text" : o.kind === "sticker" ? "sticker" : null;
    if (!kind || typeof o.id !== "string" || o.id.length === 0 || o.id.length > 16) continue;
    const sticker = typeof o.sticker === "string" ? o.sticker : "";
    if (kind === "sticker" && !Object.prototype.hasOwnProperty.call(STICKERS, sticker)) continue;
    const text = typeof o.text === "string" ? o.text.slice(0, TEXT_MAX) : "";
    if (kind === "text" && text.trim() === "") continue;
    out.push({
      id: o.id,
      image: clamp(Math.round(num(o.image, 0)), 0, 3),
      kind,
      text,
      sticker: kind === "sticker" ? sticker : "",
      color: typeof o.color === "string" && HEX.test(o.color) ? o.color : "#FFFFFF",
      font: o.font === "body" ? "body" : "display",
      x: clamp(num(o.x, 0.5), -0.1, 1.1),
      y: clamp(num(o.y, 0.5), -0.1, 1.1),
      size: clamp(num(o.size, 0.15), MIN_SIZE, MAX_SIZE),
      rot: clamp(num(o.rot, 0), -7, 7),
    });
  }
  return out;
}

/** Kotak pembatas overlay dalam koordinat ternormalisasi (pusat x/y, lebar w, tinggi h), sebelum diputar. */
export function overlayBox(o: Overlay, imageAspect: number): { w: number; h: number } {
  if (o.kind === "sticker") {
    const aspect = STICKERS[o.sticker]?.aspect ?? 1;
    return { w: o.size, h: (o.size / aspect) * imageAspect };
  }
  // Perkiraan: lebar huruf rata-rata ≈ 0,52 × tinggi huruf, tinggi baris ≈ 1,15 × tinggi huruf.
  const chars = Math.max(1, o.text.length);
  return { w: o.size * 0.52 * chars, h: o.size * 1.15 * imageAspect };
}

/**
 * Apakah titik (px, py) ternormalisasi mengenai overlay `o`. `imageAspect` = lebar/tinggi gambar.
 * Titik diputar balik ke kerangka overlay supaya putaran ikut dihitung.
 */
export function hitOverlay(o: Overlay, px: number, py: number, imageAspect: number): boolean {
  const { w, h } = overlayBox(o, imageAspect);
  // Bekerja dalam satuan "lebar gambar" untuk kedua sumbu supaya putaran tidak terdistorsi.
  const dx = px - o.x;
  const dy = (py - o.y) / imageAspect;
  const cos = Math.cos(-o.rot);
  const sin = Math.sin(-o.rot);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const hw = Math.max(w, 0.06) / 2;
  const hh = Math.max(h / imageAspect, 0.06) / 2;
  return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
}

/** Overlay teratas (terakhir ditambahkan) di titik tersebut pada gambar `image`, atau null. */
export function topOverlayAt(list: Overlay[], image: number, px: number, py: number, imageAspect: number): Overlay | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (o.image === image && hitOverlay(o, px, py, imageAspect)) return o;
  }
  return null;
}
