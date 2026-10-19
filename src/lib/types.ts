import type { Face } from "./face-math";
import type { ResultFormat } from "./layout";

/** Id bingkai, lihat `src/lib/frames.ts`. */
export type FrameId = string;
export type FilterId =
  | "none"
  | "bw"
  | "vintage"
  | "warm"
  | "cool"
  | "vivid"
  | "fade"
  | "noir"
  | "sepia"
  | "sunset"
  | "dream"
  | "pastel"
  | "neon";

/** Pengaturan booth. Hanya host yang mengubahnya; peserta lain menerima salinannya. */
export type BoothSettings = {
  frame: FrameId;
  filter: FilterId;
  shots: number;
  caption: string;
  /** Efek wajah (`src/lib/face-effects.ts`), atau "none". */
  effect: string;
  /** Lama hitung mundur per jepretan, dalam detik (`COUNTDOWN_OPTIONS`). */
  countdown: number;
  /** "strip": semua jepretan dalam satu gambar. "single": satu gambar per jepretan. */
  format: ResultFormat;
  /** Background pengganti (`src/lib/backgrounds.ts`), atau "none" untuk latar asli. */
  background: string;
};

/**
 * Pesan aplikasi yang dikirim lewat data channel WebRTC.
 * `settings`, `start`, dan `reset` hanya diproses bila datang dari data channel milik host terverifikasi.
 */
export type BoothMessage =
  /** `rev`: penghitung versi (Lamport) untuk room mode "all", supaya edit terbaru menang dan pendatang baru tidak menimpa. */
  | { type: "settings"; settings: BoothSettings; rev?: number }
  /**
   * `order`: id peserta sesuai urutan di strip, sama untuk semua orang.
   * `startAt`: waktu mulai hitung mundur menurut jam pengirim (ms epoch); penerima mengonversinya ke jamnya sendiri.
   */
  | { type: "start"; shots: number; order: string[]; startAt?: number; countdown?: number }
  /** Ulangi satu jepretan (indeks 0-based) pada sesi yang sedang di tahap review. */
  | { type: "retake"; index: number; startAt?: number; countdown?: number }
  | { type: "reset" }
  /** Pengukuran selisih jam antar perangkat: `t` = jam pengirim ping, `r` = jam penjawab. */
  /** Wajah pada foto jepretan `index` milik pengirim (null = tidak terdeteksi), untuk efek wajah di hasil. */
  | { type: "face"; index: number; face: Face | null }
  /** Wajah pada tampilan kamera langsung pengirim (arah selfie), untuk efek wajah di tile-nya. */
  | { type: "face-live"; face: Face | null }
  | { type: "ping"; t: number }
  | { type: "pong"; t: number; r: number }
  /** Peserta meminta host mengirim ulang pengaturan (mis. setelah host baru terverifikasi). */
  | { type: "sync" };

/** Pesan signaling yang dikirim lewat Supabase Realtime Broadcast. */
export type SignalPayload =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "candidates"; candidates: RTCIceCandidateInit[] };

/** Di topologi mesh setiap pesan signaling ditujukan ke satu peer tertentu. */
export type SignalEnvelope = SignalPayload & { from: string; to: string };

export type ConnectionStatus =
  | "media" // meminta izin kamera
  | "joining" // menghubungkan ke Supabase dan menunggu giliran masuk
  | "solo" // room untuk 1 orang
  | "waiting" // sudah masuk, belum ada teman lain
  | "connecting" // ada teman, negosiasi WebRTC belum selesai
  | "connected" // minimal satu teman tersambung
  | "full"
  | "error";

export const COUNTDOWN_OPTIONS = [3, 5, 10];
export const DEFAULT_COUNTDOWN = 3;

export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 8;
export const DEFAULT_CAPACITY = 2;

export function parseCapacity(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(n) || n < MIN_CAPACITY || n > MAX_CAPACITY) return null;
  return n;
}
