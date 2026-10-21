"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useBoxSize } from "@/hooks/useBoxSize";
import { usePeerRoom } from "@/hooks/usePeerRoom";
import { BACKGROUND_LIST, BACKGROUNDS, getBackground, NO_BACKGROUND } from "@/lib/backgrounds";
import { captureFrame } from "@/lib/capture";
import { detectFace, detectFaceInPhoto, preloadFaceLandmarker } from "@/lib/face";
import { EFFECT_LIST, EFFECTS, isEffect, NO_EFFECT } from "@/lib/face-effects";
import { compactFace, cropToPhoto, flipFace, sanitizeFace, type Face } from "@/lib/face-math";
import { FaceStore } from "@/lib/face-store";
import { sanitizeOverlays, type Overlay } from "@/lib/overlays";
import { DEFAULT_FRAME_ID, FRAMES, getFrame } from "@/lib/frames";
import { acceptsControlMessage, readHostSettings, saveHostSettings, type RoomMode } from "@/lib/host";
import { defaultFormatFor, defaultShotsFor, getLayout, type ResultFormat } from "@/lib/layout";
import { makePersonMask, preloadSegmenter } from "@/lib/segment";
import { composeStrip, FILTERS, renderStrip } from "@/lib/strip";
import type { BlobKind } from "@/lib/transfer";
import {
  COUNTDOWN_OPTIONS,
  DEFAULT_CAPACITY,
  DEFAULT_COUNTDOWN,
  MAX_CAPACITY,
  type BoothMessage,
  type BoothSettings,
  type ConnectionStatus,
  type FilterId,
} from "@/lib/types";
import { Brand } from "./Brand";
import { CameraSwitchIcon, ChevronIcon, MicIcon, MicOffIcon, ShareIcon } from "./Icons";
import { ClipPanel } from "./ClipPanel";
import { DecorTile } from "./DecorTile";
import { FramePicker } from "./FramePicker";
import { ResultGallery, type ResultImage } from "./ResultGallery";
import { VideoTile } from "./VideoTile";

type Phase = "idle" | "shooting" | "review";
type Session = { order: string[]; shots: number };
type Photos = Map<string, (Blob | null)[]>;
/** Frame rekaman gerak: peserta → jepretan → nomor frame. */
type Clips = Map<string, (Blob | undefined)[][]>;

function withClip(prev: Clips, id: string, shot: number, frame: number, blob: Blob): Clips {
  const next = new Map(prev);
  const shots = (next.get(id) ?? []).slice();
  const frames = (shots[shot] ?? []).slice();
  frames[frame] = blob;
  shots[shot] = frames;
  next.set(id, shots);
  return next;
}

/** Nomor frame yang dimiliki SEMUA orang pada SEMUA jepretan di `shotIdx`. */
function commonFrames(clips: Clips, order: string[], shotIdx: number[]): number[] {
  const out: number[] = [];
  for (let k = 0; k < CLIP_OFFSETS.length; k++) {
    if (order.every((id) => shotIdx.every((s) => !!clips.get(id)?.[s]?.[k]))) out.push(k);
  }
  return out;
}

/** Wajah per peserta per jepretan; "none" = sudah dicek dan tidak ada wajah, null = belum datang. */
type Faces = Map<string, (Face | "none" | null)[]>;

const SHOT_OPTIONS = [1, 2, 3, 4];
const FORMATS: Record<ResultFormat, string> = { strip: "Strip", single: "Per jepretan" };
const PHOTO_TIMEOUT_MS = 12_000;
const CAPTION_MAX = 28;
const TILE_GAP = 12;
const STAGE_PAD = 12;
/** Jeda dari tombol "Mulai" sampai hitung mundur, memberi waktu pesan sampai ke semua teman. */
const LEAD_MS = 2000;
/** Jeda antar jepretan setelah foto diambil. */
const SHOT_REST_MS = 1500;
/** Jumlah ping per teman untuk mengukur selisih jam. */
const CLOCK_PINGS = 5;
/** Selang deteksi wajah untuk efek di kamera langsung (±9 kali per detik). */
const LIVE_FACE_MS = 110;
/** Waktu tiap frame rekaman gerak terhadap saat foto diambil (ms). Satu frame tepat di 0 (foto itu sendiri). */
const CLIP_OFFSETS = [-440, -330, -220, -110, 0, 110, 220, 330];
const CLIP_FRAME_WIDTH = 480;
const CLIP_FRAME_QUALITY = 0.6;
/** Minimal frame bersama (dari semua orang) untuk membuat GIF. */
const CLIP_MIN_FRAMES = 3;
const GIF_SCALE = 0.45;
const GIF_DELAY_MS = 110;

function defaultsFor(people: number): BoothSettings {
  return {
    frame: DEFAULT_FRAME_ID,
    filter: "none",
    shots: defaultShotsFor(people),
    countdown: DEFAULT_COUNTDOWN,
    caption: "kita",
    format: defaultFormatFor(people),
    background: NO_BACKGROUND,
    clip: false,
  };
}

function statusText(status: ConnectionStatus, canControl: boolean): string {
  const ready = canControl ? "Atur bingkai, lalu mulai foto." : "Menunggu pembuat room memulai foto.";
  const texts: Record<ConnectionStatus, string> = {
    media: "Meminta izin kamera dan mikrofon…",
    joining: "Masuk ke room…",
    solo: `Mode sendiri. ${ready}`,
    waiting: "Belum ada teman yang masuk. Kirim tautan room ini ke mereka.",
    connecting: "Menyambungkan ke teman-temanmu…",
    connected: `Tersambung. ${ready}`,
    full: "",
    error: "",
  };
  return texts[status];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Tidur sampai waktu absolut `t` (jam perangkat ini), supaya jadwal tidak melenceng oleh kerja di antaranya. */
const sleepUntil = (t: number) => sleep(Math.max(0, t - Date.now()));
const pickCountdown = (value: unknown, fallback: number) =>
  typeof value === "number" && COUNTDOWN_OPTIONS.includes(value) ? value : fallback;
const emptyShots = (n: number) => Array<Blob | null>(n).fill(null);
const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const revokeAll = (prev: ResultImage[]) => {
  prev.forEach((r) => URL.revokeObjectURL(r.url));
  return [];
};

function withPhoto(prev: Photos, id: string, index: number, blob: Blob, shots: number): Photos {
  const next = new Map(prev);
  const list = (next.get(id) ?? emptyShots(Math.max(shots, index + 1))).slice();
  list[index] = blob;
  next.set(id, list);
  return next;
}

/** Pengaturan dari host bisa berasal dari versi aplikasi berbeda, jadi diperiksa dulu. */
function sanitizeSettings(value: unknown): BoothSettings | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<Record<keyof BoothSettings, unknown>>;
  if (typeof s.frame !== "string" || !hasOwn(FRAMES, s.frame)) return null;
  if (typeof s.filter !== "string" || !hasOwn(FILTERS, s.filter)) return null;
  const shots = Number(s.shots);
  if (!SHOT_OPTIONS.includes(shots)) return null;
  return {
    frame: s.frame,
    filter: s.filter as FilterId,
    shots,
    countdown: pickCountdown(Number(s.countdown), DEFAULT_COUNTDOWN),
    caption: String(s.caption ?? "").slice(0, CAPTION_MAX),
    format: s.format === "single" ? "single" : "strip",
    background: typeof s.background === "string" && hasOwn(BACKGROUNDS, s.background) ? s.background : NO_BACKGROUND,
    clip: s.clip === true,
  };
}

