import { IMAGES, LINKS } from "../config";
import { Img } from "./common";

export default function Hero() {
  return (
    <section className="relative flex min-h-[88vh] items-center overflow-hidden pt-16">
      <Img
        src={IMAGES.heroBg}
        alt=""
        label="히어로 배경사진"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-seum-navy/80 via-seum-navy/45 to-transparent" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <p className="mb-3 text-xl font-light text-white/95 md:text-2xl">수학에 공식이 있다면</p>
        <h1 className="mb-10 text-4xl font-extrabold leading-tight text-white md:text-5xl">
          스피치에는 <span className="text-sky-300">패턴</span>이 있습니다!
        </h1>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={LINKS.online}
            className="group inline-flex items-center justify-between gap-6 rounded-md bg-white/10 px-7 py-4 text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            <span className="text-base font-semibold">온라인 문의하기</span>
            <span className="transition group-hover:translate-x-1">→</span>
          </a>
          <a
            href={LINKS.schedule}
            className="group inline-flex items-center justify-between gap-6 rounded-md bg-seum-blue px-7 py-4 text-white transition hover:bg-[#2a63c4]"
          >
            <span className="text-base font-semibold">개강일정 확인하기</span>
            <span className="transition group-hover:translate-x-1">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
