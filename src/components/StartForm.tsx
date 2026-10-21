"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createHostKey, parseRoomMode, saveHostKey, saveRoomMode, type RoomMode } from "@/lib/host";
import { normalizeRoomCode } from "@/lib/room";
import { DEFAULT_CAPACITY, MAX_CAPACITY, MIN_CAPACITY, parseCapacity } from "@/lib/types";

const SIZES = Array.from({ length: MAX_CAPACITY - MIN_CAPACITY + 1 }, (_, i) => MIN_CAPACITY + i);

const MODES: { value: RoomMode; label: string; hint: string }[] = [
  { value: "all", label: "Semua orang", hint: "Siapa pun di room bisa mengubah pengaturan dan memulai foto. Edit terbaru yang berlaku." },
  { value: "host", label: "Hanya aku", hint: "Hanya pembuat room yang memilih bingkai, filter, background, dan memulai foto." },
];

export function StartForm() {
  const router = useRouter();
  const [people, setPeople] = useState(DEFAULT_CAPACITY);
  const [mode, setMode] = useState<RoomMode>("all");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      // Room id diturunkan dari public key host; private key disimpan di browser ini.
      const { roomId, privateJwk } = await createHostKey();
      saveHostKey(roomId, privateJwk);
      saveRoomMode(roomId, mode);
      router.push(`/room/${roomId}?n=${people}&m=${mode}`);
    } catch {
      setError("Browser ini tidak bisa membuat kunci room. Buka lewat HTTPS atau localhost, lalu coba lagi.");
      setBusy(false);
    }
  };

  const joinRoom = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!normalized) return;
    setBusy(true);
    // Kalau yang ditempel tautan lengkap, kapasitasnya ikut dibawa. Kode saja: ikut kapasitas room.
    const n = parseCapacity(code.match(/[?&]n=(\d+)/)?.[1]);
    const m = parseRoomMode(code.match(/[?&]m=(\w+)/)?.[1]);
    const query = [n ? `n=${n}` : "", m ? `m=${m}` : ""].filter(Boolean).join("&");
    router.push(`/room/${normalized}${query ? `?${query}` : ""}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5" role="group" aria-labelledby="people-label">
        <span id="people-label" className="text-sm font-bold text-paper/90">
          Berapa orang?
        </span>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={people === n}
              aria-label={`${n} orang`}
              onClick={() => setPeople(n)}
              className="h-11 w-11 rounded-full border-2 border-paper/40 font-display text-xl font-bold transition-colors hover:border-paper aria-pressed:border-flash aria-pressed:bg-flash aria-pressed:text-ink"
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-xs text-paper/65">
          {people === 1 ? "Foto sendiri, tanpa menunggu siapa pun." : `Kamu dan ${people - 1} teman.`}
        </span>
      </div>

      <div className="flex flex-col gap-2.5" role="radiogroup" aria-labelledby="mode-label">
        <span id="mode-label" className="text-sm font-bold text-paper/90">
          Siapa yang boleh mengatur?
        </span>
        <div className="flex flex-wrap gap-2">
          {MODES.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={mode === o.value}
              onClick={() => setMode(o.value)}
              className="rounded-full border-2 border-paper/40 px-5 py-2.5 text-sm font-bold transition-colors hover:border-paper aria-checked:border-flash aria-checked:bg-flash aria-checked:text-ink"
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="max-w-sm text-xs text-paper/65">{MODES.find((o) => o.value === mode)?.hint}</span>
      </div>

      <button
        type="button"
        onClick={createRoom}
        disabled={busy}
        className="self-start rounded-full bg-flash px-8 py-4 text-lg font-bold text-ink shadow-[0_6px_0_0_var(--color-curtain-deep)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_var(--color-curtain-deep)] disabled:opacity-60"
      >
        Buat room baru
      </button>
      {error && (
        <p role="alert" className="max-w-sm text-sm text-alert">
          {error}
        </p>
      )}

      <form onSubmit={joinRoom} className="flex max-w-sm flex-col gap-2">
        <label htmlFor="room-code" className="text-sm text-paper/80">
          Sudah dapat kode atau tautan dari temanmu?
        </label>
        <div className="flex gap-2">
          <input
            id="room-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="mis. k7xq2mnp4r"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-full border-2 border-paper/40 bg-curtain-deep/60 px-5 py-3 text-paper placeholder:text-paper/40 focus:border-flash focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !normalizeRoomCode(code)}
            className="rounded-full border-2 border-paper px-6 py-3 font-bold text-paper transition-colors hover:bg-paper hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-paper"
          >
            Masuk
          </button>
        </div>
      </form>
    </div>
  );
}
