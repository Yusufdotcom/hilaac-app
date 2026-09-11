/** Gold-stroke feature icons for the Hilaac brand sheet (landing only). */

const stroke = "#C9A84C";

export function IconQrOrdering({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="10" height="10" rx="1.5" stroke={stroke} strokeWidth="1.5" />
      <rect x="18" y="4" width="10" height="10" rx="1.5" stroke={stroke} strokeWidth="1.5" />
      <rect x="4" y="18" width="10" height="10" rx="1.5" stroke={stroke} strokeWidth="1.5" />
      <path d="M18 18h4v4h-4v-4Zm6 0h4v2h-2v2h-2v-4Zm0 6h4v4h-4v-2h2v-2h-2v0Z" fill={stroke} />
      <rect x="7" y="7" width="4" height="4" fill={stroke} />
      <rect x="21" y="7" width="4" height="4" fill={stroke} />
      <rect x="7" y="21" width="4" height="4" fill={stroke} />
    </svg>
  );
}

export function IconKitchenDisplay({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="6" width="26" height="16" rx="2" stroke={stroke} strokeWidth="1.5" />
      <path d="M11 26h10" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 22v4" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 11h6M8 15h10" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="23" cy="13" r="2" fill={stroke} />
    </svg>
  );
}

export function IconRealtimeReports({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M5 25V9M5 25h22" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M9 20l5-6 4 3 7-9"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="8" r="1.75" fill={stroke} />
    </svg>
  );
}

export function IconAiInsights({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 4l1.6 6.2L24 12l-6.4 1.8L16 20l-1.6-6.2L8 12l6.4-1.8L16 4Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 18l.9 3.4L28 22l-3.1.9L24 26l-.9-3.1L20 22l3.1-.6L24 18Z"
        fill={stroke}
      />
    </svg>
  );
}

export function IconSecurePayments({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="5" y="10" width="22" height="14" rx="2" stroke={stroke} strokeWidth="1.5" />
      <path d="M5 14h22" stroke={stroke} strokeWidth="1.5" />
      <path d="M9 20h6" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 6.5a3 3 0 0 1 3 3V10h-6V9.5a3 3 0 0 1 3-3Z"
        stroke={stroke}
        strokeWidth="1.5"
      />
    </svg>
  );
}
