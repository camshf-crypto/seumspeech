import { IMAGES, LINKS } from "../config";
import { useSiteImages } from "../lib/useSiteImage";

export default function Hero() {
  // 콘텐츠 관리(스피치 사이트 → 기본 → 메인 히어로 배경) 우선, 없으면 config
  const { img, loading } = useSiteImages();
  const heroSrc = img("heroBg", IMAGES.heroBg || "");

  // 사진 주소를 아직 불러오는 중 — 남색이나 흰 글씨가 번쩍이지 않도록
  // 자리만 잡아두고 아무것도 그리지 않는다.
  if (loading) {
    return <section className="pt-16"><div className="min-h-[70vh] w-full" /></section>;
  }

  return (
    <section className="pt-16">
      {/* 사진을 자르지 않는다.
          높이를 고정하지 않고 사진 원본 비율대로 흐르게 두어,
          세로로 길어지더라도 전체가 다 보이게 한다. */}
      <div className="relative w-full overflow-hidden">
        {heroSrc ? (
          <img src={heroSrc} alt="" className="block h-auto w-full" />
        ) : (
          <div className="min-h-[70vh] w-full bg-seum-navy" />
        )}

        {/* 글씨 가독성용 남색 막. 뿌옇게 느껴지면 아래 숫자를 더 낮출 것 (60 → 40 → 20) */}
        <div className="absolute inset-0 bg-gradient-to-r from-seum-navy/60 via-seum-navy/20 to-transparent" />

        {/* 사진 위에 겹치는 글씨 */}
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-6">
            <p className="mb-1 text-xs font-light text-white/95 drop-shadow sm:mb-3 sm:text-lg md:text-2xl">수학에 공식이 있다면</p>
            <h1 className="mb-3 text-base font-extrabold leading-tight text-white drop-shadow sm:mb-6 sm:text-4xl md:mb-10 md:text-5xl">
              스피치에는 <span className="text-sky-300">패턴</span>이 있습니다!
            </h1>

            <div className="flex flex-row gap-2 sm:gap-3">
              <a
                href={LINKS.online}
                className="group inline-flex items-center justify-between gap-1.5 bg-white/10 px-3 py-1.5 text-white backdrop-blur-sm transition hover:bg-white/20 sm:gap-6 sm:px-7 sm:py-4"
              >
                <span className="text-[11px] font-semibold sm:text-base">온라인 문의하기</span>
                <span className="transition group-hover:translate-x-1">→</span>
              </a>
              <a
                href={LINKS.schedule}
                className="group inline-flex items-center justify-between gap-1.5 bg-seum-blue px-3 py-1.5 text-white transition hover:bg-[#2a63c4] sm:gap-6 sm:px-7 sm:py-4"
              >
                <span className="text-[11px] font-semibold sm:text-base">개강일정 확인하기</span>
                <span className="transition group-hover:translate-x-1">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}