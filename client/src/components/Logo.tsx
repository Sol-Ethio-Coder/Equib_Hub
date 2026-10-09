import { brand } from '@/config/brand';

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#14877B" /><stop offset="1" stopColor="#063A33" /></linearGradient>
        <linearGradient id="lm-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFE08A" /><stop offset="1" stopColor="#D9902B" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#lm-bg)" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="3.5" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="url(#lm-gold)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="34.5 8.5" transform="rotate(-100 32 32)" />
      <rect x="25" y="22.5" width="4.2" height="19" rx="2.1" fill="#fff" />
      <rect x="25" y="22.5" width="14.5" height="4.2" rx="2.1" fill="#fff" />
      <rect x="25" y="30" width="11" height="4.2" rx="2.1" fill="#fff" />
      <rect x="25" y="37.3" width="14.5" height="4.2" rx="2.1" fill="#fff" />
    </svg>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  const head = brand.name.slice(0, -3), tail = brand.name.slice(-3);
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-display text-xl font-bold tracking-tight">{head}<span className="text-gold">{tail}</span></span>
    </span>
  );
}
