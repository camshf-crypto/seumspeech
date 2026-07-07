import { useSiteImage } from "../../lib/useSiteImage";
import { ITV_HERO } from "../../interviewConfig";

export default function InterviewHero() {
  const heroBg = useSiteImage("interview_heroBg");

  const go = (url) => {
    window.location.href = url;
  };

  return (
    <section className="relative flex min-h-[520px] items-center justify-center overflow-hidden bg-seum-navy">
      {heroBg ? (
        <img
          src={heroBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-seum-navy via-[#22356e] to-seum-blue" />
      )}

      <div className="absolute inset-0 bg-seum-navy/50" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-center text-white">
        <span className="mb-5 inline-block rounded-full bg-seum-blue/90 px-4 py-1.5 text-sm font-bold tracking-wide">
          {ITV_HERO.badge}
        </span>

        <h1 className="text-3xl font-black leading-tight sm:text-4xl md:text-5xl">
          {ITV_HERO.slogan1}
        </h1>
        <p className="mt-3 text-xl font-bold text-seum-blue sm:text-2xl md:text-3xl">
          <span className="text-white">역전</span>시키는 합격의 비결
        </p>

        <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
          {ITV_HERO.desc}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {["입시면접", "공무원면접", "공기업면접", "경력직면접"].map((f) => (
            <span
              key={f}
              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm"
            >
              {f}
            </span>
          ))}
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => go("/consult")}
            className="rounded-xl bg-seum-blue px-7 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-[#2a63c4]"
          >
            무료 상담 신청
          </button>
          <button
            onClick={() => go("/home")}
            className="rounded-xl border border-white/40 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
          >
            스피치 교육과정 →
          </button>
        </div>
      </div>
    </section>
  );
}