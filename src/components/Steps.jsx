import { Ico } from "./common";

const STEPS = ["이해", "내면화", "생각 배열", "전달력", "목소리", "호흡 설계", "표현력", "실전 적용"];

export default function Steps() {
  return (
    <section className="relative overflow-hidden bg-seum-dark py-24 text-white">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <h2 className="mb-3 text-2xl font-bold md:text-3xl">
          차이를 만드는 세움스피치학원의 <span className="text-sky-300">8단계 학습법</span>
        </h2>
        <div className="mx-auto mb-14 mt-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-sky-300/60">
          <Ico.bulb className="h-7 w-7 text-sky-300" />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="mb-2 text-xs font-medium text-sky-300/80">STEP {i + 1}</span>
              <span className="text-lg font-bold">{s}</span>
            </div>
          ))}
        </div>

        <p className="mt-16 text-lg text-white/80">
          하나를 배우더라도 <span className="font-bold text-white">제대로 가르칩니다.</span>
        </p>
      </div>
    </section>
  );
}
