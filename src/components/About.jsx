import { useState } from "react";
import { IMAGES, LINKS, NAV } from "./config";

/* ───── 사진 자리표시 ───── */
function Img({ src, alt, className, label }) {
  if (src) return <img src={src} alt={alt} className={className} />;
  return (
    <div className={`flex items-center justify-center bg-slate-200 text-xs text-slate-400 ${className}`}>
      {label || "이미지"}
    </div>
  );
}

/* ───── 아이콘 ───── */
const Ico = {
  phone: (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6.5 4h3l1.5 4-2 1.5a12 12 0 005.5 5.5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 6.2 2 2 0 016.5 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>),
  kakao: (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 4C7 4 3 7.2 3 11.2c0 2.5 1.7 4.7 4.2 6l-.9 3.3 3.7-2.2c.6.1 1.3.2 2 .2 5 0 9-3.2 9-7.3S17 4 12 4z" fill="currentColor" /></svg>),
  top: (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  close: (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>),
  chat: (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 5h16v11H9l-4 3v-3H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>),
  doc: (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>),
  globe: (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="currentColor" strokeWidth="1.6" /></svg>),
  nodes: (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="6" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="18" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M8 9.5l3 5.5M16 9.5l-3 5.5M8.5 8h7" stroke="currentColor" strokeWidth="1.6" /></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8.5 12l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>),
};

/* ───── 헤더 ───── */
function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed left-0 top-0 z-40 w-full bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="/" className="flex items-center gap-2">
          {IMAGES.logo ? (
            <img src={IMAGES.logo} alt="세움스피치학원" className="h-9 w-auto" />
          ) : (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded bg-seum-navy text-base font-black text-white">M</span>
              <span className="leading-tight">
                <span className="block text-[9px] tracking-widest text-slate-400">SEUM SPEECH</span>
                <span className="block text-lg font-bold text-seum-navy">세움스피치학원</span>
              </span>
            </>
          )}
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((m) => (
            <a key={m.label} href={m.href} className="text-sm font-medium text-slate-700 hover:text-seum-blue">{m.label}</a>
          ))}
        </nav>
        <a href={`tel:${LINKS.tel}`} className="hidden items-center gap-2 md:flex">
          <span className="text-[11px] text-slate-400">상담전화</span>
          <span className="text-lg font-extrabold tracking-tight text-seum-navy">{LINKS.tel}</span>
        </a>
        <button className="flex h-10 w-10 items-center justify-center md:hidden" aria-label="메뉴 열기" onClick={() => setOpen((v) => !v)}>
          <div className="space-y-1.5">
            <span className="block h-0.5 w-6 bg-slate-800" />
            <span className="block h-0.5 w-6 bg-slate-800" />
            <span className="block h-0.5 w-6 bg-slate-800" />
          </div>
        </button>
      </div>
      {open && (
        <nav className="border-t border-slate-100 bg-white px-5 py-3 md:hidden">
          {NAV.map((m) => (
            <a key={m.label} href={m.href} className="block py-2.5 text-sm font-medium text-slate-700">{m.label}</a>
          ))}
          <a href={`tel:${LINKS.tel}`} className="mt-2 block py-2.5 text-base font-bold text-seum-navy">상담전화 {LINKS.tel}</a>
        </nav>
      )}
    </header>
  );
}

/* ───── 우측 플로팅 ───── */
function FloatingQuick() {
  const [open, setOpen] = useState(() => typeof window === "undefined" ? true : window.innerWidth >= 768);
  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  return (
    <div className="fixed right-4 top-1/2 z-50 -translate-y-1/2">
      {open ? (
        <div className="flex w-24 flex-col items-stretch overflow-hidden rounded-2xl bg-seum-navy text-white shadow-xl">
          <button onClick={() => setOpen(false)} aria-label="상담 메뉴 접기" className="flex h-8 items-center justify-center border-b border-white/10 text-white/60 hover:text-white"><Ico.close className="h-4 w-4" /></button>
          <a href={`tel:${LINKS.tel}`} className="flex flex-col items-center gap-1 px-3 py-4 hover:bg-white/5"><Ico.phone className="h-6 w-6 text-sky-300" /><span className="text-[10px] text-white/70">상담전화</span><span className="text-center text-[11px] font-bold leading-tight">{LINKS.tel}</span></a>
          <a href={LINKS.kakao} className="flex flex-col items-center gap-1 border-t border-white/10 bg-[#FEE500] px-3 py-4 text-[#3b1e1e] hover:brightness-95"><Ico.kakao className="h-6 w-6" /><span className="text-[11px] font-bold">카톡상담</span></a>
          <a href={LINKS.online} className="flex flex-col items-center gap-1 border-t border-white/10 px-3 py-4 hover:bg-white/5"><Ico.chat className="h-6 w-6 text-sky-300" /><span className="text-[11px] font-medium">온라인문의</span></a>
          <button onClick={toTop} className="flex flex-col items-center gap-0.5 border-t border-white/10 px-3 py-3 hover:bg-white/5"><Ico.top className="h-5 w-5" /><span className="text-[10px] font-bold tracking-wider">TOP</span></button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} aria-label="상담 메뉴 열기" className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-seum-navy text-white shadow-xl hover:bg-[#24386f]"><Ico.chat className="h-6 w-6 text-sky-300" /><span className="text-[9px] font-bold">상담</span></button>
      )}
    </div>
  );
}

