import { Brand } from "@/components/Brand";
import { SampleStrip } from "@/components/SampleStrip";
import { StartForm } from "@/components/StartForm";

const HIGHLIGHTS = ["1–8 orang", "Hitung mundur serempak", "Background pengganti", "Tanpa akun"];

const STEPS = [
  { title: "Buat room", body: "Pilih jumlah orang dan siapa yang boleh mengatur, lalu buat room." },
  { title: "Kirim tautan", body: "Bagikan tautannya ke teman. Mereka cukup membuka dan mengizinkan kamera." },
  { title: "Foto bareng", body: "Hitung mundur jalan bersamaan. Strip foto jadi, unduh di perangkat masing-masing." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-5 py-10 md:px-10 md:py-16">
      <div className="grid items-center gap-12 md:grid-cols-[1.25fr_1fr]">
        <section className="flex flex-col gap-7">
          <Brand className="text-2xl" />

          <h1 className="font-display text-[clamp(3.25rem,9vw,6.25rem)] font-black leading-none tracking-tight text-balance text-paper">
            Satu strip foto, <span className="text-flash">beda kota.</span>
          </h1>

          <p className="max-w-[46ch] text-lg leading-relaxed text-paper/85">
            Buat room untuk 1 sampai 8 orang, kirim tautannya ke teman-temanmu, lalu berfoto bareng
            lewat kamera masing-masing. Hitung mundurnya jalan bersamaan, dan hasilnya satu strip foto
            yang bisa diunduh semua orang.
          </p>

          <ul className="flex flex-wrap gap-2" aria-label="Ciri khas">
            {HIGHLIGHTS.map((text) => (
              <li key={text} className="rounded-full border border-paper/25 bg-paper/5 px-3.5 py-1.5 text-sm text-paper/90">
                {text}
              </li>
            ))}
          </ul>

          <div className="max-w-xl rounded-3xl border border-paper/15 bg-curtain-deep/60 p-6 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.8)] backdrop-blur-sm md:p-7">
            <StartForm />
          </div>

          <p className="max-w-[46ch] text-sm text-paper/65">
            Video dan foto dikirim langsung antar browser. Tidak ada yang disimpan di server.
          </p>
        </section>

        <div className="flex justify-center md:justify-end">
          <SampleStrip />
        </div>
      </div>

      <section aria-labelledby="how-title" className="flex flex-col gap-6">
        <h2 id="how-title" className="font-display text-3xl font-black">
          Cara kerjanya
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-2xl border border-paper/12 bg-paper/5 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-flash font-display text-xl font-black text-ink">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-paper/75">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
