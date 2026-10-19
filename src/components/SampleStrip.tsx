/** Contoh strip foto di halaman depan: dua orang, empat jepretan, mengambang dengan konfeti di sekelilingnya. */

type Expression = "smile" | "tongue" | "laugh" | "wink";
type Accessory = "none" | "glasses" | "hat" | "heart" | "peace" | "crown";
type HairStyle = "short" | "bun" | "curly" | "long";

type Look = {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
};

type Pose = { expression: Expression; accessory: Accessory; shift: number; tilt: number };

const PERSON_A: Look = { skin: "#F2C6A0", hair: "#2B1B17", hairStyle: "short", shirt: "#FF7A59" };
const PERSON_B: Look = { skin: "#C98B62", hair: "#1A0F2E", hairStyle: "bun", shirt: "#7C5CFF" };

const SHOTS: { a: Pose; b: Pose; from: string; to: string }[] = [
  {
    a: { expression: "smile", accessory: "none", shift: -6, tilt: -3 },
    b: { expression: "smile", accessory: "none", shift: 6, tilt: 3 },
    from: "#FFD9CC",
    to: "#FFB59E",
  },
  {
    a: { expression: "tongue", accessory: "glasses", shift: -12, tilt: -8 },
    b: { expression: "laugh", accessory: "hat", shift: 8, tilt: 7 },
    from: "#D9CCFF",
    to: "#B49DFF",
  },
  {
    a: { expression: "wink", accessory: "peace", shift: 10, tilt: 6 },
    b: { expression: "smile", accessory: "heart", shift: -10, tilt: -6 },
    from: "#FFE9A8",
    to: "#FFC96B",
  },
  {
    a: { expression: "laugh", accessory: "crown", shift: -4, tilt: 4 },
    b: { expression: "wink", accessory: "none", shift: 4, tilt: -4 },
    from: "#BDEBDD",
    to: "#7FD6BE",
  },
];

function Hair({ look }: { look: Look }) {
  const c = look.hair;
  if (look.hairStyle === "bun") {
    return (
      <g fill={c}>
        <circle cx="60" cy="16" r="8" />
        <path d="M42 38c0-14 8-22 18-22s18 8 18 22c-4-8-10-12-18-12s-14 4-18 12z" />
      </g>
    );
  }
  if (look.hairStyle === "curly") {
    return (
      <g fill={c}>
        {[44, 52, 60, 68, 76].map((x, i) => (
          <circle key={x} cx={x} cy={i % 2 ? 22 : 25} r="8" />
        ))}
      </g>
    );
  }
  if (look.hairStyle === "long") {
    return <path d="M41 40c0-16 8-24 19-24s19 8 19 24v22h-8V38c-8 0-16-4-22-10-2 4-6 8-10 10v24h-8z" fill={c} />;
  }
  return <path d="M42 36c0-14 8-21 18-21s18 7 18 21c-5-6-11-9-18-9s-13 3-18 9z" fill={c} />;
}

function Face({ expression }: { expression: Expression }) {
  const ink = "#2A1633";
  return (
    <g>
      <circle cx="49" cy="47" r="3.6" fill="#FF7A8A" opacity="0.4" />
      <circle cx="71" cy="47" r="3.6" fill="#FF7A8A" opacity="0.4" />
      {expression === "laugh" ? (
        <g fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round">
          <path d="M50 40q3-4 6 0" />
          <path d="M64 40q3-4 6 0" />
        </g>
      ) : expression === "wink" ? (
        <g>
          <circle cx="53" cy="40" r="2.2" fill={ink} />
          <path d="M64 40q3-3.5 6 0" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        <g fill={ink}>
          <circle cx="53" cy="40" r="2.2" />
          <circle cx="67" cy="40" r="2.2" />
        </g>
      )}
      {expression === "laugh" ? (
        <path d="M51 48q9 11 18 0z" fill={ink} />
      ) : expression === "tongue" ? (
        <g>
          <path d="M52 49q8 6 16 0" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <path d="M57 51.5q3 8 6 0z" fill="#FF6F91" stroke={ink} strokeWidth="1" />
        </g>
      ) : (
        <path d="M52 48.5q8 7 16 0" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      )}
    </g>
  );
}

function Accessories({ kind }: { kind: Accessory }) {
  if (kind === "glasses") {
    return (
      <g fill="rgb(255 255 255 / 0.25)" stroke="#2A1633" strokeWidth="2">
        <circle cx="53" cy="40" r="6.5" />
        <circle cx="67" cy="40" r="6.5" />
        <path d="M59.5 40h1" />
      </g>
    );
  }
  if (kind === "hat") {
    return (
      <g>
        <path d="M50 24l10-22 10 22z" fill="#FF7A59" />
        <path d="M54 17h12M52 21h16" stroke="#FFF7F0" strokeWidth="2" />
        <circle cx="60" cy="2.5" r="3" fill="#FFE34D" />
      </g>
    );
  }
  if (kind === "crown") {
    return <path d="M46 24l3-12 7 7 4-10 4 10 7-7 3 12z" fill="#FFD23F" stroke="#E0A800" strokeWidth="1.2" />;
  }
  if (kind === "heart") {
    return (
      <path
        d="M96 22c-2.5-5-9-3-9 2.5 0 4 5 7 9 11 4-4 9-7 9-11 0-5.5-6.5-7.5-9-2.5z"
        fill="#FF4F7B"
        transform="rotate(12 96 28)"
      />
    );
  }
  if (kind === "peace") {
    return (
      <g transform="translate(88 52) rotate(14)">
        <rect x="-4" y="2" width="9" height="12" rx="4" fill="#F2C6A0" />
        <rect x="-3.5" y="-12" width="3.2" height="15" rx="1.6" fill="#F2C6A0" />
        <rect x="0.8" y="-13" width="3.2" height="16" rx="1.6" fill="#F2C6A0" transform="rotate(10 2 3)" />
      </g>
    );
  }
  return null;
}

