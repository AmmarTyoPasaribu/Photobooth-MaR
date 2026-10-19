/**
 * Runtime WASM MediaPipe yang dipakai bersama oleh segmentasi (`segment.ts`) dan deteksi wajah (`face.ts`).
 * Dimuat dari jsDelivr hanya saat dibutuhkan (±12 MB). Versinya harus sama dengan paket @mediapipe/tasks-vision.
 */
import type { FilesetResolver } from "@mediapipe/tasks-vision";

export const TASKS_VISION_VERSION = "1.0.1";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;

type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let filesetPromise: Promise<Fileset> | null = null;
let consoleFiltered = false;

/**
 * MediaPipe menulis pesan info ("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.") lewat console.error,
 * sehingga overlay galat Next.js ikut muncul padahal tidak ada masalah. Hanya pesan info itu yang disaring.
 */
function silenceMediapipeInfo() {
  if (consoleFiltered || typeof console === "undefined") return;
  consoleFiltered = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO: Created TensorFlow Lite")) return;
    original(...args);
  };
}

export function getVisionFileset(): Promise<Fileset> {
  silenceMediapipeInfo();
  filesetPromise ??= import("@mediapipe/tasks-vision")
    .then(({ FilesetResolver }) => FilesetResolver.forVisionTasks(WASM_URL))
    .catch((err) => {
      filesetPromise = null; // coba lagi lain kali
      throw err;
    });
  return filesetPromise;
}
