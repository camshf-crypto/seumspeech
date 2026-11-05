import { IMAGES } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { useSiteImages } from "../lib/useSiteImage";
import { useApply } from "../components/EnrollPage";

// 온라인 화면 위쪽 얇은 바 — 로고(온라인 첫 화면으로) · 내 강의실 · 로그아웃 / 로그인
// 스피치 사이트 헤더·오른쪽 메뉴 대신 온라인 수강신청 · 결제 화면에서 같이 씀
export function OnlineTopBar() {
  const { user, role, signOut } = useAuth();
  const { img } = useSiteImages();
  const logoSrc = img("logo", IMAGES.logo || "");
  const myPath = role === "master" ? "/admin" : role === "teacher" ? "/teacher" : "/my";
  const here = window.location.pathname + window.location.search;
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <button type="button" onClick={() => (window.location.href = "/online")} className="flex items-center gap-2">
          {logoSrc ? <img src={logoSrc} alt="세움스피치" className="h-9 w-auto object-contain" /> : <span className="text-lg font-extrabold text-seum-navy">세움스피치</span>}
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-seum-blue">온라인</span>
        </button>
        {user ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => (window.location.href = myPath)}
              className="rounded-lg bg-seum-navy px-3 py-2 text-sm font-bold text-white hover:bg-[#24386f]">
              {role === "master" ? "관리자" : role === "teacher" ? "강사실" : "내 강의실"}
            </button>
            <button type="button" onClick={async () => { await signOut(); window.location.href = "/online"; }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
              로그아웃
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => (window.location.href = `/login?${new URLSearchParams({ next: here })}`)}
            className="rounded-lg border border-seum-blue px-4 py-2 text-sm font-bold text-seum-blue hover:bg-seum-blue hover:text-white">
            로그인
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 온라인 수업 수강신청 (/online/enroll) — 오프라인 지점 수업(/enroll)과 따로
 *
 * 온라인 스피치 단체반: 1시간 전체 강의 + 1시간 소회의실 실습(방마다 6명 · 강사 1명)
 * 수업을 늘리거나 날짜가 정해지면 아래 ONLINE_CLASSES 만 고치면 된다.
 * 신청 버튼 → 로그인 안 됐으면 로그인/회원가입, 로그인됐으면 결제하고 신청 (오프라인과 같은 창)
 */
export const ONLINE_CLASSES = [
  {
    name: "온라인 스피치 단체반 1기",
    place: "온라인 (화상 수업)",
    period: "2026년 11월 중순 개강 · 6주",
    time: "주 1회 2시간 (전체 강의 1시간 + 소그룹 실습 1시간)",
    teacher: "세움스피치 강사진",
    listPrice: "660,000원", // 정가 (줄 그어 보여 줌)
    price: "390,000원", // 실제 결제 금액
    seats: 30,
    status: "모집중", // 모집중 | 마감
    ticket: "6주 정규과정 수강권",
    thumb: "온라인\n스피치\n단체반",
  },
];

const STEPS = [
  { t: "전체 강의", d: "강사 1명이 1시간 동안 그 주의 핵심을 강의합니다." },
  { t: "소그룹 실습", d: "6명씩 방을 나눠, 방마다 강사 1명이 1시간 동안 직접 말하기를 지도합니다." },
  { t: "피드백 · 과제", d: "수업 후 내 발표 녹음 분석과 강사 피드백, 다음 주 과제가 강의실로 옵니다." },
];

export default function OnlineEnroll() {
  const { apply, modalEl } = useApply("online");

  return (
    <>
    <OnlineTopBar />
    <section className="min-h-screen bg-slate-50 pb-24 pt-12">
      <div className="mx-auto max-w-4xl px-6">
        <p className="mb-2 text-center text-sm font-bold text-seum-blue">ONLINE CLASS</p>
        <h1 className="mb-2 text-center text-3xl font-extrabold text-slate-800">온라인 수업 수강신청</h1>
        <p className="mb-10 text-center text-slate-500">어디서든 화상으로 듣는 세움스피치 단체반입니다.</p>

        {/* 수업 방식 */}
        <div className="mb-10 grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.t} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-1 text-xs font-bold text-seum-blue">STEP {i + 1}</p>
              <p className="mb-1 font-bold text-slate-800">{s.t}</p>
              <p className="text-sm leading-relaxed text-slate-500">{s.d}</p>
            </div>
          ))}
        </div>

        {/* 개설 수업 */}
        <div className="space-y-4">
          {ONLINE_CLASSES.map((c) => {
            const closed = c.status === "마감";
            return (
              <div key={c.name} className="rounded-2xl bg-white p-6 shadow-sm md:flex md:items-center md:justify-between md:gap-6">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${closed ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-seum-blue"}`}>
                      {c.status}
                    </span>
                    <span className="text-xs text-slate-400">정원 {c.seats}명</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800">{c.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{c.period}</p>
                  <p className="text-sm text-slate-500">{c.time}</p>
                  <p className="text-sm text-slate-500">{c.teacher}</p>
                </div>
                <div className="mt-4 shrink-0 text-right md:mt-0">
                  {c.listPrice && <p className="text-sm text-slate-400 line-through">{c.listPrice}</p>}
                  <p className="mb-2 text-xl font-extrabold text-seum-navy">{c.price}</p>
                  <button
                    type="button"
                    disabled={closed}
                    onClick={() => apply(c)}
                    className="w-full rounded-lg bg-seum-blue px-8 py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:bg-slate-300 md:w-auto"
                  >
                    {closed ? "마감되었습니다" : "수강신청 하기"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalEl}
    </section>
    </>
  );
}