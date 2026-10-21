/** Jalankan: npm test */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hitOverlay,
  makeStickerOverlay,
  makeTextOverlay,
  OVERLAY_LIMIT,
  overlayBox,
  sanitizeOverlays,
  STICKER_LIST,
  topOverlayAt,
} from "./overlays.ts";

test("sanitizeOverlays: data rusak dibuang, nilai dibatasi", () => {
  assert.equal(sanitizeOverlays("x"), null);
  assert.equal(sanitizeOverlays(null), null);
  const ok = makeTextOverlay(0, "Halo");
  const out = sanitizeOverlays([
    ok,
    { ...ok, id: "a", kind: "bukan" },
    { ...ok, id: "b", text: "   " }, // teks kosong
    { ...makeStickerOverlay(0, "hati"), id: "c", sticker: "tidak-ada" },
    { ...ok, id: "d", x: 99, y: -99, size: 5, rot: 100, color: "merah", font: "aneh", image: 9, text: "x".repeat(100) },
    null,
    5,
  ]);
  assert.ok(out);
  assert.deepEqual(out.map((o) => o.id), [ok.id, "d"]);
  const d = out[1];
  assert.ok(d.x <= 1.1 && d.y >= -0.1 && d.size <= 0.8 && d.rot <= 7);
  assert.equal(d.color, "#FFFFFF");
  assert.equal(d.font, "display");
  assert.equal(d.image, 3);
  assert.equal(d.text.length, 24);
});

test("sanitizeOverlays: jumlah dibatasi", () => {
  const many = Array.from({ length: OVERLAY_LIMIT + 10 }, () => makeStickerOverlay(0, "bintang"));
  const ids = new Set(many.map((m) => m.id));
  assert.ok(ids.size > 1);
  assert.equal(sanitizeOverlays(many)?.length, OVERLAY_LIMIT);
});

test("semua stiker punya path atau src, dan id unik", () => {
  const ids = STICKER_LIST.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of STICKER_LIST) assert.ok(s.path || s.src, s.id);
});

test("hitOverlay dan topOverlayAt: titik di dalam/luar, putaran, urutan tumpukan", () => {
  const a = { ...makeStickerOverlay(0, "bintang"), id: "a", x: 0.5, y: 0.5, size: 0.2 };
  assert.equal(hitOverlay(a, 0.5, 0.5, 1), true);
  assert.equal(hitOverlay(a, 0.58, 0.5, 1), true);
  assert.equal(hitOverlay(a, 0.8, 0.5, 1), false);
  assert.equal(hitOverlay(a, 0.5, 0.9, 1), false);
  // stiker tinggi (lentera) diputar 90°: sempit ke samping, lebar ke atas-bawah menjadi menyamping
  const tall = { ...makeStickerOverlay(0, "lentera"), id: "t", x: 0.5, y: 0.5, size: 0.1, rot: Math.PI / 2 };
  assert.equal(hitOverlay(tall, 0.5 + 0.08, 0.5, 1), true);
  assert.equal(hitOverlay({ ...tall, rot: 0 }, 0.5 + 0.08, 0.5, 1), false);
  // yang terakhir ditambahkan ada di atas; gambar lain diabaikan
  const b = { ...a, id: "b" };
  const other = { ...a, id: "z", image: 1 };
  assert.equal(topOverlayAt([a, b, other], 0, 0.5, 0.5, 1)?.id, "b");
  assert.equal(topOverlayAt([a, b, other], 1, 0.5, 0.5, 1)?.id, "z");
  assert.equal(topOverlayAt([a, b], 0, 0.05, 0.05, 1), null);
});

test("overlayBox: stiker mengikuti rasio, teks mengikuti panjang", () => {
  const sticker = { ...makeStickerOverlay(0, "masjid"), size: 0.3 }; // aspek 1,5
  const box = overlayBox(sticker, 1);
  assert.ok(Math.abs(box.h - 0.2) < 1e-9 && box.w === 0.3);
  const portrait = overlayBox(sticker, 0.5); // gambar tinggi: tinggi ternormalisasi lebih kecil
  assert.ok(Math.abs(portrait.h - 0.1) < 1e-9);
  const short = overlayBox({ ...makeTextOverlay(0, "ab"), size: 0.1 }, 1);
  const long = overlayBox({ ...makeTextOverlay(0, "abcdefgh"), size: 0.1 }, 1);
  assert.ok(long.w > short.w * 3.5);
});
