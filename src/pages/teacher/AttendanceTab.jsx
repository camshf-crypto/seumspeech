import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const OPTIONS = [
  { v: "present", label: "출석", c: "bg-green-500" },
  { v: "absent", label: "결석", c: "bg-red-500" },
  { v: "hold", label: "보류", c: "bg-slate-400" },
];

const STATUS_LABEL = {
  present: { label: "출석", c: "text-green-600 bg-green-50" },
  absent: { label: "결석", c: "text-red-600 bg-red-50" },
  hold: { label: "보류", c: "text-slate-500 bg-slate-100" },
  late: { label: "지각", c: "text-amber-600 bg-amber-50" },
};

const fmtDate = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate()
  ).padStart(2, "0")}`;
};

export default function AttendanceTab() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [courses, setCourses] = useState([]);
  const [enrollCount, setEnrollCount] = useState({});
  const [doneCourses, setDoneCourses] = useState({});
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [scheduleId, setScheduleId] = useState(null);

  // 1:1 수업 예약
  const [oneBookings, setOneBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [oneStatus, setOneStatus] = useState("present");
  const [oneRemain, setOneRemain] = useState(null);
  const [oneTotal, setOneTotal] = useState(null);

  const [historyStudent, setHistoryStudent] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 결석 신청 (담당 학생 pending)
  const [absenceReqs, setAbsenceReqs] = useState([]);
  const [absenceBusyId, setAbsenceBusyId] = useState(null);

  const weekNo = (startDate) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const cur = new Date(date);
    const diffDays = Math.floor((cur - start) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    return Math.floor(diffDays / 7) + 1;
  };

  // 담당 학생의 검토 대기 결석 신청 로드
  const loadAbsenceReqs = async () => {
    // 내 담당 학생(enrollment teacher_id = 나)
    const { data: enr } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("teacher_id", user.id);
    const myStudentIds = [...new Set((enr ?? []).map((e) => e.student_id))];
    if (myStudentIds.length === 0) {
      setAbsenceReqs([]);
      return;
    }
    const { data: reqs } = await supabase
      .from("absence_requests")
      .select("*, student:student_id(name), courses(title, branch:branch_id(name)), booking:booking_id(start_time, end_time)")
      .eq("status", "pending")
      .in("student_id", myStudentIds)
      .order("created_at", { ascending: false });
    setAbsenceReqs(reqs ?? []);
  };

  const approveAbsence = async (r) => {
    setAbsenceBusyId(r.id);

    // 1) 신청 인정 처리
    const { error } = await supabase
      .from("absence_requests")
      .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", r.id);

    if (error) {
      setAbsenceBusyId(null);
      return alert("처리 실패: " + error.message);
    }

    // 2) 1:1 예약이면 그 예약(booking_id) 하나만 보류(hold) 처리
    //    (횟수 remaining_sessions는 건드리지 않음 · 학생이 다른 날 다시 잡으면 됨)
    //    단체반이면 booking_id가 없으니 이 단계는 건너뜀
    if (r.booking_id) {
      await supabase
        .from("lesson_bookings")
        .update({ attended: "hold" })
        .eq("id", r.booking_id);
    }

    setAbsenceBusyId(null);
    alert(`${r.student?.name ?? "학생"}님의 결석을 인정 처리했습니다. (수업 보류 · 횟수 차감 안 됨)`);
    loadAbsenceReqs();
    loadCourses();
  };

  const rejectAbsence = async (r) => {
    const reason = window.prompt(
      "불인정 사유를 입력하세요. (학생에게 표시됩니다)\n예: 증빙 서류가 사유와 맞지 않습니다."
    );
    if (reason === null) return;
    setAbsenceBusyId(r.id);
    const { error } = await supabase
      .from("absence_requests")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        reject_reason: reason || "사유 불충분",
      })
      .eq("id", r.id);
    setAbsenceBusyId(null);
    if (error) return alert("처리 실패: " + error.message);
    alert("불인정 처리했습니다. (수업 횟수 차감 대상)");
    loadAbsenceReqs();
  };

  const loadCourses = async () => {
    const wd = new Date(date).getDay();
    const { data: cs } = await supabase
      .from("courses")
      .select("*")
      .eq("teacher_id", user.id)
      .eq("type", "group")
      .eq("weekday", wd)
      .eq("active", true);

    const list = cs ?? [];
    setCourses(list);

    const counts = {};
    const done = {};
    for (const c of list) {
      const { count } = await supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("course_id", c.id)
        .eq("status", "active");
      counts[c.id] = count ?? 0;

      const { data: sched } = await supabase
        .from("schedules")
        .select("id")
        .eq("course_id", c.id)
        .eq("date", date)
        .maybeSingle();
      if (sched) {
        const { count: attCount } = await supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("schedule_id", sched.id);
        done[c.id] = (attCount ?? 0) > 0;
      }
    }
    setEnrollCount(counts);
    setDoneCourses(done);

    // 이 날 내 1:1 수업 예약 (student_id 있는 것 = 1:1)
    const { data: bk } = await supabase
      .from("lesson_bookings")
      .select("*, student:student_id(name), enrollment:enrollment_id(remaining_sessions, total_sessions, courses(title)), branch:branch_id(name)")
      .eq("teacher_id", user.id)
      .eq("date", date)
      .not("student_id", "is", null)
      .order("start_time");
    setOneBookings(bk ?? []);

    setSelectedCourse(null);
    setSelectedBooking(null);
    setStudents([]);
  };

  useEffect(() => {
    if (user) {
      loadCourses();
      loadAbsenceReqs();
    }
  }, [user, date]);

  const openCourse = async (course) => {
    setSelectedCourse(course);
    setSelectedBooking(null);
    setLoading(true);

    const { data: enr } = await supabase
      .from("enrollments")
      .select("student_id, total_sessions, remaining_sessions, profiles:student_id(name)")
      .eq("course_id", course.id)
      .eq("status", "active");

    const { data: sched } = await supabase
      .from("schedules")
      .select("id")
      .eq("course_id", course.id)
      .eq("date", date)
      .maybeSingle();

    let sid = sched?.id ?? null;
    let existingAtt = {};
    if (sid) {
      const { data: att } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("schedule_id", sid);
      (att ?? []).forEach((a) => {
        existingAtt[a.student_id] = a.status;
      });
    }

    const studentList = (enr ?? []).map((s) => ({
      student_id: s.student_id,
      name: s.profiles?.name ?? "학생",
      total: s.total_sessions,
      remaining: s.remaining_sessions,
    }));

    const initial = {};
    studentList.forEach((s) => {
      initial[s.student_id] = existingAtt[s.student_id] ?? "present";
    });

    setScheduleId(sid);
    setStudents(studentList);
    setAttendance(initial);
    setLoading(false);
  };

  const openBooking = (b) => {
    setSelectedBooking(b);
    setSelectedCourse(null);
    setOneStatus(b.attended ?? "present");
    setOneRemain(b.enrollment?.remaining_sessions ?? null);
    setOneTotal(b.enrollment?.total_sessions ?? null);
  };

  const setStatus = (studentId, status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const save = async () => {
    if (!selectedCourse) return;
    setLoading(true);

    let sid = scheduleId;
    if (!sid) {
      const { data: newSched, error: schErr } = await supabase
        .from("schedules")
        .insert({
          course_id: selectedCourse.id,
          date,
          start_time: selectedCourse.start_time,
          status: "done",
        })
        .select()
        .single();
      if (schErr) {
        alert("회차 생성 실패: " + schErr.message);
        setLoading(false);
        return;
      }
      sid = newSched.id;
      setScheduleId(sid);
    }

    for (const s of students) {
      const status = attendance[s.student_id];
      const { data: exist } = await supabase
        .from("attendance")
        .select("id")
        .eq("schedule_id", sid)
        .eq("student_id", s.student_id)
        .maybeSingle();

      if (exist) {
        await supabase.from("attendance").update({ status }).eq("id", exist.id);
      } else {
        await supabase.from("attendance").insert({
          schedule_id: sid,
          student_id: s.student_id,
          status,
          checked_by: user.id,
        });
      }
    }

    setLoading(false);
    alert("출석이 저장되었습니다.");
    await loadCourses();
    setSelectedCourse(null);
  };

  // 1:1 출석 저장 (횟수 차감은 예약 때 이미 됨 - 여기선 기록만)
  const saveBooking = async () => {
    if (!selectedBooking) return;
    setLoading(true);

    const b = selectedBooking;

    // 예약에 출석 상태만 기록 (차감은 예약 잡을 때 이미 처리됨)
    await supabase
      .from("lesson_bookings")
      .update({ attended: oneStatus })
      .eq("id", b.id);

    setLoading(false);
    alert("출석이 저장되었습니다.");
    await loadCourses();
    setSelectedBooking(null);
  };

  const openHistory = async (student) => {
    setHistoryStudent(student);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("attendance")
      .select("status, schedules(date)")
      .eq("student_id", student.student_id)
      .order("created_at", { ascending: false });
    setHistory(data ?? []);
    setHistoryLoading(false);
  };

  const closeHistory = () => {
    setHistoryStudent(null);
    setHistory([]);
  };

  return (
    <div className="space-y-5">
      {/* 날짜 선택 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              수업 날짜
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
            />
          </div>
          <button
            onClick={() => setDate(todayStr())}
            className="mt-6 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            오늘
          </button>
          <span className="mt-6 text-sm text-slate-400">
            {WEEKDAYS[new Date(date).getDay()]}요일
            {date === todayStr() && " (오늘)"}
          </span>
        </div>
      </div>

      {/* 결석 신청 (담당 학생 검토 대기) - 목록 화면에서만 노출 */}
      {!selectedCourse && !selectedBooking && absenceReqs.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-amber-700">
              결석 신청 검토 대기
            </h4>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              {absenceReqs.length}건
            </span>
          </div>
          <div className="space-y-3">
            {absenceReqs.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-seum-navy">
                      {r.student?.name ?? "학생"}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {r.courses?.title}
                        {r.courses?.branch?.name ? ` · ${r.courses.branch.name}` : ""}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      결석일 {fmtDate(r.date)}
                      {r.booking?.start_time ? (
                        <span className="ml-1 text-slate-500">
                          {r.booking.start_time.slice(0, 5)}
                          {r.booking.end_time ? `~${r.booking.end_time.slice(0, 5)}` : ""}
                        </span>
                      ) : null}
                      {r.reason_type ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          {r.reason_type}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{fmtDate(r.created_at)} 신청</span>
                </div>

                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {r.reason}
                </p>

                {r.file_url ? (
                  <button
                    type="button"
                    onClick={() => window.open(r.file_url, "_blank", "noopener,noreferrer")}
                    className="mt-2 text-sm font-medium text-seum-blue hover:underline"
                  >
                    📎 증빙 서류 보기
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-red-500">증빙 서류 없음</p>
                )}

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => rejectAbsence(r)}
                    disabled={absenceBusyId === r.id}
                    className="rounded-lg border border-red-200 px-4 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-60"
                  >
                    불인정 (차감)
                  </button>
                  <button
                    type="button"
                    onClick={() => approveAbsence(r)}
                    disabled={absenceBusyId === r.id}
                    className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
                  >
                    {absenceBusyId === r.id ? "처리 중..." : "인정 (차감 안 함)"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 목록 (단체반 + 1:1) */}
      {!selectedCourse && !selectedBooking && (
        <div className="space-y-5">
          {/* 단체반 */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-slate-600">
              {date === todayStr() ? "오늘 담당 단체반" : "이 날 담당 단체반"}
            </h4>
            {courses.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                이 날 담당 단체반이 없습니다.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((c) => {
                  const wn = weekNo(c.start_date);
                  return (
                    <button
                      key={c.id}
                      onClick={() => openCourse(c)}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-seum-blue hover:bg-blue-50"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-bold text-seum-navy">{c.title}</span>
                        {doneCourses[c.id] ? (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                            수업완료
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                            수업예정
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {c.start_time?.slice(0, 5)} · 수강생 {enrollCount[c.id] ?? 0}명
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {c.start_date
                          ? `개강 ${c.start_date} · ${wn ? wn + "주차" : "개강 전"}`
                          : "개강일 미설정"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 1:1 수업 예약 */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-slate-600">이 날 1:1 수업</h4>
            {oneBookings.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                이 날 1:1 수업이 없습니다.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {oneBookings.map((b) => {
                  const st = STATUS_LABEL[b.attended];
                  return (
                    <button
                      key={b.id}
                      onClick={() => openBooking(b)}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-seum-blue hover:bg-blue-50"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-bold text-seum-navy">{b.student?.name ?? "학생"}</span>
                        {b.attended ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st?.c ?? "bg-slate-100 text-slate-500"}`}>
                            {st?.label ?? "완료"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                            수업예정
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {b.start_time?.slice(0, 5)}{b.end_time ? `~${b.end_time.slice(0, 5)}` : ""} · {(b.enrollment?.courses?.title ?? "").replace("1:1 ", "")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {b.branch?.name ? `${b.branch.name} · ` : ""}
                        잔여 {b.enrollment?.remaining_sessions ?? "-"}/{b.enrollment?.total_sessions ?? "-"}회
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 선택한 단체반 출석 */}
      {selectedCourse && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="font-bold text-seum-navy">
              {selectedCourse.title} 출석
            </h4>
            <button
              onClick={() => setSelectedCourse(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            >
              ← 목록
            </button>
          </div>
          <p className="mb-4 text-xs text-slate-400">
            {selectedCourse.start_date
              ? `개강 ${selectedCourse.start_date} · ${
                  weekNo(selectedCourse.start_date)
                    ? weekNo(selectedCourse.start_date) + "주차"
                    : "개강 전"
                }`
              : ""}
          </p>

          {loading ? (
            <p className="text-slate-400">불러오는 중...</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-400">배정된 학생이 없습니다.</p>
          ) : (
            <>
              <div className="space-y-2">
                {students.map((s) => (
                  <div
                    key={s.student_id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">{s.name}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-seum-blue">
                        {s.remaining}/{s.total}회
                      </span>
                      <button
                        onClick={() => openHistory(s)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                      >
                        상세보기
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      {OPTIONS.map((opt) => (
                        <button
                          key={opt.v}
                          onClick={() => setStatus(s.student_id, opt.v)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            attendance[s.student_id] === opt.v
                              ? `${opt.c} text-white`
                              : "bg-white text-slate-400 hover:bg-slate-100"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={save}
                  disabled={loading}
                  className="rounded-lg bg-seum-blue px-8 py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
                >
                  출석 저장
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                ※ 출석·결석은 1회 차감, 보류는 차감되지 않습니다.
              </p>
            </>
          )}
        </div>
      )}

      {/* 선택한 1:1 출석 */}
      {selectedBooking && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-bold text-seum-navy">
              {selectedBooking.student?.name} 1:1 출석
            </h4>
            <button
              onClick={() => setSelectedBooking(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            >
              ← 목록
            </button>
          </div>
          <p className="mb-4 text-xs text-slate-400">
            {(selectedBooking.enrollment?.courses?.title ?? "").replace("1:1 ", "")}
            {selectedBooking.branch?.name ? ` · ${selectedBooking.branch.name}` : ""}
            {" · "}{selectedBooking.start_time?.slice(0, 5)}{selectedBooking.end_time ? `~${selectedBooking.end_time.slice(0, 5)}` : ""}
            {" · "}잔여 {oneRemain ?? "-"}/{oneTotal ?? "-"}회
          </p>

          <div className="flex gap-1.5">
            {OPTIONS.map((opt) => (
              <button
                key={opt.v}
                onClick={() => setOneStatus(opt.v)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  oneStatus === opt.v ? `${opt.c} text-white` : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={saveBooking}
              disabled={loading}
              className="rounded-lg bg-seum-blue px-8 py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
            >
              출석 저장
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            ※ 잔여 횟수는 수업을 잡을 때 이미 차감되었습니다. 여기서는 출석 여부만 기록합니다.
          </p>
        </div>
      )}

      {/* 출석 이력 모달 */}
      {historyStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeHistory}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">
                {historyStudent.name} 출석 이력
              </h3>
              <button
                onClick={closeHistory}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {historyLoading ? (
              <p className="text-slate-400">불러오는 중...</p>
            ) : history.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                출석 기록이 없습니다.
              </p>
            ) : (
              <div className="max-h-[55vh] space-y-1.5 overflow-y-auto">
                {history.map((h, i) => {
                  const d = h.schedules?.date;
                  const wd = d ? WEEKDAYS[new Date(d).getDay()] : "";
                  const st = STATUS_LABEL[h.status] ?? {
                    label: h.status,
                    c: "text-slate-500 bg-slate-100",
                  };
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5"
                    >
                      <span className="text-sm font-medium text-slate-600">
                        {d ? `${d.replaceAll("-", ".")} (${wd})` : "-"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.c}`}
                      >
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}