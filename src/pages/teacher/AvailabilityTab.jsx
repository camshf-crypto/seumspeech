import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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

    // 내 1:1 담당 학생 (enrollments.teacher_id = 나, 1:1 수업)
    const { data: enr } = await supabase
      .from("enrollments")
      .select("id, student_id, remaining_sessions, total_sessions, courses(title, type), student:student_id(name)")
      .eq("teacher_id", user.id);
    const ones = (enr ?? []).filter((e) => e.courses?.type === "oneonone");

    // 내 수업 예약 (1:1 학생 + 단체반 둘 다)
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

    // 잔여 차감은 DB 트리거가 자동 처리함 (여기서 하지 않음)

    setLessonSaving(false);
    setLessonEnroll("");
    setLessonCourse("");
    setLessonMemo("");
    setLessonEndTime("15:00");
    load();
  };

  const removeLesson = async (id) => {
    if (!window.confirm("이 수업 예약을 삭제할까요?")) return;
    // 잔여 복구는 DB 트리거가 자동 처리함
    await supabase.from("lesson_bookings").delete().eq("id", id);
    load();
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  const selectedSlots = selectedDate ? slotsOnDate(selectedDate) : [];
  const selectedCourses = selectedDate ? coursesOnDate(selectedDate) : [];
  const selectedBookings = selectedDate ? bookingsOnDate(selectedDate) : [];

  return (
    <div>
      {/* 탭 */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("avail")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tab === "avail" ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
              if (d === null) return <div key={`empty-${idx}`} className="min-h-[120px]" />;
              const ds = dateStr(d);
              const wd = new Date(year, month, d).getDay();
              const daySlots = slotsOnDate(ds);
              const dayCourses = coursesOnDate(ds);
              const dayBookings = bookingsOnDate(ds);
              const isSelected = selectedDate === ds;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(ds)}
                  className={`min-h-[120px] rounded-lg border p-1.5 text-left align-top transition ${
                    isSelected ? "border-seum-blue bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className={`text-xs font-bold ${wd === 0 ? "text-red-400" : wd === 6 ? "text-blue-400" : "text-slate-600"}`}>{d}</span>
                  <div className="mt-1 space-y-0.5">
                    {/* 가능시간 (초록) */}
                    {daySlots.map((s) => (
                      <div key={s.id} className="truncate rounded bg-green-500/15 px-1 py-0.5 text-[9px] leading-tight text-green-700">
                        {s.start_time.slice(0, 5)}~{s.end_time.slice(0, 5)}
                        {s.branch?.name ? ` ${s.branch.name}` : ""}
                      </div>
                    ))}
                    {/* 단체반 정규수업 (파랑, 요일 고정) */}
                    {dayCourses.map((c) => (
                      <div key={c.id} className="truncate rounded bg-seum-blue/15 px-1 py-0.5 text-[9px] leading-tight text-seum-blue">
                        {c.start_time?.slice(0, 5)} {c.title}
                      </div>
                    ))}
                    {/* 예약된 수업 (파랑, 진하게) - 1:1 학생 또는 단체반 */}
                    {dayBookings.map((b) => (
                      <div key={b.id} className="truncate rounded bg-seum-blue/25 px-1 py-0.5 text-[9px] font-medium leading-tight text-seum-blue">
                        {b.start_time?.slice(0, 5)}{b.end_time ? `~${b.end_time.slice(0, 5)}` : ""} {b.student?.name ?? b.course?.title ?? "수업"}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">초록 = 가능시간 / 파랑 = 수업</p>
        </div>

        {/* 오른쪽: 선택한 날 */}
        <div className="lg:col-span-1">
          {!selectedDate ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-400">
              날짜를 선택하세요.
            </div>
          ) : tab === "avail" ? (
            /* ===== 내 가능시간 탭 ===== */
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h4 className="mb-3 font-bold text-seum-navy">
                  {month + 1}월 {Number(selectedDate.slice(-2))}일 ({WEEKDAYS[new Date(selectedDate).getDay()]}) 가능시간
                </h4>

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
                    <label className="mb-1 block text-xs text-slate-500">지점</label>
                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
                      <option value="">지점 선택 안 함</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">메모 (선택)</label>
                    <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 오전만 가능 / 특강 대비" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                  </div>
                  <button onClick={add} disabled={saving} className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60">
                    {saving ? "추가 중..." : "가능시간 추가"}
                  </button>
                </div>

                {selectedSlots.length === 0 ? (
                  <p className="text-sm text-slate-400">등록된 시간 없음</p>
                ) : (
                  <div className="space-y-2">
                    {selectedSlots.map((s) => (
                      <div key={s.id} className="flex items-start justify-between rounded-lg bg-green-50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-green-700">
                            {s.start_time.slice(0, 5)} ~ {s.end_time.slice(0, 5)}
                            {s.branch?.name ? <span className="ml-1.5 rounded bg-green-100 px-1.5 py-0.5 text-[11px] text-green-800">{s.branch.name}</span> : null}
                          </p>
                          {s.memo ? <p className="mt-0.5 text-xs text-slate-500">{s.memo}</p> : null}
                        </div>
                        <button onClick={() => remove(s.id)} className="ml-2 flex-shrink-0 text-xs text-slate-400 hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ===== 수업 스케줄 탭 ===== */
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h4 className="mb-3 font-bold text-seum-navy">
                  {month + 1}월 {Number(selectedDate.slice(-2))}일 ({WEEKDAYS[new Date(selectedDate).getDay()]}) 수업 잡기
                </h4>

                {/* 1:1 / 단체반 선택 */}
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

                <div className="mb-3 space-y-2">
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
                    <label className="mb-1 block text-xs text-slate-500">지점</label>
                    <select value={lessonBranch} onChange={(e) => setLessonBranch(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
                      <option value="">지점 선택 안 함</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">메모 (선택)</label>
                    <input value={lessonMemo} onChange={(e) => setLessonMemo(e.target.value)} placeholder="예: 모의면접 2회차" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                  </div>
                  <button onClick={addLesson} disabled={lessonSaving} className="w-full rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                    {lessonSaving ? "예약 중..." : "수업 잡기"}
                  </button>
                  <p className="text-xs text-slate-400">※ 수업을 잡으면 잔여 횟수가 1회 차감됩니다. (삭제 시 복구)</p>
                </div>

                {selectedBookings.length === 0 ? (
                  <p className="text-sm text-slate-400">잡힌 수업 없음</p>
                ) : (
                  <div className="space-y-2">
                    {selectedBookings.map((b) => (
                      <div key={b.id} className="flex items-start justify-between rounded-lg bg-blue-50 px-3 py-2">
                        <button onClick={() => openEdit(b)} className="min-w-0 flex-1 text-left">
                          <p className="text-sm font-medium text-seum-blue">
                            {b.start_time?.slice(0, 5)}{b.end_time ? `~${b.end_time.slice(0, 5)}` : ""} · {b.student?.name ?? b.course?.title ?? "수업"}
                            {b.course_id && !b.student_id ? <span className="ml-1 text-[11px] text-slate-400">(단체반)</span> : null}
                            {b.enrollment ? <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-seum-blue">{b.enrollment.remaining_sessions}/{b.enrollment.total_sessions}회</span> : null}
                            {b.branch?.name ? <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{b.branch.name}</span> : null}
                          </p>
                          {b.memo ? <p className="mt-0.5 text-xs text-slate-500">{b.memo}</p> : null}
                          <p className="mt-0.5 text-[11px] text-slate-400">클릭하여 수정</p>
                        </button>
                        <button onClick={() => removeLesson(b.id)} className="ml-2 flex-shrink-0 text-xs text-slate-400 hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 단체반 정규수업 (요일 고정, 참고 표시) */}
              {selectedCourses.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h4 className="mb-2 font-bold text-seum-navy">이 요일 정규 단체반</h4>
                  <div className="space-y-1.5">
                    {selectedCourses.map((c) => (
                      <div key={c.id} className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-seum-blue">
                        {c.start_time?.slice(0, 5)} · {c.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 예약 수정 팝업 */}
      {editBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditBooking(null)}>
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
              <label className="mb-1 block text-xs text-slate-500">지점</label>
              <select value={eBranch} onChange={(e) => setEBranch(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
                <option value="">지점 선택 안 함</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">메모 (선택)</label>
              <input value={eMemo} onChange={(e) => setEMemo(e.target.value)} placeholder="예: 모의면접 2회차" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
            </div>

            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={eSaving} className="flex-1 rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                {eSaving ? "저장 중..." : "수정 저장"}
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