function withFace(prev: Faces, id: string, index: number, face: Face | "none", shots: number): Faces {
  const next = new Map(prev);
  const list = (next.get(id) ?? Array<Face | "none" | null>(Math.max(shots, index + 1)).fill(null)).slice();
  list[index] = face;
  next.set(id, list);
  return next;
}

function completeFaces(map: Faces, order: string[], shots: number) {
  return order.every((id) => {
    const list = map.get(id);
    return !!list && list.length >= shots && list.slice(0, shots).every((v) => v !== null && v !== undefined);
  });
}

/** Wajah pada foto yang akan dipotret: koordinat foto (crop 4:3), arah sama dengan foto (dicermin bila selfie). */
function photoFaceFrom(video: HTMLVideoElement, mirror: boolean): Face | null {
  const raw = detectFace(video);
  if (!raw) return null;
  const cropped = cropToPhoto(raw, video.videoWidth, video.videoHeight);
  return mirror ? flipFace(cropped) : cropped;
}

/** Semua orang di `order` punya item untuk setiap jepretan. */
function complete(map: Photos, order: string[], shots: number) {
  return order.every((id) => {
    const list = map.get(id);
    return !!list && list.length >= shots && list.slice(0, shots).every(Boolean);
  });
}

export function Booth({
  roomId,
  capacityParam,
  modeParam,
}: {
  roomId: string;
  capacityParam: number | null;
  modeParam: RoomMode | null;
}) {
  /** Pilihan host (atau salinan lengkap dari host); sisanya mengikuti bawaan untuk N orang. */
  const [choices, setChoices] = useState<Partial<BoothSettings>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState<number | null>(null);
  const [shotIndex, setShotIndex] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [photos, setPhotos] = useState<Photos>(() => new Map());
  /** Masker orang per peserta per jepretan, untuk background pengganti. */
  const [masks, setMasks] = useState<Photos>(() => new Map());
  const [faces, setFaces] = useState<Faces>(() => new Map());
  /** Teks dan stiker di hasil foto, dibagikan ke semua orang (edit terbaru menang di room "semua orang"). */
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const overlaysRevRef = useRef(0);
  /** Frame rekaman gerak untuk GIF, dan GIF yang sudah dibuat di perangkat ini. */
  const [clips, setClips] = useState<Clips>(() => new Map());
  const [gifs, setGifs] = useState<ResultImage[]>([]);
  const [gifBusy, setGifBusy] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  /** Efek wajah pilihanku sendiri, dan pilihan tiap teman (dikirim lewat data channel). */
  const [myEffect, setMyEffect] = useState(NO_EFFECT);
  const [effects, setEffects] = useState<Record<string, string>>({});
  /** Foto-ku yang sedang/sudah dicari wajahnya setelah memotret (kunci: indeks jepretan). */
  const faceJobsRef = useRef(new Set<number>());
  /** Wajah terbaru tiap tile untuk efek di kamera langsung (tidak memicu render). */
  const [faceStore] = useState(() => new FaceStore());
  const [timedOut, setTimedOut] = useState(false);
  const [results, setResults] = useState<ResultImage[]>([]);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageBoxRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const runningRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  /** Masker fotoku yang sedang/sudah dibuat di sesi ini (kunci: indeks jepretan). */
  const maskJobsRef = useRef(new Set<number>());
  /** Versi pengaturan (penghitung Lamport) untuk room yang semua anggotanya boleh mengatur. */
  const settingsRevRef = useRef(0);
  /** Selisih jam tiap teman terhadap jamku (ms, positif = jam teman lebih maju), dari ping/pong dengan RTT terkecil. */
  const clockRef = useRef(new Map<string, { offset: number; rtt: number }>());
  const [savedNames, setSavedNames] = useState<Set<string>>(() => new Set());
  const ctxRef = useRef<{
    myId: string | null;
    hostId: string | null;
    /** Semua anggota boleh mengatur (room format lama atau mode "semua orang"). */
    openControl: boolean;
    canControl: boolean;
    settings: BoothSettings;
    /** Cerminkan foto lokal (kamera depan). */
    mirror: boolean;
    sendTo: (peerId: string, message: BoothMessage) => void;
    sendPhoto: (index: number, blob: Blob, kind?: BlobKind, frame?: number) => void;
    send: (message: BoothMessage) => void;
    effect: string;
  }>({
    myId: null,
    hostId: null,
    openControl: false,
    canControl: false,
    settings: defaultsFor(DEFAULT_CAPACITY),
    mirror: true,
    sendTo: () => undefined,
    sendPhoto: () => undefined,
    send: () => undefined,
    effect: NO_EFFECT,
  });

  const box = useBoxSize(stageBoxRef);

  const resetSession = useCallback(() => {
    if (runningRef.current) return;
    sessionRef.current = null;
    setSession(null);
    setPhase("idle");
    setPhotos(new Map());
    setMasks(new Map());
    setFaces(new Map());
    setOverlays([]);
    overlaysRevRef.current = 0;
    setClips(new Map());
    setGifs(revokeAll);
    setGifError(null);
    maskJobsRef.current = new Set();
    faceJobsRef.current = new Set();
    setTimedOut(false);
    setResults(revokeAll);
  }, []);

  /** Waktu mulai dari jam pengirim diubah ke jam perangkat ini memakai selisih jam hasil ping. */
  const toLocalStart = useCallback((from: string, startAt: unknown): number => {
    const now = Date.now();
    if (typeof startAt !== "number" || !Number.isFinite(startAt)) return now + 500;
    const clock = clockRef.current.get(from);
    const local = clock ? startAt - clock.offset : now + Math.max(0, LEAD_MS - 400);
    return Math.min(Math.max(local, now + 200), now + 15_000);
  }, []);

  /**
   * Hitung mundur dan jepret untuk `indices`. Semua waktu dijadwalkan absolut dari `t0` (jam perangkat ini),
   * jadi jepretan jatuh pada saat yang sama di semua perangkat.
   */
  const shootLoop = useCallback(async (indices: number[], shots: number, t0: number, countdown: number) => {
    const period = countdown * 1000 + SHOT_REST_MS;
    for (const [k, i] of indices.entries()) {
      setShotIndex(i);
      const captureAt = t0 + k * period + countdown * 1000;
      for (let n = countdown; n >= 1; n--) {
        await sleepUntil(captureAt - n * 1000);
        setCount(n);
      }
      // Rekam gerak: beberapa frame kecil di sekitar jepretan (satu frame tepat di waktu foto).
      const clipOn = ctxRef.current.settings.clip;
      for (const [frameNo, offset] of (clipOn ? CLIP_OFFSETS : [0]).entries()) {
        await sleepUntil(captureAt + offset);
        const clipVideo = localVideoRef.current;
        const clipId = ctxRef.current.myId;
        if (clipOn && clipVideo && clipId) {
          try {
            const clipBlob = await captureFrame(clipVideo, ctxRef.current.mirror, CLIP_FRAME_WIDTH, CLIP_FRAME_QUALITY);
            setClips((prev) => withClip(prev, clipId, i, frameNo, clipBlob));
            ctxRef.current.sendPhoto(i, clipBlob, "clip", frameNo);
          } catch (err) {
            console.error("[clip]", err);
          }
        }
        if (offset !== 0) continue;

        setCount(null);
        setFlashKey((key) => key + 1);

        // Foto selalu diambil dari kamera lokal dalam resolusi penuh, bukan dari stream WebRTC.
        const video = localVideoRef.current;
        const myId = ctxRef.current.myId;
        if (video && myId) {
          try {
            // Wajah dideteksi pada frame yang sama dengan foto, sebelum frame berikutnya datang.
            const wantFace = isEffect(ctxRef.current.effect);
            // Dibulatkan seperti yang dikirim ke teman, supaya posisi efek identik di semua perangkat.
            const detected = wantFace ? photoFaceFrom(video, ctxRef.current.mirror) : null;
            const face = detected ? compactFace(detected) : null;
            const blob = await captureFrame(video, ctxRef.current.mirror);
            if (wantFace) {
              setFaces((prev) => withFace(prev, myId, i, face ?? "none", shots));
              ctxRef.current.send({ type: "face", index: i, face });
            }
            setPhotos((prev) => withPhoto(prev, myId, i, blob, shots));
            ctxRef.current.sendPhoto(i, blob);
          } catch (err) {
            console.error("[capture]", err);
          }
        }
      }
    }
    await sleep(900);
  }, []);

  const runSession = useCallback(
    async (shots: number, order: string[], t0: number, countdown: number) => {
      if (runningRef.current) return;
      runningRef.current = true;
      const next = { shots, order };
      sessionRef.current = next;
      setSession(next);
      setPhotos(new Map(order.map((id) => [id, emptyShots(shots)])));
      setMasks(new Map());
      setFaces(new Map());
      setOverlays([]);
      overlaysRevRef.current = 0;
      setClips(new Map());
      setGifs(revokeAll);
      setGifError(null);
      maskJobsRef.current = new Set();
      faceJobsRef.current = new Set();
      setTimedOut(false);
      setResults(revokeAll);
      setPhase("shooting");

      try {
        await shootLoop(Array.from({ length: shots }, (_, i) => i), shots, t0, countdown);
      } finally {
        runningRef.current = false;
        setCount(null);
        setPhase("review");
      }
    },
    [shootLoop],
  );

  /** Mengulang satu jepretan pada sesi yang sedang di tahap review; foto lain tetap. */
  const runRetake = useCallback(
    async (index: number, t0: number, countdown: number) => {
      const current = sessionRef.current;
      if (!current || runningRef.current) return;
      runningRef.current = true;
      const clearShot = (prev: Photos) => {
        const next = new Map(prev);
        for (const id of current.order) {
          const list = (next.get(id) ?? emptyShots(current.shots)).slice();
          list[index] = null;
          next.set(id, list);
        }
        return next;
      };
      setPhotos(clearShot);
      setMasks(clearShot);
      setFaces((prev) => {
        const next = new Map(prev);
        for (const id of current.order) {
          const list = (next.get(id) ?? Array<Face | "none" | null>(current.shots).fill(null)).slice();
          list[index] = null;
          next.set(id, list);
        }
        return next;
      });
      maskJobsRef.current.delete(index);
      faceJobsRef.current.delete(index);
      setClips((prev) => {
        const next = new Map(prev);
        for (const id of current.order) {
          const shotList = (next.get(id) ?? []).slice();
          shotList[index] = [];
          next.set(id, shotList);
        }
        return next;
      });
      setGifs(revokeAll);
      setTimedOut(false);
      setResults(revokeAll);
      setPhase("shooting");

      try {
        await shootLoop([index], current.shots, t0, countdown);
      } finally {
        runningRef.current = false;
        setCount(null);
        setPhase("review");
      }
    },
    [shootLoop],
  );

  const onMessage = useCallback(
    (from: string, message: BoothMessage) => {
      const ctx = ctxRef.current;
      // Pengukuran jam: boleh dari siapa pun, tidak mengubah state booth.
      if (message.type === "ping") {
        if (typeof message.t === "number") ctx.sendTo(from, { type: "pong", t: message.t, r: Date.now() });
        return;
      }
      if (message.type === "pong") {
        if (typeof message.t !== "number" || typeof message.r !== "number") return;
        const rtt = Date.now() - message.t;
        if (rtt < 0 || rtt > 5000) return;
        const best = clockRef.current.get(from);
        if (!best || rtt < best.rtt) clockRef.current.set(from, { offset: message.r - (message.t + rtt / 2), rtt });
        return;
      }
      if (message.type === "effect") {
        const id =
          typeof message.effect === "string" && (message.effect === NO_EFFECT || hasOwn(EFFECTS, message.effect))
            ? message.effect
            : NO_EFFECT;
        setEffects((prev) => (prev[from] === id ? prev : { ...prev, [from]: id }));
        return;
      }
      if (message.type === "face-live") {
        faceStore.set(from, sanitizeFace(message.face));
        return;
      }
      if (message.type === "face") {
        const index = Number(message.index);
        if (!Number.isInteger(index) || index < 0 || index >= SHOT_OPTIONS.length) return;
        const shots = sessionRef.current?.shots ?? index + 1;
        setFaces((prev) => withFace(prev, from, index, sanitizeFace(message.face) ?? "none", shots));
        return;
      }
      if (message.type === "sync") {
        // Peserta meminta pengaturan terkini; hanya yang berhak mengatur yang menjawab.
        // Di room terbuka, anggota yang belum pernah mengatur/menerima pengaturan tidak menjawab (isinya hanya bawaan).
        if (ctx.canControl && (!ctx.openControl || settingsRevRef.current > 0)) {
          ctx.sendTo(from, { type: "settings", settings: ctx.settings, rev: settingsRevRef.current });
        }
        return;
      }
      // Pengirim ditentukan dari data channel asal pesan, bukan dari isi pesan.
      if (!acceptsControlMessage(from, ctx.hostId, ctx.openControl)) {
        console.warn(`[booth] pesan "${message.type}" dari non-host diabaikan`, from);
        return;
      }
      if (message.type === "settings") {
        const incoming = sanitizeSettings(message.settings);
        if (!incoming) return;
        if (ctx.openControl && typeof message.rev === "number") {
          // Edit yang lebih lama dari yang kupunya diabaikan; yang lebih baru menang.
          if (message.rev < settingsRevRef.current) return;
          settingsRevRef.current = message.rev;
        }
        setChoices(incoming);
      } else if (message.type === "overlays") {
        const items = sanitizeOverlays(message.items);
        if (!items) return;
        if (ctx.openControl && typeof message.rev === "number") {
          // Edit yang lebih lama dari yang kupunya diabaikan; yang lebih baru menang.
          if (message.rev < overlaysRevRef.current) return;
          overlaysRevRef.current = message.rev;
        }
        setOverlays(items);
      } else if (message.type === "start") {
        const shots = SHOT_OPTIONS.includes(message.shots) ? message.shots : ctx.settings.shots;
        const order = Array.isArray(message.order)
          ? message.order.filter((id): id is string => typeof id === "string").slice(0, MAX_CAPACITY)
          : [];
        if (order.length) {
          const countdown = pickCountdown(message.countdown, ctx.settings.countdown);
          void runSession(shots, order, toLocalStart(from, message.startAt), countdown);
        }
      } else if (message.type === "retake") {
        const index = Number(message.index);
        const current = sessionRef.current;
        if (current && Number.isInteger(index) && index >= 0 && index < current.shots) {
          const countdown = pickCountdown(message.countdown, ctx.settings.countdown);
          void runRetake(index, toLocalStart(from, message.startAt), countdown);
        }
      } else if (message.type === "reset") {
        resetSession();
      }
    },
    [runSession, runRetake, resetSession, toLocalStart, faceStore],
  );

  const onPhoto = useCallback((from: string, index: number, blob: Blob, kind: BlobKind, frame?: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= SHOT_OPTIONS.length) return;
    if (kind === "clip") {
      if (typeof frame === "number" && Number.isInteger(frame) && frame >= 0 && frame < CLIP_OFFSETS.length) {
        setClips((prev) => withClip(prev, from, index, frame, blob));
      }
      return;
    }
    const shots = sessionRef.current?.shots ?? index + 1;
    if (kind === "mask") setMasks((prev) => withPhoto(prev, from, index, blob, shots));
    else setPhotos((prev) => withPhoto(prev, from, index, blob, shots));
  }, []);

  // Host mengirim pengaturan terkini ke setiap data channel yang baru terbuka.
  const onChannelOpen = useCallback((peerId: string) => {
    // Beri tahu teman ini efek wajah pilihanku.
    ctxRef.current.sendTo(peerId, { type: "effect", effect: ctxRef.current.effect });
    // Ukur selisih jam dengan teman ini (dipakai untuk hitung mundur serempak).
    for (let k = 0; k < CLOCK_PINGS; k++) {
      setTimeout(() => ctxRef.current.sendTo(peerId, { type: "ping", t: Date.now() }), k * 150);
    }
    const ctx = ctxRef.current;
    if (!ctx.canControl) return;
    // Di room terbuka, pendatang baru (yang masih bawaan) tidak boleh menimpa pengaturan yang sudah ada.
    if (ctx.openControl && settingsRevRef.current === 0) return;
    ctx.sendTo(peerId, { type: "settings", settings: ctx.settings, rev: settingsRevRef.current });
  }, []);

  // Host yang refresh memulihkan pengaturan terakhirnya sebelum data channel ke peserta terbuka.
  const onHostKey = useCallback(() => {
    const saved = sanitizeSettings(readHostSettings(roomId));
    if (saved) setChoices(saved);
  }, [roomId]);

  const room = usePeerRoom(roomId, capacityParam, modeParam, { onMessage, onPhoto, onChannelOpen, onHostKey });
  const { send, sendTo, sendPhoto } = room;

  const openControl = room.legacyRoom || room.everyone;
  const canControl = openControl || room.amHost;
  const people = Math.max(room.capacity ?? capacityParam ?? DEFAULT_CAPACITY, 1);
  const settings: BoothSettings = { ...defaultsFor(people), ...choices };

  useEffect(() => {
    ctxRef.current = {
      myId: room.myId,
      hostId: room.hostId,
      openControl,
      canControl,
      settings,
      mirror: room.mirror,
      sendTo: room.sendTo,
      sendPhoto: room.sendPhoto,
      send: room.send,
      effect: myEffect,
    };
  });

  // Peserta meminta pengaturan begitu host terverifikasi dan data channel ke host terbuka,
  // untuk berjaga-jaga bila pengaturan host datang sebelum verifikasi selesai.
  const hostChannelOpen = !!room.hostId && !!room.peers[room.hostId]?.channelOpen;
  useEffect(() => {
    if (!room.amHost && room.hostId && hostChannelOpen) sendTo(room.hostId, { type: "sync" });
  }, [room.amHost, room.hostId, hostChannelOpen, sendTo]);

  // Saat hitung mundur, panggung digulir ke atas supaya semua tile terlihat tanpa scroll.
  useEffect(() => {
    if (phase !== "shooting") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stageRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [phase]);

  const effectOn = isEffect(myEffect);
  /** Efek yang dipilih `id` (aku atau teman). */
  const effectFor = (id: string) => (id === room.myId ? myEffect : (effects[id] ?? NO_EFFECT));

  const chooseEffect = (id: string) => {
    if (phase === "shooting") return;
    setMyEffect(id);
    send({ type: "effect", effect: id });
  };

  // Model wajah mulai diunduh begitu host memilih efek, supaya siap saat memotret.
  useEffect(() => {
    if (effectOn) preloadFaceLandmarker();
  }, [effectOn]);

  // Efek di kamera langsung: wajah dideteksi di sini, lalu dikirim ke teman supaya mereka bisa menggambar efeknya di tile-ku.
  const hasLocalStream = !!room.localStream;
  useEffect(() => {
    if (!effectOn || !hasLocalStream) return;
    const timer = setInterval(() => {
      const video = localVideoRef.current;
      if (!video) return;
      const raw = detectFace(video);
      const selfie = raw ? flipFace(raw) : null; // arah selfie: dikirim ke teman (tile mereka selalu dicermin)
      faceStore.set("local", ctxRef.current.mirror ? selfie : raw);
      ctxRef.current.send({ type: "face-live", face: selfie ? compactFace(selfie) : null });
    }, LIVE_FACE_MS);
    return () => {
      clearInterval(timer);
      faceStore.set("local", null);
      ctxRef.current.send({ type: "face-live", face: null });
    };
  }, [effectOn, hasLocalStream, faceStore]);

  // Efek dipilih setelah memotret (atau model belum siap saat memotret): cari wajah pada foto-fotoku yang sudah ada.
  const myIdForFaces = room.myId;
  const myPhotosForFaces = myIdForFaces ? photos.get(myIdForFaces) : undefined;
  const myFacesForFaces = myIdForFaces ? faces.get(myIdForFaces) : undefined;
  useEffect(() => {
    if (!effectOn || !session || phase !== "review" || !myIdForFaces || !myPhotosForFaces) return;
    myPhotosForFaces.forEach((photo, index) => {
      if (!photo || myFacesForFaces?.[index] || faceJobsRef.current.has(index)) return;
      faceJobsRef.current.add(index);
      const jobs = faceJobsRef.current;
      detectFaceInPhoto(photo)
        .then((face) => {
          if (faceJobsRef.current !== jobs) return; // sesi sudah berganti
          const compact = face ? compactFace(face) : null;
          setFaces((prev) => withFace(prev, myIdForFaces, index, compact ?? "none", session.shots));
          ctxRef.current.send({ type: "face", index, face: compact });
        })
        .catch((err) => {
          console.warn("[face] foto", err);
          if (faceJobsRef.current === jobs) jobs.delete(index);
        });
    });
  }, [effectOn, session, phase, myIdForFaces, myPhotosForFaces, myFacesForFaces]);

  const background = settings.background;
  const useBackground = !!getBackground(background);

  // Model segmentasi mulai diunduh begitu host memilih background, supaya siap saat memotret.
  useEffect(() => {
    if (useBackground) preloadSegmenter();
  }, [useBackground]);

  // Masker untuk fotoku sendiri dibuat di perangkat ini, lalu dikirim ke semua teman.
  const myPhotos = room.myId ? photos.get(room.myId) : undefined;
  useEffect(() => {
    const myId = room.myId;
    if (!useBackground || !session || phase === "idle" || !myId || !myPhotos) return;
    myPhotos.forEach((photo, index) => {
      if (!photo || maskJobsRef.current.has(index)) return;
      maskJobsRef.current.add(index);
      const jobs = maskJobsRef.current;
      makePersonMask(photo)
        .then((mask) => {
          if (maskJobsRef.current !== jobs) return; // sesi sudah berganti
          setMasks((prev) => withPhoto(prev, myId, index, mask, session.shots));
          sendPhoto(index, mask, "mask");
        })
        .catch((err) => {
          console.error("[segment]", err);
          if (maskJobsRef.current === jobs) jobs.delete(index); // coba lagi saat foto/pengaturan berubah
        });
    });
  }, [useBackground, session, phase, room.myId, myPhotos, sendPhoto]);

  const allArrived =
    !!session &&
    complete(photos, session.order, session.shots) &&
    (!useBackground || complete(masks, session.order, session.shots)) &&
    completeFaces(
      faces,
      session.order.filter((id) => isEffect(effectFor(id))),
      session.shots,
    );

  useEffect(() => {
    if (phase !== "review" || allArrived) return;
    const timer = setTimeout(() => setTimedOut(true), PHOTO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase, allArrived]);

  // Susun ulang hasil setiap kali foto atau pengaturan berubah di tahap review.
  const { frame, filter, caption, format } = settings;
  useEffect(() => {
    if (phase !== "review" || !session || !(allArrived || timedOut)) return;
    let cancelled = false;
    const people = session.order.length;
    const columns = session.order.map((id) => photos.get(id) ?? []);
    const maskColumns = session.order.map((id) => masks.get(id) ?? []);
    const faceColumns = session.order.map((id) => faces.get(id) ?? []);
    const effectColumns = session.order.map((id) => (id === room.myId ? myEffect : (effects[id] ?? NO_EFFECT)));
    const jobs =
      format === "strip"
        ? [
            composeStrip({
              people,
              shots: session.shots,
              photos: columns,
              masks: maskColumns,
              faces: faceColumns,
              effects: effectColumns,
              overlays: overlays.filter((o) => o.image === 0),
              background,
              frame,
              filter,
              caption,
            }).then((blob) => ({
              blob,
              name: `fotbar-mar-${roomId}.png`,
              label: "Strip foto kalian",
            })),
          ]
        : Array.from({ length: session.shots }, (_, s) =>
            composeStrip({
              people,
              shots: 1,
              photos: columns.map((list) => [list[s]]),
              masks: maskColumns.map((list) => [list[s]]),
              faces: faceColumns.map((list) => [list[s]]),
              effects: effectColumns,
              overlays: overlays.filter((o) => o.image === s),
              background,
              frame,
              filter,
              caption,
              shotOffset: s,
              totalShots: session.shots,
            }).then((blob) => ({ blob, name: `fotbar-mar-${roomId}-${s + 1}.png`, label: `Foto ${s + 1}` })),
          );

    Promise.all(jobs)
      .then((list) => {
        if (cancelled) return;
        setSavedNames(new Set());
        setResults((prev) => {
          prev.forEach((r) => URL.revokeObjectURL(r.url));
          return list.map((r) => ({ ...r, url: URL.createObjectURL(r.blob) }));
        });
      })
      .catch((err) => console.error("[strip]", err));
    return () => {
      cancelled = true;
    };
  }, [phase, session, allArrived, timedOut, photos, masks, faces, effects, myEffect, room.myId, overlays, background, frame, filter, caption, format, roomId]);

  // Tidak ada yang tersimpan di server: ingatkan bila masih ada hasil yang belum diunduh.
  const unsaved = phase === "review" && results.some((r) => !savedNames.has(r.name));
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const sendOverlays = room.send;
  const editOverlays = useCallback(
    (next: Overlay[]) => {
      if (!canControl) return;
      setOverlays(next);
      sendOverlays({ type: "overlays", items: next, rev: ++overlaysRevRef.current });
    },
    [canControl, sendOverlays],
  );

  /** Frame gerak yang sudah lengkap dari semua orang, per gambar hasil. */
  const clipJobs = session
    ? settings.format === "strip"
      ? [{ shots: Array.from({ length: session.shots }, (_, n) => n), image: 0, name: `fotbar-mar-${roomId}.gif`, label: "GIF strip" }]
      : Array.from({ length: session.shots }, (_, n) => ({ shots: [n], image: n, name: `fotbar-mar-${roomId}-${n + 1}.gif`, label: `GIF foto ${n + 1}` }))
    : [];
  const clipReady =
    !!session && settings.clip && phase === "review" && clipJobs.some((j) => commonFrames(clips, session.order, j.shots).length >= CLIP_MIN_FRAMES);

  const buildGifs = async () => {
    if (!session || gifBusy) return;
    setGifBusy(true);
    setGifError(null);
    try {
      const { createGifBuilder } = await import("@/lib/gif");
      const list: ResultImage[] = [];
      for (const job of clipJobs) {
        const frames = commonFrames(clips, session.order, job.shots);
        if (frames.length < CLIP_MIN_FRAMES) continue;
        const canvases: HTMLCanvasElement[] = [];
        for (const k of frames) {
          canvases.push(
            await renderStrip({
              people: session.order.length,
              shots: job.shots.length,
              photos: session.order.map((id) => job.shots.map((n) => clips.get(id)?.[n]?.[k] ?? null)),
              frame,
              filter,
              caption,
              scale: GIF_SCALE,
              overlays: overlays.filter((o) => o.image === job.image),
              ...(settings.format === "single" ? { shotOffset: job.shots[0], totalShots: session.shots } : {}),
            }),
          );
        }
        // Boomerang: maju lalu mundur (tanpa mengulang frame ujung).
        const order = [...canvases.keys(), ...[...canvases.keys()].slice(1, -1).reverse()];
        const gif = createGifBuilder();
        for (const n of order) gif.add(canvases[n], GIF_DELAY_MS);
        const blob = gif.finish();
        list.push({ blob, url: URL.createObjectURL(blob), name: job.name, label: job.label });
      }
      setGifs((prev) => {
        prev.forEach((r) => URL.revokeObjectURL(r.url));
        return list;
      });
    } catch (err) {
      console.error("[gif]", err);
      setGifError("GIF gagal dibuat. Coba lagi.");
    } finally {
      setGifBusy(false);
    }
  };

  const updateSettings = (patch: Partial<BoothSettings>) => {
    if (!canControl) return;
    const next = { ...settings, ...patch };
    setChoices(next);
    if (room.amHost) saveHostSettings(roomId, next);
    send({ type: "settings", settings: next, rev: ++settingsRevRef.current });
  };

  const solo = room.status === "solo";
  const canStart = canControl && phase === "idle" && !!room.myId && (solo || room.openCount > 0);

  const start = () => {
    if (!canStart || !room.myId) return;
    // Hanya peserta yang tersambung denganku yang ikut, urutannya sama dengan urutan anggota.
    const order = room.members.filter((id) => id === room.myId || room.peers[id]?.channelOpen);
    if (!order.includes(room.myId)) order.push(room.myId);
    // Semua perangkat mulai pada waktu yang sama: jam host + jeda, dikonversi tiap penerima ke jamnya sendiri.
    const t0 = Date.now() + LEAD_MS;
    send({ type: "start", shots: settings.shots, order, startAt: t0, countdown: settings.countdown });
    void runSession(settings.shots, order, t0, settings.countdown);
  };

  const countdownSetting = settings.countdown;
  const retake = useCallback(
    (index: number) => {
      if (!canControl || phase !== "review" || runningRef.current) return;
      const t0 = Date.now() + LEAD_MS;
      send({ type: "retake", index, startAt: t0, countdown: countdownSetting });
      void runRetake(index, t0, countdownSetting);
    },
    [canControl, phase, send, runRetake, countdownSetting],
  );

  const again = () => {
    if (!canControl) return;
    send({ type: "reset" });
    resetSession();
  };

  const shareLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Fotbar Bareng MaR", text: "Ayo foto bareng!", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("Tautan disalin");
    } catch {
      setShareNote(url);
    }
  };

  if (room.status === "full") {
    return (
      <Notice
        title="Room ini sudah penuh."
        body={`Room ini untuk ${room.capacity ?? "beberapa"} orang dan semua tempat sudah terisi. Buat room baru untuk berfoto.`}
      />
    );
  }

  if (room.status === "error") {
    return (
      <Notice title="Booth belum bisa dibuka." body={room.error ?? "Coba muat ulang halaman."} reload />
    );
  }

  const theme = getFrame(settings.frame);
  const filterCss = FILTERS[settings.filter].css;
  const shooting = phase === "shooting";

  // ── Grid kamera: susunan sama dengan satu panel hasil (getLayout), ukuran tile dihitung dari viewport ──
  const inSession = !!session && phase !== "idle";
  const tileIds = inSession ? session.order : room.members;
  const slotCount = inSession ? session.order.length : Math.max(people, room.members.length, 1);
  const layout = getLayout(slotCount);
  const portraitPhone = box.viewportWidth > 0 && box.viewportWidth < 640 && box.viewportHeight > box.viewportWidth;
  // Ruang untuk panggung: sisa layar di bawah header dan status, dikurangi bar tombol tepat di bawah kamera,
  // supaya tombol "Mulai foto" selalu terlihat tanpa scroll.
  const ACTION_BAR = 84;
  const availW = box.width - STAGE_PAD * 2;
  const availH = Math.max(
    140,
    shooting
      ? box.viewportHeight - 24 - STAGE_PAD * 2
      : box.viewportHeight - box.top - ACTION_BAR - 16 - STAGE_PAD * 2,
  );
  const fitWidth = (cols: number) => {
    const rows = Math.ceil(layout.slots / cols);
    // 2 orang: tile menempel tanpa celah, sama seperti hasilnya.
    const gap = layout.seamless && cols === layout.cols ? 0 : TILE_GAP;
    const width = Math.floor(
      Math.min((availW - gap * (cols - 1)) / cols, ((availH - gap * (rows - 1)) / rows) * layout.aspect),
    );
    return { cols, gap, width };
  };
  // Di HP portrait, susunan kolom yang membuat tile terbesar yang dipilih (mis. 2 orang ditumpuk, bukan berdampingan).
  // Di layar lebar, susunan selalu sama dengan hasil foto.
  const options = (portraitPhone ? [layout.cols, 1, 2, 3] : [layout.cols]).map(fitWidth);
  const best = options.reduce((a, b) => (b.width > a.width ? b : a));
  const liveCols = best.cols;
  const tileGap = best.gap;
  const tileWidth = box.width > 0 ? Math.max(72, best.width) : 240;
  const shotsForLabel = inSession ? session.shots : settings.shots;
  const decorLabel = `${(shooting ? shotIndex : 0) + 1}/${shotsForLabel}`;

  const localTile = (label: string) => (
    <VideoTile
      key="local"
      stream={room.localStream}
      label={label}
      muted
      filterCss={filterCss}
      videoRef={localVideoRef}
      mirror={room.mirror}
      faceEffect={effectOn ? { id: myEffect, store: faceStore, storeKey: "local" } : undefined}
      emptyText="Menyalakan kamera…"
      aspect={layout.aspect}
      style={{ width: tileWidth }}
    />
  );

  const tiles = Array.from({ length: slotCount }, (_, i) => {
    const id = tileIds[i];
    const position = i + 1;
    const isHostTile = !!id && id === room.hostId;
    if (id && id === room.myId) return localTile(isHostTile ? "Kamu · Pembuat room" : "Kamu");
    const peer = id ? room.peers[id] : undefined;
    return (
      <VideoTile
        key={id ?? `slot-${i}`}
        stream={peer?.stream ?? null}
        label={isHostTile ? "Pembuat room" : `Orang ke-${position}`}
        filterCss={filterCss}
        emptyText={id ? (peer ? "Menyambungkan…" : "Terputus") : `Menunggu orang ke-${position}…`}
        quality={peer ? (peer.connected ? (peer.quality ?? "good") : "connecting") : undefined}
        faceEffect={id && isEffect(effects[id]) ? { id: effects[id], store: faceStore, storeKey: id } : undefined}
        aspect={layout.aspect}
        style={{ width: tileWidth }}
      />
    );
  });
  // Kamera lokal harus selalu terpasang supaya bisa dipotret, walau aku belum muncul di daftar anggota.
  if (!tileIds.includes(room.myId ?? "")) {
    tiles[Math.min(tileIds.length, slotCount - 1)] = localTile(room.amHost ? "Kamu · Pembuat room" : "Kamu");
  }
  for (let d = 0; d < layout.decorSlots; d++) {
    tiles.push(
      <DecorTile
        key={`decor-${d}`}
        frameId={settings.frame}
        caption={settings.caption}
        label={decorLabel}
        width={tileWidth}
        aspect={layout.aspect}
      />,
    );
  }

  const joinedText =
    room.capacity && room.capacity > 1 && room.members.length > 0
      ? `${room.members.length} dari ${room.capacity} orang sudah masuk. `
      : "";
  const admitted = !["media", "joining"].includes(room.status);
  const hostGone = !openControl && !room.amHost && admitted && room.hostSeen && !room.hostId;
  const hostNotYet = !openControl && !room.amHost && admitted && !room.hostSeen;
  const status = hostGone
    ? "Pembuat room keluar. Sesi lanjut saat dia kembali."
    : `${joinedText}${hostNotYet ? "Pembuat room belum masuk." : statusText(room.status, canControl)}`;

  const stripPeople = session?.order.length ?? slotCount;
  const stripShots = inSession ? session.shots : settings.shots;
  const thumbShots = settings.format === "single" ? 1 : stripShots;

  const iconButton =
    "flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-paper/50 px-0 text-sm font-bold transition-colors hover:bg-paper hover:text-ink disabled:opacity-40 sm:px-5";

  const cameraButton =
    room.cameraCount > 1 ? (
      <button
        type="button"
        onClick={room.switchCamera}
        disabled={!room.localStream || room.switching || shooting}
        aria-label="Ganti kamera"
        title="Ganti kamera"
        className={iconButton}
      >
        <CameraSwitchIcon />
        <span className="hidden sm:inline">{room.switching ? "Mengganti…" : "Ganti kamera"}</span>
      </button>
    ) : null;

  const micButton = (
    <button
      type="button"
      onClick={room.toggleMic}
      disabled={!room.localStream}
      aria-label={room.micOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}
      aria-pressed={!room.micOn}
      title={room.micOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}
      className={`${iconButton} aria-pressed:border-alert aria-pressed:bg-alert/15 aria-pressed:text-alert`}
    >
      {room.micOn ? <MicIcon /> : <MicOffIcon />}
      <span className="hidden sm:inline">{room.micOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}</span>
    </button>
  );

  // Bar tombol tepat di bawah kamera, supaya tidak perlu scroll jauh di HP.
  const actionBar =
    phase === "idle" ? (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2" aria-label="Kontrol foto" role="group">
        <div className="flex items-stretch gap-2">
          {canControl ? (
            <button
              type="button"
              onClick={start}
              disabled={!canStart}
              className="min-h-14 flex-1 rounded-full bg-flash px-6 text-lg font-bold text-ink shadow-[0_5px_0_0_var(--color-ink)] transition-transform active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mulai foto
            </button>
          ) : (
            <p className="flex min-h-14 flex-1 items-center justify-center rounded-full bg-paper/10 px-4 text-center text-sm text-paper/85">
              Menunggu pembuat room memulai foto
            </p>
          )}
          {micButton}
          {cameraButton}
        </div>
        {canControl && !canStart && !solo && (
          <p className="text-center text-xs text-paper/70">Tombol aktif setelah minimal satu teman tersambung.</p>
        )}
      </div>
    ) : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-3 py-3 sm:px-4 md:gap-5 md:px-8 md:py-7">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="min-w-0 truncate text-lg sm:text-2xl" aria-label="Fotbar Bareng MaR, ke halaman awal">
          <Brand />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-curtain-deep px-3 py-1.5 font-mono text-xs tracking-wide sm:px-4 sm:py-2 sm:text-sm">
            {roomId}
          </span>
          <button
            type="button"
            onClick={shareLink}
            aria-label="Bagikan tautan"
            className="flex h-9 items-center gap-2 rounded-full border-2 border-paper px-3 text-sm font-bold transition-colors hover:bg-paper hover:text-ink sm:px-4"
          >
            <ShareIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Bagikan tautan</span>
          </button>
        </div>
      </header>

      {room.legacyRoom && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-flash/70 bg-curtain-deep/70 px-5 py-3">
          <p className="max-w-[60ch] text-sm text-paper/90">
            Room ini dibuat dengan versi lama Fotbar Bareng MaR, jadi semua orang bisa mengatur dan memulai foto. Buat room
            baru supaya hanya pembuat room yang memegang kendali.
          </p>
          <Link href="/" className="rounded-full bg-flash px-5 py-2 text-sm font-bold text-ink">
            Buat room baru
          </Link>
        </div>
      )}

      <p role="status" className="text-sm leading-snug text-paper/90 md:text-base">
        {shareNote ?? status}
      </p>

      {/* Panggung: susunan dan tampilan sama dengan satu panel hasil pada bingkai yang dipilih */}
      <div ref={stageBoxRef} className={phase === "review" ? "hidden" : "w-full"}>
        <section
          ref={stageRef}
          className="relative mx-auto w-fit scroll-mt-3 transition-colors"
          style={{ backgroundColor: theme.bg, padding: STAGE_PAD }}
          aria-label="Kamera"
        >
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${liveCols}, ${tileWidth}px)`, gap: tileGap }}
          >
            {tiles}
          </div>

          {shooting && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              {count !== null && (
                <span
                  key={`${shotIndex}-${count}`}
                  className="animate-count font-display text-[min(40vw,16rem)] font-black leading-none text-flash [-webkit-text-stroke:6px_var(--color-ink)] [paint-order:stroke_fill]"
                >
                  {count}
                </span>
              )}
              <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-paper">
                Foto {shotIndex + 1} dari {shotsForLabel}
              </span>
            </div>
          )}
        </section>
      </div>

      {actionBar}

      {phase === "review" && (
        <section className="flex flex-col items-center gap-5" aria-label="Hasil foto">
          {results.length ? (
            <ResultGallery
              images={results}
              zipName={`fotbar-mar-${roomId}.zip`}
              onSaved={(names) => setSavedNames((prev) => new Set([...prev, ...names]))}
              overlays={overlays}
              canEdit={canControl}
              onOverlaysChange={editOverlays}
            />
          ) : (
            <p className="py-16 text-center text-paper/85">Menunggu foto dari teman-temanmu…</p>
          )}
          {settings.clip && results.length > 0 && (
            <ClipPanel ready={clipReady} busy={gifBusy} error={gifError} gifs={gifs} onBuild={buildGifs} />
          )}
          {canControl && session && results.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-paper/80">Kurang puas dengan salah satu foto?</span>
              <div className="flex flex-wrap justify-center gap-2">
                {Array.from({ length: session.shots }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => retake(i)}
                    className="rounded-full border-2 border-paper/50 px-4 py-2 text-sm font-bold transition-colors hover:bg-paper hover:text-ink"
                  >
                    Ulang foto {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
          {canControl && (
            <button
              type="button"
              onClick={again}
              className="rounded-full border-2 border-paper px-7 py-3 font-bold transition-colors hover:bg-paper hover:text-ink"
            >
              Foto lagi
            </button>
          )}
          <div className="flex justify-center gap-2">
            {micButton}
            {cameraButton}
          </div>
        </section>
      )}

      {phase !== "shooting" && (
        <section className="rounded-3xl bg-curtain-deep/70 p-4 md:p-7" aria-label="Efek wajahmu">
          <Section title="Efek wajah kamu" value={EFFECTS[myEffect]?.label ?? "Tanpa efek"} last>
            <div className="flex flex-wrap gap-2">
              <Chip pressed={myEffect === NO_EFFECT} onClick={() => chooseEffect(NO_EFFECT)}>
                Tanpa efek
              </Chip>
              {EFFECT_LIST.map((e) => (
                <Chip key={e.id} pressed={myEffect === e.id} onClick={() => chooseEffect(e.id)}>
                  {e.label}
                </Chip>
              ))}
            </div>
            <span className="text-xs text-paper/70">
              Efek ini hanya untuk wajahmu; teman memilih efeknya sendiri. Wajah dideteksi di perangkatmu, tampil langsung
              di kamera semua orang, dan ikut di hasil foto. Pertama kali perlu memuat ±4 MB ke browser (dan ±12 MB
              bila belum memakai background); tidak disimpan sebagai berkas.
            </span>
          </Section>
        </section>
      )}

      {canControl ? (
        <section className="grid gap-3 rounded-3xl bg-curtain-deep/70 p-4 md:grid-cols-2 md:gap-6 md:p-7" aria-label="Pengaturan">
          {(room.amHost || room.everyone) && (
            <p className="text-xs font-bold text-flash md:col-span-2">
              {room.amHost ? "Kamu pembuat room" : "Semua orang di room ini boleh mengatur"}
              {room.amHost && room.everyone ? ". Semua orang boleh ikut mengatur." : ""}
            </p>
          )}

          <Section
            title="Pengaturan foto"
            value={`${settings.shots} foto · ${settings.countdown} detik`}
            className="md:col-span-2"
          >
            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
              <Field label="Jumlah foto">
                <div className="flex flex-wrap gap-2">
                  {SHOT_OPTIONS.map((n) => (
                    <Chip
                      key={n}
                      pressed={settings.shots === n}
                      disabled={phase !== "idle"}
                      onClick={() => updateSettings({ shots: n })}
                    >
                      {n} foto
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Hitung mundur">
                <div className="flex flex-wrap gap-2">
                  {COUNTDOWN_OPTIONS.map((n) => (
                    <Chip
                      key={n}
                      pressed={settings.countdown === n}
                      disabled={shooting}
                      onClick={() => updateSettings({ countdown: n })}
                    >
                      {n} detik
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Format hasil">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(FORMATS) as ResultFormat[]).map((fmt) => (
                    <Chip key={fmt} pressed={settings.format === fmt} disabled={shooting} onClick={() => updateSettings({ format: fmt })}>
                      {FORMATS[fmt]}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Rekam gerak (GIF)">
                <div className="flex flex-wrap gap-2">
                  <Chip pressed={!settings.clip} disabled={phase !== "idle"} onClick={() => updateSettings({ clip: false })}>
                    Mati
                  </Chip>
                  <Chip pressed={settings.clip} disabled={phase !== "idle"} onClick={() => updateSettings({ clip: true })}>
                    Nyala
                  </Chip>
                </div>
                <span className="text-xs text-paper/70">
                  Tiap jepretan merekam 8 frame kecil (±25 KB) yang dikirim ke teman, lalu dibuat jadi GIF boomerang di tahap
                  review. GIF memakai bingkai dan filter, tetapi tanpa background pengganti dan efek wajah.
                </span>
              </Field>

              <Field label="Tulisan di bawah strip" htmlFor="caption">
                <input
                  id="caption"
                  value={settings.caption}
                  maxLength={CAPTION_MAX}
                  disabled={shooting}
                  onChange={(e) => updateSettings({ caption: e.target.value })}
                  className="w-full max-w-md rounded-full border-2 border-paper/30 bg-curtain px-5 py-2.5 text-base text-paper focus:border-flash focus:outline-none disabled:opacity-50"
                />
              </Field>
            </div>
          </Section>

          <Section title="Bingkai" value={theme.label} className="md:col-span-2">
            <FramePicker
              people={stripPeople}
              shots={thumbShots}
              caption={settings.caption}
              value={settings.frame}
              disabled={shooting}
              onChange={(frame) => updateSettings({ frame })}
            />
          </Section>

          <Section title="Filter" value={FILTERS[settings.filter].label} className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FILTERS) as FilterId[]).map((id) => (
                <Chip
                  key={id}
                  pressed={settings.filter === id}
                  disabled={shooting}
                  onClick={() => updateSettings({ filter: id })}
                >
                  {FILTERS[id].label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Background" value={getBackground(settings.background)?.label ?? "Asli"} className="md:col-span-2" last>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              <BackgroundChip
                label="Asli"
                pressed={settings.background === NO_BACKGROUND}
                disabled={shooting}
                onClick={() => updateSettings({ background: NO_BACKGROUND })}
              />
              {BACKGROUND_LIST.map((bg) => (
                <BackgroundChip
                  key={bg.id}
                  label={bg.label}
                  src={bg.src}
                  pressed={settings.background === bg.id}
                  disabled={shooting}
                  onClick={() => updateSettings({ background: bg.id })}
                />
              ))}
            </div>
            <span className="text-xs text-paper/70">
              Latar ruangan tiap orang diganti dengan pemandangan yang sama dan menyambung antar foto. Diproses di
              perangkat masing-masing; pertama kali perlu memuat ±12 MB ke browser; tidak disimpan sebagai berkas.
            </span>
          </Section>
        </section>
      ) : (
        <section className="flex flex-col gap-5 rounded-3xl bg-curtain-deep/70 p-4 md:p-7" aria-label="Pengaturan dari pembuat room">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            <Summary label="Bingkai" value={theme.label} swatch={theme.bg} />
            <Summary label="Filter" value={FILTERS[settings.filter].label} />
            <Summary label="Jumlah foto" value={`${settings.shots} foto`} />
            <Summary label="Format" value={FORMATS[settings.format]} />
            <Summary label="Hitung mundur" value={`${settings.countdown} detik`} />
            <Summary label="Rekam gerak" value={settings.clip ? "Nyala" : "Mati"} />
            <Summary label="Background" value={getBackground(settings.background)?.label ?? "Asli"} />
            <Summary label="Tulisan" value={settings.caption.trim() || "kita"} />
          </dl>
        </section>
      )}

      {flashKey > 0 && (
        <div key={flashKey} className="animate-flash pointer-events-none fixed inset-0 z-50 bg-white" aria-hidden="true" />
      )}
    </main>
  );
}

function BackgroundChip({
  label,
  src,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  src?: string;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="group flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-paper/20 p-1.5 transition-colors hover:border-paper aria-pressed:border-flash aria-pressed:bg-flash/10 disabled:opacity-50 sm:w-auto"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-10 w-full rounded-md object-cover sm:w-[106px]" />
      ) : (
        <span className="grid h-10 w-full place-items-center rounded-md bg-paper/15 text-[10px] text-paper/80 sm:w-[106px]">
          latar asli
        </span>
      )}
      <span className="text-xs font-medium group-aria-pressed:font-bold group-aria-pressed:text-flash">{label}</span>
    </button>
  );
}

function Summary({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-bold text-paper/70">{label}</dt>
      <dd className="flex items-center gap-2 font-medium">
        {swatch && <span className="h-4 w-4 rounded-full border border-paper/40" style={{ backgroundColor: swatch }} />}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}

/**
 * Bagian pengaturan. Di HP bisa dilipat (menampilkan pilihan saat ini di judulnya) supaya panel tidak panjang;
 * di layar lebar selalu terbuka.
 */
function Section({
  title,
  value,
  className = "",
  last = false,
  children,
}: {
  title: string;
  value: string;
  className?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`${className} ${last ? "" : "border-b border-paper/10 pb-3"} md:border-0 md:pb-0`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left md:pointer-events-none md:min-h-0 md:cursor-default"
      >
        <span className="text-sm font-bold text-paper/90">{title}</span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-paper/70 md:hidden">
          <span className="truncate">{value}</span>
          <ChevronIcon open={open} />
        </span>
      </button>
      <div id={id} className={`${open ? "flex" : "hidden"} flex-col gap-2.5 pt-1 md:flex md:pt-2.5`}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-bold text-paper/90">
          {label}
        </label>
      ) : (
        <span className="text-sm font-bold text-paper/90">{label}</span>
      )}
      {children}
    </div>
  );
}

function Chip({
  pressed,
  disabled,
  onClick,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="min-h-10 rounded-full border-2 border-paper/30 px-4 py-2 text-sm font-medium transition-colors hover:border-paper aria-pressed:border-flash aria-pressed:bg-flash aria-pressed:text-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Notice({ title, body, reload = false }: { title: string; body: string; reload?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-5 py-16">
      <h1 className="font-display text-5xl font-black leading-none">{title}</h1>
      <p className="text-lg text-paper/85">{body}</p>
      <div className="flex flex-wrap gap-3">
        {reload && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-flash px-7 py-3 font-bold text-ink"
          >
            Muat ulang
          </button>
        )}
        <Link href="/" className="rounded-full border-2 border-paper px-7 py-3 font-bold">
          Buat room baru
        </Link>
      </div>
    </main>
  );
}
