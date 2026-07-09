import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 출결 상태 뱃지 (보류=회색, 출석=초록, 결석=빨강, 지각=주황)
const ATTEND_BADGE = {
  present: { label: "출석", cls: "bg-green-100 text-green-700" },
  absent: { label: "결석", cls: "bg-red-100 text-red-600" },
  hold: { label: "보류", cls: "bg-slate-200 text-slate-500" },
  late: { label: "지각", cls: "bg-amber-100 text-amber-700" },
};

// 전체 예약 목록에 대해 enrollment별로 "그 시점 잔여"를 계산해서 Map으로 반환
// 규칙: total에서 시작, 날짜·시간순 정렬, 보류(hold)는 차감 안 함, 나머지는 순서대로 1씩 차감
// 반환: { [bookingId]: { remainAfter: number|null, isHold: bool, total: number } }
function computeRunningRemaining(allBookings) {
  const byEnr = {};
  (allBookings ?? []).forEach((b) => {
    if (!b.enrollment_id) return; // 1:1만 (단체반은 enrollment 없음)
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
      map[b.id] = {
        isHold,
        total,
        remainAfter: isHold ? null : total - used,
      };
    });
  });
  return map;
}

export default function AvailabilityTab() {
  const { user } = useAuth();
  const [tab, setTab] = useState("avail"); // avail | lesson
  const [slots, setSlots] = useState([]);
  const [courses, setCourses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [oneStudents, setOneStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [mobileShowForm, setMobileShowForm] = useState(false); // 모바일 팝업에서 입력폼 표시 여부

  // 가능시간 폼
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("18:00");
  const [branchId, setBranchId] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  // 수업 예약 폼
  const [lessonKind, setLessonKind] = useState("one"); // one | group
  const [lessonEnroll, setLessonEnroll] = useState("");
  const [lessonCourse, setLessonCourse] = useState("");
  const [lessonTime, setLessonTime] = useState("14:00");
  const [lessonEndTime, setLessonEndTime] = useState("15:00");
  const [lessonBranch, setLessonBranch] = useState("");
  const [lessonMemo, setLessonMemo] = useState("");
  const [lessonSaving, setLessonSaving] = useState(false);

  // 예약 수정 팝업
  const [editBooking, setEditBooking] = useState(null);
  const [eTime, setETime] = useState("14:00");
  const [eEndTime, setEEndTime] = useState("15:00");
  const [eBranch, setEBranch] = useState("");
  const [eMemo, setEMemo] = useState("");
  const [eSaving, setESaving] = useState(false);

  const openEdit = (b) => {
    setEditBooking(b);
    setETime(b.start_time?.slice(0, 5) ?? "14:00");
    setEEndTime(b.end_time?.slice(0, 5) ?? "15:00");
    setEBranch(b.branch_id ?? "");
    setEMemo(b.memo ?? "");
  };

  const saveEdit = async () => {
    if (!editBooking) return;
    setESaving(true);
    const { error } = await supabase
      .from("lesson_bookings")
      .update({
        start_time: eTime,
        end_time: eEndTime || null,
        branch_id: eBranch || null,
        memo: eMemo.trim() || null,
      })
      .eq("id", editBooking.id);
    setESaving(false);
    if (error) return alert("수정 실패: " + error.message);
    setEditBooking(null);
    load();
  };

  const load = async () => {
    setLoading(true);
    const { data: av } = await supabase
      .from("teacher_availability")
      .select("*, branch:branch_id(name)")
      .eq("teacher_id", user.id)
      .not("date", "is", null)
      .order("date")
      .order("start_time");
    const { data: cs } = await supabase
      .from("courses")
      .select("*")
      .eq("teacher_id", user.id)
      .eq("type", "group")
      .eq("active", true);
    const { data: br } = await supabase
      .from("branches")
      .select("id, name")
      .order("name");

    const { data: enr } = await supabase
      .from("enrollments")
      .select("id, student_id, remaining_sessions, total_sessions, courses(title, type), student:student_id(name)")
      .eq("teacher_id", user.id);
    const ones = (enr ?? []).filter((e) => e.courses?.type === "oneonone");

    const { data: bk } = await supabase
      .from("lesson_bookings")
      .select("*, student:student_id(name), course:course_id(title), enrollment:enrollment_id(remaining_sessions, total_sessions), branch:branch_id(name)")
      .eq("teacher_id", user.id)
      .order("date")
      .order("start_time");

    setSlots(av ?? []);
    setCourses(cs ?? []);
    setBranches(br ?? []);
    setOneStudents(ones);
    setBookings(bk ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const { year, month } = cursor;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dateStr = (d) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const slotsOnDate = (ds) => slots.filter((s) => s.date === ds);
  const bookingsOnDate = (ds) => bookings.filter((b) => b.date === ds);
  const coursesOnDate = (ds) => {
    const wd = new Date(ds).getDay();
    return courses.filter((c) => c.weekday === wd);
  };

  // 모든 1:1 예약의 "그 시점 잔여" 미리 계산 (bookings 바뀔 때마다)
  const remainingMap = computeRunningRemaining(bookings);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    setSelectedDate(null);
    setCursor((c) =>
      c.month === 0
        ? { year: c.year - 1, month: 11 }
        : { year: c.year, month: c.month - 1 }
    );
  };
  const nextMonth = () => {
    setSelectedDate(null);
    setCursor((c) =>
      c.month === 11
        ? { year: c.year + 1, month: 0 }
        : { year: c.year, month: c.month + 1 }
    );
  };

  const add = async () => {
    if (!selectedDate) return;
    if (start >= end) {
      alert("종료 시간이 시작 시간보다 늦어야 합니다.");
      return;
    }

    const dayCourses = coursesOnDate(selectedDate);
    if (dayCourses.length > 0) {
      const ok = dayCourses.every((c) => {
        const ct = c.start_time?.slice(0, 5);
        return ct >= start && ct <= end;
      });
      if (!ok) {
        alert(
          "이 날은 단체반 수업이 있습니다. 수업 시작시간이 가능시간 범위 안에 포함되어야 합니다."
        );
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.from("teacher_availability").insert({
      teacher_id: user.id,
      date: selectedDate,
      weekday: new Date(selectedDate).getDay(),
      start_time: start,
      end_time: end,
      branch_id: branchId || null,
      memo: memo.trim() || null,
    });
    setSaving(false);
    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }
    setMemo("");
    setMobileShowForm(false);
    load();
  };

  const remove = async (id) => {
    await supabase.from("teacher_availability").delete().eq("id", id);
    load();
  };

  const addLesson = async () => {
    if (!selectedDate) return;

    let payload = {
      teacher_id: user.id,
      date: selectedDate,
      start_time: lessonTime,
      end_time: lessonEndTime || null,
      branch_id: lessonBranch || null,
      memo: lessonMemo.trim() || null,
    };

    if (lessonKind === "one") {
      if (!lessonEnroll) return alert("학생을 선택하세요.");
      const enr = oneStudents.find((e) => e.id === lessonEnroll);
      if (!enr) return alert("학생 정보를 찾을 수 없습니다.");
      payload.student_id = enr.student_id;
      payload.enrollment_id = enr.id;
      payload.course_id = null;
    } else {
      if (!lessonCourse) return alert("반을 선택하세요.");
      payload.course_id = lessonCourse;
      payload.student_id = null;
      payload.enrollment_id = null;
    }

    setLessonSaving(true);
    const { error } = await supabase.from("lesson_bookings").insert(payload);
    if (error) {
      setLessonSaving(false);
      alert("수업 예약 실패: " + error.message);
      return;
    }

    // 1:1 예약이면 잔여 차감: DB에서 최신값 읽어서 -1
    if (lessonKind === "one" && payload.enrollment_id) {
      const { data: fresh } = await supabase
        .from("enrollments")
        .select("remaining_sessions")
        .eq("id", payload.enrollment_id)
        .single();
      if (fresh && fresh.remaining_sessions > 0) {
        await supabase
          .from("enrollments")
          .update({ remaining_sessions: fresh.remaining_sessions - 1 })
          .eq("id", payload.enrollment_id);
      }
    }

    setLessonSaving(false);
    setLessonEnroll("");
    setLessonCourse("");
    setLessonMemo("");
    setLessonEndTime("15:00");
    setMobileShowForm(false);
    load();
  };

  const removeLesson = async (id) => {
    if (!window.confirm("이 수업 예약을 삭제할까요?")) return;
    const target = bookings.find((b) => b.id === id);
    await supabase.from("lesson_bookings").delete().eq("id", id);
    if (target && target.enrollment_id && target.student_id) {
      const { data: fresh } = await supabase
        .from("enrollments")
        .select("remaining_sessions, total_sessions")
        .eq("id", target.enrollment_id)
        .single();
      if (fresh && fresh.remaining_sessions < fresh.total_sessions) {
        await supabase
          .from("enrollments")
          .update({ remaining_sessions: fresh.remaining_sessions + 1 })
          .eq("id", target.enrollment_id);
      }
    }
    load();
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  const selectedSlots = selectedDate ? slotsOnDate(selectedDate) : [];
  const selectedCourses = selectedDate ? coursesOnDate(selectedDate) : [];
  const selectedBookings = selectedDate ? bookingsOnDate(selectedDate) : [];

  // ===== 조각 1: 입력폼 =====
  const availForm = (
    <div className="mb-3 space-y-2">
      <div className="flex items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">시작</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">종료</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">지점 <span className="text-red-500">*</span></label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
          <option value="">지점 선택 (필수)</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">메모 (선택)</label>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 오전만 가능 / 특강 대비" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
      </div>
      <button onClick={add} disabled={saving || !branchId} className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed">
        {saving ? "추가 중..." : !branchId ? "지점을 선택하세요" : "가능시간 추가"}
      </button>
    </div>
  );

  const availList = (
    selectedSlots.length === 0 ? (
      <p className="text-sm text-slate-400">등록된 시간 없음</p>
    ) : (
      <div className="space-y-2">
        {selectedSlots.map((s) => (
          <div key={s.id} className="flex items-start justify-between rounded-lg bg-purple-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-purple-700">
                {s.start_time.slice(0, 5)} ~ {s.end_time.slice(0, 5)}
                {s.branch?.name ? <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[11px] text-purple-800">{s.branch.name}</span> : null}
              </p>
              {s.memo ? <p className="mt-0.5 text-xs text-slate-500">{s.memo}</p> : null}
            </div>
            <button onClick={() => remove(s.id)} className="ml-2 flex-shrink-0 text-xs text-slate-400 hover:text-red-500">✕</button>
          </div>
        ))}
      </div>
    )
  );

  const lessonForm = (
    <div className="mb-3">
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setLessonKind("one")}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${lessonKind === "one" ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
        >
          1:1
        </button>
        <button
          onClick={() => setLessonKind("group")}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${lessonKind === "group" ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
        >
          단체반
        </button>
      </div>

      <div className="space-y-2">
        {lessonKind === "one" ? (
          <div>
            <label className="mb-1 block text-xs text-slate-500">학생 (1:1 담당)</label>
            <select value={lessonEnroll} onChange={(e) => setLessonEnroll(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
              <option value="">학생 선택...</option>
              {oneStudents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.student?.name} · {e.courses?.title?.replace("1:1 ", "")} (잔여 {e.remaining_sessions}/{e.total_sessions})
                </option>
              ))}
            </select>
            {oneStudents.length === 0 ? <p className="mt-1 text-xs text-amber-600">담당으로 배정된 1:1 학생이 없습니다.</p> : null}
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs text-slate-500">반 (담당 단체반)</label>
            <select value={lessonCourse} onChange={(e) => setLessonCourse(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
              <option value="">반 선택...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · 매주 {WEEKDAYS[c.weekday] ?? "-"} {c.start_time?.slice(0, 5) ?? ""}
                </option>
              ))}
            </select>
            {courses.length === 0 ? <p className="mt-1 text-xs text-amber-600">담당으로 지정된 단체반이 없습니다.</p> : null}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-slate-500">수업 시간</label>
          <div className="flex items-center gap-2">
            <input type="time" value={lessonTime} onChange={(e) => setLessonTime(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
            <span className="text-sm text-slate-400">~</span>
            <input type="time" value={lessonEndTime} onChange={(e) => setLessonEndTime(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">지점 <span className="text-red-500">*</span></label>
          <select value={lessonBranch} onChange={(e) => setLessonBranch(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
            <option value="">지점 선택 (필수)</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">메모 (선택)</label>
          <input value={lessonMemo} onChange={(e) => setLessonMemo(e.target.value)} placeholder="예: 모의면접 2회차" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
        </div>
        <button onClick={addLesson} disabled={lessonSaving || !lessonBranch} className="w-full rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60 disabled:cursor-not-allowed">
          {lessonSaving ? "예약 중..." : !lessonBranch ? "지점을 선택하세요" : "수업 잡기"}
        </button>
        <p className="text-xs text-slate-400">※ 수업을 잡으면 잔여 횟수가 1회 차감됩니다. (삭제 시 복구)</p>
      </div>
    </div>
  );

  const lessonList = (
    <>
      {selectedBookings.length === 0 ? (
        <p className="text-sm text-slate-400">잡힌 수업 없음</p>
      ) : (
        <div className="space-y-2">
          {selectedBookings.map((b) => {
            const rm = remainingMap[b.id];
            const badge = b.attended ? ATTEND_BADGE[b.attended] : null;
            return (
              <div key={b.id} className="flex items-start justify-between rounded-lg bg-blue-50 px-3 py-2">
                <button onClick={() => openEdit(b)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-seum-blue">
                    {b.start_time?.slice(0, 5)}{b.end_time ? `~${b.end_time.slice(0, 5)}` : ""} · {b.student?.name ?? b.course?.title ?? "수업"}
                    {b.course_id && !b.student_id ? <span className="ml-1 text-[11px] text-slate-400">(단체반)</span> : null}
                    {/* 출결 상태 뱃지 (보류/출석/결석/지각) */}
                    {badge ? <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span> : null}
                    {/* 그 시점 잔여 (1:1만) - 보류면 표시 안 함 */}
                    {rm && rm.remainAfter != null ? (
                      <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-seum-blue">{rm.remainAfter}/{rm.total}회</span>
                    ) : null}
                    {b.branch?.name ? <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{b.branch.name}</span> : null}
                  </p>
                  {b.memo ? <p className="mt-0.5 text-xs text-slate-500">{b.memo}</p> : null}
                  <p className="mt-0.5 text-[11px] text-slate-400">클릭하여 수정</p>
                </button>
                <button onClick={() => removeLesson(b.id)} className="ml-2 flex-shrink-0 text-xs text-slate-400 hover:text-red-500">✕</button>
              </div>
            );
          })}
        </div>
      )}
      {selectedCourses.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="mb-2 text-sm font-bold text-seum-navy">이 요일 정규 단체반</h4>
          <div className="space-y-1.5">
            {selectedCourses.map((c) => (
              <div key={c.id} className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-seum-blue">
                {c.start_time?.slice(0, 5)} · {c.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  // ===== 데스크탑용 통짜 패널 (폼 + 목록 항상 같이) =====
  const detailPanel = (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h4 className="mb-3 font-bold text-seum-navy">
          {month + 1}월 {Number(selectedDate?.slice(-2))}일 ({selectedDate ? WEEKDAYS[new Date(selectedDate).getDay()] : ""}) {tab === "avail" ? "가능시간" : "수업 잡기"}
        </h4>
        {tab === "avail" ? availForm : lessonForm}
        {tab === "avail" ? availList : lessonList}
      </div>
    </div>
  );

  return (
    <div>
      {/* 탭 */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("avail")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tab === "avail" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          내 가능시간
        </button>
        <button
          onClick={() => setTab("lesson")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tab === "lesson" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          수업 스케줄
        </button>
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
              if (d === null) return <div key={`empty-${idx}`} className="min-h-[80px] md:min-h-[120px]" />;
              const ds = dateStr(d);
              const wd = new Date(year, month, d).getDay();
              const daySlots = slotsOnDate(ds);
              const dayCourses = coursesOnDate(ds);
              const dayBookings = bookingsOnDate(ds);
              const isSelected = selectedDate === ds;
              return (
                <button
                  key={d}
                  onClick={() => { setSelectedDate(ds); setMobileShowForm(false); }}
                  className={`flex min-h-[80px] flex-col rounded-lg border p-1.5 text-left transition md:min-h-[120px] ${
                    isSelected ? "border-seum-blue bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  {/* 날짜 숫자 - 항상 맨 위 */}
                  <span className={`block text-xs font-bold leading-none ${wd === 0 ? "text-red-400" : wd === 6 ? "text-blue-400" : "text-slate-600"}`}>{d}</span>
                  <div className="mt-1 space-y-0.5">
                    {daySlots.map((s) => (
                      <div key={s.id} className="truncate rounded bg-purple-500/15 px-1 py-0.5 text-[9px] leading-tight text-purple-700">
                        {s.start_time.slice(0, 5)}~{s.end_time.slice(0, 5)}
                        {s.branch?.name ? ` ${s.branch.name}` : ""}
                      </div>
                    ))}
                    {dayCourses.map((c) => (
                      <div key={c.id} className="truncate rounded bg-seum-blue/15 px-1 py-0.5 text-[9px] leading-tight text-seum-blue">
                        {c.start_time?.slice(0, 5)} {c.title}
                      </div>
                    ))}
                    {dayBookings.map((b) => {
                      // 출결 상태에 따라 셀 색 구분 (보류=회색, 출석=초록, 결석=빨강, 지각=주황, 미처리=파랑)
                      const cellCls =
                        b.attended === "hold" ? "bg-slate-200 text-slate-500"
                        : b.attended === "present" ? "bg-green-500/25 text-green-700"
                        : b.attended === "absent" ? "bg-red-500/25 text-red-600"
                        : b.attended === "late" ? "bg-amber-500/25 text-amber-700"
                        : "bg-seum-blue/25 text-seum-blue";
                      const mark =
                        b.attended === "hold" ? "[보류] "
                        : b.attended === "present" ? "[출석] "
                        : b.attended === "absent" ? "[결석] "
                        : b.attended === "late" ? "[지각] "
                        : "";
                      return (
                        <div key={b.id} className={`truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight ${cellCls}`}>
                          {mark}{b.start_time?.slice(0, 5)}{b.end_time ? `~${b.end_time.slice(0, 5)}` : ""} {b.student?.name ?? b.course?.title ?? "수업"}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">보라 = 가능시간 / 파랑 = 수업 · 출석(초록) 결석(빨강) 보류(회색)</p>
        </div>

        {/* 오른쪽 상세 - 데스크탑(lg 이상)에서만 옆에 표시 */}
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

      {/* 모바일 상세 - 팝업(모달)으로 표시 (lg 미만) */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:hidden"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="flex h-[90vh] w-full flex-col rounded-t-2xl bg-slate-50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 (고정) */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="font-bold text-seum-navy">
                {month + 1}월 {Number(selectedDate.slice(-2))}일 ({WEEKDAYS[new Date(selectedDate).getDay()]})
                <span className="ml-1.5 text-xs font-normal text-slate-400">{tab === "avail" ? "가능시간" : "수업 스케줄"}</span>
              </h3>
              <button onClick={() => setSelectedDate(null)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-500 hover:bg-white">
                닫기 ✕
              </button>
            </div>

            {/* 내용 (스크롤) */}
            <div className="flex-1 overflow-y-auto p-4">
              {!mobileShowForm ? (
                <>
                  {/* 스케줄 목록 먼저 */}
                  {tab === "avail" ? availList : lessonList}

                  {/* 입력 버튼 */}
                  <button
                    onClick={() => setMobileShowForm(true)}
                    className={`mt-4 w-full rounded-lg px-4 py-3 text-sm font-bold text-white ${tab === "avail" ? "bg-purple-600 hover:bg-purple-700" : "bg-seum-blue hover:bg-[#2a63c4]"}`}
                  >
                    + {tab === "avail" ? "가능시간 입력" : "수업 스케줄 입력"}
                  </button>
                </>
              ) : (
                <>
                  {/* 입력폼 */}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-seum-navy">{tab === "avail" ? "가능시간 입력" : "수업 잡기"}</span>
                    <button onClick={() => setMobileShowForm(false)} className="text-xs text-slate-400 hover:text-slate-600">← 목록으로</button>
                  </div>
                  {tab === "avail" ? availForm : lessonForm}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 예약 수정 팝업 */}
      {editBooking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setEditBooking(null)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">수업 수정</h3>
              <button onClick={() => setEditBooking(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium text-seum-navy">
                {editBooking.student?.name ?? editBooking.course?.title ?? "수업"}
              </p>
              <p className="text-xs text-slate-400">{editBooking.date}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">수업 시간</label>
              <div className="flex items-center gap-2">
                <input type="time" value={eTime} onChange={(e) => setETime(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                <span className="text-sm text-slate-400">~</span>
                <input type="time" value={eEndTime} onChange={(e) => setEEndTime(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">지점 <span className="text-red-500">*</span></label>
              <select value={eBranch} onChange={(e) => setEBranch(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
                <option value="">지점 선택 (필수)</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">메모 (선택)</label>
              <input value={eMemo} onChange={(e) => setEMemo(e.target.value)} placeholder="예: 모의면접 2회차" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
            </div>

            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={eSaving || !eBranch} className="flex-1 rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60 disabled:cursor-not-allowed">
                {eSaving ? "저장 중..." : !eBranch ? "지점을 선택하세요" : "수정 저장"}
              </button>
              <button
                onClick={() => { removeLesson(editBooking.id); setEditBooking(null); }}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}