/* ───── 드롭다운 ───── */
function SubDropdown({ current = "세움스피치학원", items = ["세움스피치학원", "세움면접", "세움비즈"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-center pt-24 pb-8">
      <div className="relative w-64">
        <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between border-b-2 border-slate-300 px-3 py-3 text-base font-medium text-slate-700">
          {current}
          <svg viewBox="0 0 24 24" className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {open && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
            {items.map((it) => (<li key={it}><a href="#" className="block px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">{it}</a></li>))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ───── 원장 인사말 ───── */
function Greeting() {
  return (
    <section className="bg-white pb-16">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-400">세움스피치학원</p>
          <h1 className="mb-8 text-3xl font-extrabold text-slate-800 md:text-4xl">“Definite Change<br className="hidden md:block" /> and Pleasure”</h1>
          <div className="space-y-4 text-sm leading-relaxed text-slate-600">
            <p>안녕하세요.<br />세움스피치학원 원장 김지윤입니다.</p>
            <p>그동안 교육을 하며 수없이 많은 분들이 변화하는 모습을 보았습니다.</p>
            <p>세움스피치학원는 전 국민이 말을 잘하는 그 날까지라는 모토로 교육을 진행하고 있습니다.</p>
            <p>앞으로도 세움스피치학원는 발표불안으로 고민하시는 분들의 마음을 견고하게 세우고, 공식석상에만 가면 머리 속이 하얘지는 분들의 <strong className="text-slate-800">논리를 탄탄하게 세우며</strong>, 승진을 앞둔 분들이나 중요한 면접을 앞둔 여러분의 <strong className="text-slate-800">자리를 높일 수 있도록</strong> 끊임없이 연구하고 교육할 것입니다.</p>
            <p>자신 있고 당당한 말하기로부터 당신도 인생의 주인공이 될 수 있습니다.<br />확실한 변화의 시작 세움스피치학원와 함께 하세요.<br />당신도 할 수 있습니다.</p>
          </div>
        </div>
        <Img src={IMAGES.principal} alt="세움스피치학원 원장" label="원장 사진" className="h-[420px] w-full rounded-xl object-cover object-top" />
      </div>
    </section>
  );
}

/* ───── 인용문구 띠 ───── */
function QuoteBand() {
  return (
    <section className="relative overflow-hidden py-28 text-center">
      <Img src={IMAGES.aboutBg} alt="" label="인용문구 배경사진" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-seum-navy/75" />
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-white">
        <p className="text-xl font-medium leading-relaxed md:text-2xl">“말을 잘 못해서 고민이신가요?<br />스피치가 어려운 게 아니라<br />그동안 스피치를 제대로 배울 기회가 없었던 것입니다.”</p>
        <p className="mt-6 text-sm text-white/70">- 세움스피치학원 -</p>
      </div>
    </section>
  );
}

/* ───── 약속 4개 ───── */
const PROMISES = [
  { icon: Ico.doc, title: "전문화된 커리큘럼", desc: "세움스피치학원의 커리큘럼은 견고합니다. (수강생 목표치 96.8% 달성) 전문적인 교육서비스를 통해 수강생이 원하는 목표를 함께 이뤄드릴 것을 약속드립니다." },
  { icon: Ico.globe, title: "업계 최고 수준의 강사진", desc: "스피치 교육은 어떤 학원을 다니냐보다 어떤 선생님께 배우냐에 따라 그 결과가 달라집니다. 스피치 교육만을 연구하고 업계에서 인정받는 실력 있는 선생님들로 책임감 있게 교육할 것을 약속드립니다." },
  { icon: Ico.nodes, title: "소수정예 클래스 운영", desc: "최대의 교육효과를 볼 수 있는 소수정예(4~6명) 인원으로 수강생 전원을 꼼꼼하게 책임지고 관리할 수 있는 규모로 운영할 것을 약속드립니다." },
  { icon: Ico.check, title: "체계적인 사후관리 시스템", desc: "세움스피치학원의 출석률은 100%를 자랑합니다. 교육을 진행하면서 일정이 생길 경우 중도에 교육을 듣지못하는 일이 없도록 수강 횟수 보장 시스템이 마련되어 있습니다." },
];

function Promises() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="mb-14 text-center text-2xl font-bold text-slate-800 md:text-3xl">세움스피치학원가 드리는 약속</h2>
        <div className="divide-y divide-slate-100">
          {PROMISES.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="flex items-start gap-6 py-8">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 text-seum-blue"><Icon className="h-8 w-8" /></div>
                <div>
                  <h3 className="mb-2 text-lg font-bold text-slate-800">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───── 푸터 ───── */
function Footer() {
  return (
    <footer className="bg-[#1a1f2e] py-10 text-white/60">
      <div className="mx-auto max-w-6xl px-6 text-xs leading-relaxed">
        <p className="mb-2 text-sm font-bold text-white">세움스피치학원학원</p>
        <p>대표 김지윤 | 사업자등록번호 432-91-01752 | TEL {LINKS.tel}</p>
        <p>서울시 강서구 마곡중앙로55 퀸즈파크13 205-206호</p>
        <p className="mt-4 text-white/40">Copyright © 세움스피치학원. All Rights Reserved.</p>
      </div>
    </footer>
  );
}

/* ───── 페이지 ───── */
export default function About() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <Header />
      <FloatingQuick />
      <main>
        <SubDropdown current="세움스피치학원" />
        <Greeting />
        <QuoteBand />
        <Promises />
      </main>
      <Footer />
    </div>
  );
}