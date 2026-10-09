import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#3446F0" />
      <circle cx="16" cy="16" r="7" stroke="#fff" strokeWidth="3.5" />
      <circle cx="23.5" cy="9" r="3" fill="#F2A71B" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Opsly home">
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-tight">Opsly</span>
    </Link>
  );
}