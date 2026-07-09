import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const STATUS_LABEL = {
  new: "신규", scheduled: "방문예약", done: "상담완료",
  enrolled: "등록전환", dropped: "미등록종료",
};

// 출결 상태 뱃지 (보류=회색, 출석=초록, 결석=빨강, 지각=주황)
const ATTEND_BADGE = {
  present: { label: "출석", cls: "bg-green-100 text-green-700" },
  absent: { label: "결석", cls: "bg-red-100 text-red-600" },
  hold: { label: "보류", cls: "bg-slate-200 text-slate-500" },
  late: { label: "지각", cls: "bg-amber-100 text-amber-700" },
};

// enrollment별로 "그 시점 잔여" 계산 (보류 제외, 시간순 차감)
function computeRunningRemaining(allBookings) {
  const byEnr = {};
  (allBookings ?? []).forEach((b) => {
    if (!b.enrollment_id) return;
    (byEnr[b.enrollment_id] = byEnr[b.enrollment_id] || []).push(b);
  });
  const map = {};
  Object.values(byEnr).forEach((list) => {
    const sorted = [...list].sort((a, b) => {
      const da = `${a.date ?? ""} ${a.start_time ?? ""}`;
      const db = `${b.date ?? ""} ${b.start_time ?? ""}`;
      return da < db ? -1 : da > db ? 1 : 0;
    });
    const total = sorted[0]?.enrollment?.total_sessions ?? 0;
    let used = 0;
    sorted.forEach((b) => {
      const isHold = b.attended === "hold";
      if (!isHold) used += 1;
      map[b.id] = { isHold, total, remainAfter: isHold ? null : total - used };
    });
  });
  return map;
}

