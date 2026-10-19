/** Jalankan: npm test */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compactFace, cropToPhoto, faceFrame, faceFromLandmarks, flipFace, LM, mapFace, sanitizeFace, type Face } from "./face-math.ts";

function landmarks() {
  const lm = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
  lm[LM.top] = { x: 0.5, y: 0.2 };
  lm[LM.chin] = { x: 0.5, y: 0.8 };
  lm[LM.cheekA] = { x: 0.7, y: 0.5 }; // sengaja terbalik: A di kanan
  lm[LM.cheekB] = { x: 0.3, y: 0.5 };
  lm[LM.nose] = { x: 0.5, y: 0.55 };
  lm[LM.lipUpper] = { x: 0.5, y: 0.66 };
  lm[LM.lipLower] = { x: 0.5, y: 0.72 };
  lm[LM.eyeA] = { x: 0.36, y: 0.42 };
  lm[LM.eyeB] = { x: 0.64, y: 0.42 };
  return lm;
}

const face = faceFromLandmarks(landmarks()) as Face;

test("faceFromLandmarks: l selalu di kiri, mulut dan mata di tengah", () => {
  assert.ok(face);
  assert.ok(face.l[0] < face.r[0]);
  assert.deepEqual(face.e, [0.5, 0.42]);
  assert.ok(Math.abs(face.m[1] - 0.69) < 1e-9);
  assert.ok(face.open > 0.09 && face.open < 0.11); // 0.06 / 0.6
  assert.equal(faceFromLandmarks([]), null);
  assert.equal(faceFromLandmarks(undefined), null);
});

test("flipFace: cermin dua kali = semula, l tetap di kiri", () => {
  const f = flipFace(face);
  assert.ok(f.l[0] < f.r[0]);
  assert.ok(Math.abs(f.t[0] - 0.5) < 1e-9);
  const back = flipFace(f);
  for (const k of ["t", "c", "l", "r", "n", "m", "e"] as const) {
    assert.ok(Math.abs(back[k][0] - face[k][0]) < 1e-9 && Math.abs(back[k][1] - face[k][1]) < 1e-9, k);
  }
});

test("cropToPhoto: crop tengah 4:3 dari video 16:9", () => {
  // video 1600x900 -> foto 1200x900, sx = 200
  const f = cropToPhoto({ ...face, t: [0.5, 0.5], c: [0.5, 0.5], l: [0.125, 0.5], r: [0.875, 0.5], n: [0.5, 0], m: [0.5, 1], e: [0.5, 0.5] }, 1600, 900);
  assert.ok(Math.abs(f.l[0] - 0) < 1e-9);
  assert.ok(Math.abs(f.r[0] - 1) < 1e-9);
  assert.ok(Math.abs(f.n[1] - 0) < 1e-9 && Math.abs(f.m[1] - 1) < 1e-9); // tinggi tidak dipotong
});

test("mapFace: sel 4:3 pada foto 4:3 = skala lurus, sel 1:1 memotong sisi", () => {
  const p = mapFace(face, 1280, 960, { x: 100, y: 50, w: 640, h: 480 });
  assert.ok(Math.abs(p.t[0] - (100 + 0.5 * 640)) < 1e-6);
  assert.ok(Math.abs(p.t[1] - (50 + 0.2 * 480)) < 1e-6);
  // sel persegi 500x500 dari foto 1280x960: skala = 500/960, sisi kiri/kanan dipotong
  const q = mapFace(face, 1280, 960, { x: 0, y: 0, w: 500, h: 500 });
  assert.ok(Math.abs(q.t[0] - 250) < 1e-6, "tengah tetap di tengah");
  assert.ok(Math.abs(q.t[1] - 0.2 * 960 * (500 / 960)) < 1e-6);
});

test("faceFrame: kepala tegak = sudut 0; miring mengikuti garis pipi", () => {
  const upright = mapFace(face, 1000, 1000, { x: 0, y: 0, w: 1000, h: 1000 });
  const fr = faceFrame(upright);
  assert.ok(Math.abs(fr.angle) < 1e-9);
  assert.ok(Math.abs(fr.width - 400) < 1e-6); // 0.3 -> 0.7
  const [lx] = fr.local(upright.l);
  assert.ok(Math.abs(lx - -0.5) < 1e-6);
  const tilted = { ...upright, l: [300, 600] as [number, number], r: [700, 400] as [number, number] };
  assert.ok(faceFrame(tilted).angle < 0); // sisi kanan lebih tinggi
});

test("sanitizeFace menolak data rusak dan menerima hasil compactFace", () => {
  assert.deepEqual(sanitizeFace(compactFace(face)), compactFace(face));
  for (const bad of [null, 5, "x", {}, { ...face, open: 5 }, { ...face, t: [NaN, 0] }, { ...face, l: [0.1] }, { ...face, n: [9, 9] }]) {
    assert.equal(sanitizeFace(bad), null);
  }
});
