/** Pembuat GIF animasi di browser (memakai gifenc). Dimuat hanya saat tombol "Buat GIF" ditekan. */
import { applyPalette, GIFEncoder, quantize, type Palette } from "gifenc";

type Indexed = { index: Uint8Array; palette: Palette; width: number; height: number };

export function createGifBuilder() {
  const gif = GIFEncoder();
  // Frame yang sama (mis. saat boomerang diputar mundur) tidak dihitung ulang paletnya.
  const cache = new Map<HTMLCanvasElement, Indexed>();

  return {
    add(canvas: HTMLCanvasElement, delayMs: number) {
      let item = cache.get(canvas);
      if (!item) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas tidak didukung.");
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const palette = quantize(data, 256);
        item = { index: applyPalette(data, palette), palette, width, height };
        cache.set(canvas, item);
      }
      gif.writeFrame(item.index, item.width, item.height, { palette: item.palette, delay: delayMs });
    },
    finish(): Blob {
      gif.finish();
      return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: "image/gif" });
    },
  };
}
