import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const MINUTES = [0, 10, 20, 30, 40, 50];
const AM_HOURS = [8, 9, 10, 11];
const PM_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const addMinutes = (hhmm, min) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

// 달력 칸의 + 를 누르면 열리는 창
// 수강 중인 학생(다음 수업)과 가입만 한 학생(첫 수업)을 한 목록에서 고른다.
// branchId 는 "지점" 기본 선택값으로만 쓴다. 학생 목록은 지점으로 거르지 않는다.
// (강사가 요일마다 다른 지점에 가므로, 목록을 지점으로 막으면 학생이 안 보인다)
export default function QuickBookModal({ branchId, date, defaultTeacherId, onClose, onDone }) {
  const [branches, setBranches] = useState([]);
  const [bookBranch, setBookBranch] = useState(branchId ?? null); // 이 수업을 어느 지점으로 저장할지
  const [enrolls, setEnrolls] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 선택한 대상
  const [picked, setPicked] = useState(null); // { kind:"enroll"|"new", ... }
  const [courseId, setCourseId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [sessions, setSessions] = useState(10);
  const [h24, setH24] = useState(14);
  const [min, setMin] = useState(0);
  const [len, setLen] = useState(60);
  const [changeTeacher, setChangeTeacher] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);

    const { data: enr, error: enrErr } = await supabase
      .from("enrollments")
      .select("id, total_sessions, remaining_sessions, teacher_id, student:student_id(id, name, branch_id), courses(title, type)")
      .eq("status", "active");
    if (enrErr) console.error("수강 조회 실패:", enrErr);

    const { data: st } = await supabase
      .from("profiles")
      .select("id, name, branch_id, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false });

    const { data: cs } = await supabase
      .from("courses")
      .select("id, title, type, branch_id, sessions_total")
      .eq("active", true);
    const { data: tc } = await supabase.from("profiles").select("id, name").eq("role", "teacher");
    const { data: br } = await supabase.from("branches").select("id, name").order("sort_order");
    setBranches(br ?? []);

    const hasEnroll = new Set((enr ?? []).map((e) => e.student?.id));

    setEnrolls((enr ?? []).filter((e) => e.courses?.type === "oneonone"));
    setWaiting((st ?? []).filter((s) => !hasEnroll.has(s.id)));
    setCourses(cs ?? []);
    setTeachers(tc ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setBookBranch(branchId ?? null); }, [branchId]);

  const oneCourses = courses.filter((c) => c.type === "oneonone");
  // 단체반은 저장할 지점의 반만 보여준다
  const groupCourses = courses.filter((c) => c.type === "group" && (!bookBranch || c.branch_id === bookBranch));

  const pickEnroll = (e) => {
    if ((e.remaining_sessions ?? 0) <= 0) {
      return alert(`${e.student?.name}님은 잔여 횟수가 없습니다.\n수강생 관리에서 재등록해주세요.`);
    }
    setPicked({ kind: "enroll", enroll: e, name: e.student?.name });
    setChangeTeacher(false);
    setTeacherId(e.teacher_id || defaultTeacherId || "");
    setH24(14); setMin(0); setLen(60);
  };

  const pickNew = async (s) => {
    setPicked({ kind: "new", student: s, name: s.name });
    setChangeTeacher(false);
    setTeacherId(defaultTeacherId || "");
    setSessions(10);
    setH24(14); setMin(0); setLen(60);

    const { data } = await supabase
      .from("enrollment_requests")
      .select("lesson_type, lesson_detail")
      .eq("student_id", s.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.lesson_type === "oneonone" && data.lesson_detail) {
      const match = oneCourses.find((c) => c.title.replace("1:1 ", "") === data.lesson_detail);
      setCourseId(match?.id ?? "");
    } else {
      setCourseId("");
    }
  };

  const start = `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  const end = addMinutes(start, len);
  const selCourse = courses.find((c) => c.id === courseId);
  const isOne = picked?.kind === "enroll" ? true : selCourse?.type === "oneonone";

  const save = async () => {
    if (!teacherId) return alert("담임 선생님을 선택하세요.");
    if (!bookBranch) return alert("지점을 선택하세요.");
    setSaving(true);

    // 이미 수강 중 — 예약만 추가
    if (picked.kind === "enroll") {
      const e = picked.enroll;
      const { error } = await supabase.from("lesson_bookings").insert({
        teacher_id: teacherId,
        student_id: e.student?.id,
        enrollment_id: e.id,
        date,
        start_time: start,
        end_time: end,
        branch_id: bookBranch ?? null,
      });
      if (error) { setSaving(false); return alert("수업 예약 실패: " + error.message); }

      await supabase.from("enrollments")
        .update({ remaining_sessions: Math.max(0, (e.remaining_sessions ?? 1) - 1) })
        .eq("id", e.id);
    } else {
      // 가입만 한 학생 — 수강 등록 + 첫 수업
      if (!courseId) { setSaving(false); return alert("수업을 선택하세요."); }
      const total = isOne ? Number(sessions) : (selCourse?.sessions_total ?? 6);

      const { data: enr, error } = await supabase
        .from("enrollments")
        .insert({
          student_id: picked.student.id,
          course_id: courseId,
          teacher_id: teacherId,
          total_sessions: total,
          remaining_sessions: total,
          status: "active",
        })
        .select()
        .single();
      if (error) { setSaving(false); return alert("수강 등록 실패: " + error.message); }

      if (isOne) {
        const { error: bkErr } = await supabase.from("lesson_bookings").insert({
          teacher_id: teacherId,
          student_id: picked.student.id,
          enrollment_id: enr.id,
          date,
          start_time: start,
          end_time: end,
          branch_id: bookBranch ?? null,
        });
        if (bkErr) { setSaving(false); return alert("첫 수업 예약 실패: " + bkErr.message); }
        if (total > 0) {
          await supabase.from("enrollments")
            .update({ remaining_sessions: total - 1 })
            .eq("id", enr.id);
        }
      }
    }

    setSaving(false);
    onClose();
    if (onDone) onDone();
  };

  const q = search.trim().toLowerCase();
  // 달력에서 선생님을 골라 들어왔으면 그 선생님이 담임인 학생만 보여준다
  const filteredEnrolls = enrolls
    .filter((e) => !defaultTeacherId || e.teacher_id === defaultTeacherId)
    .filter((e) => !q || (e.student?.name ?? "").toLowerCase().includes(q));
  const filteredWaiting = waiting.filter((s) => !q || (s.name ?? "").toLowerCase().includes(q));

  const isAm = h24 < 12;
  const label12 = (h) => (h === 12 ? "12" : h > 12 ? String(h - 12) : String(h));

  // 섹션 사이 실선 구분 (바깥) / 시간 블록 안쪽 구분 (연한 선)
  const SECTION = "border-t border-slate-200 pt-4";
  const SUBLINE = "mt-2 border-t border-slate-100 pt-2";
  const LABEL = "mb-1.5 block text-xs font-bold text-slate-500";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4">
          <h3 className="text-lg font-bold text-seum-navy">
            {date?.slice(5).replace("-", ".")} 일정 추가
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {/* 1단계 — 학생 고르기 */}
        {!picked ? (
          loading ? (
            <p className={`${SECTION} py-6 text-center text-sm text-slate-400`}>불러오는 중...</p>
          ) : (
            <div className={SECTION}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="학생 이름 검색"
                className="mb-3 w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
              />

              <div className="max-h-80 space-y-3 overflow-y-auto">
                {filteredEnrolls.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-seum-blue">수강 중</p>
                    <div className="space-y-1.5">
                      {filteredEnrolls.map((e) => {
                        const left = e.remaining_sessions ?? 0;
                        const zero = left <= 0;
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => pickEnroll(e)}
                            className={`flex w-full items-center justify-between border px-3 py-2 text-left ${
                              zero ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-300 bg-white hover:bg-blue-50"
                            }`}
                          >
                            <span className="text-sm font-bold">
                              {e.student?.name}
                              <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                                {e.courses?.title?.replace("1:1 ", "")}
                              </span>
                            </span>
                            <span className={`text-[11px] font-bold ${zero ? "text-red-400" : "text-seum-blue"}`}>
                              {zero ? "재등록 필요" : `${left}/${e.total_sessions}회`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredWaiting.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-amber-600">첫 수업 (수강 미등록)</p>
                    <div className="space-y-1.5">
                      {filteredWaiting.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => pickNew(s)}
                          className="flex w-full items-center justify-between border border-amber-300 bg-amber-50 px-3 py-2 text-left hover:bg-amber-100"
                        >
                          <span className="text-sm font-bold text-seum-navy">{s.name}</span>
                          <span className="text-[11px] text-slate-400">수강 등록 필요</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {filteredEnrolls.length === 0 && filteredWaiting.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">해당하는 학생이 없습니다.</p>
                )}
              </div>
            </div>
          )
        ) : (
          /* 2단계 — 시간 정하기 */
          <>
            {/* 학생 */}
            <div className={SECTION}>
              <label className={LABEL}>학생</label>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-seum-navy">{picked.name}</span>
                <button type="button" onClick={() => setPicked(null)} className="text-[11px] text-slate-400 underline hover:text-seum-blue">
                  다른 학생 고르기
                </button>
              </div>
            </div>

            {/* 수업 · 횟수 (가입만 한 학생) */}
            {picked.kind === "new" && (
              <div className={`${SECTION} mt-4`}>
                <label className={LABEL}>수업</label>
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

                {isOne && (
                  <div className="mt-3 w-28">
                    <label className={LABEL}>횟수</label>
                    <input
                      type="number"
                      min={1}
                      value={sessions}
                      onChange={(e) => setSessions(Number(e.target.value))}
                      className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 지점 */}
            <div className={`${SECTION} mt-4`}>
              <label className={LABEL}>지점</label>
              <div className="flex gap-1.5">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBookBranch(b.id)}
                    className={`flex-1 border py-2 text-sm font-bold transition ${
                      bookBranch === b.id
                        ? "border-seum-navy bg-seum-navy text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 담임 선생님 */}
            <div className={`${SECTION} mt-4`}>
              <label className={LABEL}>담임 선생님</label>
              {picked.kind === "enroll" && picked.enroll?.teacher_id && !changeTeacher ? (
                // 이미 담임이 정해진 학생은 그대로 쓴다 (정산이 담임 기준이라 함부로 바꾸지 않는다)
                <div className="flex items-center justify-between border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-bold text-seum-navy">
                    {teachers.find((t) => t.id === teacherId)?.name ?? "-"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setChangeTeacher(true)}
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

            {/* 시간 */}
            {isOne && (
              <div className={`${SECTION} mt-4`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">시간</label>
                  <span className="text-sm font-bold text-seum-blue">{start} ~ {end}</span>
                </div>

                {/* 오전 / 오후 */}
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setH24(AM_HOURS[0])}
                    className={`flex-1 border py-1.5 text-xs font-bold ${isAm ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                    오전
                  </button>
                  <button type="button" onClick={() => setH24(PM_HOURS[2])}
                    className={`flex-1 border py-1.5 text-xs font-bold ${!isAm ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                    오후
                  </button>
                </div>

                {/* 시 */}
                <div className={SUBLINE}>
                  <div className="grid grid-cols-6 gap-1">
                    {(isAm ? AM_HOURS : PM_HOURS).map((h) => (
                      <button key={h} type="button" onClick={() => setH24(h)}
                        className={`border py-1.5 text-xs font-bold ${h24 === h ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                        {label12(h)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 분 */}
                <div className={SUBLINE}>
                  <div className="grid grid-cols-6 gap-1">
                    {MINUTES.map((m) => (
                      <button key={m} type="button" onClick={() => setMin(m)}
                        className={`border py-1.5 text-xs font-bold ${min === m ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                        {String(m).padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 수업 길이 */}
                <div className={SUBLINE}>
                  <div className="flex items-center gap-1.5">
                    {[60, 90].map((m) => (
                      <button key={m} type="button" onClick={() => setLen(m)}
                        className={`border px-3 py-1.5 text-xs font-bold ${len === m ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                        {m}분
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 저장 */}
            <div className={`${SECTION} mt-4`}>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="w-full bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}