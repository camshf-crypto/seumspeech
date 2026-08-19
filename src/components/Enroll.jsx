import { useState } from "react";
import { COURSES } from "../config";

const CalIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const ClockIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 사진을 없앴으므로 동그란 뱃지 대신 카드 우상단에 작은 라벨로 표시
function Badge({ type }) {
  if (!type) return null;
  const isClosed = type === "마감";
  return (
    <span
      className={`absolute right-4 top-4 px-2.5 py-1 text-[11px] font-bold text-white ${
        isClosed ? "bg-slate-500" : "bg-[#7c4dcf]"
      }`}
    >
      {type}
    </span>
  );
}

export default function Enroll() {
  const [start, setStart] = useState(0);
  const perView = 4;
  const maxStart = Math.max(0, COURSES.length - perView);

  const prev = () => setStart((s) => Math.max(0, s - 1));
  const next = () => setStart((s) => Math.min(maxStart, s + 1));

  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-2 text-center text-sm text-slate-400">SEUM SPEECH CLASS</p>
        <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
          지금 바로 <span className="text-seum-blue">수강신청</span> 하세요
        </h2>

        <div className="relative">
          <button
            onClick={prev}
            disabled={start === 0}
            aria-label="이전"
            className="absolute -left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="overflow-hidden px-1 py-2">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${start * (100 / perView)}%)` }}
            >
              {COURSES.map((c, i) => (
                <div key={i} className="w-full flex-shrink-0 px-3 sm:w-1/2 md:w-1/4">
                  {/* 강사 사진 영역은 제거 — 강의 정보만 보여준다 */}
                  <div className="relative overflow-hidden bg-white shadow-sm transition hover:shadow-md">
                    <Badge type={c.badge} />

                    <div className="px-5 pb-6 pt-7">
                      <h3 className="mb-1 pr-16 text-lg font-bold text-slate-800">{c.title}</h3>
                      <p className="mb-4 text-sm text-slate-400">{c.teacher}</p>

                      <div className="mb-1 flex items-center gap-2 text-sm text-slate-600">
                        <CalIcon className="h-4 w-4 text-seum-blue" />
                        {c.period}
                      </div>
                      <div className="mb-5 flex items-center gap-2 text-sm text-slate-600">
                        <ClockIcon className="h-4 w-4 text-seum-blue" />
                        {c.time}
                      </div>

                      <button
                        onClick={() => (window.location.href = "/enroll")}
                        disabled={c.badge === "마감"}
                        className={`w-full py-2.5 text-sm font-semibold transition ${
                          c.badge === "마감"
                            ? "cursor-not-allowed bg-slate-200 text-slate-400"
                            : "bg-seum-navy text-white hover:bg-[#24386f]"
                        }`}
                      >
                        {c.badge === "마감" ? "마감되었습니다" : "수강신청"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={next}
            disabled={start >= maxStart}
            aria-label="다음"
            className="absolute -right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}