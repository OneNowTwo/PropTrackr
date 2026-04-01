/** Decorative SVG for marketing — no external assets required */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="ht" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#0D9488" stopOpacity="0.15" />
          <stop offset="1" stopColor="#0D9488" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="hf" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F3F4F6" />
        </linearGradient>
      </defs>
      <rect width="560" height="420" rx="24" fill="url(#ht)" />
      <circle cx="420" cy="88" r="36" fill="#FDE68A" fillOpacity="0.9" />
      <ellipse cx="120" cy="360" rx="140" ry="28" fill="#0D9488" fillOpacity="0.08" />
      <path
        d="M72 320V200l88-64 88 64v120H72z"
        fill="url(#hf)"
        stroke="#E5E7EB"
        strokeWidth="2"
      />
      <path
        d="M108 320V232h56v88h-56zm88 0V248h56v72h-56z"
        fill="#FFFFFF"
        stroke="#E5E7EB"
        strokeWidth="1.5"
      />
      <path
        d="M52 200l108-78 108 78"
        stroke="#0D9488"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="300" y="140" width="200" height="180" rx="8" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
      <rect x="320" y="160" width="72" height="52" rx="4" fill="#ECFDF5" stroke="#99F6E4" strokeWidth="1.5" />
      <rect x="408" y="160" width="72" height="52" rx="4" fill="#ECFDF5" stroke="#99F6E4" strokeWidth="1.5" />
      <rect x="320" y="228" width="72" height="52" rx="4" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1.5" />
      <rect x="408" y="228" width="72" height="52" rx="4" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1.5" />
      <path
        d="M300 200h200"
        stroke="#E5E7EB"
        strokeWidth="2"
      />
    </svg>
  );
}
