import { KIDS_SPEECH, LINKS } from "../config";

const TargetIcons = [
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 5h16v10H7l-3 3V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3v10M12 13a3 3 0 003-3V6a3 3 0 00-6 0v4a3 3 0 003 3zM7 18h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M8 10h.01M16 10h.01M8 15c1 1.2 2.4 2 4 2s3-.8 4-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" /></svg>),
];

export default function KidsSpeech() {
  const K = KIDS_SPEECH;
  const tel = () => (window.location.href = `tel:${LINKS.tel}`);
  const enroll = () => (window.location.href = LINKS.enroll);

  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">KIDS / TEEN</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">발표력 향상 (발표 스피치)</h1>
      </div>

      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-6 text-2xl font-bold text-slate-800">
            발표 스피치<span className="text-seum-blue">란?</span>
          </h2>
          <p className="leading-relaxed text-slate-600">{K.intro}</p>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            어떤 친구에게 <span className="text-seum-blue">필요할까요?</span>
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {K.targets.map((t, i) => {
              const Icon = TargetIcons[i] || TargetIcons[0];
              return (
                <div key={i} className="flex items-start gap-5 rounded-2xl bg-white p-7 shadow-sm">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-seum-blue/10 text-seum-blue">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-bold text-seum-navy">{t.catch}</h3>
                    <p className="text-sm leading-relaxed text-slate-500">{t.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-100 p-8 shadow-sm">
            <div className="mb-4 inline-block rounded-full bg-seum-blue/10 px-4 py-1.5 text-sm font-bold text-seum-blue">과정 특징</div>
            <p className="leading-relaxed text-slate-600">{K.feature}</p>
          </div>
          <div className="rounded-3xl bg-seum-navy p-8 text-white shadow-sm">
            <div className="mb-4 inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold text-sky-200">학습 목표</div>
            <p className="text-xl font-bold leading-relaxed">{K.goal}</p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            수업 후, <span className="text-seum-blue">이렇게 달라집니다</span>
          </h2>
          <p className="mb-12 text-center text-slate-500">실제 수강생들에게 나타나는 변화입니다.</p>
          <div className="space-y-4">
            {K.changes.map((c, i) => (
              <div key={i} className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <div className="flex-1 rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
                  <span className="mb-1 block text-xs font-bold text-slate-400">Before</span>
                  {c.before}
                </div>
                <div className="flex flex-shrink-0 items-center justify-center text-seum-blue">
                  <span className="text-2xl sm:hidden">↓</span>
                  <span className="hidden text-2xl sm:block">→</span>
                </div>
                <div className="flex-1 rounded-2xl bg-seum-blue p-5 text-sm font-medium text-white shadow-sm">
                  <span className="mb-1 block text-xs font-bold text-sky-200">After</span>
                  {c.after}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            단계별 <span className="text-seum-blue">커리큘럼</span>
          </h2>
          <div className="space-y-5">
            {K.curriculum.map((c, i) => (
              <div key={i} className="flex gap-5 rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-seum-navy text-sm font-bold text-white">
                  {i + 1}
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-seum-blue">{c.step}</span>
                    <h3 className="text-lg font-bold text-slate-800">{c.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-500">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-seum-navy py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-white md:text-3xl">
            세움스피치는 <span className="text-sky-300">이렇게 다릅니다</span>
          </h2>
          <p className="mb-12 text-center text-white/60">아이의 변화를 만드는 세움만의 수업 방식</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {K.how.map((h, i) => (
              <div key={i} className="rounded-2xl bg-white/5 p-6 text-center backdrop-blur">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl">
                  {h.icon === "group" ? "👥" : h.icon === "camera" ? "🎥" : h.icon === "heart" ? "💛" : "📋"}
                </div>
                <h3 className="mb-2 font-bold text-white">{h.title}</h3>
                <p className="text-xs leading-relaxed text-white/60">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            자주 묻는 <span className="text-seum-blue">질문</span>
          </h2>
          <div className="space-y-4">
            {K.faq.map((f, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 p-6">
                <p className="mb-2 flex items-start gap-2 font-bold text-slate-800">
                  <span className="text-seum-blue">Q.</span> {f.q}
                </p>
                <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-500">
                  <span className="font-bold text-slate-400">A.</span> {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-3xl bg-slate-50 px-8 py-12 text-center">
            <h2 className="mb-3 text-2xl font-bold text-slate-800">우리 아이의 시작, 세움스피치와 함께하세요</h2>
            <p className="mb-7 text-slate-500">당당하고 자신감 있는 말하기, 지금 시작할 수 있습니다.</p>
            <div className="flex justify-center gap-3">
              <button onClick={tel} className="rounded-xl border border-slate-300 px-8 py-3.5 text-sm font-semibold text-slate-700 hover:bg-white">
                상담 문의
              </button>
              <button onClick={enroll} className="rounded-xl bg-seum-blue px-8 py-3.5 text-sm font-bold text-white hover:bg-[#2a63c4]">
                수강신청 바로가기
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}