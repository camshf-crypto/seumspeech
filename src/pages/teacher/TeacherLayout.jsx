import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import AvailabilityTab from "./AvailabilityTab";
import AttendanceTab from "./AttendanceTab";
import TeacherHomeworkTab from "./TeacherHomeworkTab";
import TeacherChatTab from "./TeacherChatTab";
import TeacherNotificationsTab from "./TeacherNotificationsTab";
import TeacherSettlementTab from "./TeacherSettlementTab";
import StudentMaterialsView from "../../components/StudentMaterialsView";
import TeacherInterviewTab from "./TeacherInterviewTab";
import TeacherMyPageTab from "./TeacherMyPageTab";

export default function TeacherLayout() {
  const { profile, signOut } = useAuth();
  const [active, setActive] = useState("schedule");
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadUnread = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", profile.id)
      .is("read_at", null);
    setUnread(data ? data.length : 0);
  };

  useEffect(() => {
    if (profile) loadUnread();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`tnotif-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        () => loadUnread()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/home";
  };

  const MENUS = [
    { key: "schedule", label: "내 스케줄" },
    { key: "attendance", label: "출석 체크" },
    { key: "homework", label: "숙제 피드백" },
    { key: "interview", label: "1:1 면접수업" },
    { key: "materials", label: "학생 자료함" },
    { key: "chat", label: "학생 채팅" },
    { key: "notifications", label: "알림" },
    { key: "settlement", label: "수업 정산" },
    { key: "mypage", label: "마이페이지" },
  ];

  const current = MENUS.find((m) => m.key === active);

  const renderContent = () => {
    switch (active) {
      case "schedule":
        return <AvailabilityTab />;
      case "attendance":
        return <AttendanceTab />;
      case "homework":
        return <TeacherHomeworkTab teacherId={profile.id} />;
      case "interview":
        return <TeacherInterviewTab teacherId={profile.id} />;
      case "materials":
        return <StudentMaterialsView />;
      case "chat":
        return <TeacherChatTab teacherId={profile.id} onRead={loadUnread} />;
      case "notifications":
        return (
          <TeacherNotificationsTab
            userId={profile.id}
            onGoTab={(tab) => setActive(tab)}
            onRead={loadUnread}
          />
        );
      case "settlement":
        return <TeacherSettlementTab teacherId={profile.id} />;
      case "mypage":
        return <TeacherMyPageTab teacherId={profile.id} />;
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 데스크탑 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-lg font-bold text-seum-navy">세움스피치</p>
          <p className="text-xs text-slate-400">강사실</p>
        </div>

        <nav className="flex-1 px-3 py-4">
          {MENUS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm font-medium transition ${
                active === m.key
                  ? "bg-seum-blue text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{m.label}</span>
              {m.key === "notifications" && unread > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {unread}
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
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-8">
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
              {unread > 0 && !menuOpen ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              ) : null}
            </button>
            <div>
              <h1 className="text-lg font-bold text-seum-navy">{current?.label}</h1>
              <p className="text-xs text-slate-400">
                {profile?.name ?? "선생님"}님 환영합니다
              </p>
            </div>
          </div>
          <button
            onClick={() => (window.location.href = "/home")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 md:hidden"
          >
            홈
          </button>
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
                {m.key === "notifications" && unread > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {unread}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        ) : null}

        <main className="flex-1 p-4 md:p-8">{renderContent()}</main>
      </div>
    </div>
  );
}