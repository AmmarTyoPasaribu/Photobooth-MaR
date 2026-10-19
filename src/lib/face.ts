/**
 * Deteksi wajah di perangkat (MediaPipe Face Landmarker) untuk efek wajah.
 * Model (±3,7 MB) ada di `public/models/`; runtime WASM dibagi dengan segmentasi (`vision.ts`).
 * Dimuat hanya saat host memilih efek wajah.
 */
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { faceFromLandmarks, type Face } from "./face-math";
import { getVisionFileset } from "./vision";

const MODEL_URL = "/models/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;
/** Diisi begitu model siap, supaya deteksi per frame bisa sinkron. */
let ready: FaceLandmarker | null = null;
let lastTimestamp = 0;

async function createLandmarker(): Promise<FaceLandmarker> {
  const { FaceLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await getVisionFileset();
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO" as const,
    numFaces: 1,
  });
  try {
    return await FaceLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    // Sebagian browser/HP tidak mendukung delegate GPU.
    return FaceLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

function getLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= createLandmarker()
    .then((instance) => (ready = instance))
    .catch((err) => {
      landmarkerPromise = null; // coba lagi lain kali
      throw err;
    });
  return landmarkerPromise;
}

/** Mulai mengunduh model lebih awal (mis. begitu host memilih efek wajah). */
export function preloadFaceLandmarker() {
  void getLandmarker().catch((err) => console.warn("[face] model gagal dimuat", err));
}

/**
 * Wajah pada frame video saat ini, dinormalisasi terhadap frame penuh (arah asli, belum dicermin).
 * Null bila model belum siap, video belum punya gambar, atau tidak ada wajah.
 */
export function detectFace(video: HTMLVideoElement): Face | null {
  if (!ready || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
  try {
    // Timestamp harus selalu naik.
    lastTimestamp = Math.max(performance.now(), lastTimestamp + 1);
    const result = ready.detectForVideo(video, lastTimestamp);
    return faceFromLandmarks(result.faceLandmarks[0]);
  } catch (err) {
    console.warn("[face] deteksi gagal", err);
    return null;
  }
}
