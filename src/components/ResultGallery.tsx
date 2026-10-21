"use client";

import { useRef, useState, type CSSProperties } from "react";
import {
  makeStickerOverlay,
  makeTextOverlay,
  MAX_SIZE,
  MIN_SIZE,
  OVERLAY_LIMIT,
  overlayBox,
  STICKER_LIST,
  TEXT_COLORS,
  TEXT_MAX,
  topOverlayAt,
  type Overlay,
} from "@/lib/overlays";

export type ResultImage = { url: string; blob: Blob; name: string; label: string };

type Props = {
  images: ResultImage[];
  zipName: string;
  /** Dipanggil saat gambar diunduh, supaya booth tahu mana yang sudah disimpan. */
  onSaved?: (names: string[]) => void;
  /** Teks dan stiker yang sedang menempel (semua gambar). */
  overlays?: Overlay[];
  /** Boleh mengubah teks dan stiker (host, atau semua orang di room mode "semua orang"). */
  canEdit?: boolean;
  onOverlaysChange?: (next: Overlay[]) => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Gambar hasil, dengan kotak seleksi yang bisa diseret untuk teks dan stiker yang sedang dipilih. */
function EditableImage({
  img,
  index,
  className,
  overlays,
  editing,
  selectedId,
  onSelect,
  onActive,
  onMove,
}: {
  img: ResultImage;
  index: number;
  className: string;
  overlays: Overlay[];
  editing: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onActive: (index: number) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  /** Lebar/tinggi gambar hasil, diisi saat gambar selesai dimuat. */
  const [imgAspect, setImgAspect] = useState(1);
  const dragRef = useRef<{ id: string; offX: number; offY: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const point = (clientX: number, clientY: number): [number, number] => {
    const r = wrapRef.current?.getBoundingClientRect();
    return r ? [(clientX - r.left) / r.width, (clientY - r.top) / r.height] : [0.5, 0.5];
  };

  const selected = editing ? overlays.find((o) => o.id === selectedId && o.image === index) : undefined;
  let boxStyle: CSSProperties | undefined;
  if (selected) {
    const { w, h } = overlayBox(selected, imgAspect);
    const x = drag?.x ?? selected.x;
    const y = drag?.y ?? selected.y;
    const bw = Math.max(w, 0.08);
    const bh = Math.max(h, 0.06);
    boxStyle = {
      left: `${(x - bw / 2) * 100}%`,
      top: `${(y - bh / 2) * 100}%`,
      width: `${bw * 100}%`,
      height: `${bh * 100}%`,
      transform: `rotate(${selected.rot}rad)`,
    };
  }

  return (
    <div
      ref={wrapRef}
      className="relative inline-block max-w-full"
      onClick={(e) => {
        if (!editing) return;
        onActive(index);
        const [px, py] = point(e.clientX, e.clientY);
        onSelect(topOverlayAt(overlays, index, px, py, imgAspect)?.id ?? null);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.url}
        alt={img.label}
        className={className}
        draggable={false}
        onLoad={(e) => setImgAspect(e.currentTarget.naturalHeight ? e.currentTarget.naturalWidth / e.currentTarget.naturalHeight : 1)}
      />
      {selected && boxStyle && (
        <div
          className="absolute cursor-move touch-none rounded-md border-2 border-dashed border-flash bg-flash/10"
          style={boxStyle}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            const [px, py] = point(e.clientX, e.clientY);
            dragRef.current = { id: selected.id, offX: selected.x - px, offY: selected.y - py, x: selected.x, y: selected.y };
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d) return;
            const [px, py] = point(e.clientX, e.clientY);
            d.x = clamp(px + d.offX, -0.1, 1.1);
            d.y = clamp(py + d.offY, -0.1, 1.1);
            setDrag({ x: d.x, y: d.y });
          }}
          onPointerUp={() => {
            const d = dragRef.current;
            dragRef.current = null;
            setDrag(null);
            if (d && (d.x !== selected.x || d.y !== selected.y)) onMove(d.id, d.x, d.y);
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setDrag(null);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Seret untuk memindahkan"
        />
      )}
    </div>
  );
}

const pill =
  "rounded-full border-2 border-paper/40 px-4 py-2 text-sm font-bold transition-colors hover:bg-paper hover:text-ink disabled:opacity-40";

/** Panel "Hias foto": tambah teks atau stiker, lalu atur ukuran, putaran, dan warna yang sedang dipilih. */
function OverlayPanel({
  overlays,
  selectedId,
  activeImage,
  onChange,
  onSelect,
}: {
  overlays: Overlay[];
  selectedId: string | null;
  activeImage: number;
  onChange: (next: Overlay[]) => void;
  onSelect: (id: string | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const selected = overlays.find((o) => o.id === selectedId);
  const full = overlays.length >= OVERLAY_LIMIT;

  const add = (o: Overlay) => {
    onChange([...overlays, o]);
    onSelect(o.id);
  };
  const patch = (changes: Partial<Overlay>) => {
    if (!selected) return;
    onChange(overlays.map((o) => (o.id === selected.id ? { ...o, ...changes } : o)));
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-4 rounded-2xl bg-curtain-deep/70 p-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-paper/90">Tambah teks</span>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text || full) return;
            add(makeTextOverlay(activeImage, text.slice(0, TEXT_MAX)));
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={TEXT_MAX}
            placeholder="Tulis sesuatu…"
            aria-label="Teks baru"
            className="min-w-0 flex-1 rounded-full border-2 border-paper/30 bg-curtain px-4 py-2 text-base text-paper focus:border-flash focus:outline-none"
          />
          <button type="submit" disabled={!draft.trim() || full} className={pill}>
            Tambah
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-paper/90">Tambah stiker</span>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STICKER_LIST.map((st) => (
            <button
              key={st.id}
              type="button"
              disabled={full}
              onClick={() => add(makeStickerOverlay(activeImage, st.id))}
              aria-label={`Stiker ${st.label}`}
              title={st.label}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border-2 border-paper/25 bg-paper/10 p-2 transition-colors hover:border-paper disabled:opacity-40"
            >
              {st.path ? (
                <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
                  <path d={st.path} fill={st.fill} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={st.src} alt="" className="max-h-full max-w-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="flex flex-col gap-3 border-t border-paper/15 pt-3">
          <span className="text-sm font-bold text-flash">
            {selected.kind === "text" ? "Teks dipilih" : "Stiker dipilih"}
            <span className="ml-2 font-normal text-paper/70">seret kotak putus-putus pada foto untuk memindahkan</span>
          </span>
          {selected.kind === "text" && (
            <>
              <input
                value={selected.text}
                onChange={(e) => patch({ text: e.target.value.slice(0, TEXT_MAX) })}
                maxLength={TEXT_MAX}
                aria-label="Ubah teks"
                className="w-full rounded-full border-2 border-paper/30 bg-curtain px-4 py-2 text-base text-paper focus:border-flash focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Warna teks">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Warna ${c}`}
                    aria-pressed={selected.color === c}
                    onClick={() => patch({ color: c })}
                    className="h-8 w-8 rounded-full border-2 border-paper/40 aria-pressed:border-flash aria-pressed:ring-2 aria-pressed:ring-flash"
                    style={{ backgroundColor: c }}
                  />
                ))}
                <button type="button" className={pill} onClick={() => patch({ font: selected.font === "display" ? "body" : "display" })}>
                  Huruf: {selected.font === "display" ? "Judul" : "Santai"}
                </button>
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={pill} onClick={() => patch({ size: clamp(selected.size * 0.85, MIN_SIZE, MAX_SIZE) })}>
              Kecil
            </button>
            <button type="button" className={pill} onClick={() => patch({ size: clamp(selected.size * 1.18, MIN_SIZE, MAX_SIZE) })}>
              Besar
            </button>
            <button type="button" className={pill} onClick={() => patch({ rot: selected.rot - 0.2 })} aria-label="Putar ke kiri">
              ⟲ Putar
            </button>
            <button type="button" className={pill} onClick={() => patch({ rot: selected.rot + 0.2 })} aria-label="Putar ke kanan">
              Putar ⟳
            </button>
            <button
              type="button"
              className={`${pill} border-alert/60 text-alert`}
              onClick={() => {
                onChange(overlays.filter((o) => o.id !== selected.id));
                onSelect(null);
              }}
            >
              Hapus
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-paper/70">
          Ketuk teks atau stiker di foto untuk memilihnya, lalu atur ukuran, putaran, atau pindahkan dengan menyeret.
        </p>
      )}
    </div>
  );
}

/** Menampilkan hasil foto: satu strip, atau satu gambar per jepretan dengan tombol unduh masing-masing. */
export function ResultGallery({ images, zipName, onSaved, overlays = [], canEdit = false, onOverlaysChange }: Props) {
  const [zipping, setZipping] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const change = (next: Overlay[]) => onOverlaysChange?.(next);
  const move = (id: string, x: number, y: number) => change(overlays.map((o) => (o.id === id ? { ...o, x, y } : o)));
  const editable = canEdit && !!onOverlaysChange;
  const isEditing = editable && editing;

  const downloadAll = async () => {
    setZipping(true);
    try {
      const { zipSync } = await import("fflate");
      const files: Record<string, Uint8Array> = {};
      for (const img of images) files[img.name] = new Uint8Array(await img.blob.arrayBuffer());
      // PNG sudah terkompresi, jadi cukup disimpan (level 0) supaya cepat di HP.
      const zipped = zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>;
      const url = URL.createObjectURL(new Blob([zipped], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onSaved?.(images.map((img) => img.name));
    } catch (err) {
      console.error("[zip]", err);
    } finally {
      setZipping(false);
    }
  };

  const editToggle = editable ? (
    <button
      type="button"
      aria-expanded={editing}
      onClick={() => {
        setEditing((v) => !v);
        setSelectedId(null);
      }}
      className={`${pill} ${editing ? "border-flash bg-flash text-ink" : ""}`}
    >
      {editing ? "Selesai menghias" : "Hias foto: teks & stiker"}
    </button>
  ) : null;

  const panel = isEditing ? (
    <OverlayPanel overlays={overlays} selectedId={selectedId} activeImage={activeImage} onChange={change} onSelect={setSelectedId} />
  ) : null;

  const shared = {
    overlays,
    editing: isEditing,
    selectedId,
    onSelect: setSelectedId,
    onActive: setActiveImage,
    onMove: move,
  };

  if (images.length === 1) {
    const [img] = images;
    return (
      <div className="flex w-full flex-col items-center gap-5">
        <EditableImage
          img={img}
          index={0}
          className="max-h-[75vh] w-auto max-w-full shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)]"
          {...shared}
        />
        {editToggle}
        {panel}
        <a href={img.url} download={img.name} onClick={() => onSaved?.([img.name])} className={PRIMARY}>
          Unduh strip
        </a>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ul className="grid w-full gap-6 sm:grid-cols-2">
        {images.map((img, i) => (
          <li key={img.name} className="flex flex-col items-center gap-3">
            <EditableImage
              img={img}
              index={i}
              className="max-h-[70vh] w-auto max-w-full shadow-[0_24px_48px_-20px_rgb(0_0_0/0.55)]"
              {...shared}
            />
            <a
              href={img.url}
              download={img.name}
              onClick={() => onSaved?.([img.name])}
              className="rounded-full border-2 border-paper px-5 py-2.5 text-sm font-bold transition-colors hover:bg-paper hover:text-ink"
            >
              Unduh {img.label.toLowerCase()}
            </a>
          </li>
        ))}
      </ul>
      {editToggle}
      {panel}
      <button type="button" onClick={downloadAll} disabled={zipping} className={`${PRIMARY} disabled:opacity-60`}>
        {zipping ? "Menyiapkan ZIP…" : `Unduh semua (${images.length} foto, ZIP)`}
      </button>
    </div>
  );
}

const PRIMARY =
  "block w-full max-w-xs rounded-full bg-flash px-7 py-3.5 text-center font-bold text-ink shadow-[0_5px_0_0_var(--color-curtain-deep)] sm:w-auto";