function Person({ look, pose, gid, from, to }: { look: Look; pose: Pose; gid: string; from: string; to: string }) {
  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <pattern id={`${gid}-dots`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.3" fill="#fff" opacity="0.35" />
        </pattern>
      </defs>
      <rect width="120" height="90" fill={`url(#${gid}-bg)`} />
      <rect width="120" height="90" fill={`url(#${gid}-dots)`} />
      <g transform={`translate(${pose.shift} 0) rotate(${pose.tilt} 60 90)`}>
        <path d="M22 92c2-21 17-30 38-30s36 9 38 30z" fill={look.shirt} />
        <path d="M50 62q10 9 20 0l-2 5q-8 6-16 0z" fill="#FFF7F0" opacity="0.85" />
        <rect x="54" y="52" width="12" height="12" rx="4" fill={look.skin} />
        {look.hairStyle === "long" && <Hair look={look} />}
        <ellipse cx="60" cy="40" rx="17" ry="19" fill={look.skin} />
        {look.hairStyle !== "long" && <Hair look={look} />}
        <Face expression={pose.expression} />
        <Accessories kind={pose.accessory} />
      </g>
    </svg>
  );
}

type FloaterKind = "star" | "heart" | "spark";

/** Bentuk kecil yang melayang di sekitar strip. */
const FLOATERS: { kind: FloaterKind; color: string; className: string; size: number; dur: string; delay: string }[] = [
  { kind: "star", color: "#FFE34D", className: "-left-8 top-6", size: 28, dur: "6s", delay: "0s" },
  { kind: "heart", color: "#FF7A8A", className: "-right-9 top-24", size: 30, dur: "7.5s", delay: "-2s" },
  { kind: "spark", color: "#FFF7F0", className: "-left-12 top-[46%]", size: 22, dur: "5.5s", delay: "-1s" },
  { kind: "star", color: "#B49DFF", className: "-right-6 top-[62%]", size: 20, dur: "6.8s", delay: "-3s" },
  { kind: "heart", color: "#FF7A59", className: "-left-7 bottom-16", size: 24, dur: "8s", delay: "-4s" },
  { kind: "spark", color: "#FFE34D", className: "-right-10 bottom-6", size: 26, dur: "5s", delay: "-2.5s" },
];

const FLOATER_PATHS: Record<FloaterKind, string> = {
  star: "M12 1l3.2 7.3 7.8.7-5.9 5.2 1.8 7.7L12 17.9 5.1 21.9l1.8-7.7L1 9l7.8-.7z",
  heart: "M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3.5-3 7-10 13z",
  spark: "M12 1c.8 6 2.2 8.8 11 11-8.8 2.2-10.2 5-11 11-.8-6-2.2-8.8-11-11C9.8 9.8 11.2 7 12 1z",
};

export function SampleStrip() {
  return (
    <div className="relative w-[min(72vw,290px)]">
      {FLOATERS.map((f, i) => (
        <span
          key={i}
          className={`animate-drift absolute ${f.className}`}
          style={{ width: f.size, height: f.size, ["--dur" as string]: f.dur, ["--delay" as string]: f.delay }}
        >
          <svg viewBox="0 0 24 24" className="h-full w-full drop-shadow-[0_4px_8px_rgb(0_0_0/0.35)]" aria-hidden="true">
            <path d={FLOATER_PATHS[f.kind]} fill={f.color} />
          </svg>
        </span>
      ))}

      <div className="animate-float">
        <figure
          className="animate-strip relative overflow-hidden bg-paper p-3 pb-0 text-ink shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]"
          aria-label="Contoh strip foto berisi dua orang dalam empat jepretan"
        >
          <div className="flex flex-col gap-2">
            {SHOTS.map((shot, i) => (
              <div key={i} className="grid grid-cols-2 gap-1.5">
                <div className="aspect-[4/3] overflow-hidden">
                  <Person look={PERSON_A} pose={shot.a} gid={`a${i}`} from={shot.from} to={shot.to} />
                </div>
                <div className="aspect-[4/3] overflow-hidden">
                  <Person look={PERSON_B} pose={shot.b} gid={`b${i}`} from={shot.from} to={shot.to} />
                </div>
              </div>
            ))}
          </div>
          <figcaption className="py-4 text-center">
            <span className="block font-display text-3xl font-black leading-none">kita</span>
            <span className="mt-1 block text-xs text-ink/60">14 Februari 2026</span>
          </figcaption>
          {/* kilau yang menyapu permukaan */}
          <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <span className="animate-sheen absolute -inset-y-4 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </span>
        </figure>
      </div>

      <span className="animate-shadow mx-auto mt-6 block h-4 w-3/4 rounded-[50%] bg-black/60 blur-md" aria-hidden="true" />
    </div>
  );
}
