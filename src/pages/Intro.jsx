import { INTRO } from "../config";
import { useSiteImage } from "../lib/useSiteImage";

// 온라인 수업 문구 — config.js에 INTRO.online을 넣으면 그쪽이 우선
const ONLINE_DEFAULT = {
  eng: "ONLINE CLASS",
  title: "온라인 스피치",
  desc1: "어디서든 듣는 6주 스피치 단체반",
  desc2: "강의 + 6명 소그룹 실습 + 음성 분석",
  keywords: ["6주 과정", "소그룹 실습", "피드백·숙제", "음성 분석"],
  btn: "온라인 수업 보기",
  link: "/online",
  bg: "",
};

const TONES = {
  speech: {
    overlay: "bg-gradient-to-b from-slate-700/70 to-seum-navy/80",
    accent: "text-sky-300",
    fallback: "bg-slate-500",
  },
  interview: {
    overlay: "bg-gradient-to-b from-stone-800/70 to-stone-900/85",
    accent: "text-amber-300",
    fallback: "bg-stone-700",
  },
  online: {
    overlay: "bg-gradient-to-b from-teal-800/70 to-slate-900/85",
    accent: "text-teal-300",
    fallback: "bg-teal-900",
  },
};

function Side({ data, tone, bgSlot }) {
  const go = () => (window.location.href = data.link);
  const adminBg = useSiteImage(bgSlot); // 어드민에서 올린 배경 (있으면 우선)
  const bg = adminBg || data.bg;
  const t = TONES[tone];

  return (
    <div className="group relative flex min-h-[60vh] flex-1 items-center justify-center overflow-hidden md:min-h-screen">
      {bg ? (
        <img src={bg} alt={data.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
      ) : (
        <div className={`absolute inset-0 ${t.fallback}`} />
      )}
      <div className={`absolute inset-0 ${t.overlay} transition duration-500 group-hover:opacity-80`} />

      <div className="relative z-10 px-6 text-center text-white">
        <p className={`mb-3 text-sm font-medium tracking-widest ${t.accent}`}>{data.eng}</p>
        <h2 className="mb-6 text-4xl font-extrabold lg:text-5xl">{data.title}</h2>
        <p className="text-lg leading-relaxed text-white/90">
          {data.desc1}<br />
          <span className="font-bold">{data.desc2}</span>
        </p>
        <p className="mt-6 text-sm text-white/70">
          {data.keywords.join("  |  ")}
        </p>
        <button
          onClick={go}
          className="mt-10 rounded-lg border border-white/60 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-white hover:text-slate-900"
        >
          {data.btn}
        </button>
      </div>
    </div>
  );
}

export default function Intro() {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute left-1/2 top-8 z-20 -translate-x-1/2 text-center">
        <div className="flex items-center gap-2 rounded-full bg-black/20 px-5 py-2 backdrop-blur">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-extrabold text-seum-navy">M</span>
          <div className="text-left leading-none">
            <p className="text-[10px] tracking-widest text-white/70">SEUM SPEECH</p>
            <p className="text-lg font-extrabold text-white">세움스피치</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen flex-col md:flex-row">
        <Side data={INTRO.speech} tone="speech" bgSlot="intro_speechBg" />
        <Side data={INTRO.interview} tone="interview" bgSlot="intro_interviewBg" />
        <Side data={INTRO.online ?? ONLINE_DEFAULT} tone="online" bgSlot="intro_onlineBg" />
      </div>
    </div>
  );
}