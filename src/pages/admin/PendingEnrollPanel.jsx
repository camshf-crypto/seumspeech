import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const MINUTES = [0, 10, 20, 30, 40, 50];
const AM_HOURS = [10, 11];
const PM_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

const addMinutes = (hhmm, min) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const ymd = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// 날짜 상세 패널 안에 들어가는 "수강 등록 대기" 목록
// 수강(enrollments)이 하나도 없는 학생만 보여주고,
// 학생을 고르면 선택한 날짜로 수강 + 첫 수업이 함께 만들어진다.
export default function PendingEnrollPanel({ branchId, date, defaultTeacherId, open: isOpen, onToggle, onDone }) {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState(null);   // 등록할 학생
  const [reqDetail, setReqDetail] = useState(""); // 신청서에 적은 과목
  const [courseId, setCourseId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [sessions, setSessions] = useState(10);
  const [h24, setH24] = useState(14);
  const [min, setMin] = useState(0);
  const [len, setLen] = useState(60);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);

    const { data: st, error: stErr } = await supabase
      .from("profiles")
      .select("id, name, phone, branch_id, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false });
    if (stErr) console.error("학생 조회 실패:", stErr);

    const { data: enr } = await supabase.from("enrollments").select("student_id");
    const has = new Set((enr ?? []).map((e) => e.student_id));

    const { data: cs } = await supabase
      .from("courses")
      .select("id, title, type, branch_id, sessions_total")
      .eq("active", true);
    const { data: tc } = await supabase.from("profiles").select("id, name").eq("role", "teacher");

    // 수강이 없는 학생만, 이 지점 소속만
    setStudents((st ?? []).filter((s) => !has.has(s.id) && (!branchId || s.branch_id === branchId)));
    setCourses(cs ?? []);
    setTeachers(tc ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [branchId]);

  const oneCourses = courses.filter((c) => c.type === "oneonone");
  const groupCourses = courses.filter((c) => c.type === "group" && (!branchId || c.branch_id === branchId));

  const open = async (s) => {
    setTarget(s);
    setTeacherId(defaultTeacherId ?? "");
    setSessions(10);
    setH24(14); setMin(0); setLen(60);

    // 신청서에서 고른 과목을 미리 골라 둔다
    const { data } = await supabase
      .from("enrollment_requests")
      .select("lesson_type, lesson_detail")
      .eq("student_id", s.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setReqDetail(data?.lesson_detail ?? "");
    if (data?.lesson_type === "oneonone" && data.lesson_detail) {
      const match = oneCourses.find((c) => c.title.replace("1:1 ", "") === data.lesson_detail);
      setCourseId(match?.id ?? "");
    } else {
      setCourseId("");
    }
  };

  const selCourse = courses.find((c) => c.id === courseId);
  const isOne = selCourse?.type === "oneonone";
  const start = `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  const end = addMinutes(start, len);

  const save = async () => {
    if (!courseId) return alert("수업을 선택하세요.");
    if (isOne && !teacherId) return alert("담임 선생님을 선택하세요.");

    setSaving(true);

    const total = isOne ? Number(sessions) : (selCourse?.sessions_total ?? 6);
    const { data: enr, error } = await supabase
      .from("enrollments")
      .insert({
        student_id: target.id,
        course_id: courseId,
        teacher_id: teacherId || null,
        total_sessions: total,
        remaining_sessions: total,
        status: "active",
      })
      .select()
      .single();

    if (error) { setSaving(false); return alert("수강 등록 실패: " + error.message); }

    // 첫 수업을 잡았으면 예약도 함께 만든다
    if (date && isOne) {
      const { error: bkErr } = await supabase.from("lesson_bookings").insert({
        teacher_id: teacherId,
        student_id: target.id,
        enrollment_id: enr.id,
        date,
        start_time: start,
        end_time: end,
        branch_id: branchId ?? null,
      });
      if (bkErr) { setSaving(false); return alert("첫 수업 예약 실패: " + bkErr.message); }
      if (total > 0) {
        await supabase.from("enrollments")
          .update({ remaining_sessions: total - 1 })
          .eq("id", enr.id);
      }
    }

    setSaving(false);
    setTarget(null);
    await load();
    if (onDone) onDone();
  };

  if (loading || !date) return null;

  const isAm = h24 < 12;
  const label12 = (h) => (h === 12 ? "12" : h > 12 ? String(h - 12) : String(h));

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full border px-3 py-2.5 text-sm font-bold transition ${
          isOpen ? "border-amber-500 bg-amber-500 text-white" : "border-amber-400 bg-white text-amber-600 hover:bg-amber-50"
        }`}
      >
        첫 수업 등록 ({students.length})
      </button>

      {isOpen && (
      <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
        {students.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => open(s)}
            className="flex w-full items-center justify-between border border-amber-300 bg-amber-50 px-3 py-2 text-left hover:bg-amber-100"
          >
            <span className="text-sm font-bold text-seum-navy">{s.name || "이름없음"}</span>
            <span className="text-[11px] text-slate-400">{ymd(s.created_at).slice(5).replace("-", ".")} 가입</span>
          </button>
        ))}
      </div>
      )}

      {/* 등록 창 */}
      {target && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setTarget(null)}>
          <div className="my-8 w-full max-w-md space-y-4 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">{target.name} · 수강 등록</h3>
              <button type="button" onClick={() => setTarget(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {reqDetail && (
              <p className="bg-blue-50 px-3 py-2 text-xs text-seum-blue">
                신청서에 적은 과목: <b>{reqDetail}</b>
              </p>
            )}

            <div>
              <label className="mb-1 block text-xs text-slate-500">수업</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
              >
                <option value="">선택...</option>
                <optgroup label="1:1">
                  {oneCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title.replace("1:1 ", "")}</option>
                  ))}
                </optgroup>
                <optgroup label="단체반">
                  {groupCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {isOne && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-slate-500">담임 선생님</label>
                    {defaultTeacherId ? (
                      // 달력에서 이미 선생님을 골라 들어왔으면 그대로 쓴다
                      <div className="flex items-center justify-between border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                        <span className="font-bold text-seum-navy">
                          {teachers.find((t) => t.id === teacherId)?.name ?? "-"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTeacherId("")}
                          className="text-[11px] text-slate-400 underline hover:text-seum-blue"
                        >
                          변경
                        </button>
                      </div>
                    ) : (
                      <select
                        value={teacherId}
                        onChange={(e) => setTeacherId(e.target.value)}
                        className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                      >
                        <option value="">선택...</option>
                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-xs text-slate-500">횟수</label>
                    <input
                      type="number"
                      min={1}
                      value={sessions}
                      onChange={(e) => setSessions(Number(e.target.value))}
                      className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                    />
                  </div>
                </div>

                {/* 첫 수업 시간 — 날짜는 달력에서 고른 그 날 */}
                <div className="border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-bold text-slate-600">
                    첫 수업 {date ? date.slice(5).replace("-", ".") : ""}
                  </p>

                  <div className="mb-1.5 flex gap-1.5">
                    <button type="button" onClick={() => setH24(AM_HOURS[0])}
                      className={`flex-1 border py-1.5 text-xs font-bold ${isAm ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                      오전
                    </button>
                    <button type="button" onClick={() => setH24(PM_HOURS[2])}
                      className={`flex-1 border py-1.5 text-xs font-bold ${!isAm ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                      오후
                    </button>
                  </div>

                  <div className="mb-1.5 grid grid-cols-5 gap-1">
                    {(isAm ? AM_HOURS : PM_HOURS).map((h) => (
                      <button key={h} type="button" onClick={() => setH24(h)}
                        className={`border py-1.5 text-xs font-bold ${h24 === h ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                        {label12(h)}
                      </button>
                    ))}
                  </div>

                  <div className="mb-1.5 grid grid-cols-6 gap-1">
                    {MINUTES.map((m) => (
                      <button key={m} type="button" onClick={() => setMin(m)}
                        className={`border py-1.5 text-xs font-bold ${min === m ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                        {String(m).padStart(2, "0")}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[60, 90].map((m) => (
                      <button key={m} type="button" onClick={() => setLen(m)}
                        className={`border px-3 py-1.5 text-xs font-bold ${len === m ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                        {m}분
                      </button>
                    ))}
                    <span className="ml-auto text-sm font-bold text-seum-blue">{start} ~ {end}</span>
                  </div>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={save}
              disabled={saving || !courseId}
              className="w-full bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
            >
              {saving ? "등록 중..." : "수강 등록"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}