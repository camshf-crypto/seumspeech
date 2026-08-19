import { IMAGES } from "../config";
import { useSiteImages } from "../lib/useSiteImage";

// 콘텐츠 관리(스피치 사이트 → 인기 강좌) 슬롯과 연결
const LIST = [
  {
    slot: "course1",
    t: "논리적 대화의 스피치 심화",
    d: "대화를 논리적으로 풀어내어 설득력 높은 스피치 패턴을 완성합니다.",
    fallback: IMAGES.course1,
  },
  {
    slot: "course2",
    t: "실력향상 프레젠테이션",
    d: "발표 자료부터 전달까지, 설득력 있는 발표의 모든 것을 익힙니다.",
    fallback: IMAGES.course2,
  },
  {
    slot: "course3",
    t: "합격의 완성 1:1 면접",
    d: "기업·입시·공무원 면접을 1:1 맞춤으로 완벽하게 대비합니다.",
    fallback: IMAGES.course3,
  },
];

export default function Courses() {
  const { img } = useSiteImages();

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
          세움스피치학원의 <span className="text-seum-blue">인기 강좌</span>를 소개합니다.
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {LIST.map((c, i) => {
            // 콘텐츠 관리에서 올린 사진이 우선, 없으면 config.js
            const src = img(c.slot, "") || c.fallback;

            return (
              <a
                key={i}
                href="#"
                className="group overflow-hidden bg-slate-50 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                {/* 칸 비율을 4:3으로 고정해 세 장의 크기를 통일 */}
                <div className="aspect-[4/3] w-full bg-slate-100">
                  {src ? (
                    <img src={src} alt={c.t} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      강좌 {i + 1}
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="mb-2 text-lg font-bold text-slate-800">{c.t}</h3>
                  <p className="mb-5 text-sm leading-relaxed text-slate-500">{c.d}</p>
                  <span className="inline-block bg-seum-navy px-5 py-2 text-xs font-medium text-white">
                    강의 자세히 보기
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}