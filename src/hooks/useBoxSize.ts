"use client";

import { useEffect, useState, type RefObject } from "react";

export type BoxSize = { width: number; viewportWidth: number; viewportHeight: number; top: number };

/** Lebar elemen + ukuran viewport, diperbarui saat ukuran berubah (rotasi HP, resize jendela). */
export function useBoxSize(ref: RefObject<HTMLElement | null>): BoxSize {
  const [size, setSize] = useState<BoxSize>({ width: 0, viewportWidth: 0, viewportHeight: 0, top: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize((prev) => {
        const next = {
          width: el.clientWidth,
          viewportWidth: window.innerWidth,
          viewportHeight: window.visualViewport?.height ?? window.innerHeight,
          // Jarak dari atas halaman ke panggung (header + status di atasnya), supaya ukuran kamera bisa menyisakan ruang untuk tombol.
          top: Math.round(el.getBoundingClientRect().top + window.scrollY),
        };
        return prev.width === next.width &&
          prev.viewportWidth === next.viewportWidth &&
          prev.viewportHeight === next.viewportHeight &&
          prev.top === next.top
          ? prev
          : next;
      });
    // ResizeObserver langsung memanggil callback sekali saat mulai mengamati.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Tinggi bagian di atas panggung (mis. teks status jadi dua baris) menggeser panggung tanpa mengubah ukurannya.
    if (el.parentElement) observer.observe(el.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return size;
}
