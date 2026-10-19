import type { Face } from "./face-math";

/**
 * Penyimpan wajah terbaru per tile untuk efek di kamera langsung. Diperbarui ±9 kali per detik,
 * jadi tile menggambar langsung ke canvas lewat langganan, tanpa memicu render ulang React.
 * Kunci: "local" untuk tile sendiri (arah sesuai tampilan), id peer untuk tile teman (arah selfie).
 */
export class FaceStore {
  private faces = new Map<string, Face | null>();
  private listeners = new Map<string, Set<() => void>>();

  get(key: string): Face | null {
    return this.faces.get(key) ?? null;
  }

  set(key: string, face: Face | null) {
    this.faces.set(key, face);
    this.listeners.get(key)?.forEach((fn) => fn());
  }

  subscribe(key: string, listener: () => void): () => void {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  }
}
