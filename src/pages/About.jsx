import { ABOUT } from "../config";
import { Img } from "../components/common";

const ICONS = [
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" /><path d="M5 20a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="7" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M2.5 19a4.5 4.5 0 019 0M12.5 19a4.5 4.5 0 019 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>),
  (p) => (<svg viewBox="0 0 24 24" fill="none" {...p}><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>),
];

export default function About() {
  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">ACADEMY</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">아카데미 소개</h1>
      </div>

      <section className="py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 md:grid-cols-2">
          <Img
            src={ABOUT.principalImg}
            alt="세움스피치 원장 김지윤"
            label="원장 사진"
            className="mx-auto h-[440px] w-full max-w-sm rounded-2xl object-cover object-top"
          />
          <div>
            <p className="mb-2 text-sm font-medium text-slate-400">세움스피치</p>
            <h2 className="mb-8 text-3xl font-extrabold leading-tight text-slate-800">
              “Definite Change<br />and Pleasure”
            </h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              {ABOUT.greeting.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-seum-navy py-24 text-center">
        <div className="mx-auto max-w-3xl px-6 text-white">
          <p className="text-xl font-medium leading-relaxed md:text-2xl">
            “말을 잘 못해서 고민이신가요?<br />
            스피치가 어려운 게 아니라<br />
            그동안 스피치를 제대로 배울 기회가 없었던 것입니다.”
          </p>
          <p className="mt-6 text-sm text-sky-200">- 세움스피치 -</p>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-14 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            세움스피치가 드리는 <span className="text-seum-blue">약속</span>
          </h2>
          <div className="divide-y divide-slate-100">
            {ABOUT.promises.map((p, i) => {
              const Icon = ICONS[i] || ICONS[0];
              return (
                <div key={i} className="flex items-start gap-6 py-8">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 text-seum-blue">
                    <Icon className="h-8 w-8" />
                  </div>
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
    </div>
  );
}