// src/pages/admin/AssignTab.jsx
// 원장 — 학생 배정
//
// 1:1 수강 등록마다 담당 선생님을 정한다. (enrollments.teacher_id)
// 학생이 가입·결제하면 담당이 비어 있어서, 어느 선생님 화면에도 학생이 나오지 않는다.
// 여기서 선생님을 고르면 그 선생님의 [1:1 수업] 화면에 학생이 나타난다.
//
// 단체반은 반마다 담당이 정해져 있으므로 여기서 다루지 않는다. (반/수업 개설에서 지정)

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const fmtDate = (ds) => {
  if (!ds) return "";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const isExpired = (e) => {
  if (!e.expires_at) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(e.expires_at);
  exp.setHours(0, 0, 0, 0);
  return exp < today;
};

export default function AssignTab({ branchId }) {
  const [rows, setRows] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [waiting, setWaiting] = useState([]);   // 가입만 하고 수강 등록이 없는 학생
  const [oneCourses, setOneCourses] = useState([]);   // 1:1 수업 목록
  const [pendCourse, setPendCourse] = useState("");   // 결제 전 학생 배정 때 고른 수업
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("none");   // none(미배정) | all
  const [showExpired, setShowExpired] = useState(false);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState(null);
  // 선생님을 고르면 바로 저장하지 않고 한 번 확인한다
  // { kind: "enr" | "wait", target, teacherId }
  const [pending, setPending] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data: enr, error } = await supabase
      .from("enrollments")
      .select(
        "id, student_id, teacher_id, remaining_sessions, total_sessions, expires_at, created_at, " +
        "courses(title, type), student:student_id(name, phone, branch_id), teacher:teacher_id(name)"
      )
      .order("created_at", { ascending: false });
    if (error) console.error("수강 등록 조회 실패:", error);

    const { data: tc } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("role", "teacher")
      .order("name");

    const { data: br } = await supabase.from("branches").select("id, name").order("sort_order");
    setBranches(br ?? []);

    // 1:1 수업만
    setRows((enr ?? []).filter((e) => e.courses?.type === "oneonone"));

    // 1:1 수업 — 결제 전 학생을 배정할 때 수강 등록을 만들 수업
    const { data: oc } = await supabase
      .from("courses")
      .select("id, title")
      .eq("type", "oneonone")
      .eq("active", true)
      .order("title");
    setOneCourses(oc ?? []);

    // 가입 때 고른 과목 (enrollment_requests). 어떤 칸으로 학생과 이어지는지 몰라 넓게 맞춘다.
    const { data: reqs } = await supabase.from("enrollment_requests").select("*");

    // 가입했지만 수강 등록이 하나도 없는 학생
    const enrolled = new Set((enr ?? []).map((e) => e.student_id));
    // (profiles 에 created_at 이 없을 수도 있어 * 로 받고 여기서 정렬한다)
    const { data: st, error: stErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "student");
    if (stErr) console.error("학생 조회 실패:", stErr);
    const digits = (v) => String(v ?? "").replace(/\D/g, "");
    const findReq = (x) =>
      (reqs ?? [])
        .filter((r) =>
          [r.student_id, r.user_id, r.profile_id].includes(x.id) ||
          (x.phone && digits(r.phone) && digits(r.phone) === digits(x.phone))
        )
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];

    setWaiting(
      (st ?? [])
        .filter((x) => !enrolled.has(x.id))
        .map((x) => {
          const r = findReq(x);
          const want = r?.lesson_type === "oneonone" ? r?.lesson_detail : null;
          const course = want ? (oc ?? []).find((c) => c.title === `1:1 ${want}`) : null;
          return { ...x, wantLesson: r?.lesson_detail ?? null, wantType: r?.lesson_type ?? null, defaultCourseId: course?.id ?? "" };
        })
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    );
    setTeachers(tc ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const assign = async (row, teacherId) => {
    setSavingId(row.id);
    const { error } = await supabase
      .from("enrollments")
      .update({ teacher_id: teacherId || null })
      .eq("id", row.id);
    if (error) { setSavingId(null); return alert("배정 실패: " + error.message); }

    // 학생 쪽 담당도 맞춰둔다 — 나중에 재등록하면 같은 선생님에게 자동 배정된다
    if (teacherId && row.student_id) {
      await supabase
        .from("profiles")
        .update({ assigned_teacher_id: teacherId })
        .eq("id", row.student_id);
    }
    setSavingId(null);

    const t = teachers.find((x) => x.id === teacherId);
    setRows((p) =>
      p.map((r) =>
        r.id === row.id
          ? { ...r, teacher_id: teacherId || null, teacher: t ? { name: t.name } : null }
          : r
      )
    );
  };

  // 결제 전 학생 배정 — 수강 등록을 만들고 담당을 넣는다. (횟수 0, 결제는 나중에)
  // 그 순간 선생님의 1:1 수업·수업 추가·학생 답변 화면에 뜬다.
  const enrollAndAssign = async (x, teacherId, courseId) => {
    if (!courseId) return alert("수업을 골라주세요.");
    setSavingId(x.id);
    const { error } = await supabase.from("enrollments").insert({
      student_id: x.id,
      course_id: courseId,
      teacher_id: teacherId,
      total_sessions: 0,
      remaining_sessions: 0,
    });
    if (error) { setSavingId(null); return alert("수강 등록 실패: " + error.message); }
    await supabase.from("profiles").update({ assigned_teacher_id: teacherId }).eq("id", x.id);
    setSavingId(null);
    await load();   // 결제 전 → 수강 중 목록으로 옮겨간다
  };

  // 가입만 한 학생 — 담당을 미리 적어둔다.
  // 수강 등록이 생기는 순간 DB(트리거)가 이 선생님으로 채운다.
  const preAssign = async (x, teacherId) => {
    setSavingId(x.id);
    const { error } = await supabase
      .from("profiles")
      .update({ assigned_teacher_id: teacherId || null })
      .eq("id", x.id);
    setSavingId(null);
    if (error) return alert("배정 실패: " + error.message);
    setWaiting((p) =>
      p.map((w) => (w.id === x.id ? { ...w, assigned_teacher_id: teacherId || null } : w))
    );
  };

  const branchName = (id) =>
    (branches.find((b) => b.id === id)?.name ?? "").replace("점", "");

  // 위쪽 지점 탭에 맞는 학생만. 지점을 안 정한 학생은 양쪽에 다 보여서 놓치지 않게 한다.
  const inBranch = (r) =>
    !branchId || !r.student?.branch_id || r.student.branch_id === branchId;

  // 화면에 보일 목록
  const kw = q.trim();
  const enrList = rows
    .filter(inBranch)
    .filter((r) => showExpired || !isExpired(r))
    .filter((r) => (filter === "none" ? !r.teacher_id : true))
    .filter((r) => !kw || (r.student?.name ?? "").includes(kw));

  // 가입만 하고 수강 등록이 없는 학생 (결제 전)
  const waitList = waiting
    .filter((x) => !branchId || !x.branch_id || x.branch_id === branchId)
    .filter((x) => (filter === "none" ? !x.assigned_teacher_id : true))
    .filter((x) => !kw || (x.name ?? "").includes(kw));

  const noneEnr = rows.filter((r) => inBranch(r) && !isExpired(r) && !r.teacher_id).length;
  const noneWait = waiting.filter(
    (x) => (!branchId || !x.branch_id || x.branch_id === branchId) && !x.assigned_teacher_id
  ).length;
  const noneCount = noneEnr + noneWait;

  // 선생님별 담당 수 (진행 중인 것만)
  const loadByTeacher = {};
  rows.forEach((r) => {
    if (isExpired(r) || !r.teacher_id) return;
    loadByTeacher[r.teacher_id] = (loadByTeacher[r.teacher_id] || 0) + 1;
  });

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      {/* 미배정 알림 */}
      {noneCount > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-amber-700">담당 선생님이 정해지지 않은 학생이 {noneCount}명 있습니다</p>
          <p className="mt-0.5 text-xs text-amber-600">
            수강 중 {noneEnr}명 · 결제 전 {noneWait}명. 배정하기 전까지는 어느 선생님 화면에도 학생이 나오지 않습니다.
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm font-bold text-green-700">모든 학생에게 담당 선생님이 있습니다</p>
        </div>
      )}

      {/* 선생님별 담당 현황 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {teachers.map((t) => (
          <span key={t.id} className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200">
            {t.name} <b className="ml-1 text-seum-blue">{loadByTeacher[t.id] ?? 0}명</b>
          </span>
        ))}
      </div>

      {/* 필터 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setFilter("none")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            filter === "none" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}>
          미배정 {noneCount}
        </button>
        <button type="button" onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            filter === "all" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}>
          전체
        </button>
        <label className="ml-1 flex items-center gap-1.5 text-xs text-slate-500">
          <input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} />
          종료된 수강도 보기
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="학생 이름 검색"
          className="ml-auto w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-seum-blue sm:w-48"
        />
      </div>

      {/* 목록 — 수강 중인 학생과 결제 전 학생을 함께 */}
      {enrList.length === 0 && waitList.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-400">
          {filter === "none" ? "배정할 학생이 없습니다." : "해당하는 학생이 없습니다."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {/* 수강 중 */}
          {enrList.map((r, i) => {
            const expired = isExpired(r);
            return (
              <div key={r.id}
                className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${
                  i > 0 ? "border-t border-slate-100" : ""
                } ${expired ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-seum-navy">
                    {r.student?.name ?? "(이름 없음)"}
                    {r.student?.branch_id ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        {branchName(r.student.branch_id)}
                      </span>
                    ) : (
                      <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-500">지점 미정</span>
                    )}
                    {!r.teacher_id && !expired && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">미배정</span>
                    )}
                    {expired && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">종료</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {(r.courses?.title ?? "").replace("1:1 ", "")}
                    <span className="mx-1.5 text-slate-300">·</span>
                    잔여 {r.remaining_sessions}/{r.total_sessions}회
                    <span className="mx-1.5 text-slate-300">·</span>
                    {fmtDate(r.created_at)} 등록
                    {r.student?.phone ? <span className="ml-1.5 text-slate-400">{r.student.phone}</span> : null}
                  </p>
                </div>
                <select
                  value={r.teacher_id ?? ""}
                  onChange={(e) => setPending({ kind: "enr", target: r, teacherId: e.target.value })}
                  disabled={savingId === r.id}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-seum-blue sm:w-44 ${
                    r.teacher_id ? "border-slate-300 bg-white" : "border-amber-300 bg-amber-50"
                  }`}
                >
                  <option value="">담당 선택...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            );
          })}

          {/* 결제 전 — 담당을 미리 정해두면 수강 등록이 생길 때 자동으로 붙는다 */}
          {waitList.map((x, i) => (
            <div key={`w-${x.id}`}
              className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${
                enrList.length > 0 || i > 0 ? "border-t border-slate-100" : ""
              }`}>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-seum-navy">
                  {x.name || "(이름 없음)"}
                  {x.branch_id ? (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {branchName(x.branch_id)}
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-500">지점 미정</span>
                  )}
                  <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-seum-blue">결제 전</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {x.wantLesson ? `희망: ${x.wantLesson}` : "수강 등록 없음"}
                  {x.created_at && (
                    <>
                      <span className="mx-1.5 text-slate-300">·</span>
                      {fmtDate(x.created_at)} 가입
                    </>
                  )}
                  {x.phone ? <span className="ml-1.5 text-slate-400">{x.phone}</span> : null}
                </p>
              </div>
              {/* 담당은 이미 정해뒀는데 수강 등록이 없는 학생 — 같은 선생님으로 등록만 */}
              {x.assigned_teacher_id && (
                <button type="button"
                  onClick={() => { setPendCourse(x.defaultCourseId || ""); setPending({ kind: "wait", target: { ...x, assigned_teacher_id: null }, teacherId: x.assigned_teacher_id }); }}
                  className="shrink-0 rounded-lg bg-seum-blue px-3 py-2 text-xs font-bold text-white hover:bg-[#2a63c4]">
                  수업 등록
                </button>
              )}
              <select
                value={x.assigned_teacher_id ?? ""}
                onChange={(e) => { setPendCourse(x.defaultCourseId || ""); setPending({ kind: "wait", target: x, teacherId: e.target.value }); }}
                disabled={savingId === x.id}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-seum-blue sm:w-44 ${
                  x.assigned_teacher_id ? "border-slate-300 bg-white" : "border-amber-300 bg-amber-50"
                }`}
              >
                <option value="">담당 선택...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        선생님을 고르면 확인 창이 뜨고, 확인해야 저장됩니다. [결제 전] 학생은 담당을 미리 정해두면 결제하는 순간 그 선생님에게 자동으로 배정됩니다.
        단체반 담당은 [반/수업 개설]에서 반마다 지정하세요.
      </p>

      {/* ===== 배정 확인 ===== */}
      {pending && (() => {
        const t = teachers.find((x) => x.id === pending.teacherId);
        const isEnr = pending.kind === "enr";
        const name = isEnr ? pending.target.student?.name : pending.target.name;
        const bId = isEnr ? pending.target.student?.branch_id : pending.target.branch_id;
        const prevId = isEnr ? pending.target.teacher_id : pending.target.assigned_teacher_id;
        const prev = teachers.find((x) => x.id === prevId);
        const clearing = !pending.teacherId;

        const ok = async () => {
          const p2 = pending;
          if (p2.kind === "wait" && !clearing && !pendCourse) return alert("수업을 골라주세요.");
          setPending(null);
          if (p2.kind === "enr") await assign(p2.target, p2.teacherId);
          else if (clearing) await preAssign(p2.target, "");
          else await enrollAndAssign(p2.target, p2.teacherId, pendCourse);
        };

        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
            onClick={() => setPending(null)}>
            <div className="w-full max-w-sm bg-white p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-seum-navy">
                {clearing ? "담당 해제" : prev ? "담당 변경" : "담당 배정"}
              </h3>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-400">학생</p>
                <p className="mt-0.5 font-bold text-seum-navy">
                  {name || "(이름 없음)"}
                  {bId && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {branchName(bId)}
                    </span>
                  )}
                  {!isEnr && (
                    <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-seum-blue">결제 전</span>
                  )}
                </p>
                {isEnr && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {(pending.target.courses?.title ?? "").replace("1:1 ", "")} · 잔여 {pending.target.remaining_sessions}/{pending.target.total_sessions}회
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-400">담당 선생님</p>
                <p className="mt-1 text-base font-bold">
                  {prev && <span className="text-slate-400 line-through">{prev.name}</span>}
                  {prev && <span className="mx-2 text-slate-300">→</span>}
                  <span className={clearing ? "text-red-500" : "text-seum-blue"}>
                    {clearing ? "담당 없음" : t?.name}
                  </span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {clearing
                    ? "해제하면 이 학생이 선생님 화면에서 사라집니다."
                    : `저장하면 ${t?.name} 선생님의 [1:1 수업]과 수업 추가 목록에 바로 나타납니다.`}
                </p>
              </div>

              {/* 결제 전 학생 — 어느 수업으로 등록할지 */}
              {!isEnr && !clearing && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-xs font-bold text-slate-400">수업</p>
                  <select value={pendCourse} onChange={(e) => setPendCourse(e.target.value)}
                    className={`mt-1 w-full border px-3 py-2 text-sm outline-none focus:border-seum-blue ${
                      pendCourse ? "border-slate-300" : "border-amber-300 bg-amber-50"
                    }`}>
                    <option value="">수업 선택...</option>
                    {oneCourses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {pending.target.wantLesson
                      ? `가입할 때 [${pending.target.wantType === "group" ? "단체반" : "1:1"} ${pending.target.wantLesson}]을(를) 골랐어요.`
                      : "가입할 때 고른 과목을 찾지 못했어요. 직접 골라주세요."}
                    {" "}횟수 0회로 등록되고, 결제가 들어오면 수강생 관리에서 횟수를 넣어주세요.
                  </p>
                </div>
              )}

              <div className="mt-5 flex gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setPending(null)}
                  className="flex-1 border border-slate-300 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  취소
                </button>
                <button type="button" onClick={ok}
                  className={`flex-1 py-2.5 text-sm font-bold text-white ${
                    clearing ? "bg-red-500 hover:bg-red-600" : "bg-seum-blue hover:bg-[#2a63c4]"
                  }`}>
                  {clearing ? "해제" : prev ? "변경" : "배정"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}