/**
 * Background pengganti. Setiap gambar membentang di seluruh area foto satu panel
 * (untuk 2 orang: dua foto 4:3 berdampingan = 8:3), jadi pemandangannya menyambung
 * dari foto kiri ke kanan dan semua orang terlihat berada di tempat yang sama.
 *
 * Menambah background: simpan SVG/PNG/JPG rasio ±8:3 di `public/backgrounds/`, lalu daftarkan di sini.
 * Untuk SVG, hindari teks (font tiap perangkat bisa berbeda).
 */

export type BackgroundDef = { id: string; label: string; src: string };

export const NO_BACKGROUND = "none";

export const BACKGROUND_LIST: BackgroundDef[] = [
  { id: "studio", label: "Studio", src: "/backgrounds/studio.svg" },
  { id: "ruang-tamu", label: "Ruang tamu", src: "/backgrounds/ruang-tamu.svg" },
  { id: "kafe", label: "Kafe", src: "/backgrounds/kafe.svg" },
  { id: "pantai", label: "Pantai", src: "/backgrounds/pantai.svg" },
  { id: "senja-kota", label: "Senja kota", src: "/backgrounds/senja-kota.svg" },
  { id: "hutan", label: "Hutan", src: "/backgrounds/hutan.svg" },
  { id: "gunung", label: "Gunung", src: "/backgrounds/gunung.svg" },
  { id: "sakura", label: "Sakura", src: "/backgrounds/sakura.svg" },
  { id: "pelangi", label: "Pelangi", src: "/backgrounds/pelangi.svg" },
  { id: "bawah-laut", label: "Bawah laut", src: "/backgrounds/bawah-laut.svg" },
  { id: "angkasa", label: "Luar angkasa", src: "/backgrounds/angkasa.svg" },
  { id: "synthwave", label: "Synthwave", src: "/backgrounds/synthwave.svg" },
  { id: "panggung", label: "Panggung", src: "/backgrounds/panggung.svg" },
  { id: "pesta", label: "Pesta", src: "/backgrounds/pesta.svg" },
  { id: "masjid", label: "Masjid", src: "/backgrounds/masjid.svg" },
  { id: "dalam-masjid", label: "Dalam masjid", src: "/backgrounds/dalam-masjid.svg" },
];

export const BACKGROUNDS: Record<string, BackgroundDef> = Object.fromEntries(BACKGROUND_LIST.map((b) => [b.id, b]));

export function getBackground(id: string | undefined): BackgroundDef | null {
  return id && id !== NO_BACKGROUND ? (BACKGROUNDS[id] ?? null) : null;
}
