import { useState } from "react";
import { REVIEWS_PAGE, REVIEW_CATS, LINKS } from "../config";

function Stars() {
  return <span className="text-amber-400">★★★★★</span>;
}

const CAT_COLOR = {
  스피치: "bg-blue-100 text-seum-blue",
  보이스: "bg-emerald-100 text-emerald-600",
  면접: "bg-amber-100 text-amber-700",
  프레젠테이션: "bg-violet-100 text-violet-600",
};

export default function Reviews() {
  const [cat, setCat] = useState("전체");
  const go = () => (window.location.href = LINKS.enroll);

  const list = cat === "전체" ? REVIEWS_PAGE : REVIEWS_PAGE.filter((r) => r.cat === cat);

  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">COMMUNITY</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">수강후기</h1>
        <p className="mt-3 text-slate-500">생생한 수강 후기를 만나보세요.</p>
      </div>

      <section className="py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            {REVIEW_CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  cat === c ? "bg-seum-navy text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {list.map((r, i) => (
              <div key={i} className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex flex-1 flex-col">
                  {/* 상단: 카테고리 + 별점 */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CAT_COLOR[r.cat] || "bg-slate-100 text-slate-500"}`}>
                      {r.cat}
                    </span>
                    <Stars />
                  </div>

                  {/* 제목 */}
                  <h3 className="mb-2 text-lg font-bold leading-snug text-slate-800">{r.title}</h3>

                  {/* 본문 */}
                  <p className="mb-5 flex-1 text-sm leading-relaxed text-slate-600 line-clamp-4">{r.text}</p>

                  {/* 하단: 작성자 프로필 + 날짜 */}
                  <div className="mt-auto flex items-center gap-3 border-t border-slate-100 pt-4">
                    {r.img ? (
                      <img src={r.img} alt={r.name} className="h-14 w-14 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-seum-navy text-base font-bold text-white">
                        {r.name.charAt(0)}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {list.length === 0 && (
            <p className="py-16 text-center text-slate-400">해당 카테고리의 후기가 없습니다.</p>
          )}

          <div className="mt-14 rounded-3xl bg-seum-navy px-8 py-12 text-center">
            <h2 className="mb-3 text-2xl font-bold text-white">다음 합격 후기의 주인공은 당신입니다</h2>
            <p className="mb-7 text-white/70">세움스피치와 함께 확실한 변화를 시작하세요.</p>
            <button onClick={go} className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-seum-navy transition hover:bg-slate-100">
              수강신청 바로가기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}