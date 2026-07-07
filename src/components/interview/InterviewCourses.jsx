import { ITV_COURSES, ITV_FIELDS } from "../../interviewConfig";

const fieldLabel = (key) => ITV_FIELDS.find((f) => f.key === key)?.label ?? "";

export default function InterviewCourses() {
  const go = () => { window.location.href = "/consult"; };

  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="text-sm font-bold tracking-widest text-seum-blue">COURSE</p>
          <h2 className="mt-2 text-2xl font-black text-seum-navy sm:text-3xl">면접 교육과정</h2>
          <p className="mt-3 text-sm text-slate-500 sm:text-base">
            토론·집단면접은 그룹반으로 실전감 있게, 세밀한 코칭은 1:1로.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ITV_COURSES.map((c, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-seum-navy px-2.5 py-1 text-[11px] font-bold text-white">
                  {fieldLabel(c.field)}
                </span>
                <span
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                    c.type === "group"
                      ? "bg-seum-blue/10 text-seum-blue"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {c.type === "group" ? "단체반" : "1:1"}
                </span>
                {c.badge && (
                  <span className="ml-auto rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-500">
                    {c.badge}
                  </span>
                )}
              </div>

              <h3 className="mt-4 text-lg font-extrabold text-seum-navy">{c.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{c.desc}</p>

              <button
                onClick={go}
                className="mt-5 rounded-xl bg-seum-navy py-2.5 text-sm font-bold text-white transition hover:bg-[#24386f]"
              >
                상담 신청하기
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}