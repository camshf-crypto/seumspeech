import { ITV_FIELDS } from "../../interviewConfig";

export default function InterviewFields() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="text-sm font-bold tracking-widest text-seum-blue">INTERVIEW FIELD</p>
          <h2 className="mt-2 text-2xl font-black text-seum-navy sm:text-3xl">면접 분야</h2>
          <p className="mt-3 text-sm text-slate-500 sm:text-base">
            분야별 전문 코치가 합격까지 책임집니다.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {ITV_FIELDS.map((f) => (
            <div
              key={f.key}
              className="group rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center transition hover:border-seum-blue hover:bg-white hover:shadow-lg"
            >
              <span className="inline-block rounded-full bg-seum-navy/5 px-3 py-1 text-[11px] font-bold text-seum-blue">
                {f.tag}
              </span>
              <h3 className="mt-4 text-lg font-extrabold text-seum-navy">{f.label}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}