export default function AdminScheduleTab({ branchId }) {
  const [slots, setSlots] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [consults, setConsults] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickTeacher, setPickTeacher] = useState("all");
  const [selectedDate, setSelectedDate] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const load = async () => {
    setLoading(true);
    const { data: av } = await supabase
      .from("teacher_availability")
      .select("*, teacher:teacher_id(name), branch:branch_id(name)")
      .not("date", "is", null);
    const { data: cs } = await supabase
      .from("courses")
      .select("*, teacher:teacher_id(name)")
      .eq("type", "group")
      .eq("active", true);
    const { data: tc } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("role", "teacher");
    const { data: br } = await supabase.from("branches").select("*").order("sort_order");
    const { data: co } = await supabase
      .from("consultations")
      .select("*")
      .not("scheduled_at", "is", null);
    const { data: bk } = await supabase
      .from("lesson_bookings")
      .select("*, teacher:teacher_id(name), student:student_id(name), course:course_id(title), enrollment:enrollment_id(remaining_sessions, total_sessions, courses(title)), branch:branch_id(name)");
    setSlots(av ?? []);
    setCourses(cs ?? []);
    setTeachers(tc ?? []);
    setBranches(br ?? []);
    setConsults(co ?? []);
    setBookings(bk ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const branchName = (id) => branches.find((b) => b.id === id)?.name?.replace("점", "") ?? "";

  const { year, month } = cursor;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateStr = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const filterTeacher = (tid) => pickTeacher === "all" || tid === pickTeacher;

  const slotsOnDate = (ds) =>
    slots.filter((s) => s.date === ds && filterTeacher(s.teacher_id) && s.branch_id === branchId);
  const coursesOnDate = (ds) => {
    const wd = new Date(ds).getDay();
    return courses.filter(
      (c) => c.weekday === wd && c.branch_id === branchId && filterTeacher(c.teacher_id)
    );
  };
  const bookingsOnDate = (ds) =>
    bookings.filter((b) => b.date === ds && filterTeacher(b.teacher_id) && b.branch_id === branchId);
  const consultsOnDate = (ds) =>
    consults.filter((c) => {
      if (!c.scheduled_at) return false;
      const d = new Date(c.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return key === ds;
    });

  const consultTime = (ts) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const showConsult = (c) => {
    alert(
      `[방문상담]\n` +
      `이름: ${c.name || "-"}\n` +
      `연락처: ${c.phone || "-"}\n` +
      `일시: ${new Date(c.scheduled_at).toLocaleString("ko-KR")}\n` +
      `상태: ${STATUS_LABEL[c.status] || c.status}\n` +
      (c.needs ? `내용: ${c.needs}\n` : "") +
      (c.memo ? `메모: ${c.memo}` : "")
    );
  };

  // 예약 표시 텍스트: 시간 · 학생/반 · 수업명
  const bookingLabel = (b) => {
    const time = b.start_time?.slice(0, 5) ?? "";
    const endTime = b.end_time ? `~${b.end_time.slice(0, 5)}` : "";
    const who = b.student?.name ?? b.course?.title ?? "수업";
    const courseTitle = (b.enrollment?.courses?.title ?? b.course?.title ?? "").replace("1:1 ", "");
    let txt = `${time}${endTime} ${who}`;
    if (courseTitle && b.student?.name) txt += ` ${courseTitle}`;
    return txt;
  };

  // 모든 1:1 예약의 "그 시점 잔여" 미리 계산
  const remainingMap = computeRunningRemaining(bookings);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    setSelectedDate(null);
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  };
  const nextMonth = () => {
    setSelectedDate(null);
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  // 셀 내 예약 색 (출결 상태별)
  const bookingCellCls = (b) =>
    b.attended === "hold" ? "bg-slate-200 text-slate-500"
    : b.attended === "present" ? "bg-green-500/25 text-green-700"
    : b.attended === "absent" ? "bg-red-500/25 text-red-600"
    : b.attended === "late" ? "bg-amber-500/25 text-amber-700"
    : "bg-seum-blue/25 text-seum-blue";
  const bookingMark = (b) =>
    b.attended === "hold" ? "[보류] "
    : b.attended === "present" ? "[출석] "
    : b.attended === "absent" ? "[결석] "
    : b.attended === "late" ? "[지각] "
    : "";

  // ===== 선택한 날짜 상세 (보기 전용) =====
  const selSlots = selectedDate ? slotsOnDate(selectedDate) : [];
  const selCourses = selectedDate ? coursesOnDate(selectedDate) : [];
  const selBookings = selectedDate ? bookingsOnDate(selectedDate) : [];
  const selConsults = selectedDate ? consultsOnDate(selectedDate) : [];

  const detailPanel = (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h4 className="mb-3 font-bold text-seum-navy">
        {month + 1}월 {Number(selectedDate?.slice(-2))}일 ({selectedDate ? WEEKDAYS[new Date(selectedDate).getDay()] : ""}) 일정
      </h4>

      {/* 방문상담 */}
      {selConsults.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-bold text-amber-600">방문상담</p>
          <div className="space-y-1.5">
            {selConsults.map((c) => (
              <button key={c.id} onClick={() => showConsult(c)}
                className="block w-full rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-100">
                🗓 {consultTime(c.scheduled_at)} · {c.name} ({STATUS_LABEL[c.status] || c.status})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 수업 예약 */}
      {selBookings.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-bold text-seum-blue">수업</p>
          <div className="space-y-1.5">
            {selBookings.map((b) => {
              const rm = remainingMap[b.id];
              const badge = b.attended ? ATTEND_BADGE[b.attended] : null;
              return (
                <div key={b.id} className="rounded-lg bg-blue-50 px-3 py-2 text-sm">
                  <p className="font-medium text-seum-blue">
                    {b.start_time?.slice(0, 5)}{b.end_time ? `~${b.end_time.slice(0, 5)}` : ""} · {b.student?.name ?? b.course?.title ?? "수업"}
                    {b.course_id && !b.student_id ? <span className="ml-1 text-[11px] text-slate-400">(단체반)</span> : null}
                    {badge ? <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span> : null}
                    {rm && rm.remainAfter != null ? (
                      <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-seum-blue">{rm.remainAfter}/{rm.total}회</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {b.teacher?.name ? `${b.teacher.name}쌤` : ""}
                    {b.branch?.name ? ` · ${b.branch.name}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 정규 단체반 */}
      {selCourses.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-bold text-seum-blue">정규 단체반</p>
          <div className="space-y-1.5">
            {selCourses.map((c) => (
              <div key={c.id} className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-seum-blue">
                {c.start_time?.slice(0, 5)} · {c.title}
                {c.teacher?.name ? <span className="ml-1.5 text-[11px] text-slate-400">{c.teacher.name}쌤</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {selConsults.length === 0 && selBookings.length === 0 && selCourses.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">이 날 일정이 없습니다.</p>
      )}
    </div>
  );

  return (
    <div>
      {/* 선생님 필터 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setPickTeacher("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${pickTeacher === "all" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          전체 선생님
        </button>
        {teachers.map((t) => (
          <button
            key={t.id}
            onClick={() => setPickTeacher(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${pickTeacher === t.id ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        {/* 달력 */}
        <div className="lg:col-span-2 lg:sticky lg:top-4">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={prevMonth} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">←</button>
            <h3 className="text-lg font-bold text-seum-navy">{year}년 {month + 1}월</h3>
            <button onClick={nextMonth} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">→</button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-xs font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, idx) => {
              if (d === null) return <div key={`empty-${idx}`} className="min-h-[110px]" />;
              const ds = dateStr(d);
              const wd = new Date(year, month, d).getDay();
              const daySlots = slotsOnDate(ds);
              const dayCourses = coursesOnDate(ds);
              const dayConsults = consultsOnDate(ds);
              const dayBookings = bookingsOnDate(ds);
              const isSelected = selectedDate === ds;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(ds)}
                  className={`flex min-h-[110px] w-full flex-col rounded-lg border p-1.5 text-left align-top transition ${
                    isSelected ? "border-seum-blue bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className={`text-xs font-bold ${wd === 0 ? "text-red-400" : wd === 6 ? "text-blue-400" : "text-slate-600"}`}>{d}</span>
                  <div className="mt-1 space-y-0.5">
                    {daySlots.map((s) => (
                      <div key={s.id} className="truncate rounded bg-purple-500/15 px-1 py-0.5 text-[9px] leading-tight text-purple-700">
                        {s.start_time.slice(0, 5)}~{s.end_time.slice(0, 5)}
                        {pickTeacher === "all" && s.teacher?.name && ` ${s.teacher.name}`}
                      </div>
                    ))}
                    {dayCourses.map((c) => (
                      <div key={c.id} className="truncate rounded bg-seum-blue/15 px-1 py-0.5 text-[9px] leading-tight text-seum-blue">
                        [{branchName(c.branch_id)}] {c.start_time?.slice(0, 5)} {c.title}
                      </div>
                    ))}
                    {dayBookings.map((b) => (
                      <div key={b.id} className={`truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight ${bookingCellCls(b)}`}>
                        {bookingMark(b)}
                        {b.branch?.name ? `[${b.branch.name.replace("점", "")}] ` : ""}
                        {bookingLabel(b)}
                        {(() => { const rm = remainingMap[b.id]; return rm && rm.remainAfter != null ? ` (${rm.remainAfter}/${rm.total})` : ""; })()}
                        {pickTeacher === "all" && b.teacher?.name ? ` ${b.teacher.name}쌤` : ""}
                      </div>
                    ))}
                    {dayConsults.map((c) => (
                      <div
                        key={c.id}
                        className="block w-full truncate rounded bg-amber-500/20 px-1 py-0.5 text-left text-[9px] leading-tight text-amber-700"
                      >
                        🗓 {consultTime(c.scheduled_at)} {c.name} 상담
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">보라 = 가능시간 / 파랑 = 수업 / 주황 = 방문상담 · 출석(초록) 결석(빨강) 보류(회색)</p>
        </div>

        {/* 오른쪽 상세 - 데스크탑 */}
        <div className="hidden lg:col-span-1 lg:block">
          {!selectedDate ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-400">
              날짜를 선택하세요.
            </div>
          ) : (
            detailPanel
          )}
        </div>
      </div>

      {/* 모바일 상세 - 팝업 */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:hidden"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="flex h-[85vh] w-full flex-col rounded-t-2xl bg-slate-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="font-bold text-seum-navy">
                {month + 1}월 {Number(selectedDate.slice(-2))}일 ({WEEKDAYS[new Date(selectedDate).getDay()]}) 일정
              </h3>
              <button onClick={() => setSelectedDate(null)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-500 hover:bg-white">
                닫기 ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detailPanel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}