export default function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stylised 'P' letterform with chakra dots */}
      <rect width="36" height="36" rx="8" fill="currentColor" />
      <path
        d="M10 26V10h9a5.5 5.5 0 0 1 0 11H10"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="26" r="2" fill="#C8700D" />
      <circle cx="26" cy="20" r="1.2" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}
