/** Logo kecil (lensa kamera) dan nama aplikasi. */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display font-bold ${className}`}>
      <svg viewBox="0 0 32 32" className="h-[1.15em] w-[1.15em]" aria-hidden="true">
        <rect x="2" y="7" width="28" height="20" rx="6" fill="var(--color-flash)" />
        <rect x="10" y="3.5" width="8" height="5" rx="2" fill="var(--color-flash)" />
        <circle cx="16" cy="17" r="6.5" fill="var(--color-ink)" />
        <circle cx="16" cy="17" r="3.2" fill="var(--color-paper)" />
        <circle cx="25" cy="11.5" r="1.4" fill="var(--color-ink)" />
      </svg>
      <span>Fotbar Bareng MaR</span>
    </span>
  );
}
