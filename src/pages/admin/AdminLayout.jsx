import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import DashboardTab from "./DashboardTab";
import CoursesTab from "./CoursesTab";
import StudentsTab from "./StudentsTab";
import TeachersTab from "./TeachersTab";
import AdminScheduleTab from "./AdminScheduleTab";
import ConsultTab from "./ConsultTab";
import InquiryAdminTab from "./InquiryAdminTab";
import PaymentsTab from "./PaymentsTab";
import AdminSettlementTab from "./AdminSettlementTab";
import ContentTab from "./ContentTab";
import TeacherProfileTab from "./TeacherProfileTab";
import StudentMaterialsView from "../../components/StudentMaterialsView";
import ApprovalTab from "./ApprovalTab";

const MENUS = [
  { key: "dashboard", label: "대시보드" },
  { key: "approval", label: "가입 승인" },
  { key: "courses", label: "반/수업 개설" },
  { key: "students", label: "수강생(수업) 관리" },
  { key: "materials", label: "학생 자료함" },
  { key: "teachers", label: "선생님 관리" },
  { key: "schedule", label: "전체 스케줄" },
  { key: "consult", label: "상담 관리" },
  { key: "inquiry", label: "1:1 문의(채팅)" },
  { key: "payments", label: "결제/환불" },
  { key: "settlement", label: "정산 관리" },
  { key: "content", label: "콘텐츠 관리" },
  { key: "teacherProfile", label: "강사 프로필" },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [active, setActive] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [inquiryCount, setInquiryCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("branches")
        .select("*")
        .order("sort_order");
      setBranches(data ?? []);
      if (data && data.length > 0) setBranchId(data[0].id);
    })();
    loadPendingCount();
    loadInquiryCount();
  }, []);

  const loadPendingCount = async () => {
    const { count } = await supabase
      .from("enrollment_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingCount(count ?? 0);
  };

  // 진행중인 1:1 문의 개수
  const loadInquiryCount = async () => {
    const { count } = await supabase
      .from("chat_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    setInquiryCount(count ?? 0);
  };

  // 새 문의 실시간 반영
  useEffect(() => {
    const ch = supabase
      .channel("admin-layout-inquiries")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_inquiries" }, () => loadInquiryCount())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/home";
  };

  const current = MENUS.find((m) => m.key === active);

  const renderContent = () => {
    switch (active) {
      case "dashboard":
        return <DashboardTab />;
      case "approval":
        return <ApprovalTab />;
      case "courses":
        return <CoursesTab branchId={branchId} />;
      case "students":
        return <StudentsTab branchId={branchId} />;
      case "materials":
        return <StudentMaterialsView />;
      case "teachers":
        return <TeachersTab branchId={branchId} />;
      case "schedule":
        return <AdminScheduleTab branchId={branchId} />;
      case "consult":
        return <ConsultTab branchId={branchId} />;
      case "inquiry":
        return <InquiryAdminTab />;
      case "payments":
        return <PaymentsTab branchId={branchId} />;
      case "settlement":
        return <AdminSettlementTab />;
      case "content":
        return <ContentTab />;
      case "teacherProfile":
        return <TeacherProfileTab />;
      default:
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
            <p className="text-slate-400">
              [{current?.label}] 화면은 다음 단계에서 만들 예정입니다.
            </p>
          </div>
        );
    }
  };

  const needsBranch =
    active !== "settlement" &&
    active !== "dashboard" &&
    active !== "content" &&
    active !== "teacherProfile" &&
    active !== "approval" &&
    active !== "inquiry" &&
    active !== "materials";

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 데스크탑 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-lg font-bold text-seum-navy">세움스피치</p>
          <p className="text-xs text-slate-400">원장 관리자</p>
        </div>

        <nav className="flex-1 px-3 py-4">
          {MENUS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-[13px] font-medium transition ${
                active === m.key
                  ? "bg-seum-blue text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{m.label}</span>
              {m.key === "approval" && pendingCount > 0 ? (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${active === m.key ? "bg-white text-seum-blue" : "bg-red-500 text-white"}`}>
                  {pendingCount}
                </span>
              ) : null}
              {m.key === "inquiry" && inquiryCount > 0 ? (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${active === m.key ? "bg-white text-seum-blue" : "bg-red-500 text-white"}`}>
                  {inquiryCount}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            onClick={() => (window.location.href = "/home")}
            className="mb-1 block w-full rounded-lg px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
          >
            ← 홈으로
          </button>
          <button
            onClick={handleLogout}
            className="block w-full rounded-lg px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <div className="flex w-full flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 햄버거 (모바일만) */}
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 md:hidden"
              >
                {menuOpen ? (
                  <span className="text-lg leading-none">✕</span>
                ) : (
                  <span className="flex flex-col gap-1">
                    <span className="block h-0.5 w-5 bg-slate-600" />
                    <span className="block h-0.5 w-5 bg-slate-600" />
                    <span className="block h-0.5 w-5 bg-slate-600" />
                  </span>
                )}
                {(pendingCount > 0 || inquiryCount > 0) && !menuOpen ? (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                ) : null}
              </button>
              <div>
                <h1 className="text-lg font-bold text-seum-navy">{current?.label}</h1>
                <p className="text-xs text-slate-400">
                  {profile?.name ?? "원장"}님 환영합니다
                </p>
              </div>
            </div>
            <button
              onClick={() => (window.location.href = "/home")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 md:hidden"
            >
              홈
            </button>
          </div>

          {needsBranch ? (
            <div className="mt-3 flex gap-2">
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBranchId(b.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    branchId === b.id
                      ? "bg-seum-navy text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {/* 모바일: 햄버거 펼침 메뉴 */}
        {menuOpen ? (
          <nav className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
            {MENUS.map((m) => (
              <button
                key={m.key}
                onClick={() => { setActive(m.key); setMenuOpen(false); }}
                className={`mb-1 flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm font-medium transition ${
                  active === m.key
                    ? "bg-seum-blue text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{m.label}</span>
                {m.key === "approval" && pendingCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {pendingCount}
                  </span>
                ) : null}
                {m.key === "inquiry" && inquiryCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {inquiryCount}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        ) : null}

        <main className="flex-1 p-4 md:p-8">
          {needsBranch ? (
            branchId ? (
              renderContent()
            ) : (
              <p className="text-slate-400">지점을 불러오는 중...</p>
            )
          ) : (
            renderContent()
          )}
        </main>
      </div>
    </div>
  );
}