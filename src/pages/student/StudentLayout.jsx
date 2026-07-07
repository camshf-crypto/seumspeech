import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import MaterialsTab from "./MaterialsTab";
import HomeworkTab from "./HomeworkTab";
import PaymentsTab from "./PaymentsTab";
import ChatTab from "./ChatTab";
import NotificationsTab from "./NotificationsTab";
import StudentInterviewTab from "./StudentInterviewTab";
import EnrollmentRequestForm from "./EnrollmentRequestForm";
import AbsenceRequestTab from "./AbsenceRequestTab";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const INTERVIEW_TITLES = ["1:1 공무원면접", "1:1 공기업면접", "1:1 사기업면접"];

const isExpired = (e) => {
  if (!e.expires_at) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(e.expires_at);
  exp.setHours(0, 0, 0, 0);
  return exp < today;
};

export default function StudentLayout() {
  const { profile, signOut } = useAuth();
  const [active, setActive] = useState("courses");
  const [menuOpen, setMenuOpen] = useState(false);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [hasRequest, setHasRequest] = useState(false);
  const [branches, setBranches] = useState([]);

  const loadStatus = async () => {
    setStatusLoading(true);
    const { data: prof } = await supabase.from("profiles").select("status").eq("id", profile.id).single();
    setStatus(prof?.status ?? "pending");
    const { data: reqs } = await supabase
      .from("enrollment_requests")
      .select("id")
      .eq("student_id", profile.id)
      .limit(1);
    setHasRequest((reqs ?? []).length > 0);
    const { data: brs } = await supabase.from("branches").select("id, name");
    setBranches(brs ?? []);
    setStatusLoading(false);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("enrollments")
      .select("*, courses(title, type, weekday, start_time, start_date), teacher:teacher_id(name)")
      .eq("student_id", profile.id);
    setEnrollments(data ?? []);
    setLoading(false);
  };

  const loadUnread = async () => {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null);
    setUnread(count ?? 0);
  };

  useEffect(() => {
    if (profile) loadStatus();
  }, [profile]);

  useEffect(() => {
    if (profile && status === "approved") {
      load();
      loadUnread();
    }
  }, [profile, status]);

  useEffect(() => {
    if (!profile || status !== "approved") return;
    const channel = supabase
      .channel(`notif-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        () => loadUnread()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, status]);

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/home";
  };

  const endDate = (startDate, total) => {
    if (!startDate || !total) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + (total - 1) * 7);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  const fmtDate = (ds) => {
    if (!ds) return "-";
    const d = new Date(ds);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  const hasInterview = enrollments.some((e) => INTERVIEW_TITLES.includes(e.courses?.title));

  const hasActive = enrollments.some((e) => !isExpired(e));
  const locked = enrollments.length > 0 && !hasActive;

  const MENUS = [
    { key: "courses", label: "수강 현황" },
    { key: "absence", label: "결석 신청" },
    { key: "materials", label: "자료 제출함" },
    { key: "homework", label: "숙제" },
    ...(hasInterview ? [{ key: "interview", label: "면접 수업" }] : []),
    { key: "chat", label: "선생님과 채팅" },
    { key: "payments", label: "결제내역" },
    { key: "notifications", label: "알림" },
  ];

  if (statusLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400">불러오는 중...</p>
      </div>
    );
  }

  const TopBar = () => (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <div>
          <p className="text-lg font-bold text-seum-navy">세움스피치</p>
          <p className="text-xs text-slate-400">{profile?.name}님</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => (window.location.href = "/home")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">홈으로</button>
          <button onClick={handleLogout} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">로그아웃</button>
        </div>
      </div>
    </header>
  );

  if (status !== "approved" && !hasRequest) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <EnrollmentRequestForm
            studentId={profile.id}
            studentName={profile.name}
            studentEmail={profile.email}
            branches={branches}
            onSubmitted={loadStatus}
          />
        </main>
      </div>
    );
  }

  if (status !== "approved" && hasRequest) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar />
        <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl">⏳</div>
          <h2 className="text-xl font-bold text-seum-navy">승인 대기 중입니다</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            가입 신청이 접수되었습니다. 원장님 승인 후 모든 기능을 이용하실 수 있습니다.
            승인까지 시간이 걸릴 수 있으니 잠시만 기다려주세요.
          </p>
          <button onClick={loadStatus} className="mt-6 rounded-lg bg-seum-blue px-5 py-2 text-sm font-bold text-white hover:bg-[#2a63c4]">
            승인 상태 새로고침
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
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
              <p className="text-lg font-bold text-seum-navy">내 강의실</p>
              <p className="text-xs text-slate-400">{profile?.name}님</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => (window.location.href = "/home")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">홈으로</button>
            <button onClick={handleLogout} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">로그아웃</button>
          </div>
        </div>

        <div className="mx-auto hidden max-w-3xl gap-2 overflow-x-auto px-4 pb-3 md:flex">
          {MENUS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className={`relative whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${active === m.key ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {m.label}
              {m.key === "notifications" && unread > 0 ? (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {unread}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {menuOpen ? (
          <div className="border-t border-slate-100 px-4 py-2 md:hidden">
            {MENUS.map((m) => (
              <button
                key={m.key}
                onClick={() => { setActive(m.key); setMenuOpen(false); }}
                className={`mb-1 flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm font-medium transition ${active === m.key ? "bg-seum-blue text-white" : "text-slate-600 hover:bg-slate-100"
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
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {locked && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-700">수강이 종료되었습니다</p>
            <p className="mt-0.5 text-xs text-slate-500">지난 자료는 계속 확인하실 수 있지만, 새로운 제출·전송은 재등록 후 이용하실 수 있습니다.</p>
          </div>
        )}

        {active === "courses" && (
          <div>
            <h2 className="mb-3 font-bold text-seum-navy">수강 현황</h2>
            {loading ? (
              <p className="text-slate-400">불러오는 중...</p>
            ) : enrollments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
                아직 수강 중인 반이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {enrollments.map((e) => {
                  const isGroup = e.courses?.type === "group";
                  const expired = isExpired(e);
                  return (
                    <div key={e.id} className={`rounded-xl border border-slate-200 bg-white p-5 ${expired ? "opacity-60" : ""}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-seum-navy">
                            {e.courses?.title}
                            <span className="ml-2 text-xs text-slate-400">{isGroup ? "단체반" : "1:1"}</span>
                            {expired ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">종료</span> : null}
                          </p>
                          {e.teacher?.name && (
                            <p className="mt-1 text-sm text-slate-500">담임 {e.teacher.name}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-seum-blue">{e.remaining_sessions}</p>
                          <p className="text-xs text-slate-400">/ {e.total_sessions}회 남음</p>
                        </div>
                      </div>

                      {e.expires_at ? (
                        <p className="mt-2 text-xs text-slate-400">수강 종료일 {fmtDate(e.expires_at)}</p>
                      ) : null}

                      {isGroup && (
                        <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                          <div className="flex justify-between">
                            <span className="text-slate-400">수업 시간</span>
                            <span>매주 {WEEKDAYS[e.courses?.weekday]}요일 {e.courses?.start_time?.slice(0, 5)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">개강일</span>
                            <span>{fmtDate(e.courses?.start_date)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">종료 예정</span>
                            <span>{endDate(e.courses?.start_date, e.total_sessions) ?? "-"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {active === "absence" && <AbsenceRequestTab studentId={profile.id} />}
        {active === "materials" && <MaterialsTab studentId={profile.id} locked={locked} />}
        {active === "homework" && <HomeworkTab studentId={profile.id} locked={locked} />}
        {active === "interview" && <StudentInterviewTab studentId={profile.id} locked={locked} />}
        {active === "chat" && <ChatTab studentId={profile.id} onRead={loadUnread} locked={locked} />}
        {active === "payments" && <PaymentsTab studentId={profile.id} />}
        {active === "notifications" && (
          <NotificationsTab userId={profile.id} onGoTab={(tab) => setActive(tab)} onRead={loadUnread} />
        )}
      </main>
    </div>
  );
}