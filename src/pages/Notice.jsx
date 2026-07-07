import { useState } from "react";
import { NOTICES, NOTICE_CATS } from "../config";

const CAT_COLOR = {
  공지: "bg-slate-100 text-slate-600",
  개강: "bg-blue-100 text-seum-blue",
  이벤트: "bg-rose-100 text-rose-600",
  휴강: "bg-amber-100 text-amber-700",
};

export default function Notice() {
  const [cat, setCat] = useState("전체");
  const [open, setOpen] = useState(null);

  const list = cat === "전체" ? NOTICES : NOTICES.filter((n) => n.cat === cat);
  const sorted = [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">COMMUNITY</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">공지사항</h1>
        <p className="mt-3 text-slate-500">세움스피치의 새로운 소식을 확인하세요.</p>
      </div>

      <section className="py-14">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {NOTICE_CATS.map((c) => (
              <button
                key={c}
                onClick={() => { setCat(c); setOpen(null); }}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  cat === c ? "bg-seum-navy text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            {sorted.map((n, i) => {
              const isOpen = open === i;
              return (
                <div key={i} className="border-b border-slate-100 last:border-b-0">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center gap-4 px-6 py-5 text-left transition hover:bg-slate-50"
                  >
                    {n.pinned && (
                      <span className="hidden flex-shrink-0 rounded bg-seum-navy px-2 py-0.5 text-xs font-bold text-white sm:inline">고정</span>
                    )}
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${CAT_COLOR[n.cat] || "bg-slate-100 text-slate-500"}`}>
                      {n.cat}
                    </span>
                    <span className="flex-1 font-semibold text-slate-800">{n.title}</span>
                    <span className="hidden flex-shrink-0 text-sm text-slate-400 sm:block">{n.date}</span>
                    <span className={`flex-shrink-0 text-slate-300 transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="bg-slate-50 px-6 py-5 text-sm leading-relaxed text-slate-600">
                      {n.body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sorted.length === 0 && (
            <p className="py-16 text-center text-slate-400">해당 카테고리의 공지가 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}