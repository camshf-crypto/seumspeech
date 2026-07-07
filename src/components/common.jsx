// 공용: SVG 아이콘 모음 + 사진 자리표시 컴포넌트

export const Ico = {
  phone: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M6.5 4h3l1.5 4-2 1.5a12 12 0 005.5 5.5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 6.2 2 2 0 016.5 4z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  kakao: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 4C7 4 3 7.2 3 11.2c0 2.5 1.7 4.7 4.2 6l-.9 3.3 3.7-2.2c.6.1 1.3.2 2 .2 5 0 9-3.2 9-7.3S17 4 12 4z"
        fill="currentColor" />
    </svg>
  ),
  top: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  chat: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M4 5h16v11H9l-4 3v-3H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  bulb: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.6.6 1 1.3 1 2.5h6c0-1.2.4-1.9 1-2.5A6 6 0 0012 3z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
};

// 사진 자리표시: src 있으면 이미지, 없으면 회색 박스
export function Img({ src, alt, className, label }) {
  if (src) return <img src={src} alt={alt} className={className} />;
  return (
    <div className={`flex items-center justify-center bg-slate-200 text-xs text-slate-400 ${className}`}>
      {label || "이미지"}
    </div>
  );
}
