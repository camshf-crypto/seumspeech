import { ONEONONE, LINKS } from "../config";

const TargetIcons = [
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" /><path d="M5 20a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M21 11.5a8.38 8.38 0 01-9 8.5 8.5 8.5 0 01-3.8-.9L3 20l1.9-5.2A8.5 8.5 0 1121 11.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>),
];

export default function OneOnOne() {
  const O = ONEONONE;
  const tel = () => (window.location.href = `tel:${LINKS.tel}`);
  const enroll = () => (window.location.href = LINKS.enroll);

  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">SPECIAL COURSE</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">1:1 과정</h1>
      </div>

      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-6 text-2xl font-bold text-slate-800">
            1:1 과정<span className="text-seum-blue">이란?</span>
          </h2>
          <p className="leading-relaxed text-slate-600">{O.intro}</p>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            1:1 과정 <span className="text-seum-blue">교육 대상</span>
          </h2>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-5">
            {O.targets.map((t, i) => {
              const Icon = TargetIcons[i] || TargetIcons[0];
              return (
                <div key={i} className="rounded-2xl bg-white p-6 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-seum-blue/10 text-seum-blue">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-2 font-bold text-slate-800">{t.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-500">{t.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            1:1 과정 <span className="text-seum-blue">커리큘럼</span>
          </h2>
          <div className="space-y-4">
            {O.curriculum.map((c, i) => (
              <div key={i} className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-6 sm:flex-row sm:items-center">
                <div className="flex flex-shrink-0 items-center gap-4 sm:w-48">
                  <span className="flex h-10 w-14 items-center justify-center rounded-lg bg-seum-navy text-sm font-bold text-white">
                    {c.step}
                  </span>
                  <h3 className="text-lg font-bold text-slate-800">{c.title}</h3>
                </div>
                <ul className="flex flex-1 flex-wrap gap-x-5 gap-y-2">
                  {c.points.map((p, j) => (
                    <li key={j} className="flex items-center gap-1.5 text-sm text-slate-600">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-seum-blue" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-seum-navy py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center text-white">
            <h2 className="mb-3 text-2xl font-bold md:text-3xl">1:1 개인지도 프로그램</h2>
            <p className="text-sky-200">효과를 높이는 밀착 코칭 수업</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {O.features.map((f, i) => (
              <div key={i} className="rounded-2xl bg-white/5 p-6 backdrop-blur">
                <span className="text-2xl font-extrabold text-sky-300">{f.no}.</span>
                <h3 className="mb-2 mt-3 text-lg font-bold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/60">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center gap-3">
            <button onClick={tel} className="rounded-xl border border-white/30 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10">
              상담 문의 바로가기
            </button>
            <button onClick={enroll} className="rounded-xl bg-seum-blue px-8 py-3.5 text-sm font-bold text-white hover:bg-[#2a63c4]">
              수강신청 바로가기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}