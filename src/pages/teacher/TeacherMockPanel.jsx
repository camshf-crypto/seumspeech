import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * 모의면접 — 현장 모의면접 (비커스 LiveInterview 에서 옮김)
 *
 * 학원에서 선생님 노트북과 학생 핸드폰으로 동시에 녹음하며 최대 6명을 한 번에 진행한다.
 *   준비: 학생 고르기(선생님 = 담당 학생, 원장 = 전체) → 학생마다 지원 학교·질문 개수
 *   진행: 학생 칸 → 질문 읽기 → 녹음 시작/끝 → 뒤에서 받아 적기·나누기(interview-live-answer)
 *         → 문답마다 AI 진단(interview-ai-mock)
 *   결과: 녹음 듣기 → 받아 적은 대화 → AI 진단 → 선생님 피드백 저장
 *
 * 저장 위치
 *   univ_simulations           학생 한 명의 현장 모의면접 한 번 (is_mock = true, mock_mode = 'live')
 *   univ_simulation_questions  본 질문 (is_tail = false) + 꼬리질문 (is_tail = true, parent_id)
 *   예전 면접 모의고사(mock_mode 없음)는 지우지 않고 화면에서만 뺀다.
 *
 * 학생 핸드폰: 학생이 면접 화면에서 [현장 면접 대기]를 켜 두면 채널 live-mock-{학생id} 로 연결된다.
 *
 * 쓰는 곳
 *   선생님·원장 메뉴 "모의면접"             <TeacherMockPanel teacherId branchId />
 *   선생님 면접 화면 > 학생 > 모의면접 탭   <TeacherMockPanel teacherId student />
 */

const MAX_STUDENTS = 6;
const MAX_EACH = 5;
const INTRO = "본인을 소개해 주세요.";
const SOURCES = [
  { key: "insung", label: "기본 인성" },
  { key: "saenggibu", label: "생기부" },
  { key: "gichul", label: "기출" },
];
const DEF_COUNTS = { insung: 1, saenggibu: 2, gichul: 2 };
const SOURCE_LABEL = {
  intro: "자기소개",
  insung: "기본 인성",
  saenggibu: "생기부",
  gichul: "기출",
  custom: "직접 입력",
  voice: "말로 질문",
  followup: "꼬리질문",
};
const SOURCE_CHIP = {
  intro: "bg-slate-100 text-slate-600",
  insung: "bg-emerald-50 text-emerald-700",
  saenggibu: "bg-blue-50 text-seum-blue",
  gichul: "bg-purple-50 text-purple-700",
  custom: "bg-slate-100 text-slate-600",
  voice: "bg-slate-100 text-slate-600",
  followup: "bg-amber-50 text-amber-700",
};
const EVALS = [
  ["eye", "시선"],
  ["posture", "자세"],
  ["confidence", "자신감"],
];

const fmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const mmss = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const uniq = (list) => [...new Set((list ?? []).map((q) => (q ?? "").trim()))].filter(Boolean);
// 컨셉 매칭 — AI 진단의 "③ 컨셉 연결: (중) — 근거" 줄을 꺼낸다
//   skipped: 컨셉이 없거나, 컨셉을 꺼낼 자리가 아닌 질문이라 판단을 안 한 경우 (리포트 평균에서 뺀다)
function conceptCheck(row) {
  const fb = row?.ai_feedback ?? "";
  const line = fb.split("\n").find((l) => /컨셉\s*연결/.test(l));
  const grade = (row?.ai_scores ?? []).find((sc) => sc.label === "컨셉 연결")?.grade
    ?? line?.match(/[(（]\s*([상중하])\s*[)）]/)?.[1] ?? null;
  if (!grade) return null;
  const reason = (line ?? "").replace(/^.*?[)）]\s*[—\-–:：]?\s*/, "").trim();
  const skipped = /미설정|확인되지 않음|확인되지 않는다|해당 없음/.test(reason);
  return { grade, reason, skipped };
}

function ConceptMatch({ row, concept }) {
  const c = conceptCheck(row);
  if (!concept) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        이 학생은 면접 컨셉이 없어 컨셉 매칭을 확인할 수 없어요. 단체반·1:1 수업 화면의 [면접 컨셉]에 먼저 적어 주세요.
      </div>
    );
  }
  if (!c) return null;
  const tone = c.skipped
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : c.grade === "상" ? "border-green-200 bg-green-50 text-green-800"
    : c.grade === "중" ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-red-200 bg-red-50 text-red-700";
  const head = c.skipped ? "이 질문에선 확인 안 됨" : c.grade === "상" ? "컨셉과 맞음" : c.grade === "중" ? "연결이 약함" : "컨셉과 어긋남";
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-xs font-extrabold">🎯 컨셉 매칭 · {head}{c.skipped ? "" : ` (${c.grade})`}</p>
      <p className="mt-0.5 text-[11px] opacity-80">컨셉: {concept}</p>
      {c.reason && <p className="mt-1 text-[13px] leading-relaxed">{c.reason}</p>}
    </div>
  );
}

const scoreCls = (g) =>
  g === "상" ? "bg-green-50 text-green-700" : g === "중" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600";

async function fnError(error) {
  let detail = error?.message || "unknown";
  try {
    const body = await error.context?.json();
    detail = body?.error || detail;
  } catch (_) {}
  return detail;
}

