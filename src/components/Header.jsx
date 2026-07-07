import { useState } from "react";
import { IMAGES, LINKS, NAV } from "../config";
import { useAuth } from "../contexts/AuthContext";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mobileSub, setMobileSub] = useState(null);
  const { user, role, signOut } = useAuth();

  const go = (href) => {
    if (href && href !== "#") window.location.href = href;
  };

  const myPath =
    role === "master" ? "/admin" : role === "teacher" ? "/teacher" : "/my";

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/home";
  };

  return (
    <header
      className="fixed left-0 top-0 z-40 w-full bg-white shadow-sm"
      onMouseLeave={() => setHovered(false)}
    >
      {/* ───── 윗줄: 면접배너 + 로고 + 로그인 ───── */}
      <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-6">
        {/* 면접 교육과정 바로가기 배너 (왼쪽, 데스크탑) */}
        <button
          onClick={() => go(LINKS.interview)}
          className="hidden flex-shrink-0 items-center gap-3 transition hover:opacity-80 lg:ml-11 lg:flex"
        >
          {IMAGES.interviewBanner ? (
            <img src={IMAGES.interviewBanner} alt="면접 교육과정" className="h-12 w-auto" />
          ) : (
            <span className="flex h-12 w-16 items-center justify-center rounded-lg bg-slate-100 text-[9px] text-slate-400">사진</span>
          )}
          <span className="text-left leading-tight">
            <span className="block text-[15px] font-extrabold text-seum-blue">면접 교육과정</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">바로가기 <span className="text-sm">→</span></span>
          </span>
        </button>

        {/* 로고 (가운데) */}
        <button onClick={() => go("/home")} className="flex flex-shrink-0 items-center gap-2 lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:transform">
          {IMAGES.logo ? (
            <img src={IMAGES.logo} alt="세움스피치" className="h-10 w-auto" />
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded bg-seum-navy text-lg font-black text-white">
                M
              </span>
              <span className="leading-tight text-left">
                <span className="block text-[10px] tracking-widest text-slate-400">SEUM SPEECH</span>
                <span className="block text-xl font-bold text-seum-navy">세움스피치</span>
              </span>
            </>
          )}
        </button>

        {/* 오른쪽: 로그인 (데스크탑) */}
        <div className="hidden flex-shrink-0 items-center gap-5 md:flex">
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => go(myPath)}
                className="rounded-lg bg-seum-navy px-3 py-2 text-sm font-bold text-white hover:bg-[#24386f]"
              >
                {role === "master" ? "관리자" : role === "teacher" ? "강사실" : "내 강의실"}
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => go("/login")}
              className="rounded-lg border border-seum-blue px-4 py-2 text-sm font-bold text-seum-blue hover:bg-seum-blue hover:text-white"
            >
              로그인
            </button>
          )}
        </div>

        {/* 모바일 햄버거 */}
        <button
          className="flex h-10 w-10 items-center justify-center md:hidden"
          aria-label="메뉴 열기"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <div className="space-y-1.5">
            <span className="block h-0.5 w-6 bg-slate-800" />
            <span className="block h-0.5 w-6 bg-slate-800" />
            <span className="block h-0.5 w-6 bg-slate-800" />
          </div>
        </button>
      </div>

      {/* ───── 아랫줄: 메뉴 (데스크탑) ───── */}
      <nav
        className="hidden border-t border-slate-100 md:block"
        onMouseEnter={() => setHovered(true)}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-stretch justify-center px-6">
          {NAV.map((m, idx) => (
            <button
              key={m.label}
              onClick={() => go(m.href)}
              className={`flex flex-1 items-center justify-center whitespace-nowrap px-4 text-[15px] font-semibold text-slate-700 transition-colors hover:text-seum-blue ${
                idx !== 0 ? "border-l border-slate-100" : ""
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 대형 드롭다운 (데스크탑) */}
      <div
        className={`hidden overflow-hidden border-t border-slate-100 bg-white text-slate-700 shadow-lg transition-all duration-300 ease-out md:block ${
          hovered ? "max-h-[440px] opacity-100" : "pointer-events-none max-h-0 opacity-0"
        }`}
        onMouseEnter={() => setHovered(true)}
      >
        <div className="mx-auto flex max-w-5xl justify-center px-6 pb-10 pt-8">
          {NAV.map((m, idx) => (
            <ul
              key={m.label}
              className={`flex flex-1 flex-col items-center gap-5 px-4 ${
                idx !== 0 ? "border-l border-slate-200" : ""
              }`}
            >
              {m.sub?.map((s) => (
                <li key={s.label}>
                  <button
                    onClick={() => go(s.href)}
                    className="whitespace-nowrap text-[15px] font-medium text-slate-600 transition-colors hover:text-seum-blue"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <nav className="border-t border-slate-100 bg-white md:hidden">
          {/* 면접 교육과정 바로가기 (맨 위) */}
          <button
            onClick={() => go(LINKS.interview)}
            className="block w-full border-b border-slate-50 px-5 py-3.5 text-left text-sm font-bold text-seum-blue"
          >
            면접 교육과정 바로가기 →
          </button>

          {NAV.map((m, i) => (
            <div key={m.label} className="border-b border-slate-50">
              <button
                onClick={() => setMobileSub(mobileSub === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-700"
              >
                {m.label}
                <svg viewBox="0 0 24 24" className={`h-4 w-4 transition ${mobileSub === i ? "rotate-180" : ""}`} fill="none">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {mobileSub === i && (
                <ul className="bg-slate-50 pb-2">
                  {m.sub?.map((s) => (
                    <li key={s.label}>
                      <button
                        onClick={() => go(s.href)}
                        className="block w-full px-8 py-2.5 text-left text-sm text-slate-500"
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* 모바일 로그인 영역 */}
          {user ? (
            <>
              <button
                onClick={() => go(myPath)}
                className="block w-full border-b border-slate-50 px-5 py-3.5 text-left text-sm font-bold text-seum-blue"
              >
                {role === "master" ? "관리자" : role === "teacher" ? "강사실" : "내 강의실"}
              </button>
              <button
                onClick={handleLogout}
                className="block w-full px-5 py-3.5 text-left text-sm font-medium text-slate-500"
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              onClick={() => go("/login")}
              className="block w-full px-5 py-3.5 text-left text-sm font-bold text-seum-blue"
            >
              로그인
            </button>
          )}
        </nav>
      )}
    </header>
  );
}