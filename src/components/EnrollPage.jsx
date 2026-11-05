import { useState, useEffect } from "react";
import { BRANCHES, CLASS_LIST, DETAIL, LINKS } from "../config";
import { useAuth } from "../contexts/AuthContext";

// 수강신청 버튼 (오프라인 /enroll · 온라인 /online/enroll 같이 씀)
//   학생으로 로그인됨 → 결제 페이지(/checkout)로 바로
//   로그인 전 → 로그인 / 회원가입 안내 창 (로그인하면 결제 페이지로 돌아옴)
// 온라인은 /online/checkout (온라인 화면 — 스피치 헤더·오른쪽 메뉴 없음), 오프라인은 /checkout
export const checkoutUrl = (type, name) =>
  type === "online"
    ? `/online/checkout?${new URLSearchParams({ class: name })}`
    : `/checkout?${new URLSearchParams({ type, class: name })}`;

export function useApply(type) {
  const { user, role } = useAuth();
  const [modal, setModal] = useState(null);
  const apply = (item) => {
    if (user && role === "student") window.location.href = checkoutUrl(type, item.name);
    else setModal(item);
  };
  const modalEl = modal && <ApplyModal item={modal} type={type} onClose={() => setModal(null)} />;
  return { apply, modalEl };
}

export function ApplyModal({ item, type, onClose }) {
  const { user, profile } = useAuth();
  const branchName = BRANCHES.find((b) => b.id === item.branch)?.name ?? "";

  // 회원가입하면 이 수업·지점이 미리 골라진 신청서로
  const joinUrl = () => {
    const n = item.name ?? "";
    const detail = /면접/.test(n) ? "면접반" : /보이스/.test(n) ? "보이스" : "스피치";
    return `/join?${new URLSearchParams({ branch: branchName, type: "group", detail, class: n })}`;
  };
  const loginUrl = () => `/login?${new URLSearchParams({ next: checkoutUrl(type, item.name) })}`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-seum-navy">수강신청</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <p className="mb-1 font-bold text-slate-800">{item.name}</p>
        {user ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
            학생 계정으로 로그인해야 신청할 수 있어요. (지금 로그인: {profile?.name ?? "관리자"})
          </p>
        ) : (
          <>
            <p className="mb-4 mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              수강신청은 로그인 후 할 수 있어요.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => (window.location.href = loginUrl())}
                className="rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4]">로그인</button>
              <button type="button" onClick={() => (window.location.href = joinUrl())}
                className="rounded-lg border border-seum-blue py-3 text-sm font-bold text-seum-blue hover:bg-blue-50">회원가입</button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">처음이시면 회원가입 후 바로 로그인할 수 있어요.</p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    마감임박: "bg-amber-100 text-amber-700",
    마감: "bg-slate-200 text-slate-500",
    수강신청: "bg-blue-100 text-seum-blue",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${map[status] || map["수강신청"]}`}>
      {status}
    </span>
  );
}

function Stars({ rating }) {
  return (
    <span className="text-amber-400">
      {"★".repeat(Math.round(rating))}
      <span className="text-slate-300">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

function Detail({ item, onBack }) {
  const [openFaq, setOpenFaq] = useState(null);
  const [openStep, setOpenStep] = useState(0);
  const [showBar, setShowBar] = useState(true);
  const { apply: applyFor, modalEl } = useApply("offline");

  useEffect(() => {
    const onScroll = () => {
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      setShowBar(docHeight - scrollBottom > 220);
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 수강신청 → 로그인 여부에 따라 로그인·회원가입 안내 또는 신청·결제 창
  const apply = () => applyFor(item);
  const closed = item.status === "마감";

  return (
    <div className="bg-slate-50 pb-32 pt-24">
      <div className="bg-white">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <button
            onClick={onBack}
            className="mb-6 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-seum-blue"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            목록으로
          </button>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-gradient-to-br from-seum-navy to-seum-blue text-white">
              <div className="text-center">
                <p className="text-sm opacity-70">SEUM SPEECH</p>
                <p className="mt-2 px-6 text-2xl font-bold">{item.name}</p>
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <div className="mb-3 flex items-center gap-2">
                <StatusBadge status={item.status} />
                <span className="text-sm text-slate-400">
                  <Stars rating={DETAIL.rating} /> ({DETAIL.reviewCount})
                </span>
              </div>
              <h1 className="mb-3 text-3xl font-extrabold text-slate-800">{item.name}</h1>
              <p className="mb-6 leading-relaxed text-slate-500">{DETAIL.tagline}</p>

              <div className="space-y-2 rounded-xl bg-slate-50 p-5 text-sm">
                <div className="flex">
                  <span className="w-24 font-semibold text-slate-400">수강기간</span>
                  <span className="font-medium text-slate-700">{item.period}</span>
                </div>
                <div className="flex">
                  <span className="w-24 font-semibold text-slate-400">수업시간</span>
                  <span className="font-medium text-slate-700">{item.time}</span>
                </div>
                <div className="flex">
                  <span className="w-24 font-semibold text-slate-400">담당강사</span>
                  <span className="font-medium text-slate-700">{item.teacher}</span>
                </div>
                <div className="flex">
                  <span className="w-24 font-semibold text-slate-400">수강료</span>
                  <span className="font-bold text-seum-blue">{item.price}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-6 pt-6">
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-800">🎁 수강생 혜택</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {DETAIL.benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 flex-shrink-0 text-seum-blue" fill="none">
                  <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-800">📋 커리큘럼</h2>
          <div className="space-y-3">
            {DETAIL.curriculum.map((c, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-slate-100">
                <button
                  onClick={() => setOpenStep(openStep === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-12 items-center justify-center rounded-md bg-seum-navy text-xs font-bold text-white">
                      {c.step}
                    </span>
                    <span className="font-bold text-slate-800">{c.title}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{c.time}</span>
                    <svg viewBox="0 0 24 24" className={`h-4 w-4 text-slate-400 transition ${openStep === i ? "rotate-180" : ""}`} fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                {openStep === i && (
                  <ul className="space-y-2 border-t border-slate-100 bg-slate-50 px-5 py-4 pl-20">
                    {c.points.map((p, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-seum-blue" />
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-800">🏷️ 수강 후기</h2>
          <div className="space-y-4">
            {DETAIL.bestReviews.map((r, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold text-slate-700">{r.name}</span>
                  <span className="text-xs text-slate-400">{r.ago}</span>
                </div>
                <div className="mb-2 text-sm"><Stars rating={5} /></div>
                <p className="text-sm leading-relaxed text-slate-600">{r.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-800">📌 자주 묻는 질문</h2>
          <div className="divide-y divide-slate-100">
            {DETAIL.faq.map((f, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between py-4 text-left"
                >
                  <span className="font-medium text-slate-700">Q. {f.q}</span>
                  <svg viewBox="0 0 24 24" className={`h-4 w-4 flex-shrink-0 text-slate-400 transition ${openFaq === i ? "rotate-180" : ""}`} fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {openFaq === i && (
                  <p className="pb-4 text-sm leading-relaxed text-slate-500">A. {f.a}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div
        className={`fixed bottom-0 left-0 z-30 w-full border-t border-slate-200 bg-white/95 backdrop-blur transition-transform duration-300 ${
          showBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="hidden sm:block">
            <p className="text-sm text-slate-400">{item.name}</p>
            <p className="text-lg font-bold text-seum-blue">{item.price}</p>
          </div>
          <div className="flex flex-1 gap-3 sm:flex-none">
            <button
              onClick={() => LINKS.tel && (window.location.href = `tel:${LINKS.tel}`)}
              className="flex-1 rounded-xl border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
            >
              전화상담
            </button>
            <button
              onClick={apply}
              disabled={closed}
              className={`flex-1 rounded-xl px-10 py-3.5 text-sm font-bold transition sm:flex-none ${
                closed ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-seum-blue text-white hover:bg-[#2a63c4]"
              }`}
            >
              {closed ? "마감되었습니다" : "수강신청 하기"}
            </button>
          </div>
        </div>
      </div>

      {modalEl}
    </div>
  );
}

export default function EnrollPage() {
  // 로그인하고 돌아오면 (/enroll?class=수업명) 그 수업 화면을 바로 연다
  const [detail, setDetail] = useState(() => {
    const name = new URLSearchParams(window.location.search).get("class");
    return name ? CLASS_LIST.find((c) => c.name === name) ?? null : null;
  });
  const [branch, setBranch] = useState(detail?.branch ?? BRANCHES[0].id);

  if (detail) return <Detail item={detail} onBack={() => setDetail(null)} />;

  const list = CLASS_LIST.filter((c) => c.branch === branch);

  return (
    <section className="min-h-screen bg-slate-50 pb-24 pt-28">
      <div className="mx-auto max-w-5xl px-6">
        <h1 className="mb-2 text-center text-3xl font-extrabold text-slate-800">수강신청</h1>
        <p className="mb-10 text-center text-slate-500">세움스피치학원의 개설 강의를 확인하고 바로 신청하세요.</p>

        <div className="mb-10 flex justify-center gap-2">
          {BRANCHES.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranch(b.id)}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                branch === b.id ? "bg-seum-navy text-white shadow" : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="hidden bg-slate-100 px-6 py-4 text-sm font-bold text-slate-500 md:grid md:grid-cols-[2fr_1.4fr_1.3fr_1fr_1fr] md:gap-4">
            <span>강의명</span>
            <span>수강기간</span>
            <span>수강시간</span>
            <span>강사명</span>
            <span className="text-center">신청</span>
          </div>

          {list.length === 0 ? (
            <p className="py-16 text-center text-slate-400">개설 예정 강의가 없습니다.</p>
          ) : (
            list.map((c, i) => (
              <button
                key={i}
                onClick={() => setDetail(c)}
                className="block w-full border-t border-slate-100 px-6 py-5 text-left transition hover:bg-slate-50 md:grid md:grid-cols-[2fr_1.4fr_1.3fr_1fr_1fr] md:items-center md:gap-4"
              >
                <span className="block font-bold text-slate-800">{c.name}</span>
                <span className="mt-1 block text-sm text-slate-500 md:mt-0">{c.period}</span>
                <span className="mt-1 block text-sm text-slate-500 md:mt-0">{c.time}</span>
                <span className="mt-1 block text-sm text-slate-500 md:mt-0">{c.teacher}</span>
                <span className="mt-2 block md:mt-0 md:text-center">
                  <StatusBadge status={c.status} />
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}