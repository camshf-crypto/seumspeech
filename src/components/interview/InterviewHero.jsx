import { useSiteImage } from "../../lib/useSiteImage";
import { ITV_HERO } from "../../interviewConfig";

export default function InterviewHero() {
  const heroBg = useSiteImage("interview_heroBg");

  const go = (url) => {
    window.location.href = url;
  };

  return (
    <section className="relative overflow-hidden bg-seum-navy">
      {/* 사진을 자르지 않는다. 원본 비율대로 흐르게 두고 글씨를 그 위에 겹친다. */}
      {heroBg ? (
        <img src={heroBg} alt="" className="block h-auto w-full" />
      ) : (
        <div className="min-h-[520px] w-full bg-gradient-to-br from-seum-navy via-[#22356e] to-seum-blue" />
      )}

      {/* 글씨 가독성용 막.
          완전히 없애고 싶으면 아래 div 한 줄을 통째로 지우면 된다.
          글씨가 잘 안 보이면 숫자를 올릴 것 (15 → 25 → 40) */}
      <div className="absolute inset-0 bg-seum-navy/15" />

      {/* PC에서는 사진이 세로로 길어 글씨가 화면 아래로 밀리므로,
          가운데가 아니라 위쪽에 붙여 첫 화면에 버튼까지 다 보이게 한다 */}
      <div className="absolute inset-0 flex items-center md:items-start md:pt-[25vh]">
        {/* 모바일은 오른쪽 세로 상담 띠(약 56px)를 피하려고 오른쪽 여백을 더 준다 */}
        <div className="mx-auto w-full max-w-6xl pl-4 pr-20 text-right text-white sm:px-6">
          <span className="mb-2 inline-block rounded-full bg-seum-blue/90 px-2.5 py-0.5 text-[10px] font-bold tracking-wide sm:mb-5 sm:px-4 sm:py-1.5 sm:text-sm">
            {ITV_HERO.badge}
          </span>

          <h1 className="text-base font-black leading-tight drop-shadow sm:text-4xl md:text-5xl">
            {ITV_HERO.slogan1}
          </h1>
          <p className="mt-1 text-xs font-bold text-seum-blue drop-shadow sm:mt-3 sm:text-2xl md:text-3xl">
            <span className="text-white">역전</span>시키는 합격의 비결
          </p>

          <p className="ml-auto mt-6 hidden max-w-2xl text-sm leading-relaxed text-white/90 drop-shadow sm:block sm:text-base">
            {ITV_HERO.desc}
          </p>

          <div className="mt-8 hidden flex-wrap items-center justify-end gap-2.5 sm:flex">
            {["입시면접", "공무원면접", "공기업면접", "경력직면접"].map((f) => (
              <span
                key={f}
                className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm"
              >
                {f}
              </span>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 sm:mt-9 sm:gap-3">
            <button
              onClick={() => go("/consult")}
              className="bg-seum-blue px-3 py-1.5 text-[11px] font-bold text-white shadow-lg transition hover:bg-[#2a63c4] sm:px-7 sm:py-4 sm:text-base"
            >
              무료 상담 신청
            </button>
            <button
              onClick={() => go("/home")}
              className="border border-white/40 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/10 sm:px-7 sm:py-4 sm:text-base"
            >
              스피치 교육과정 →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}