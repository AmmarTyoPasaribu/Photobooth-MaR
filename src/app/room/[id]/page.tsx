import { Suspense } from "react";
import { notFound } from "next/navigation";
import { parseRoomMode } from "@/lib/host";
import { Booth } from "@/components/Booth";
import { normalizeRoomCode } from "@/lib/room";
import { parseCapacity } from "@/lib/types";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ n?: string | string[]; m?: string | string[] }>;

async function RoomContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  let decoded: string;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    notFound(); // escape rusak, mis. %E0%A4%A
  }
  const roomId = normalizeRoomCode(decoded);
  if (!roomId) notFound();
  // Kapasitas dari tautan pembuat room. Tanpa ?n, ikut kapasitas anggota yang sudah ada.
  const capacity = parseCapacity(Array.isArray(query.n) ? query.n[0] : query.n);
  // Siapa yang boleh mengatur, dari tautan. Host terverifikasi yang hadir menentukan sendiri.
  const mode = parseRoomMode(Array.isArray(query.m) ? query.m[0] : query.m);
  return <Booth roomId={roomId} capacityParam={capacity} modeParam={mode} />;
}

export default function RoomPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <main className="grid flex-1 place-items-center p-8 text-paper/80">Membuka booth…</main>
      }
    >
      <RoomContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
