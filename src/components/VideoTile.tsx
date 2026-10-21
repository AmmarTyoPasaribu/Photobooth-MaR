"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { drawFaceEffect } from "@/lib/face-effects";
import { mapFace } from "@/lib/face-math";
import type { FaceStore } from "@/lib/face-store";

type Props = {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  filterCss: string;
  videoRef?: RefObject<HTMLVideoElement | null>;
  emptyText: string;
  style?: CSSProperties;
  /** Rasio lebar/tinggi tile, sama dengan sel di hasil foto. */
  aspect?: number;
  /** Cerminkan tampilan (kamera depan). Bawaan true; kamera belakang tidak dicerminkan. */
  mirror?: boolean;
  /** Status koneksi teman; tidak diisi untuk tile milik sendiri. */
  quality?: "good" | "weak" | "connecting";
  /** Efek wajah di kamera langsung: id efek, penyimpan wajah, dan kuncinya di penyimpan itu. */
  faceEffect?: { id: string; store: FaceStore; storeKey: string };
};

/** Canvas di atas video yang menggambar efek wajah langsung, tanpa render ulang React. */
function FaceOverlay({
  effect,
  videoRef,
}: {
  effect: { id: string; store: FaceStore; storeKey: string };
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { id, store, storeKey } = effect;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      if (w < 1 || h < 1) return; // tile sedang tersembunyi (mis. tahap review)
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const video = videoRef.current;
      const face = store.get(storeKey);
      if (!face || !video || !video.videoWidth || !video.videoHeight) return;
      ctx.scale(dpr, dpr);
      drawFaceEffect(ctx, id, mapFace(face, video.videoWidth, video.videoHeight, { x: 0, y: 0, w, h }));
    };
    draw();
    const unsubscribe = store.subscribe(storeKey, draw);
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, [id, store, storeKey, videoRef]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

const QUALITY_BADGE = {
  good: { dot: "bg-green-400", text: "Lancar" },
  weak: { dot: "bg-amber-400", text: "Lemah" },
  connecting: { dot: "bg-paper/60", text: "Menyambung" },
} as const;

export function VideoTile({
  stream,
  label,
  muted = false,
  filterCss,
  videoRef,
  emptyText,
  style,
  aspect = 4 / 3,
  mirror = true,
  quality,
  faceEffect,
}: Props) {
  const innerRef = useRef<HTMLVideoElement | null>(null);
  const ref = videoRef ?? innerRef;
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) {
      video.play().then(
        () => setNeedsTap(false),
        () => setNeedsTap(true), // autoplay dengan suara diblokir browser
      );
    }
  }, [stream, ref]);

  const resume = () => {
    ref.current?.play().then(() => setNeedsTap(false), () => undefined);
  };

  return (
    <div className="relative overflow-hidden bg-ink/15" style={{ aspectRatio: aspect, ...style }}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`}
        style={{ filter: filterCss }}
      />

      {faceEffect && <FaceOverlay effect={faceEffect} videoRef={ref} />}

      {!stream && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink/70">
          {emptyText}
        </div>
      )}

      {needsTap && stream && (
        <button
          type="button"
          onClick={resume}
          className="absolute inset-0 grid place-items-center bg-ink/50 text-base font-bold text-paper"
        >
          Ketuk untuk menyalakan suara
        </button>
      )}

      {quality && (
        <span
          className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-paper"
          title="Kualitas koneksi ke teman ini"
        >
          <span className={`h-2 w-2 rounded-full ${QUALITY_BADGE[quality].dot}`} aria-hidden="true" />
          {QUALITY_BADGE[quality].text}
        </span>
      )}

      <span className="absolute bottom-2 left-2 rounded-full bg-ink/70 px-3 py-1 text-xs font-medium text-paper">
        {label}
      </span>
    </div>
  );
}
