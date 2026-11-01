import Link from "next/link";

export function LogoMark({ size = 34, tone = "ink" }: { size?: number; tone?: "ink" | "lime" }) {
  const bg = tone === "ink" ? "#0E1512" : "#C6F24E";
  const fg = tone === "ink" ? "#C6F24E" : "#0E1512";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill={bg} />
      <path d="M26 9.5v13a7.5 7.5 0 0 1-15 0" fill="none" stroke={fg} strokeWidth="4.6" strokeLinecap="round" />
      <circle cx="14.5" cy="13.5" r="3.6" fill={fg} />
    </svg>
  );
}

export function Logo({ onDark = false, size = 34 }: { onDark?: boolean; size?: number }) {
  return (
    <Link href="/" className={onDark ? "logo onDark" : "logo"} aria-label="Jobba home">
      <LogoMark size={size} tone={onDark ? "lime" : "ink"} />
      <span className="brand">Jobba<span>.</span></span>
    </Link>
  );
}