// ── 담당 학생 (대입 면접 수업) ─────────────────────────
// 선생님: 단체반은 courses.teacher_id = 나, 1:1 은 enrollments.teacher_id = 나
// 원장: 전체 (원장 화면에서 지점을 골랐으면 그 지점만)
async function loadMyStudents({ teacherId, isMaster, branchId }) {
  const { data: cs, error } = await supabase
    .from("courses")
    .select("id, title, type, teacher_id")
    .eq("course_kind", "interview")
    .eq("interview_category", "univ")
    .eq("active", true);
  if (error) throw error;
  const courses = cs ?? [];
  if (courses.length === 0) return [];
  const byId = Object.fromEntries(courses.map((c) => [c.id, c]));

  const { data: enr, error: eErr } = await supabase
    .from("enrollments")
    .select("student_id, teacher_id, course_id, profiles:student_id(id, name, branch_id)")
    .in("course_id", courses.map((c) => c.id));
  if (eErr) throw eErr;

  const map = {};
  (enr ?? []).forEach((e) => {
    const c = byId[e.course_id];
    const p = e.profiles;
    if (!c || !p) return;
    if (!isMaster) {
      const mine = c.type === "group" ? c.teacher_id === teacherId : e.teacher_id === teacherId;
      if (!mine) return;
    } else if (branchId && p.branch_id !== branchId) {
      return;
    }
    if (!map[p.id]) map[p.id] = { id: p.id, name: p.name, courses: [] };
    if (c.title && !map[p.id].courses.includes(c.title)) map[p.id].courses.push(c.title);
  });
  return Object.values(map).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

// ── AI 진단 1건 (기존 interview-ai-mock 그대로) ────────
async function runMockAi(row, ctx) {
  if (!row?.transcript?.trim()) throw new Error("받아 적은 대답이 없습니다.");
  const scope = ["insung", "saenggibu", "gichul"].includes(row.question_source) ? row.question_source : null;
  const { data, error } = await supabase.functions.invoke("interview-ai-mock", {
    body: {
      question: row.question_text,
      transcript: row.transcript,
      concept: ctx.concept || null,
      scope,
      univ: ctx.univ ?? null,
      major: ctx.major ?? null,
      speech: {
        duration_sec: row.duration_sec ?? null,
        speed_label: row.speed_label ?? null,
        filler_count: row.filler_count ?? null,
      },
    },
  });
  if (error) throw new Error(await fnError(error));
  if (!data?.success) throw new Error(data?.error || "AI 실패");
  const { data: saved, error: uErr } = await supabase
    .from("univ_simulation_questions")
    .update({ ai_feedback: data.feedback, ai_scores: data.scores })
    .eq("id", row.id)
    .select()
    .maybeSingle();
  if (uErr) throw uErr;
  return saved;
}

// ============================================================
// 화면
// ============================================================
export default function TeacherMockPanel({ teacherId, student = null, branchId = null }) {
  const [me, setMe] = useState({ id: teacherId ?? null, role: null });
  const isMaster = me.role === "master";

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [names, setNames] = useState({});   // 목록에 없는 학생 이름 (원장이 다른 지점 기록을 볼 때)
  const [openId, setOpenId] = useState(null);
  const [live, setLive] = useState(false);
  const [reportFor, setReportFor] = useState(null);   // { id, name } — 성장 리포트

  // 로그인한 사람과 역할
  useEffect(() => {
    let alive = true;
    (async () => {
      let id = teacherId;
      if (!id) {
        const { data } = await supabase.auth.getUser();
        id = data?.user?.id ?? null;
      }
      if (!id) return;
      const { data: p } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
      if (alive) setMe({ id, role: p?.role ?? "teacher" });
    })();
    return () => { alive = false; };
  }, [teacherId]);

  // 담당 학생
  useEffect(() => {
    if (!me.role) return;
    let alive = true;
    (async () => {
      setStudentsLoading(true);
      try {
        const list = await loadMyStudents({ teacherId: me.id, isMaster, branchId });
        if (alive) setStudents(list);
      } catch (e) {
        console.error("담당 학생 조회 실패:", e);
        if (alive) setStudents([]);
      } finally {
        if (alive) setStudentsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [me.id, me.role, isMaster, branchId]);

  // 지난 현장 모의면접
  const loadSessions = async () => {
    if (!me.role) return;
    setSessionsLoading(true);
    let q = supabase
      .from("univ_simulations")
      .select("*")
      .eq("is_mock", true)
      .eq("mock_mode", "live")
      .order("created_at", { ascending: false })
      .limit(60);
    if (student) {
      q = q.eq("student_id", student.id);
    } else if (!isMaster) {
      const ids = students.map((s) => s.id);
      if (ids.length === 0) { setSessions([]); setSessionsLoading(false); return; }
      q = q.in("student_id", ids);
    }
    const { data, error } = await q;
    if (error) console.error("모의면접 기록 조회 실패:", error);
    let list = data ?? [];
    if (!student && isMaster && branchId) {
      const ids = new Set(students.map((s) => s.id));
      list = list.filter((x) => ids.has(x.student_id));
    }
    setSessions(list);
    setSessionsLoading(false);

    // 이름 채우기
    const known = new Set(students.map((s) => s.id));
    if (student) known.add(student.id);
    const missing = [...new Set(list.map((x) => x.student_id))].filter((id) => !known.has(id));
    if (missing.length) {
      const { data: ps } = await supabase.from("profiles").select("id, name").in("id", missing);
      setNames((n) => ({ ...n, ...Object.fromEntries((ps ?? []).map((p) => [p.id, p.name])) }));
    }
  };

  useEffect(() => {
    if (studentsLoading) return;
    loadSessions();
    /* eslint-disable-next-line */
  }, [studentsLoading, student?.id, isMaster, branchId]);

  // 학생마다 몇 번째 모의면접인지 (오래된 것부터 1회)
  const roundOf = (sim) =>
    sessions.filter((x) => x.student_id === sim.student_id && new Date(x.created_at) <= new Date(sim.created_at)).length;

  const nameOf = (id) =>
    students.find((s) => s.id === id)?.name ?? (student?.id === id ? student.name : null) ?? names[id] ?? "학생";

  const removeSession = async (sim) => {
    if (!window.confirm(`${nameOf(sim.student_id)} 학생의 이 모의면접 기록을 지울까요?\n질문·대답·피드백이 함께 사라집니다.`)) return;
    const { error } = await supabase.from("univ_simulations").delete().eq("id", sim.id);
    if (error) return alert("삭제 실패: " + error.message);
    if (openId === sim.id) setOpenId(null);
    loadSessions();
  };

  // 같은 날 같은 조끼리 묶는다
  const groups = useMemo(() => {
    const out = [];
    sessions.forEach((s) => {
      const d = new Date(s.opened_at ?? s.created_at);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}|${s.live_group ?? ""}`;
      let g = out.find((x) => x.key === key);
      if (!g) {
        g = { key, label: `${d.getMonth() + 1}월 ${d.getDate()}일${s.live_group ? ` ${s.live_group}` : ""}`, items: [] };
        out.push(g);
      }
      g.items.push(s);
    });
    return out;
  }, [sessions]);

  if (!me.role) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      {/* 머리 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-bold text-seum-navy">
          {student ? `${student.name} 모의면접` : "현장 모의면접"}
          <span className="ml-2 text-xs font-medium text-slate-400">
            {student
              ? `기록 ${sessions.length}회`
              : `${isMaster ? "전체" : "담당"} 대입 학생 ${studentsLoading ? "…" : students.length}명`}
          </span>
        </div>
        <div className="flex gap-2">
          {student && (
            <button
              type="button"
              onClick={() => setReportFor({ id: student.id, name: student.name })}
              disabled={sessions.length === 0}
              className="rounded-lg border border-seum-blue px-4 py-2 text-sm font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-40"
            >
              📈 성장 리포트
            </button>
          )}
          <button
            type="button"
            onClick={() => setLive(true)}
            disabled={studentsLoading || students.length === 0}
            className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50"
          >
            🎙 현장 모의면접 시작
          </button>
        </div>
      </div>
      {!studentsLoading && students.length === 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {isMaster ? "대입 면접 수업을 듣는 학생이 없습니다." : "담당하는 대입 면접 학생이 없습니다. 원장님께 반 담당이나 학생 배정을 요청하세요."}
        </p>
      )}
      <p className="mb-4 text-[11px] text-slate-400">
        학원에서 학생 최대 {MAX_STUDENTS}명을 한 번에 진행합니다. 학생이 핸드폰으로 면접 화면의 [현장 면접 대기]를 켜 두면 노트북과 함께 녹음됩니다.
      </p>

      {/* 목록 */}
      {sessionsLoading ? (
        <p className="py-10 text-center text-slate-400">불러오는 중...</p>
      ) : sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          아직 현장 모의면접 기록이 없습니다.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-xs font-bold text-slate-500">{g.label}</p>
              <div className="space-y-2">
                {g.items.map((sim) => {
                  const on = openId === sim.id;
                  return (
                    <div key={sim.id}
                      className={`rounded-xl border bg-white transition ${on ? "border-seum-blue" : "border-slate-200"}`}>
                      <div className="flex items-center justify-between gap-3 p-4">
                        <button type="button" onClick={() => setOpenId(on ? null : sim.id)} className="min-w-0 flex-1 text-left">
                          <p className="font-medium text-seum-navy">
                            <span className="mr-1.5 text-slate-400">{roundOf(sim)}회</span>
                            {nameOf(sim.student_id)}
                            {sim.university && (
                              <span className="ml-1.5 text-xs font-normal text-slate-500">
                                {sim.university} · {sim.department}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {fmt(sim.opened_at ?? sim.created_at)} · 질문 {sim.question_count ?? "-"}개
                            {sim.status !== "done" && " · 진행 중"}
                          </p>
                        </button>
                        <button type="button" onClick={() => setReportFor({ id: sim.student_id, name: nameOf(sim.student_id) })}
                          className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-500 hover:border-seum-blue hover:text-seum-blue">
                          📈 리포트
                        </button>
                        <button type="button" onClick={() => removeSession(sim)}
                          className="shrink-0 text-xs text-slate-300 hover:text-red-500">✕</button>
                      </div>
                      {on && <SessionResult sim={sim} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {reportFor && (
        <ProgressReport studentId={reportFor.id} name={reportFor.name} onClose={() => setReportFor(null)} />
      )}

      {live && (
        <LiveSession
          teacherId={me.id}
          students={students}
          defaultIds={student ? [student.id] : []}
          onClose={() => { setLive(false); loadSessions(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// 성장 리포트 — 한 학생의 1회 → 2회 → 3회 … 변화
//   AI 진단 3축(말하기 구조 · 내용 구체성 · 컨셉 연결)은 상 3 · 중 2 · 하 1로 바꿔 회차 평균을 낸다.
//   말하기 습관(대답 길이 · 군말 · 속도)과 현장 평가(시선 · 자세 · 자신감)도 회차별로 나란히 본다.
// ============================================================
const AXES = [
  { label: "말하기 구조", color: "#2563EB" },
  { label: "내용 구체성", color: "#059669" },
  { label: "컨셉 연결", color: "#D97706" },
];
const GRADE_NUM = { 상: 3, 중: 2, 하: 1 };
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const f1 = (n) => (n == null ? "-" : n.toFixed(1));

const REPORT_PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #mock-report, #mock-report * { visibility: visible !important; }
  #mock-report { position: absolute !important; left: 0; top: 0; width: 100%; box-shadow: none !important; }
  .no-print { display: none !important; }
  @page { margin: 12mm; }
}`;

function summarize(sim, rows) {
  const answered = rows.filter((r) => r.transcript?.trim());
  const axis = {};
  AXES.forEach(({ label }) => {
    axis[label] = avg(
      answered
        .filter((r) => label !== "컨셉 연결" || !conceptCheck(r)?.skipped)
        .map((r) => (r.ai_scores ?? []).find((sc) => sc.label === label))
        .filter(Boolean)
        .map((sc) => sc.score ?? GRADE_NUM[sc.grade])
        .filter((n) => Number.isFinite(n))
    );
  });
  const axisVals = AXES.map((a) => axis[a.label]).filter((n) => n != null);
  const speeds = answered.map((r) => r.speed_label).filter(Boolean);
  const normal = speeds.filter((x) => x === "보통").length;
  return {
    sim,
    date: new Date(sim.opened_at ?? sim.created_at),
    mains: answered.filter((r) => !r.is_tail).length,
    tails: answered.filter((r) => r.is_tail).length,
    axis,
    total: avg(axisVals),
    diagnosed: answered.filter((r) => Array.isArray(r.ai_scores) && r.ai_scores.length).length,
    answeredN: answered.length,
    sec: avg(answered.map((r) => r.duration_sec).filter((n) => n > 0)),
    filler: avg(answered.map((r) => r.filler_count).filter((n) => n != null)),
    speedOk: speeds.length ? Math.round((normal / speeds.length) * 100) : null,
    ev: sim.teacher_eval ?? {},
    // 피드백 예시 — 가장 최근 선생님 피드백 한 줄
    lastFeedback: [...rows].reverse().find((r) => r.teacher_feedback?.trim())?.teacher_feedback ?? "",
  };
}

// 회차별 3축 꺾은선 (1~3점)
function TrendChart({ items }) {
  const W = 640;
  const H = 230;
  const L = 44;
  const R = 20;
  const T = 18;
  const B = 34;
  const n = items.length;
  const x = (i) => (n === 1 ? (L + W - R) / 2 : L + ((W - L - R) * i) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - 1) / 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {[1, 2, 3].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E2E8F0" strokeDasharray={v === 2 ? "4 4" : undefined} />
          <text x={L - 10} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#94A3B8">{["하", "중", "상"][v - 1]}</text>
        </g>
      ))}
      {items.map((it, i) => (
        <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">{i + 1}회</text>
      ))}
      {AXES.map((a) => {
        const pts = items.map((it, i) => (it.axis[a.label] == null ? null : [x(i), y(it.axis[a.label])])).filter(Boolean);
        return (
          <g key={a.label}>
            {pts.length > 1 && (
              <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={a.color} strokeWidth="2.5" strokeLinejoin="round" />
            )}
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill="#fff" stroke={a.color} strokeWidth="2.5" />)}
          </g>
        );
      })}
    </svg>
  );
}

// 처음 → 최근 변화 칩
function Delta({ from, to, better = "up", unit = "", digits = 1 }) {
  if (from == null || to == null) return <span className="text-slate-300">-</span>;
  const d = to - from;
  if (Math.abs(d) < 0.05) return <span className="text-slate-400">변화 없음</span>;
  const good = better === "up" ? d > 0 : d < 0;
  return (
    <span className={good ? "text-emerald-600" : "text-red-500"}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(digits)}{unit}
    </span>
  );
}

function ProgressReport({ studentId, name, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [concept, setConcept] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: sims, error } = await supabase
        .from("univ_simulations")
        .select("*")
        .eq("student_id", studentId)
        .eq("is_mock", true)
        .eq("mock_mode", "live")
        .order("created_at", { ascending: true });
      if (error) console.error("리포트 회차 조회 실패:", error);
      const list = sims ?? [];
      let qs = [];
      if (list.length) {
        const { data } = await supabase
          .from("univ_simulation_questions")
          .select("simulation_id, is_tail, transcript, duration_sec, speed_label, filler_count, ai_scores, ai_feedback, teacher_feedback, order, tail_index")
          .in("simulation_id", list.map((x) => x.id))
          .order("order", { ascending: true });
        qs = data ?? [];
      }
      const { data: asg } = await supabase
        .from("interview_assignments").select("concept").eq("student_id", studentId).maybeSingle();
      if (!alive) return;
      setConcept(asg?.concept ?? "");
      // 대답이 하나도 없는 회차(시작만 하고 끝낸 것)는 뺀다
      setItems(list.map((sim) => summarize(sim, qs.filter((q) => q.simulation_id === sim.id))).filter((x) => x.answeredN > 0));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [studentId]);

  const first = items[0];
  const last = items[items.length - 1];
  const undiagnosed = items.reduce((s, it) => s + (it.answeredN - it.diagnosed), 0);
  const fmtD = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <style>{REPORT_PRINT_CSS}</style>
      <div id="mock-report" className="my-6 w-full max-w-[860px] bg-white p-6 shadow-2xl md:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-seum-blue">세움스피치 모의면접 성장 리포트</p>
            <h3 className="mt-1 text-2xl font-extrabold text-seum-navy">{name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {items.length ? `${fmtD(first.date)} ~ ${fmtD(last.date)} · 모의면접 ${items.length}회` : ""}
              {concept ? ` · 컨셉 ${concept}` : ""}
            </p>
          </div>
          <div className="no-print flex shrink-0 gap-2">
            <button type="button" onClick={() => window.print()} disabled={!items.length}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">인쇄 · PDF</button>
            <button type="button" onClick={onClose} className="px-2 text-slate-400 hover:text-slate-700">✕</button>
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-slate-400">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400">대답이 기록된 모의면접이 아직 없습니다.</p>
        ) : (
          <>
            {/* 한눈에 */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-bold text-seum-blue">AI 진단 평균</p>
                <p className="mt-1 text-2xl font-extrabold text-seum-navy">{f1(last.total)}<span className="text-sm font-bold text-slate-400"> / 3</span></p>
                <p className="mt-0.5 text-xs font-bold">{items.length > 1 ? <Delta from={first.total} to={last.total} /> : "첫 회차"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">대답 1개 평균 길이</p>
                <p className="mt-1 text-2xl font-extrabold text-seum-navy">{last.sec ? Math.round(last.sec) : "-"}<span className="text-sm font-bold text-slate-400">초</span></p>
                <p className="mt-0.5 text-xs font-bold text-slate-400">{items.length > 1 && first.sec ? `1회 ${Math.round(first.sec)}초` : ""}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">대답 1개당 군말</p>
                <p className="mt-1 text-2xl font-extrabold text-seum-navy">{f1(last.filler)}<span className="text-sm font-bold text-slate-400">회</span></p>
                <p className="mt-0.5 text-xs font-bold">{items.length > 1 ? <Delta from={first.filler} to={last.filler} better="down" unit="회" /> : ""}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">꼬리질문까지 대답</p>
                <p className="mt-1 text-2xl font-extrabold text-seum-navy">{last.tails}<span className="text-sm font-bold text-slate-400">개</span></p>
                <p className="mt-0.5 text-xs font-bold text-slate-400">{items.length > 1 ? `1회 ${first.tails}개` : ""}</p>
              </div>
            </div>

            {/* 3축 꺾은선 */}
            <div className="mb-6 rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-seum-navy">회차별 AI 진단</p>
                <div className="flex flex-wrap gap-3 text-xs font-bold">
                  {AXES.map((a) => (
                    <span key={a.label} className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />{a.label}
                    </span>
                  ))}
                </div>
              </div>
              <TrendChart items={items} />
              {undiagnosed > 0 && (
                <p className="no-print mt-1 text-[11px] text-amber-700">
                  AI 진단이 없는 대답이 {undiagnosed}개 있어요. 목록에서 그 회차를 열고 [✨ 빠진 것 AI 진단]을 누르면 그래프에 들어갑니다.
                </p>
              )}
            </div>

            {/* 회차별 표 */}
            <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">회차</th>
                    {AXES.map((a) => <th key={a.label} className="px-2 py-2">{a.label}</th>)}
                    <th className="px-2 py-2">대답</th>
                    <th className="px-2 py-2">평균 길이</th>
                    <th className="px-2 py-2">군말/대답</th>
                    <th className="px-2 py-2">속도 보통</th>
                    <th className="px-2 py-2">시선·자세·자신감</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.sim.id} className="border-t border-slate-100 text-center">
                      <td className="px-3 py-2 text-left font-bold text-seum-navy">
                        {i + 1}회 <span className="ml-1 text-xs font-normal text-slate-400">{fmtD(it.date)}</span>
                      </td>
                      {AXES.map((a) => <td key={a.label} className="px-2 py-2 font-bold">{f1(it.axis[a.label])}</td>)}
                      <td className="px-2 py-2">{it.mains}{it.tails ? <span className="text-slate-400"> +꼬리 {it.tails}</span> : ""}</td>
                      <td className="px-2 py-2">{it.sec ? `${Math.round(it.sec)}초` : "-"}</td>
                      <td className="px-2 py-2">{f1(it.filler)}</td>
                      <td className="px-2 py-2">{it.speedOk == null ? "-" : `${it.speedOk}%`}</td>
                      <td className="px-2 py-2 text-xs">{["eye", "posture", "confidence"].map((k) => it.ev[k] ?? "-").join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 처음과 지금 */}
            {items.length > 1 && (
              <div className="mb-6 rounded-xl border border-slate-200 p-4">
                <p className="mb-3 font-bold text-seum-navy">1회와 최근({items.length}회) 비교</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {AXES.map((a) => (
                    <div key={a.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-bold text-slate-600">{a.label}</span>
                      <span className="font-bold">
                        <span className="text-slate-400">{f1(first.axis[a.label])} → </span>
                        <span className="text-seum-navy">{f1(last.axis[a.label])}</span>
                        <span className="ml-2 text-xs"><Delta from={first.axis[a.label]} to={last.axis[a.label]} /></span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {last.lastFeedback && (
              <div className="rounded-xl border-l-4 border-seum-blue bg-blue-50/50 px-4 py-3">
                <p className="mb-1 text-xs font-bold text-seum-blue">최근 선생님 피드백</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{last.lastFeedback}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 결과 — 한 학생의 현장 모의면접 한 번
// ============================================================
function SessionResult({ sim }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [concept, setConcept] = useState("");
  const [aiAll, setAiAll] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data, error }, { data: asg }] = await Promise.all([
        supabase.from("univ_simulation_questions").select("*").eq("simulation_id", sim.id).order("order", { ascending: true }),
        supabase.from("interview_assignments").select("concept").eq("student_id", sim.student_id).maybeSingle(),
      ]);
      if (!alive) return;
      if (error) console.error("문항 조회 실패:", error);
      setRows(data ?? []);
      setConcept(asg?.concept ?? "");
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [sim.id, sim.student_id]);

  const patch = (saved) => setRows((p) => p.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)));
  const ctx = { concept, univ: sim.university, major: sim.department };

  const mains = rows.filter((r) => !r.is_tail);
  const tailsOf = (id) => rows.filter((r) => r.is_tail && r.parent_id === id).sort((a, b) => (a.tail_index ?? 0) - (b.tail_index ?? 0));
  const answeredN = rows.filter((r) => r.transcript?.trim()).length;
  const ev = sim.teacher_eval ?? {};

  const genAll = async () => {
    const targets = rows.filter((r) => r.transcript?.trim() && !r.ai_feedback);
    if (targets.length === 0) return alert("진단할 대답이 없습니다. (대답이 없거나 이미 진단했습니다)");
    setAiAll({ done: 0, total: targets.length });
    let fail = 0;
    let first = "";
    for (let i = 0; i < targets.length; i++) {
      try {
        patch(await runMockAi(targets[i], ctx));
      } catch (e) {
        fail += 1;
        if (!first) first = e.message;
      }
      setAiAll({ done: i + 1, total: targets.length });
    }
    setAiAll(null);
    if (fail) alert(`${targets.length}건 중 ${fail}건 실패했습니다.\n\n${first}`);
  };

  if (loading) return <p className="border-t border-slate-100 py-6 text-center text-sm text-slate-400">불러오는 중...</p>;

  return (
    <div className="border-t border-slate-100 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-slate-400">
          대답 {answeredN}개 · 진단 {rows.filter((x) => x.ai_feedback).length}개
          {concept ? ` · 컨셉 ${concept}` : ""}
        </span>
        <button type="button" onClick={genAll} disabled={!!aiAll}
          className="rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
          {aiAll ? `진단 중... (${aiAll.done}/${aiAll.total})` : "✨ 빠진 것 AI 진단"}
        </button>
      </div>

      {(ev.eye || ev.posture || ev.confidence || ev.memo) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px]">
          <span className="font-bold text-slate-500">현장 평가</span>
          {EVALS.map(([k, label]) => ev[k] && (
            <span key={k} className={`rounded px-2 py-0.5 font-bold ${scoreCls(ev[k])}`}>{label} {ev[k]}</span>
          ))}
          {ev.memo && <span className="text-slate-600">· {ev.memo}</span>}
        </div>
      )}

      {mains.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">질문이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {mains.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-3">
              <QuestionResult row={r} no={i + 1} ctx={ctx} onSaved={patch} />
              {tailsOf(r.id).map((t) => (
                <div key={t.id} className="mt-3 border-l-2 border-amber-200 pl-3">
                  <QuestionResult row={t} no={`꼬리 ${t.tail_index ?? ""}`} ctx={ctx} onSaved={patch} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 문항 하나 — 녹음 듣기 · 받아 적은 대화 · AI 진단 · 선생님 피드백
function QuestionResult({ row, no, ctx, onSaved }) {
  const [fb, setFb] = useState(row.teacher_feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [showLines, setShowLines] = useState(false);
  useEffect(() => { setFb(row.teacher_feedback ?? ""); }, [row.id, row.teacher_feedback]);

  const answered = !!row.transcript?.trim();
  const dirty = fb !== (row.teacher_feedback ?? "");
  const src = row.question_source ?? (row.is_tail ? "followup" : null);

  const runAi = async () => {
    setAiBusy(true);
    try {
      onSaved(await runMockAi(row, ctx));
    } catch (e) {
      alert("AI 진단 실패:\n\n" + e.message);
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    const text = fb.trim();
    if (!text) return alert("피드백을 입력하세요.");
    setSaving(true);
    const { data, error } = await supabase
      .from("univ_simulation_questions")
      .update({ teacher_feedback: text, feedback_at: new Date().toISOString() })
      .eq("id", row.id)
      .select()
      .maybeSingle();
    setSaving(false);
    if (error) return alert("저장 실패: " + error.message);
    onSaved(data);
  };

  return (
    <div>
      <p className="text-sm font-medium text-seum-navy">
        <span className="mr-1 text-slate-400">{no}.</span>
        {src && (
          <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-[10px] font-bold ${SOURCE_CHIP[src] ?? SOURCE_CHIP.custom}`}>
            {SOURCE_LABEL[src] ?? src}
          </span>
        )}
        {row.question_text}
      </p>

      {!answered ? (
        <p className="mt-2 text-xs text-slate-400">대답하지 않은 질문입니다.</p>
      ) : (
        <>
          {/* 녹음 — 바로 이어 한 꼬리질문은 본 질문 녹음 안에 들어 있다 */}
          {row.recording_url && (
            <audio controls src={row.recording_url} className="mt-2 h-8 w-full" />
          )}
          {row.student_recording_url && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-slate-400">학생 핸드폰 녹음</summary>
              <audio controls src={row.student_recording_url} className="mt-1 h-8 w-full" />
            </details>
          )}

          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-400">학생 대답</p>
              {Array.isArray(row.lines) && row.lines.length > 1 && (
                <button type="button" onClick={() => setShowLines((v) => !v)}
                  className="text-[11px] font-medium text-seum-blue hover:underline">
                  {showLines ? "대답만 보기" : "대화로 보기"}
                </button>
              )}
            </div>
            {showLines ? (
              <div className="space-y-1.5">
                {row.lines.map((l, i) => (
                  <div key={i} className="flex gap-2 text-sm leading-relaxed">
                    <span className={`h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      l.who === "interviewer" ? "bg-seum-navy text-white" : "bg-blue-100 text-seum-blue"}`}>
                      {l.who === "interviewer" ? "면접관" : "학생"}
                    </span>
                    <span className="text-slate-700">{l.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{row.transcript}</p>
            )}
          </div>

          {(row.speed_label || row.filler_count != null || row.duration_sec) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.duration_sec ? (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">대답 {row.duration_sec}초</span>
              ) : null}
              {row.speed_label && (
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-seum-blue">속도 {row.speed_label}</span>
              )}
              {row.filler_count != null && (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">군말 {row.filler_count}회</span>
              )}
            </div>
          )}

          {row.ai_feedback && <div className="mt-2"><ConceptMatch row={row} concept={ctx.concept} /></div>}

          {/* AI 진단 — 선생님만 본다 */}
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-[11px] font-black text-slate-500">
                AI 진단
                <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 font-bold">선생님만 봄</span>
              </p>
              <button type="button" onClick={runAi} disabled={aiBusy}
                className="shrink-0 rounded-md border border-seum-blue px-2.5 py-0.5 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-40">
                {aiBusy ? "진단 중..." : row.ai_feedback ? "🔄 다시" : "✨ AI 진단"}
              </button>
            </div>
            {row.ai_feedback ? (
              <>
                {Array.isArray(row.ai_scores) && row.ai_scores.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-slate-200 px-3 py-2">
                    {row.ai_scores.map((sc) => (
                      <span key={sc.label} className={`rounded px-2 py-0.5 text-[11px] font-bold ${scoreCls(sc.grade)}`}>
                        {sc.label} {sc.grade}
                      </span>
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap border-t border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
                  {row.ai_feedback}
                </p>
              </>
            ) : (
              <p className="border-t border-slate-200 px-3 py-2.5 text-xs text-slate-400">아직 진단하지 않았습니다.</p>
            )}
          </div>

          {/* 선생님 피드백 */}
          <div className="mt-2">
            <textarea value={fb} onChange={(e) => setFb(e.target.value)} rows={3}
              placeholder="학생에게 전할 피드백"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
            <div className="mt-1.5 flex items-center justify-end gap-2">
              {row.feedback_at && !dirty && <span className="text-[11px] text-slate-400">{fmt(row.feedback_at)} 저장됨</span>}
              <button type="button" onClick={save} disabled={saving || !dirty}
                className={`rounded-lg px-3 py-1 text-xs font-bold text-white transition disabled:opacity-100 ${
                  !dirty && row.teacher_feedback ? "cursor-default bg-green-600" : "bg-seum-blue hover:bg-[#2a63c4] disabled:opacity-40"}`}>
                {saving ? "저장 중..." : !dirty && row.teacher_feedback ? "✓ 저장됨" : "피드백 저장"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// 진행 — 전체 화면
// ============================================================
function LiveSession({ teacherId, students, defaultIds, onClose }) {
  const today = new Date();
  const period = `${today.getMonth() + 1}월 ${today.getDate()}일`;

  // ───────── 준비 ─────────
  const [step, setStep] = useState("setup");
  const [picked, setPicked] = useState(() => defaultIds.filter((id) => students.some((s) => s.id === id)));
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("1조");
  const [univPicks, setUnivPicks] = useState({});   // { [학생]: [지원 학교...] }
  const [target, setTarget] = useState({});         // { [학생]: 고른 지원 학교 id }
  const [counts, setCounts] = useState({});         // { [학생]: { insung, saenggibu, gichul } }
  const [preparing, setPreparing] = useState("");
  const [err, setErr] = useState("");

  const studentOf = (id) => students.find((s) => s.id === id) ?? { id, name: "학생" };
  const countOf = (id) => counts[id] ?? DEF_COUNTS;
  const pickOf = (id) => (univPicks[id] ?? []).find((p) => p.id === target[id]) ?? null;

  const togglePick = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_STUDENTS ? p : [...p, id]));

  const changeCount = (id, key, d) =>
    setCounts((c) => {
      const cur = c[id] ?? DEF_COUNTS;
      return { ...c, [id]: { ...cur, [key]: Math.max(0, Math.min(MAX_EACH, cur[key] + d)) } };
    });

  // 고른 학생의 지원 학교 (기출용)
  useEffect(() => {
    const need = picked.filter((id) => !(id in univPicks));
    if (need.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("student_univ_picks")
        .select("*")
        .in("student_id", need)
        .order("created_at");
      const m = {};
      need.forEach((id) => { m[id] = []; });
      (data ?? []).forEach((p) => { m[p.student_id].push(p); });
      setUnivPicks((u) => ({ ...u, ...m }));
      setTarget((t) => {
        const n = { ...t };
        need.forEach((id) => { if (!n[id] && m[id][0]) n[id] = m[id][0].id; });
        return n;
      });
    })();
  }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps

  // 고른 학생의 면접 컨셉 (선생님이 [면접 컨셉]에 적은 것)
  const [concepts, setConcepts] = useState({});
  useEffect(() => {
    const need = picked.filter((id) => !(id in concepts));
    if (need.length === 0) return;
    (async () => {
      const { data } = await supabase.from("interview_assignments").select("student_id, concept").in("student_id", need);
      const m = {};
      need.forEach((id) => { m[id] = (data ?? []).find((a) => a.student_id === id)?.concept?.trim() || ""; });
      setConcepts((c) => ({ ...c, ...m }));
    })();
  }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownStudents = students.filter((s) => !search.trim() || (s.name ?? "").includes(search.trim()));

  // ───────── 진행 ─────────
  const [seats, setSeats] = useState([]);
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState(null);            // null | "custom" | "voice"
  const [customText, setCustomText] = useState("");
  const [cont, setCont] = useState(null);            // { parentId } — 꼬리질문만 이어서 녹음
  const [phase, setPhase] = useState("idle");        // idle | rec
  const [sec, setSec] = useState(0);
  const [jobs, setJobs] = useState([]);              // 받아 적는 중·실패한 녹음
  const [aiBusy, setAiBusy] = useState({});          // { [문항 id]: true }
  const [lastBy, setLastBy] = useState({});          // { [학생]: { parentId, ids } }
  const [fbTab, setFbTab] = useState(0);
  const [evals, setEvals] = useState({});
  const [ending, setEnding] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const seatsRef = useRef([]);
  useEffect(() => { seatsRef.current = seats; }, [seats]);
  const curCtxRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (recRef.current?.state === "recording") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // 시작: 마이크 → 학생마다 기록 만들기 → 질문 뽑기
  const start = async () => {
    setErr("");
    try {
      setPreparing("마이크 연결 중…");
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      setPreparing("질문 준비 중…");
      const { data: insRows, error: insErr } = await supabase
        .from("interview_questions_v2")
        .select("question")
        .eq("category_key", "univ")
        .eq("tab_key", "insung")
        .eq("is_active", true);
      if (insErr) throw insErr;
      const insungAll = uniq((insRows ?? []).map((r) => r.question));

      const { data: asg } = await supabase
        .from("interview_assignments")
        .select("student_id, concept")
        .in("student_id", picked);
      const conceptOf = (id) => (asg ?? []).find((a) => a.student_id === id)?.concept ?? "";

      const next = [];
      for (const id of picked) {
        const s = studentOf(id);
        const pick = pickOf(id);
        setPreparing(`${s.name} 질문 준비 중…`);

        const { data: sgRows } = await supabase
          .from("student_questions")
          .select("question")
          .eq("student_id", id)
          .eq("tab_key", "saenggibu")
          .eq("is_active", true)
          .not("sent_at", "is", null);
        let gichulAll = [];
        if (pick) {
          const { data: gq } = await supabase
            .from("univ_questions")
            .select("question")
            .eq("univ", pick.univ)
            .eq("major", pick.major)
            .eq("admission", pick.admission)
            .eq("is_active", true);
          gichulAll = uniq((gq ?? []).map((r) => r.question));
        }
        const pools = {
          insung: shuffle(insungAll),
          saenggibu: shuffle(uniq((sgRows ?? []).map((r) => r.question))),
          gichul: shuffle(gichulAll),
        };

        // 자기소개 + 고른 개수만큼. 모자라면 기본 인성으로 채운다
        const used = new Set([INTRO]);
        const take = (key) => {
          const fromPool = (k) => {
            while (pools[k].length) {
              const t = pools[k].shift();
              if (!used.has(t)) { used.add(t); return { source: k, text: t }; }
            }
            return null;
          };
          return fromPool(key) ?? (key !== "insung" ? fromPool("insung") : null);
        };
        const want = SOURCES.flatMap((src) => Array(countOf(id)[src.key]).fill(src.key));
        const items = [{ source: "intro", text: INTRO }];
        want.forEach((k) => { const it = take(k); if (it) items.push(it); });

        const { data: sim, error: simErr } = await supabase
          .from("univ_simulations")
          .insert({
            student_id: id,
            teacher_id: teacherId ?? null,
            question_type: "live",
            tail_question_enabled: true,
            question_mode: "live",
            university: pick?.univ ?? null,
            department: pick?.major ?? null,
            admission_type: pick?.admission ?? null,
            question_count: items.length,
            is_mock: true,
            mock_mode: "live",
            live_group: group.trim() || null,
            opened_at: new Date().toISOString(),
            status: "doing",
          })
          .select()
          .single();
        if (simErr) throw simErr;

        const { data: rows, error: qErr } = await supabase
          .from("univ_simulation_questions")
          .insert(items.map((it, i) => ({
            simulation_id: sim.id,
            student_id: id,
            order: i + 1,
            question_text: it.text,
            question_source: it.source,
            is_tail: false,
          })))
          .select();
        if (qErr) throw qErr;

        next.push({
          student: s,
          sim,
          pick,
          concept: conceptOf(id),
          rows: (rows ?? []).sort((a, b) => a.order - b.order),
          tails: [],
          pos: 0,
          pools,
        });
      }
      setSeats(next);
      setSel(0);
      setStep("live");
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setErr(e?.name === "NotAllowedError"
        ? "마이크 사용을 허용해 주세요. (주소창 왼쪽 자물쇠 → 마이크 허용)"
        : `시작 실패: ${e.message || e}`);
    } finally {
      setPreparing("");
    }
  };

  const patchStudent = (sid, fn) => setSeats((prev) => prev.map((s) => (s.student.id === sid ? fn(s) : s)));
  const patchRow = (sid, saved) =>
    patchStudent(sid, (x) => ({
      ...x,
      rows: x.rows.map((r) => (r.id === saved.id ? { ...r, ...saved } : r)),
      tails: x.tails.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)),
    }));

  const seat = seats[sel];
  const cur = seat?.rows[seat.pos];
  const answered = (r) => !!r?.transcript?.trim();
  const running = jobs.filter((j) => j.status === "running");
  const busyRowIds = new Set(running.map((j) => j.rowId).filter(Boolean));
  const isBusyRow = (r) => !!r && busyRowIds.has(r.id);
  const doneOrBusy = (r) => answered(r) || isBusyRow(r);

  const pickStudent = (i) => {
    if (phase === "rec") return;
    setSel(i); setMode(null); setCont(null); setFbTab(0);
  };
  const goPos = (k) => {
    if (phase === "rec") return;
    patchStudent(seat.student.id, (s) => ({ ...s, pos: k }));
    setMode(null); setCont(null); setFbTab(0);
  };

  // 같은 종류의 다른 질문으로 바꾸기 (대답 전만)
  const swap = async () => {
    if (!seat || !cur || answered(cur) || cur.question_source === "intro") return;
    const key = cur.question_source;
    const used = new Set(seat.rows.map((r) => r.question_text));
    const pool = [...(seat.pools[key] ?? []), ...(key !== "insung" ? seat.pools.insung : [])];
    const text = pool.find((t) => !used.has(t));
    if (!text) return alert("바꿀 질문이 더 없습니다.");
    const source = (seat.pools[key] ?? []).includes(text) ? key : "insung";
    const { error } = await supabase
      .from("univ_simulation_questions")
      .update({ question_text: text, question_source: source })
      .eq("id", cur.id);
    if (error) return alert("바꾸기 실패: " + error.message);
    patchStudent(seat.student.id, (s) => ({
      ...s,
      pools: { ...s.pools, [source]: s.pools[source].filter((t) => t !== text) },
      rows: s.rows.map((r) => (r.id === cur.id ? { ...r, question_text: text, question_source: source } : r)),
    }));
  };

  const qText = cont ? "녹음을 시작하고 이어서 꼬리질문을 하세요"
    : mode === "custom" ? (customText.trim() || "아래에 질문을 적어 주세요")
    : mode === "voice" ? "녹음을 시작하고 말로 질문하세요"
    : cur?.question_text ?? "";
  const qTag = cont ? "followup" : mode ?? cur?.question_source ?? "";

  // ───────── 학생 핸드폰 연결 (Supabase 실시간) ─────────
  //   학생이 핸드폰에서 [현장 면접 대기]를 켜 두면 채널 live-mock-{학생id}에 들어와 있다
  //   녹음 시작/끝 → 학생 핸드폰도 시작/끝 → 학생이 파일을 올리고 "uploaded"로 알려 준다
  const [phones, setPhones] = useState({});
  const chansRef = useRef({});
  const uploadWaitRef = useRef({});
  const uploadedRef = useRef({});
  const seatIds = seats.map((x) => x.student.id).join(",");
  useEffect(() => {
    if (step !== "live") return;
    seatIds.split(",").filter(Boolean).forEach((sid) => {
      if (chansRef.current[sid]) return;
      const ch = supabase.channel(`live-mock-${sid}`, { config: { broadcast: { self: false }, presence: { key: "teacher" } } });
      ch.on("presence", { event: "sync" }, () => {
        const st = ch.presenceState();
        setPhones((p) => ({ ...p, [sid]: !!st.student?.length }));
      });
      ch.on("broadcast", { event: "uploaded" }, ({ payload }) => {
        const v = payload?.path ? { path: payload.path, startedAt: Number(payload.startedAt) || 0 } : null;
        uploadedRef.current[payload?.recId] = v;
        uploadWaitRef.current[payload?.recId]?.(v);
      });
      ch.subscribe((status) => { if (status === "SUBSCRIBED") ch.track({ role: "teacher" }); });
      chansRef.current[sid] = ch;
    });
  }, [step, seatIds]);
  useEffect(() => () => {
    Object.values(chansRef.current).forEach((ch) => { supabase.removeChannel(ch); });
    chansRef.current = {};
  }, []);
  const sendToPhone = (sid, event, payload) => {
    chansRef.current[sid]?.send({ type: "broadcast", event, payload });
  };
  // 학생 핸드폰 파일이 올라올 때까지 기다림 (최대 25초, 안 오면 노트북 녹음만으로)
  const waitPhoneUpload = (recId) => new Promise((resolve) => {
    if (recId in uploadedRef.current) { resolve(uploadedRef.current[recId]); return; }
    const timer = window.setTimeout(() => { delete uploadWaitRef.current[recId]; resolve(null); }, 25000);
    uploadWaitRef.current[recId] = (v) => { window.clearTimeout(timer); delete uploadWaitRef.current[recId]; resolve(v); };
  });

  // ───────── 녹음 ─────────
  const startRec = () => {
    if (!streamRef.current || !seat) { setErr("마이크가 연결되지 않았어요."); return; }
    if (mode === "custom" && !customText.trim()) { alert("질문을 먼저 적어 주세요."); return; }
    if (!cont && !mode && cur && isBusyRow(cur)) { alert("이 질문은 아직 정리 중이에요. 다른 질문을 먼저 하세요."); return; }
    setErr("");
    // 녹음 시작 순간의 상황을 기억 (끝나고 다른 학생으로 넘어가도 이 학생에게 저장)
    const ctx = {
      studentId: seat.student.id,
      rowId: !cont && !mode && cur ? cur.id : null,
      contParentId: cont?.parentId ?? null,
      mode,
      qText,
      customText,
      recId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      phone: !!phones[seat.student.id],
      startedAt: Date.now(),
    };
    curCtxRef.current = ctx;
    if (ctx.phone) {
      sendToPhone(ctx.studentId, "start", {
        recId: ctx.recId,
        question: cont ? "꼬리질문에 대답해 주세요" : mode === "voice" ? "선생님 질문을 듣고 대답해 주세요" : qText,
        teacherStartedAt: ctx.startedAt,
      });
    }
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => { analyze(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }), ctx); };
    rec.start();
    recRef.current = rec;
    setSec(0);
    timerRef.current = window.setInterval(() => setSec((s) => s + 1), 1000);
    setPhase("rec");
  };

  // 끝 → 바로 다음 질문으로 (받아 적기·진단은 뒤에서)
  const stopRec = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    recRef.current?.stop();
    const c = curCtxRef.current;
    if (c?.phone) sendToPhone(c.studentId, "stop", { recId: c.recId });
    curCtxRef.current = null;
    setPhase("idle");
    if (seat && !cont && !mode) {
      const open = seat.rows.findIndex((r, k) => k !== seat.pos && !doneOrBusy(r) && r.id !== c?.rowId);
      if (open >= 0) patchStudent(seat.student.id, (s) => ({ ...s, pos: open }));
    }
    setCont(null); setMode(null); setCustomText("");
  };

  // 녹음 한 번 = 본 질문 + 대답 + (바로 한) 꼬리질문 + 대답 … → 문답별로 나눠 저장 → 문답마다 AI 진단
  const analyze = async (blob, ctx) => {
    const s0 = seatsRef.current.find((x) => x.student.id === ctx.studentId);
    if (!s0) return;
    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const row0 = ctx.rowId ? s0.rows.find((r) => r.id === ctx.rowId) : null;
    setJobs((js) => [...js, {
      id: jobId,
      studentId: ctx.studentId,
      name: s0.student.name,
      rowId: ctx.rowId,
      label: ctx.contParentId ? "꼬리질문" : ctx.mode ? "추가 질문" : `${s0.rows.findIndex((r) => r.id === ctx.rowId) + 1}번 질문`,
      status: "running",
    }]);

    try {
      // 학생 핸드폰도 녹음했으면 그 파일이 올라올 때까지 기다렸다가 같이 보냄
      const phone = ctx.phone ? await waitPhoneUpload(ctx.recId) : null;
      const delay = phone ? (phone.startedAt - ctx.startedAt) / 1000 : 0;
      const fd = new FormData();
      fd.append("audio", new File([blob], (blob.type || "").includes("mp4") ? "answer.mp4" : "answer.webm", { type: blob.type || "audio/webm" }));
      fd.append("meta", JSON.stringify({
        studentId: ctx.studentId,
        recId: ctx.recId,
        questionText: ctx.contParentId || ctx.mode === "voice" ? "" : ctx.qText,
        voiceQuestion: !ctx.contParentId && ctx.mode === "voice",
        continuation: !!ctx.contParentId,
        studentName: s0.student.name,
        concept: s0.concept || undefined,
        univ: s0.pick?.univ,
        major: s0.pick?.major,
        studentAudioPath: phone?.path ?? undefined,
        // 기기 시계가 어긋날 수 있어서 0~2초 사이일 때만 믿음
        studentDelaySec: phone ? (delay >= 0 && delay <= 2 ? delay : 0.3) : undefined,
      }));
      const { data, error } = await supabase.functions.invoke("interview-live-answer", { body: fd });
      if (error) throw new Error(await fnError(error));
      if (!data?.success) throw new Error(data?.error || "받아 적기 실패");
      const pairs = data.pairs ?? [];
      if (pairs.length === 0) throw new Error("대화를 나누지 못했어요");

      const liveOf = (p, withAudio) => ({
        transcript: p.answer || null,
        lines: p.lines,
        duration_sec: p.durationSec,
        speed_label: p.speedLabel,
        filler_count: p.fillerCount,
        ...(withAudio ? { recording_url: data.recordingUrl, student_recording_url: data.studentRecordingUrl } : {}),
      });

      const sNow = seatsRef.current.find((x) => x.student.id === ctx.studentId) ?? s0;
      let mainRow = ctx.contParentId ? sNow.rows.find((r) => r.id === ctx.contParentId) : row0;
      let tailPairs = pairs;
      const saved = [];

      if (!ctx.contParentId) {
        const p0 = pairs[0];
        tailPairs = pairs.slice(1);
        if (ctx.mode) {
          // 목록에 없던 질문 → 본 질문 뒤에 추가
          const order = Math.max(0, ...sNow.rows.map((r) => r.order || 0)) + 1;
          const { data: ins, error: iErr } = await supabase
            .from("univ_simulation_questions")
            .insert({
              simulation_id: s0.sim.id,
              student_id: ctx.studentId,
              order,
              is_tail: false,
              question_source: ctx.mode,
              question_text: (p0.question || ctx.customText || "").trim() || "(말로 한 질문)",
              ...liveOf(p0, true),
            })
            .select()
            .single();
          if (iErr) throw iErr;
          mainRow = ins;
          saved.push(ins);
          patchStudent(ctx.studentId, (x) => ({ ...x, rows: [...x.rows, ins] }));
        } else if (row0) {
          const { data: up, error: uErr } = await supabase
            .from("univ_simulation_questions")
            .update(liveOf(p0, true))
            .eq("id", row0.id)
            .select()
            .single();
          if (uErr) throw uErr;
          mainRow = up;
          saved.push(up);
          patchRow(ctx.studentId, up);
        }
      }

      // 이어서 한 꼬리질문들 → 그 본 질문 밑에 꼬리 1, 꼬리 2 …
      const before = mainRow ? sNow.tails.filter((t) => t.parent_id === mainRow.id).length : 0;
      if (mainRow && tailPairs.length) {
        const { data: ins, error: iErr } = await supabase
          .from("univ_simulation_questions")
          .insert(tailPairs.map((p, i) => ({
            simulation_id: s0.sim.id,
            student_id: ctx.studentId,
            order: mainRow.order,
            is_tail: true,
            parent_id: mainRow.id,
            tail_index: before + i + 1,
            question_source: "followup",
            question_text: p.question,
            // 이어서 녹음한 꼬리질문은 자기 녹음이 따로 있다
            ...liveOf(p, !!ctx.contParentId && i === 0),
          })))
          .select();
        if (iErr) throw iErr;
        const list = (ins ?? []).sort((a, b) => (a.tail_index ?? 0) - (b.tail_index ?? 0));
        saved.push(...list);
        patchStudent(ctx.studentId, (x) => ({ ...x, tails: [...x.tails, ...list] }));
      }

      setLastBy((m) => ({ ...m, [ctx.studentId]: { parentId: mainRow?.id ?? "", ids: saved.map((r) => r.id) } }));
      setJobs((js) => js.filter((j) => j.id !== jobId));

      // 문답마다 AI 진단 — 기다리지 않고 다음 진행
      const aiCtx = { concept: s0.concept, univ: s0.pick?.univ, major: s0.pick?.major };
      for (const r of saved) {
        if (!r.transcript?.trim()) continue;
        setAiBusy((b) => ({ ...b, [r.id]: true }));
        try {
          patchRow(ctx.studentId, await runMockAi(r, aiCtx));
        } catch (e) {
          console.error("AI 진단 실패:", e.message);
        } finally {
          setAiBusy((b) => { const n = { ...b }; delete n[r.id]; return n; });
        }
      }
    } catch (e) {
      setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, status: "error", error: e.message || String(e) } : j)));
    }
  };

  // 실패한 녹음 → 그 학생·그 질문으로 돌아가서 다시
  const retryJob = (j) => {
    const i = seats.findIndex((x) => x.student.id === j.studentId);
    if (i >= 0) {
      setSel(i);
      const k = j.rowId ? seats[i].rows.findIndex((r) => r.id === j.rowId) : -1;
      if (k >= 0) patchStudent(j.studentId, (x) => ({ ...x, pos: k }));
    }
    setMode(null); setCont(null);
    setJobs((js) => js.filter((x) => x.id !== j.id));
  };

  // 지금 보여 줄 문답 — 대답한 질문을 누르면 그 질문(+ 꼬리질문), 아니면 이 학생 마지막 녹음
  const allRows = seat ? [...seat.rows, ...seat.tails] : [];
  const byId = (id) => allRows.find((r) => r.id === id);
  const viewingRow = !cont && !mode && cur && answered(cur) ? cur : null;
  const last = seat ? lastBy[seat.student.id] ?? null : null;
  const shownRows = viewingRow
    ? [viewingRow, ...seat.tails.filter((t) => t.parent_id === viewingRow.id).sort((a, b) => (a.tail_index ?? 0) - (b.tail_index ?? 0))]
    : (last?.ids ?? []).map(byId).filter(Boolean);
  const shownParentId = viewingRow ? viewingRow.id : last?.parentId ?? "";
  const shownLabel = viewingRow ? `${seat.rows.indexOf(viewingRow) + 1}번 질문 기록` : "마지막 녹음";
  const pairLabel = (r) => (r.is_tail ? `꼬리 ${r.tail_index ?? ""}` : "본 질문");
  const runningHere = seat ? running.filter((j) => j.studentId === seat.student.id) : [];
  const fbRow = shownRows[Math.min(fbTab, Math.max(0, shownRows.length - 1))];

  // 선생님 직접 평가 — 누를 때마다 저장
  const saveEval = async (sid, nextEval) => {
    const s = seats.find((x) => x.student.id === sid);
    if (!s) return;
    const { error } = await supabase.from("univ_simulations").update({ teacher_eval: nextEval }).eq("id", s.sim.id);
    if (error) console.error("평가 저장 실패:", error);
  };
  const setEval = (key, value) => {
    if (!seat) return;
    const sid = seat.student.id;
    const nextEval = { ...(evals[sid] ?? {}), [key]: value };
    setEvals((e) => ({ ...e, [sid]: nextEval }));
    if (key !== "memo") saveEval(sid, nextEval);
  };

  const close = () => {
    if (phase === "rec" && !window.confirm("녹음 중이에요. 그래도 닫을까요?")) return;
    if (running.length && !window.confirm(`아직 ${running.length}개를 받아 적고 있어요. 지금 닫으면 저장이 안 될 수 있어요. 그래도 닫을까요?`)) return;
    if (recRef.current?.state === "recording") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  // 면접 끝 — 기록을 "끝"으로 바꾸고 닫는다
  const finish = async () => {
    setFinishing(true);
    try {
      for (const s of seats) {
        await supabase
          .from("univ_simulations")
          .update({
            status: "done",
            question_count: s.rows.length,
            teacher_eval: evals[s.student.id] ?? s.sim.teacher_eval ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", s.sim.id);
      }
    } finally {
      setFinishing(false);
    }
    if (recRef.current?.state === "recording") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  // ═════════════════════════ 화면 ═════════════════════════
  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-slate-100">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5">
        {/* 상단 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xl font-extrabold text-seum-navy">현장 모의면접</div>
            <div className="text-sm text-slate-500">
              {period}{step === "live" ? ` · ${group ? `${group} · ` : ""}${seats.length}명` : ""}
            </div>
          </div>
          <button type="button" onClick={step === "live" ? () => setEnding(true) : close}
            className="h-11 rounded-xl bg-seum-navy px-4 text-sm font-bold text-white">
            {step === "live" ? "면접 끝내기" : "닫기"}
          </button>
        </div>

        {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{err}</div>}

        {/* ═════ 면접 끝 ═════ */}
        {ending && (
          <div className="fixed inset-0 z-[310] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
            <div className="mt-10 flex w-full max-w-[640px] flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl">
              <div>
                <div className="text-lg font-extrabold text-seum-navy">면접 끝내기</div>
                <div className="mt-1 text-sm text-slate-500">
                  기록은 이미 저장되어 있어요. 학생별 피드백은 모의면접 목록에서 열어 확인하고 저장하세요.
                </div>
              </div>
              {running.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  아직 {running.length}개를 받아 적고 있어요. 끝날 때까지 기다렸다가 닫아 주세요. (10~30초)
                </div>
              )}
              <div className="flex flex-col gap-2">
                {seats.map((s) => {
                  const done = s.rows.filter(answered).length;
                  const tailN = s.tails.filter(answered).length;
                  const busy = running.filter((j) => j.studentId === s.student.id).length;
                  const failed = jobs.filter((j) => j.studentId === s.student.id && j.status === "error").length;
                  return (
                    <div key={s.student.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                      <span className="font-bold text-seum-navy">{s.student.name}</span>
                      <span className="text-xs text-slate-500">
                        답한 질문 {done}/{s.rows.length}{tailN ? ` · 꼬리 ${tailN}` : ""}
                        {busy ? ` · 정리 중 ${busy}` : ""}{failed ? ` · 실패 ${failed}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setEnding(false)}
                  className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">면접 계속</button>
                <button type="button" onClick={finish} disabled={finishing || running.length > 0}
                  className="h-11 rounded-xl bg-seum-blue px-5 text-sm font-extrabold text-white disabled:opacity-40">
                  {finishing ? "저장 중…" : running.length ? "정리 끝나면 닫을 수 있어요" : "끝내고 닫기"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═════ 준비 ═════ */}
        {step === "setup" && (
          <div className="flex max-w-[1000px] flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-bold text-seum-navy">오늘 면접 볼 학생</div>
                <div className="flex items-center gap-3">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름 검색"
                    className="h-9 w-36 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-seum-blue" />
                  <div className="text-sm font-bold text-seum-blue">{picked.length} / {MAX_STUDENTS}명</div>
                </div>
              </div>
              <div className="text-xs text-slate-500">고른 순서대로 1~{MAX_STUDENTS}번 칸이 됩니다.</div>
              <div className="flex flex-wrap gap-2">
                {shownStudents.map((s) => {
                  const idx = picked.indexOf(s.id);
                  const on = idx >= 0;
                  const full = !on && picked.length >= MAX_STUDENTS;
                  return (
                    <button key={s.id} type="button" onClick={() => togglePick(s.id)} disabled={full}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition disabled:opacity-40 ${
                        on ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] ${on ? "bg-seum-blue text-white" : "border border-slate-300"}`}>
                        {on ? idx + 1 : ""}
                      </span>
                      {s.name}
                      {s.courses?.[0] && <span className="text-[11px] font-normal text-slate-400">{s.courses[0]}</span>}
                    </button>
                  );
                })}
                {shownStudents.length === 0 && <p className="text-sm text-slate-400">학생이 없습니다.</p>}
              </div>
            </div>

            {picked.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="font-bold text-seum-navy">학생별 질문</div>
                <div className="text-xs text-slate-500">
                  자기소개 1개 + 고른 개수만큼 뽑습니다. 생기부는 학생에게 보낸 생기부 질문, 기출은 학생이 고른 지원 학교에서 뽑고, 모자라면 기본 인성으로 채웁니다.
                </div>
                {picked.map((id, i) => {
                  const s = studentOf(id);
                  const picks = univPicks[id];
                  const c = countOf(id);
                  return (
                    <div key={id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 md:flex-row md:items-center">
                      <div className="w-40 shrink-0">
                        <p className="font-bold text-seum-navy"><span className="mr-1.5 text-slate-400">{i + 1}</span>{s.name}</p>
                        <p className={`truncate text-[11px] ${concepts[id] ? "text-slate-500" : "font-bold text-amber-600"}`} title={concepts[id] ?? ""}>
                          {concepts[id] === undefined ? "" : concepts[id] ? `🎯 ${concepts[id]}` : "컨셉 없음 · 매칭 확인 불가"}
                        </p>
                      </div>
                      <select value={target[id] ?? ""} onChange={(e) => setTarget((t) => ({ ...t, [id]: e.target.value }))}
                        disabled={!picks?.length}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-2 text-sm disabled:bg-slate-50 disabled:text-slate-400">
                        {!picks ? <option value="">불러오는 중…</option>
                          : picks.length === 0 ? <option value="">지원 학교 없음 (기출 대신 기본 인성)</option>
                          : picks.map((p) => <option key={p.id} value={p.id}>{p.univ} · {p.major} · {p.admission}</option>)}
                      </select>
                      <div className="flex flex-wrap gap-1.5">
                        {SOURCES.map((src) => (
                          <span key={src.key} className="inline-flex items-center overflow-hidden rounded-lg border border-slate-300 text-xs">
                            <span className="px-2 font-bold text-slate-600">{src.label}</span>
                            <button type="button" onClick={() => changeCount(id, src.key, -1)} className="h-8 w-7 bg-slate-50 font-bold text-slate-600">−</button>
                            <span className="w-6 text-center font-extrabold">{c[src.key]}</span>
                            <button type="button" onClick={() => changeCount(id, src.key, 1)} className="h-8 w-7 bg-slate-50 font-bold text-slate-600">+</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="font-bold text-seum-navy">조 이름</div>
              <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="예: 1조"
                className="h-10 max-w-[200px] rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-seum-blue" />
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900">
              <b>학생 핸드폰으로 같이 녹음</b> — 학생이 자기 핸드폰으로 세움스피치에 로그인 → 면접 화면의 <b>[현장 면접 대기]</b>를 켜 두면,
              녹음 시작을 누를 때 노트북(질문)과 학생 핸드폰(대답)이 같이 녹음됩니다. 학생 칸에 "핸드폰 연결됨"이 뜨면 준비 끝입니다.
              핸드폰이 없으면 노트북 하나로 녹음됩니다. 시작하면 브라우저가 마이크를 물어봐요 — <b>허용</b>을 눌러 주세요.
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={start} disabled={!picked.length || !!preparing}
                className="h-14 rounded-xl bg-seum-blue px-7 text-base font-extrabold text-white disabled:opacity-50">
                {preparing || (!picked.length ? "학생을 골라 주세요" : `면접 시작 (${picked.length}명) →`)}
              </button>
            </div>
          </div>
        )}

        {/* ═════ 진행 ═════ */}
        {step === "live" && seat && (
          <>
            {/* 학생 칸 */}
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {seats.map((s, i) => {
                const on = i === sel;
                const total = s.rows.length;
                const done = s.rows.filter(doneOrBusy).length;
                const busyN = running.filter((j) => j.studentId === s.student.id).length;
                const errN = jobs.filter((j) => j.studentId === s.student.id && j.status === "error").length;
                const status = on && phase === "rec" ? "녹음 중" : errN ? "다시 필요" : busyN ? "정리 중" : on ? "차례" : done >= total ? "끝" : done ? `${done}/${total}` : "대기";
                return (
                  <button key={s.student.id} type="button" onClick={() => pickStudent(i)}
                    className={`flex min-h-[96px] flex-col gap-2 rounded-2xl border-2 bg-white p-3.5 text-left ${on ? "border-seum-blue shadow-lg" : "border-slate-200"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-extrabold ${on ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                        <span className="font-bold text-seum-navy">{s.student.name}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        (on && phase === "rec") || errN ? "bg-red-100 text-red-700" : busyN ? "bg-amber-100 text-amber-800" : on ? "bg-blue-100 text-seum-blue" : "bg-slate-100 text-slate-500"}`}>
                        {status}
                      </span>
                    </div>
                    <div className="truncate text-xs text-slate-500">{s.pick ? `${s.pick.univ} · ${s.pick.major}` : "지원 학교 없음"}</div>
                    <div className={`truncate text-[11px] ${s.concept ? "text-slate-500" : "font-bold text-amber-600"}`}>{s.concept ? `🎯 ${s.concept}` : "컨셉 없음"}</div>
                    <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${phones[s.student.id] ? "text-emerald-700" : "text-slate-400"}`}>
                      <span className={`h-2 w-2 rounded-full ${phones[s.student.id] ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {phones[s.student.id] ? "핸드폰 연결됨" : "핸드폰 미연결 · 노트북만"}
                    </div>
                    <div className="flex gap-1">
                      {s.rows.map((r) => (
                        <div key={r.id} className={`h-1.5 flex-1 rounded ${answered(r) ? "bg-seum-blue" : isBusyRow(r) ? "bg-blue-200" : "bg-slate-200"}`} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-start gap-4">
              {/* 가운데 */}
              <div className="flex min-w-0 flex-col gap-4" style={{ flex: "999 1 560px" }}>
                {/* 질문 */}
                <div className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-slate-500">
                      <b className="text-lg text-seum-navy">{seat.student.name}</b> 차례
                      <span className={`ml-2 rounded px-2 py-0.5 text-xs font-bold ${seat.concept ? "bg-blue-50 text-seum-blue" : "bg-amber-50 text-amber-700"}`}>
                        {seat.concept ? `🎯 컨셉 ${seat.concept}` : "컨셉 없음"}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-seum-blue">
                      {cont ? "꼬리질문 이어서" : mode ? "추가 질문" : `질문 ${seat.pos + 1} / ${seat.rows.length}`}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 rounded-2xl bg-blue-50 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-seum-blue">지금 읽을 질문</span>
                      {qTag && <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${SOURCE_CHIP[qTag] ?? SOURCE_CHIP.custom}`}>{SOURCE_LABEL[qTag] ?? qTag}</span>}
                    </div>
                    <div className="text-2xl font-bold leading-normal text-seum-navy">{qText}</div>
                    {!cont && !mode && cur && !doneOrBusy(cur) && cur.question_source !== "intro" && phase === "idle" && (
                      <div>
                        <button type="button" onClick={swap}
                          className="h-9 rounded-lg border border-blue-300 bg-white px-3.5 text-[13px] font-bold text-seum-blue">
                          다른 질문으로 바꾸기
                        </button>
                      </div>
                    )}
                    {!cont && !mode && phase === "idle" && (
                      <div className="text-xs text-blue-900/70">
                        대답을 듣고 궁금한 게 있으면 <b>녹음을 끄지 말고</b> 바로 꼬리질문 하세요. AI가 질문별로 나눠서 저장합니다.
                      </div>
                    )}
                    {cont && (
                      <div>
                        <button type="button" onClick={() => setCont(null)}
                          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600">이어서 녹음 취소</button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="text-xs text-slate-500">{seat.student.name} 오늘 질문</div>
                    {seat.rows.map((r, k) => {
                      const on = k === seat.pos && !mode && !cont;
                      const done = answered(r);
                      const busy = isBusyRow(r);
                      const tailN = seat.tails.filter((t) => t.parent_id === r.id).length;
                      return (
                        <button key={r.id} type="button" onClick={() => goPos(k)}
                          className={`flex min-h-[44px] items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-sm ${
                            on ? "border-seum-blue bg-blue-50" : "border-slate-100 bg-white"} ${done && !on ? "text-slate-400" : "text-seum-navy"}`}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                            done ? "bg-seum-blue text-white" : busy ? "bg-blue-200 text-white" : on ? "bg-seum-navy text-white" : "bg-slate-100 text-slate-500"}`}>
                            {done ? "✓" : busy ? "…" : k + 1}
                          </span>
                          <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${SOURCE_CHIP[r.question_source] ?? SOURCE_CHIP.custom}`}>
                            {SOURCE_LABEL[r.question_source] ?? "질문"}
                          </span>
                          <span className="flex-1">{r.question_text}</span>
                          <span className="shrink-0 text-xs text-slate-400">
                            {busy ? "정리 중" : done ? `답함${tailN ? ` · 꼬리 ${tailN}` : ""}` : on ? "지금" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <span className="text-[13px] text-slate-500">목록에 없는 질문</span>
                    {["custom", "voice"].map((m) => (
                      <button key={m} type="button"
                        onClick={() => { if (phase === "idle") { setMode(mode === m ? null : m); setCont(null); } }}
                        className={`h-9 rounded-lg border px-3.5 text-[13px] font-semibold ${
                          mode === m ? "border-seum-navy bg-seum-navy text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                        {m === "custom" ? "직접 입력" : "🎙 말로 질문"}
                      </button>
                    ))}
                  </div>
                  {mode === "custom" && (
                    <input value={customText} onChange={(e) => setCustomText(e.target.value)}
                      placeholder="예: 친구와 의견이 달랐던 적이 있나요?"
                      className="h-11 rounded-lg border border-slate-300 px-3.5 text-[15px] outline-none focus:border-seum-blue" />
                  )}
                  {mode === "voice" && (
                    <div className="rounded-xl border border-dashed border-slate-400 bg-slate-50 p-3.5 text-[13px] leading-relaxed text-slate-700">
                      그냥 <b>말로 질문</b>하세요. 녹음에서 질문도 같이 받아 적어서 이 학생 기록에 저장합니다.
                    </div>
                  )}
                </div>

                {/* 녹음 */}
                <div className="flex flex-col gap-4 rounded-2xl bg-seum-navy p-5 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-3 w-3 rounded-full ${phase === "rec" ? "animate-pulse bg-red-500" : "bg-slate-500"}`} />
                      <span className="font-bold">
                        {phase === "rec" ? `녹음 중 · ${phones[seat.student.id] ? `노트북 + ${seat.student.name} 핸드폰` : seat.student.name}` : "대기 중"}
                      </span>
                      {running.length > 0 && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                          받아 적는 중 {running.length}개 · 기다리지 않아도 돼요
                        </span>
                      )}
                    </div>
                    <span className="text-2xl font-extrabold tabular-nums">{mmss(sec)}</span>
                  </div>
                  {phase === "idle" ? (
                    <button type="button" onClick={startRec}
                      className="h-16 rounded-2xl bg-seum-blue text-lg font-extrabold">🎙 녹음 시작</button>
                  ) : (
                    <button type="button" onClick={stopRec}
                      className="h-16 rounded-2xl bg-white text-lg font-extrabold text-seum-navy">■ 끝 · 바로 다음으로</button>
                  )}
                  {jobs.filter((j) => j.status === "error").map((j) => (
                    <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-3.5 py-2.5">
                      <div className="text-[13px] text-red-200"><b>{j.name} · {j.label}</b> 정리 실패 — {j.error}</div>
                      <button type="button" onClick={() => retryJob(j)}
                        className="h-9 rounded-lg bg-white px-3 text-xs font-bold text-seum-navy">그 질문 다시 녹음</button>
                    </div>
                  ))}
                  <div className="text-xs text-slate-400">시작·끝만 누르세요. 끝을 누르면 바로 다음 질문으로 넘어갑니다. 다른 학생은 위 학생 칸을 누르면 됩니다.</div>
                </div>

                {/* 받아 적은 내용 */}
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-seum-navy">받아 적은 내용 <span className="text-xs font-medium text-slate-500">· {shownLabel}</span></div>
                    <div className="text-xs text-slate-500">답한 질문을 누르면 그 기록이 보여요</div>
                  </div>
                  {shownRows.length === 0 && (
                    <div className="py-3 text-sm text-slate-400">
                      {runningHere.length ? "뒤에서 받아 적고 있어요. 다른 학생을 진행해도 되고, 끝나면 여기에 나와요."
                        : phase === "rec" ? "녹음 중이에요. 끝을 누르면 바로 다음으로 넘어가고, 뒤에서 나눠 적어요."
                        : "녹음을 시작하면 여기에 면접관과 학생 말이 나눠서 적혀요."}
                    </div>
                  )}
                  {shownRows.map((r) => (
                    <div key={r.id} className={`flex flex-col gap-2 rounded-xl border p-3 ${r.is_tail ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-slate-50"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-extrabold ${r.is_tail ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-seum-blue"}`}>{pairLabel(r)}</span>
                        <span className="text-[13px] font-bold text-seum-navy">{r.question_text}</span>
                      </div>
                      {(r.lines ?? []).map((l, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className={`w-14 shrink-0 rounded py-1 text-center text-[11px] font-extrabold ${
                            l.who === "interviewer" ? "bg-seum-navy text-white" : "bg-blue-100 text-seum-blue"}`}>
                            {l.who === "interviewer" ? "면접관" : "학생"}
                          </span>
                          <div className="flex-1 text-sm leading-relaxed text-slate-700">{l.text}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* 오른쪽 */}
              <div className="flex min-w-0 flex-col gap-4" style={{ flex: "1 1 360px" }}>
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-bold text-seum-navy">AI 진단</div>
                    <div className="text-xs text-slate-500">{seat.student.name} · {shownLabel}</div>
                  </div>
                  {runningHere.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      {runningHere.map((j) => j.label).join(", ")} 받아 적는 중 · 끝나면 자동으로 바뀌어요
                    </div>
                  )}
                  {!fbRow ? (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-500">
                      <b>끝</b>을 누르면 바로 다음 질문으로 넘어가고, 받아 적기와 AI 진단은 뒤에서 만들어져 여기에 나와요.
                    </div>
                  ) : (
                    <>
                      {shownRows.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {shownRows.map((r, i) => (
                            <button key={r.id} type="button" onClick={() => setFbTab(i)}
                              className={`h-8 rounded-lg px-3 text-xs font-bold ${i === Math.min(fbTab, shownRows.length - 1) ? "bg-seum-navy text-white" : "bg-slate-100 text-slate-500"}`}>
                              {pairLabel(r)}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="text-[13px] leading-normal text-slate-500">Q. {fbRow.question_text}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {fbRow.duration_sec ? <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">대답 {fbRow.duration_sec}초</span> : null}
                        {fbRow.speed_label && <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-seum-blue">속도 {fbRow.speed_label}</span>}
                        {fbRow.filler_count != null && <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">군말 {fbRow.filler_count}회</span>}
                        {(fbRow.ai_scores ?? []).map((sc) => (
                          <span key={sc.label} className={`rounded px-2 py-0.5 text-[11px] font-bold ${scoreCls(sc.grade)}`}>{sc.label} {sc.grade}</span>
                        ))}
                      </div>
                      {!aiBusy[fbRow.id] && (fbRow.ai_feedback || !seat.concept) && <ConceptMatch row={fbRow} concept={seat.concept} />}
                      {aiBusy[fbRow.id] ? (
                        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-400">AI 진단 중… (10~20초)</p>
                      ) : fbRow.ai_feedback ? (
                        <p className="max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">{fbRow.ai_feedback}</p>
                      ) : (
                        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-400">
                          {answered(fbRow) ? "진단이 아직 없어요. 면접이 끝난 뒤 목록에서 다시 진단할 수 있어요." : "대답이 없어요."}
                        </p>
                      )}
                      {shownParentId && phase === "idle" && (
                        <button type="button" onClick={() => { setCont({ parentId: shownParentId }); setMode(null); }}
                          className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 text-[13px] font-semibold text-slate-700">
                          🎙 꼬리질문 더 하기 (이어서 녹음)
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* 선생님 직접 평가 */}
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-bold text-seum-navy">직접 평가</div>
                    <div className="text-xs text-slate-500">녹음으로 못 보는 것 · {seat.student.name}</div>
                  </div>
                  {EVALS.map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2.5">
                      <div className="w-14 shrink-0 text-sm font-semibold text-slate-600">{label}</div>
                      <div className="flex flex-1 gap-1.5">
                        {["상", "중", "하"].map((lv) => {
                          const on = evals[seat.student.id]?.[key] === lv;
                          return (
                            <button key={lv} type="button" onClick={() => setEval(key, lv)}
                              className={`h-10 flex-1 rounded-xl border text-sm font-bold ${on ? "border-seum-navy bg-seum-navy text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                              {lv}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <input value={evals[seat.student.id]?.memo ?? ""}
                    onChange={(e) => setEval("memo", e.target.value)}
                    onBlur={() => saveEval(seat.student.id, evals[seat.student.id] ?? {})}
                    placeholder="한 줄 메모 (예: 대답할 때 손을 자주 만짐)"
                    className="h-10 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-seum-blue" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}