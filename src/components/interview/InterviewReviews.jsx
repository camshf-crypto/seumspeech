import { ITV_REVIEWS } from "../../interviewConfig";

export default function InterviewReviews() {
  return (
    <section className="bg-seum-navy py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center text-white">
          <p className="text-sm font-bold tracking-widest text-seum-blue">PASS REVIEW</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">합격으로 증명합니다</h2>
          <p className="mt-3 text-sm text-white/70 sm:text-base">
            세움면접 수강생들의 실제 최종 합격 결과입니다.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITV_REVIEWS.map((r, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm ring-1 ring-white/15"
            >
              <span className="inline-block rounded-full bg-seum-blue px-3 py-1 text-[11px] font-bold text-white">
                {r.field}
              </span>
              <p className="mt-4 text-lg font-black leading-snug text-white">{r.result}</p>
              <p className="mt-3 text-sm text-white/60">{r.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}