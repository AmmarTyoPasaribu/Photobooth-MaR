/** Jalankan: npm test */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceiver, MAX_MASK_BYTES, MAX_PHOTO_BYTES, type PhotoMeta } from "./transfer.ts";

function collect() {
  const got: [number, number, string][] = [];
  const receiver = createReceiver((index, blob, kind) => got.push([index, blob.size, kind]));
  return { got, receiver };
}

test("foto dan masker diterima utuh dari potongan", () => {
  const { got, receiver } = collect();
  receiver.meta({ type: "photo-meta", index: 1, size: 5, mime: "image/jpeg" } as PhotoMeta);
  receiver.chunk(new ArrayBuffer(3));
  receiver.chunk(new ArrayBuffer(2));
  receiver.meta({ type: "photo-meta", index: 0, size: 4, mime: "image/png", kind: "mask" });
  receiver.chunk(new ArrayBuffer(4));
  assert.deepEqual(got, [
    [1, 5, "photo"],
    [0, 4, "mask"],
  ]);
});

test("potongan tanpa meta diabaikan, ukuran 0 langsung selesai", () => {
  const { got, receiver } = collect();
  receiver.chunk(new ArrayBuffer(10));
  assert.equal(got.length, 0);
  receiver.meta({ type: "photo-meta", index: 0, size: 0, mime: "image/jpeg" });
  assert.equal(got.length, 1);
});

test("ukuran di luar batas ditolak dan potongannya dibuang", () => {
  const { got, receiver } = collect();
  for (const size of [-1, 1.5, Number.NaN, 1e12, MAX_PHOTO_BYTES + 1]) {
    receiver.meta({ type: "photo-meta", index: 0, size, mime: "image/jpeg" });
    receiver.chunk(new ArrayBuffer(1024));
  }
  receiver.meta({ type: "photo-meta", index: 0, size: MAX_MASK_BYTES + 1, mime: "image/png", kind: "mask" });
  receiver.chunk(new ArrayBuffer(1024));
  assert.equal(got.length, 0);
});

test("meta baru menggantikan transfer yang belum selesai", () => {
  const { got, receiver } = collect();
  receiver.meta({ type: "photo-meta", index: 0, size: 10, mime: "image/jpeg" });
  receiver.chunk(new ArrayBuffer(4));
  receiver.meta({ type: "photo-meta", index: 1, size: 2, mime: "image/jpeg" });
  receiver.chunk(new ArrayBuffer(2));
  assert.deepEqual(got, [[1, 2, "photo"]]);
});

test("frame klip diterima dengan nomor frame dan batas ukuran sendiri", async () => {
  const { MAX_CLIP_BYTES } = await import("./transfer.ts");
  const got: [number, number, string, number | undefined][] = [];
  const receiver = createReceiver((index, blob, kind, frame) => got.push([index, blob.size, kind, frame]));
  receiver.meta({ type: "photo-meta", index: 2, size: 6, mime: "image/jpeg", kind: "clip", frame: 5 });
  receiver.chunk(new ArrayBuffer(6));
  receiver.meta({ type: "photo-meta", index: 0, size: MAX_CLIP_BYTES + 1, mime: "image/jpeg", kind: "clip", frame: 1 });
  receiver.chunk(new ArrayBuffer(100));
  assert.deepEqual(got, [[2, 6, "clip", 5]]);
});
