/** Jalankan: npm test */
import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultFormatFor, defaultShotsFor, getLayout } from "./layout.ts";
import { normalizeRoomCode } from "./room.ts";
import { parseCapacity } from "./types.ts";

test("getLayout: slot, tile hiasan, dan batas jumlah orang", () => {
  const decor = [0, 0, 0, 0, 1, 0, 1, 0];
  for (let n = 1; n <= 8; n++) {
    const layout = getLayout(n);
    assert.equal(layout.slots - n, layout.decorSlots);
    assert.equal(layout.decorSlots, decor[n - 1], `n=${n}`);
  }
  assert.equal(getLayout(2).seamless, true);
  assert.equal(getLayout(3).seamless, false);
  assert.equal(getLayout(0).slots, 1);
  assert.equal(getLayout(99).slots, 8);
  assert.equal(getLayout(Number.NaN).slots, 1);
});

test("bawaan jumlah foto dan format mengikuti jumlah orang", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 8].map(defaultShotsFor), [4, 4, 3, 3, 2, 2]);
  assert.deepEqual([1, 4, 5, 8].map(defaultFormatFor), ["strip", "strip", "single", "single"]);
});

test("normalizeRoomCode: tautan, huruf besar, karakter aneh, panjang", () => {
  assert.equal(normalizeRoomCode("https://x.com/room/ABCdefghjk?n=3"), "abcdefghjk");
  assert.equal(normalizeRoomCode("  K7XQ2M "), "k7xq2m");
  assert.equal(normalizeRoomCode("!!!"), "");
  assert.equal(normalizeRoomCode("a".repeat(50)).length, 32);
});

test("parseCapacity hanya menerima 1–8", () => {
  assert.equal(parseCapacity("3"), 3);
  assert.equal(parseCapacity(8), 8);
  for (const bad of ["0", "9", 2.5, undefined, null, "abc", ""]) assert.equal(parseCapacity(bad), null, String(bad));
});
