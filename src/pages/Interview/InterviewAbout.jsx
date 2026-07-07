import { ITV_ABOUT } from "../../interviewConfig";
import { useSiteImage } from "../../lib/useSiteImage";

export default function InterviewAbout() {
  const go = (url) => { window.location.href = url; };
  const principalImg = useSiteImage("interview_principalImg");

  return (
    <div className="bg-white">
      {/* ───── 상단 타이틀 ───── */}
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">세움면접 소개</h1>
      </div>

      {/* ───── 합격률 강조 배너 ───── */}
      <section className="bg-seum-navy py-16">
        <div className="mx-auto max-w-4xl px-6 text-center text-white">
          <p className="text-sm font-bold tracking-widest text-seum-blue">{ITV_ABOUT.slogan}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="text-5xl font-black sm:text-6xl">{ITV_ABOUT.passRate}</span>
          </div>
          <p className="mt-3 text-base font-semibold text-white/80">{ITV_ABOUT.passLabel}</p>
        </div>
      </section>

      {/* ───── 원장 인사말 ───── */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-10 md:grid-cols-[300px_1fr]">
            <div>
              {principalImg ? (
                <img src={principalImg} alt="원장" className="h-96 w-full rounded-2xl object-cover" />
              ) : (
                <div className="flex h-96 w-full items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400">
                  원장 사진
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-seum-blue">세움면접</p>
              <h2 className="mt-2 text-2xl font-extrabold text-seum-navy">합격에는 이유가 있습니다</h2>
              <div className="mt-6 space-y-4">
                {ITV_ABOUT.greeting.map((g, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-600 sm:text-base">{g}</p>
                ))}
              </div>
              <div className="mt-8 rounded-2xl border-l-4 border-seum-blue bg-slate-50 p-6">
                <p className="text-base font-bold text-seum-navy">"{ITV_ABOUT.quote}"</p>
                <p className="mt-2 text-sm text-slate-400">- 세움면접 -</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── 통계 ───── */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {ITV_ABOUT.stats.map((s, i) => (
              <div key={i} className="rounded-2xl bg-white p-7 text-center shadow-sm">
                <p className="text-2xl font-black text-seum-blue sm:text-3xl">{s.num}</p>
                <p className="mt-2 text-sm font-semibold text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 세움면접의 약속 ───── */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-seum-navy sm:text-3xl">세움면접이 드리는 약속</h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
            {ITV_ABOUT.promises.map((p, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-7 transition hover:border-seum-blue hover:bg-white hover:shadow-lg"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-seum-navy text-base font-black text-white">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-seum-navy">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 하단 CTA ───── */}
      <section className="bg-seum-navy py-16">
        <div className="mx-auto max-w-3xl px-6 text-center text-white">
          <h2 className="text-2xl font-black sm:text-3xl">혼자서 면접을 준비하고 있나요?</h2>
          <p className="mt-4 text-sm text-white/70 sm:text-base">
            데이터 기반 합격 전략과 AI 면접 시뮬레이션, 세움면접이 합격까지 함께합니다.
          </p>
          <button
            onClick={() => go("/consult")}
            className="mt-8 rounded-xl bg-white px-8 py-4 text-base font-bold text-seum-navy shadow-lg transition hover:bg-slate-100"
          >
            무료 상담 신청하기
          </button>
        </div>
      </section>
    </div>
  );
}