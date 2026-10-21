"use client";

import type { ResultImage } from "./ResultGallery";

type Props = {
  /** Frame rekaman gerak dari semua orang sudah cukup untuk membuat GIF. */
  ready: boolean;
  busy: boolean;
  error: string | null;
  gifs: ResultImage[];
  onBuild: () => void;
};

/** Pembuat GIF boomerang dari frame gerak tiap jepretan: tombol "Buat GIF", pratinjau, dan unduhan. */
export function ClipPanel({ ready, busy, error, gifs, onBuild }: Props) {
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl bg-curtain-deep/70 p-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-bold text-paper/90">GIF gerak</span>
        <span className="text-xs text-paper/70">
          Animasi boomerang dari gerakan kalian di setiap jepretan, lengkap dengan bingkai, filter, teks, dan stiker.
        </span>
      </div>
      <button
        type="button"
        onClick={onBuild}
        disabled={!ready || busy}
        className="rounded-full border-2 border-paper/50 px-6 py-2.5 text-sm font-bold transition-colors hover:bg-paper hover:text-ink disabled:opacity-40"
      >
        {busy ? "Membuat GIF…" : gifs.length ? "Buat ulang GIF" : "Buat GIF"}
      </button>
      {!ready && !busy && <span className="text-xs text-paper/60">Menunggu frame dari semua teman…</span>}
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
      {gifs.length > 0 && (
        <ul className="grid w-full gap-4 sm:grid-cols-2">
          {gifs.map((g) => (
            <li key={g.name} className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url} alt={g.label} className="max-h-[60vh] w-auto max-w-full shadow-[0_18px_40px_-18px_rgb(0_0_0/0.6)]" />
              <a
                href={g.url}
                download={g.name}
                className="rounded-full bg-flash px-5 py-2.5 text-sm font-bold text-ink shadow-[0_4px_0_0_var(--color-curtain-deep)]"
              >
                Unduh {g.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
