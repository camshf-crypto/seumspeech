import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 달력 칸 안의 일정 한 줄. (원장 화면과 같은 규칙)
// 지점을 맨 앞에 두고, 한 줄에 11자까지, 하루 4개까지만 그린다.
const CELL_MAX = 4;
const CELL_CHARS = 11;
const cut = (t) => {
  const v = String(t ?? "").trim();
  return v.length > CELL_CHARS ? v.slice(0, CELL_CHARS) : v;
};
const CELL_ITEM =
  "truncate whitespace-nowrap rounded px-0.5 py-px text-[9px] leading-[1.4] tracking-[-0.02em]";

const shortBranch = (name) => String(name ?? "").replace("점", "").slice(0, 2);

// 시간 버튼 (원장 화면과 같은 방식)
const MINUTES = [0, 10, 20, 30, 40, 50];
const AM_HOURS = [8, 9, 10, 11];
const PM_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const addMinutes = (hhmm, min) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const diffMinutes = (from, to) => {
  if (!from || !to) return 60;
  const [h1, m1] = from.split(":").map(Number);
  const [h2, m2] = to.split(":").map(Number);
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return d > 0 ? d : 60;
};

const label12 = (h) => (h === 12 ? "12" : h > 12 ? String(h - 12) : String(h));

// "HH:MM" 값을 오전/오후 · 시 · 분 버튼으로 고른다
function TimeButtons({ value, onChange }) {
  const [h, m] = (value || "14:00").split(":").map(Number);
  const isAm = h < 12;
  const on = "border-seum-blue bg-seum-blue text-white";
  const off = "border-slate-300 bg-white text-slate-600";
  const set = (hh, mm) =>
    onChange(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);

  return (
    <div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => set(AM_HOURS[0], m)}
          className={`flex-1 border py-1.5 text-xs font-bold ${isAm ? on : off}`}>
          오전
        </button>
        <button type="button" onClick={() => set(PM_HOURS[2], m)}
          className={`flex-1 border py-1.5 text-xs font-bold ${!isAm ? on : off}`}>
          오후
        </button>
      </div>

      <div className="mt-2 grid grid-cols-6 gap-1 border-t border-slate-100 pt-2">
        {(isAm ? AM_HOURS : PM_HOURS).map((hh) => (
          <button key={hh} type="button" onClick={() => set(hh, m)}
            className={`border py-1.5 text-xs font-bold ${h === hh ? on : off}`}>
            {label12(hh)}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-6 gap-1 border-t border-slate-100 pt-2">
        {MINUTES.map((mm) => (
          <button key={mm} type="button" onClick={() => set(h, mm)}
            className={`border py-1.5 text-xs font-bold ${m === mm ? on : off}`}>
            {String(mm).padStart(2, "0")}
          </button>
        ))}
      </div>
    </div>
  );
}

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

export default function AvailabilityTab() {
  const { user } = useAuth();
  const [tab, setTab] = useState("avail"); // avail | lesson — 화면 위에서 고른다
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

  // 일정 추가 팝업 (종류는 위 탭을 따른다)
  const [addDate, setAddDate] = useState(null);
  const [addBranch, setAddBranch] = useState("");
  const [addMemo, setAddMemo] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  // 가능시간
  const [aStart, setAStart] = useState("14:00");
  const [aEnd, setAEnd] = useState("18:00");
  // 수업
  const [lessonKind, setLessonKind] = useState("one"); // one | group
  const [lessonEnroll, setLessonEnroll] = useState("");
  const [lessonCourse, setLessonCourse] = useState("");
  const [lessonTime, setLessonTime] = useState("14:00");
  const [lessonLen, setLessonLen] = useState(60);
  const lessonEndTime = addMinutes(lessonTime, lessonLen);

  // 예약 수정 팝업
  const [editBooking, setEditBooking] = useState(null);
  const [eTime, setETime] = useState("14:00");
  const [eLen, setELen] = useState(60);
  const [eBranch, setEBranch] = useState("");
  const [eMemo, setEMemo] = useState("");
  const [eSaving, setESaving] = useState(false);
  const eEndTime = addMinutes(eTime, eLen);

  const openAdd = (ds) => {
    setAddDate(ds);
    setAddBranch(branches[0]?.id ?? "");
    setAddMemo("");
    setAStart("14:00");
    setAEnd("18:00");
    setLessonKind("one");
    setLessonEnroll("");
    setLessonCourse("");
    setLessonTime("14:00");
    setLessonLen(60);
  };

  const openEdit = (b) => {
    setEditBooking(b);
    const st = b.start_time?.slice(0, 5) ?? "14:00";
    setETime(st);
    setELen(diffMinutes(st, b.end_time?.slice(0, 5)));
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

  // 달력 셀에 붙이는 지점 이름 ("루원시티점" -> "루원시티")
  const branchName = (id) => branches.find((b) => b.id === id)?.name?.replace("점", "") ?? "";

  const slotsOnDate = (ds) => slots.filter((s) => s.date === ds);
  const bookingsOnDate = (ds) => bookings.filter((b) => b.date === ds);
  const coursesOnDate = (ds) => {
    const wd = new Date(ds).getDay();
    return courses.filter((c) => c.weekday === wd);
  };

  const remainingMap = computeRunningRemaining(bookings);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    setSelectedDate(null);
    setCursor((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }
    );
  };
  const nextMonth = () => {
    setSelectedDate(null);
    setCursor((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }
    );
  };

  // ===== 저장 =====
  const saveAvail = async () => {
    if (aStart >= aEnd) return alert("종료 시간이 시작 시간보다 늦어야 합니다.");

    const dayCourses = coursesOnDate(addDate);
    if (dayCourses.length > 0) {
      const ok = dayCourses.every((c) => {
        const ct = c.start_time?.slice(0, 5);
        return ct >= aStart && ct <= aEnd;
      });
      if (!ok) {
        return alert("이 날은 단체반 수업이 있습니다. 수업 시작시간이 가능시간 범위 안에 포함되어야 합니다.");
      }
    }

    setAddSaving(true);
    const { error } = await supabase.from("teacher_availability").insert({
      teacher_id: user.id,
      date: addDate,
      weekday: new Date(addDate).getDay(),
      start_time: aStart,
      end_time: aEnd,
      branch_id: addBranch || null,
      memo: addMemo.trim() || null,
    });
    setAddSaving(false);
    if (error) return alert("저장 실패: " + error.message);
    setAddDate(null);
    load();
  };

  const saveLesson = async () => {
    let payload = {
      teacher_id: user.id,
      date: addDate,
      start_time: lessonTime,
      end_time: lessonEndTime || null,
      branch_id: addBranch || null,
      memo: addMemo.trim() || null,
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

    setAddSaving(true);
    const { error } = await supabase.from("lesson_bookings").insert(payload);
    if (error) {
      setAddSaving(false);
      return alert("수업 예약 실패: " + error.message);
    }

    // 1:1 예약이면 잔여 차감
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

    setAddSaving(false);
    setAddDate(null);
    load();
  };

  const save = () => (tab === "avail" ? saveAvail() : saveLesson());

  const remove = async (id) => {
    await supabase.from("teacher_availability").delete().eq("id", id);
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

  const selSlots = selectedDate ? slotsOnDate(selectedDate) : [];
  const selCourses = selectedDate ? coursesOnDate(selectedDate) : [];
  const selBookings = selectedDate ? bookingsOnDate(selectedDate) : [];

  const SECTION = "border-t border-slate-200 pt-4";
  const LABEL = "mb-1.5 block text-xs font-bold text-slate-500";

  // ===== 선택한 날짜 상세 (목록만, 입력은 + 팝업) =====
  const detailPanel = (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-bold text-seum-navy">
          {month + 1}월 {Number(selectedDate?.slice(-2))}일 ({selectedDate ? WEEKDAYS[new Date(selectedDate).getDay()] : ""}) 일정
        </h4>
        <button
          type="button"
          onClick={() => openAdd(selectedDate)}
          title={tab === "avail" ? "가능시간 추가" : "수업 추가"}
          className={`flex h-7 w-7 items-center justify-center text-lg font-bold leading-none text-white ${
            tab === "avail" ? "bg-purple-600 hover:bg-purple-700" : "bg-seum-blue hover:bg-[#2a63c4]"
          }`}
        >
          +
        </button>
      </div>

      {/* 가능시간 */}
      {selSlots.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-bold text-purple-600">가능시간</p>
          <div className="space-y-1.5">
            {selSlots.map((s) => (
              <div key={s.id} className="flex items-start justify-between rounded-lg bg-purple-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-purple-700">
                    {s.start_time.slice(0, 5)} ~ {s.end_time.slice(0, 5)}
                    {s.branch?.name ? <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[11px] text-purple-800">{s.branch.name}</span> : null}
                  </p>
                  {s.memo ? <p className="mt-0.5 truncate text-xs text-slate-500" title={s.memo}>{s.memo}</p> : null}
                </div>
                <button onClick={() => remove(s.id)} className="ml-2 flex-shrink-0 text-xs text-slate-400 hover:text-red-500">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 수업 */}
      {selBookings.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-bold text-seum-blue">수업</p>
          <div className="space-y-1.5">
            {selBookings.map((b) => {
              const rm = remainingMap[b.id];
              const badge = b.attended ? ATTEND_BADGE[b.attended] : null;
              return (
                <div key={b.id} className="flex items-start justify-between rounded-lg bg-blue-50 px-3 py-2">
                  <button onClick={() => openEdit(b)} className="min-w-0 flex-1 text-left" title="누르면 시간 변경·삭제">
                    <p className="text-sm font-medium text-seum-blue">
                      {b.start_time?.slice(0, 5)}{b.end_time ? `~${b.end_time.slice(0, 5)}` : ""} · {b.student?.name ?? b.course?.title ?? "수업"}
                      {b.course_id && !b.student_id ? <span className="ml-1 text-[11px] text-slate-400">(단체반)</span> : null}
                      {badge ? <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span> : null}
                      {rm && rm.remainAfter != null ? (
                        <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-seum-blue">{rm.remainAfter}/{rm.total}회</span>
                      ) : null}
                    </p>
                    {b.memo ? <p className="mt-0.5 truncate text-xs text-slate-500">{b.memo}</p> : null}
                    <p className="mt-0.5 text-[11px] text-slate-400">{b.branch?.name ?? ""}</p>
                  </button>
                  <button onClick={() => removeLesson(b.id)} className="ml-2 flex-shrink-0 text-xs text-slate-400 hover:text-red-500">✕</button>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {selSlots.length === 0 && selBookings.length === 0 && selCourses.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">이 날 일정이 없습니다.</p>
      )}
    </div>
  );

  return (
    <div>
      {/* 탭 — 여기서 고른 종류로 + 버튼이 열린다 */}
      <div data-guide="t-sch-tabs" className="mb-4 flex gap-2">
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

          <div className="mb-1 grid grid-cols-7 gap-px sm:gap-1">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-xs font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"}`}>{d}</div>
            ))}
          </div>

          <div data-guide="t-sch-cal" className="grid grid-cols-7 gap-px sm:gap-1">
            {cells.map((d, idx) => {
              if (d === null) return <div key={`empty-${idx}`} className="min-h-[118px]" />;
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
                  className={`flex min-h-[118px] flex-col rounded-lg border p-1 text-left transition sm:p-1.5 ${
                    isSelected ? "border-seum-blue bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className={`block text-[13px] font-bold leading-none sm:text-xs ${wd === 0 ? "text-red-400" : wd === 6 ? "text-blue-400" : "text-slate-600"}`}>{d}</span>
                  <div className="mt-1 space-y-0.5">
                    {(() => {
                      // 이 날 일정을 한 줄짜리 항목으로 모은다
                      const items = [];
                      daySlots.forEach((s2) =>
                        items.push({
                          key: `s${s2.id}`,
                          cls: "bg-purple-500/15 text-purple-700",
                          text: `${shortBranch(s2.branch?.name)} ${s2.start_time.slice(0, 5)}`,
                        })
                      );
                      dayCourses.forEach((c) =>
                        items.push({
                          key: `c${c.id}`,
                          cls: "bg-seum-blue/15 text-seum-blue",
                          text: `${branchName(c.branch_id).slice(0, 2)} ${c.start_time?.slice(0, 5) ?? ""}`,
                        })
                      );
                      dayBookings.forEach((b) => {
                        const cellCls =
                          b.attended === "hold" ? "bg-slate-200 text-slate-500"
                          : b.attended === "present" ? "bg-green-500/25 text-green-700"
                          : b.attended === "absent" ? "bg-red-500/25 text-red-600"
                          : b.attended === "late" ? "bg-amber-500/25 text-amber-700"
                          : "bg-seum-blue/25 text-seum-blue";
                        items.push({
                          key: `b${b.id}`,
                          cls: cellCls,
                          text: `${shortBranch(b.branch?.name)} ${b.start_time?.slice(0, 5) ?? ""} ${b.student?.name ?? ""}`,
                        });
                      });

                      const shown = items.slice(0, CELL_MAX);
                      const more = items.length - shown.length;

                      return (
                        <>
                          {shown.map((it) => (
                            <div key={it.key} className={`${CELL_ITEM} ${it.cls}`}>
                              {cut(it.text)}
                            </div>
                          ))}
                          {more > 0 && (
                            <div className="px-1 text-[9px] font-bold leading-tight text-slate-400">
                              +{more}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">보라 = 가능시간 / 파랑 = 수업 · 출석(초록) 결석(빨강) 보류(회색)</p>
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
            <div className="flex-1 overflow-y-auto p-4">{detailPanel}</div>
          </div>
        </div>
      )}

      {/* ===== 일정 추가 팝업 ===== */}
      {addDate && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setAddDate(null)}>
          <div className="my-8 w-full max-w-md bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4">
              <h3 className="text-lg font-bold text-seum-navy">
                {addDate?.slice(5).replace("-", ".")} {tab === "avail" ? "가능시간 추가" : "수업 추가"}
              </h3>
              <button type="button" onClick={() => setAddDate(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {/* 수업 대상 */}
            {tab === "lesson" && (
              <div className={SECTION}>
                <label className={LABEL}>대상</label>
                <div className="mb-2 flex gap-1.5">
                  <button type="button" onClick={() => setLessonKind("one")}
                    className={`flex-1 border py-1.5 text-xs font-bold ${
                      lessonKind === "one" ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"
                    }`}>
                    1:1
                  </button>
                  <button type="button" onClick={() => setLessonKind("group")}
                    className={`flex-1 border py-1.5 text-xs font-bold ${
                      lessonKind === "group" ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"
                    }`}>
                    단체반
                  </button>
                </div>

                {lessonKind === "one" ? (
                  <>
                    <select value={lessonEnroll} onChange={(e) => setLessonEnroll(e.target.value)}
                      className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
                      <option value="">학생 선택...</option>
                      {oneStudents.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.student?.name} · {e.courses?.title?.replace("1:1 ", "")} (잔여 {e.remaining_sessions}/{e.total_sessions})
                        </option>
                      ))}
                    </select>
                    {oneStudents.length === 0 && <p className="mt-1 text-xs text-amber-600">담당으로 배정된 1:1 학생이 없습니다.</p>}
                  </>
                ) : (
                  <>
                    <select value={lessonCourse} onChange={(e) => setLessonCourse(e.target.value)}
                      className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
                      <option value="">반 선택...</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} · 매주 {WEEKDAYS[c.weekday] ?? "-"} {c.start_time?.slice(0, 5) ?? ""}
                        </option>
                      ))}
                    </select>
                    {courses.length === 0 && <p className="mt-1 text-xs text-amber-600">담당으로 지정된 단체반이 없습니다.</p>}
                  </>
                )}
              </div>
            )}

            {/* 지점 */}
            <div className={`${SECTION} ${tab === "lesson" ? "mt-4" : ""}`}>
              <label className={LABEL}>지점</label>
              <div className="flex gap-1.5">
                {branches.map((b) => (
                  <button key={b.id} type="button" onClick={() => setAddBranch(b.id)}
                    className={`flex-1 border py-2 text-sm font-bold transition ${
                      addBranch === b.id ? "border-seum-navy bg-seum-navy text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 시간 */}
            {tab === "avail" ? (
              <>
                <div className={`${SECTION} mt-4`}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500">시작</label>
                    <span className={`text-sm font-bold ${aStart >= aEnd ? "text-red-500" : "text-seum-blue"}`}>
                      {aStart} ~ {aEnd}
                    </span>
                  </div>
                  <TimeButtons value={aStart} onChange={setAStart} />
                </div>
                <div className={`${SECTION} mt-4`}>
                  <label className={LABEL}>종료</label>
                  <TimeButtons value={aEnd} onChange={setAEnd} />
                  {aStart >= aEnd && <p className="mt-1.5 text-xs text-red-500">종료가 시작보다 늦어야 합니다.</p>}
                </div>
              </>
            ) : (
              <div className={`${SECTION} mt-4`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">시간</label>
                  <span className="text-sm font-bold text-seum-blue">{lessonTime} ~ {lessonEndTime}</span>
                </div>
                <TimeButtons value={lessonTime} onChange={setLessonTime} />
                <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                  {[60, 90].map((m) => (
                    <button key={m} type="button" onClick={() => setLessonLen(m)}
                      className={`border px-3 py-1.5 text-xs font-bold ${lessonLen === m ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                      {m}분
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 메모 */}
            <div className={`${SECTION} mt-4`}>
              <label className={LABEL}>메모 (선택)</label>
              <input value={addMemo} onChange={(e) => setAddMemo(e.target.value)}
                placeholder={tab === "avail" ? "예: 오전만 가능" : "예: 모의면접 2회차"}
                className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
              {tab === "lesson" && (
                <p className="mt-2 text-xs text-slate-400">※ 수업을 잡으면 잔여 횟수가 1회 차감됩니다. (삭제 시 복구)</p>
              )}
            </div>

            {/* 저장 */}
            <div className={`${SECTION} mt-4`}>
              <button type="button" onClick={save} disabled={addSaving || !addBranch}
                className={`w-full py-3 text-sm font-bold text-white disabled:opacity-60 ${
                  tab === "avail" ? "bg-purple-600 hover:bg-purple-700" : "bg-seum-blue hover:bg-[#2a63c4]"
                }`}>
                {addSaving ? "저장 중..." : !addBranch ? "지점을 선택하세요" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 수업 수정 팝업 ===== */}
      {editBooking && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setEditBooking(null)}>
          <div className="my-8 w-full max-w-md bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4">
              <h3 className="text-lg font-bold text-seum-navy">수업 수정</h3>
              <button onClick={() => setEditBooking(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className={SECTION}>
              <label className={LABEL}>수업</label>
              <p className="text-sm font-bold text-seum-navy">
                {editBooking.student?.name ?? editBooking.course?.title ?? "수업"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">{editBooking.date}</p>
            </div>

            <div className={`${SECTION} mt-4`}>
              <label className={LABEL}>지점</label>
              <div className="flex gap-1.5">
                {branches.map((b) => (
                  <button key={b.id} type="button" onClick={() => setEBranch(b.id)}
                    className={`flex-1 border py-2 text-sm font-bold transition ${
                      eBranch === b.id ? "border-seum-navy bg-seum-navy text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            <div className={`${SECTION} mt-4`}>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500">시간</label>
                <span className="text-sm font-bold text-seum-blue">{eTime} ~ {eEndTime}</span>
              </div>
              <TimeButtons value={eTime} onChange={setETime} />
              <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                {[60, 90].map((m) => (
                  <button key={m} type="button" onClick={() => setELen(m)}
                    className={`border px-3 py-1.5 text-xs font-bold ${eLen === m ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                    {m}분
                  </button>
                ))}
              </div>
            </div>

            <div className={`${SECTION} mt-4`}>
              <label className={LABEL}>메모 (선택)</label>
              <input value={eMemo} onChange={(e) => setEMemo(e.target.value)} placeholder="예: 모의면접 2회차"
                className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
            </div>

            <div className={`${SECTION} mt-4 flex gap-2`}>
              <button onClick={saveEdit} disabled={eSaving || !eBranch}
                className="flex-1 bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                {eSaving ? "저장 중..." : !eBranch ? "지점을 선택하세요" : "수정 저장"}
              </button>
              <button
                onClick={() => { removeLesson(editBooking.id); setEditBooking(null); }}
                className="border border-red-200 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50"
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