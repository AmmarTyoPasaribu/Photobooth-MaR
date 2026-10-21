/**
 * Kirim/terima file (foto) lewat RTCDataChannel dengan cara dipotong-potong.
 * Pesan teks (JSON) dipakai untuk metadata, pesan biner untuk potongan data.
 */

const CHUNK_SIZE = 16 * 1024; // aman untuk semua browser
const HIGH_WATER_MARK = 1024 * 1024; // tahan kirim kalau buffer > 1 MB
const LOW_WATER_MARK = 256 * 1024;

/**
 * "photo": foto JPEG; "mask": masker orang (PNG) untuk background pengganti;
 * "clip": satu frame kecil dari rekaman gerak per jepretan (untuk GIF), bernomor lewat `frame`.
 */
export type BlobKind = "photo" | "mask" | "clip";

export type PhotoMeta = {
  type: "photo-meta";
  index: number;
  size: number;
  mime: string;
  /** Tidak ada pada peer versi lama: dianggap "photo". */
  kind?: BlobKind;
  /** Nomor frame, hanya untuk kind "clip". */
  frame?: number;
};

function normalizeKind(kind: unknown): BlobKind {
  return kind === "mask" ? "mask" : kind === "clip" ? "clip" : "photo";
}

function waitForDrain(dc: RTCDataChannel): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      dc.removeEventListener("bufferedamountlow", done);
      dc.removeEventListener("close", done);
      resolve();
    };
    dc.addEventListener("bufferedamountlow", done);
    dc.addEventListener("close", done); // jangan menggantung antrean kalau peer keluar
  });
}

export async function sendBlob(dc: RTCDataChannel, index: number, blob: Blob, kind: BlobKind = "photo", frame?: number) {
  if (dc.readyState !== "open") return;
  const buffer = await blob.arrayBuffer();
  const meta: PhotoMeta = {
    type: "photo-meta",
    index,
    size: buffer.byteLength,
    mime: blob.type || "image/jpeg",
    kind,
    ...(frame === undefined ? {} : { frame }),
  };

  dc.bufferedAmountLowThreshold = LOW_WATER_MARK;
  dc.send(JSON.stringify(meta));

  for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
    if (dc.readyState !== "open") return;
    if (dc.bufferedAmount > HIGH_WATER_MARK) await waitForDrain(dc);
    dc.send(buffer.slice(offset, offset + CHUNK_SIZE));
  }
}

/** Batas ukuran per berkas, supaya peer rusak/jahat tidak bisa menghabiskan memori. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_MASK_BYTES = 2 * 1024 * 1024;
export const MAX_CLIP_BYTES = 400 * 1024;

export function createReceiver(onComplete: (index: number, blob: Blob, kind: BlobKind, frame?: number) => void) {
  let current: (PhotoMeta & { parts: ArrayBuffer[]; received: number }) | null = null;

  return {
    meta(meta: PhotoMeta) {
      const kind = normalizeKind(meta.kind);
      const limit = kind === "mask" ? MAX_MASK_BYTES : kind === "clip" ? MAX_CLIP_BYTES : MAX_PHOTO_BYTES;
      if (!Number.isInteger(meta.size) || meta.size < 0 || meta.size > limit) {
        current = null; // abaikan berkas ini, potongan datanya ikut dibuang
        return;
      }
      current = { ...meta, parts: [], received: 0 };
      if (meta.size === 0) {
        onComplete(meta.index, new Blob([], { type: meta.mime }), kind, meta.frame);
        current = null;
      }
    },
    chunk(data: ArrayBuffer) {
      if (!current) return;
      current.parts.push(data);
      current.received += data.byteLength;
      if (current.received >= current.size) {
        onComplete(current.index, new Blob(current.parts, { type: current.mime }), normalizeKind(current.kind), current.frame);
        current = null;
      }
    },
  };
}
