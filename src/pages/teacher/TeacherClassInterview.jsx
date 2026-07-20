import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  getCategory,
  getSubLabel,
  getCategoryLabel,
  getTabLabel,
} from "../../lib/interviewConfig";

// ============================================================
// 카테고리별 Edge Function 매핑
// 배포된 것만 여기에 등록. 없으면 fallback 함수 사용.
// ============================================================
const FN_MAP = {
  gov: "interview-ai-gov",             // 공무원
  public_corp: "interview-ai-public",  // 공기업
  // company: "interview-ai-company",     // 사기업 (미배포)
  // hospital: "interview-ai-hospital",   // 병원 (미배포)
  // univ: "interview-ai-univ",           // 대입 (미배포)
  // transfer: "interview-ai-transfer",   // 편입 (미배포)
  // highschool: "interview-ai-high",     // 고입 (미배포)
};
const FN_FALLBACK = "interview-ai-feedback";

function getFnName(categoryKey) {
  return FN_MAP[categoryKey] ?? FN_FALLBACK;
}

// Edge Function 에러의 실제 응답 본문을 뽑아냄
async function extractFnError(error) {
  let detail = error?.message || "unknown";
  try {
    const body = await error.context?.json();
    detail = body?.error || JSON.stringify(body);
  } catch (_) {
    try {
      const txt = await error.context?.text();
      if (txt) detail = txt;
    } catch (__) {}
  }
  return detail;
}

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ============================================================
// 선생님 단체반 모드
// 반 선택 → 학생 선택 → 탭 → 그 학생의 질문/답변/피드백
// 학생이 저장(제출)한 답변만 피드백 대상으로 노출
// 기출문제는 학생마다 직렬이 다르므로 "제출한 것만" 표시
// ============================================================
export default function TeacherClassInterview() {
  const [classes, setClasses] = useState([]); // [{course, assignment}]
  const [classesLoading, setClassesLoading] = useState(true);

  const [selClass, setSelClass] = useState(null);     // { course, assignment }
  const [students, setStudents] = useState([]);       // 반 학생 [{id, name}]
  const [selStudent, setSelStudent] = useState(null); // { id, name }
  const [activeTab, setActiveTab] = useState(null);

  const [rows, setRows] = useState([]);   // [{ ...question, _answer }]
  const [loading, setLoading] = useState(false);

  const [draftEdits, setDraftEdits] = useState({}); // { [answerId]: text }
  const [savingId, setSavingId] = useState(null);
  const [aiLoadingId, setAiLoadingId] = useState(null);

  // 탭별 답변 현황 (학생 선택 시 계산)
  const [tabStats, setTabStats] = useState({}); // { [tabKey]: { answered, feedbacked } }

  // 일괄 AI 진행 상태
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // 1) 면접 단체반 로드
  useEffect(() => {
    (async () => {
      setClassesLoading(true);
      const { data: me } = await supabase.auth.getUser();
      const myId = me?.user?.id;

      const { data: cs } = await supabase
        .from("courses")
        .select("id, title, type, teacher_id, course_kind, interview_category, interview_sub")
        .eq("type", "group")
        .eq("course_kind", "interview")
        .eq("active", true);

      let list = (cs ?? [])
        .filter((c) => c.interview_category)
        .map((c) => ({
          course: c,
          assignment: { category_key: c.interview_category, sub_key: c.interview_sub },
        }));

      if (myId) {
        const mine = list.filter((c) => c.course.teacher_id === myId);
        if (mine.length > 0) list = mine;
      }

      setClasses(list);
      setClassesLoading(false);
    })();
  }, []);

  // 2) 반 선택 → 학생 목록
  useEffect(() => {
    if (!selClass) {
      setStudents([]); setSelStudent(null); setActiveTab(null);
      setRows([]); setTabStats({});
      return;
    }
    (async () => {
      setSelStudent(null);
      setRows([]);
      const cat = getCategory(selClass.assignment.category_key);
      setActiveTab(cat?.tabs?.[0]?.key ?? null);

      const { data: enr } = await supabase
        .from("enrollments")
        .select("student_id, profiles:student_id(id, name)")
        .eq("course_id", selClass.course.id);
      const map = {};
      (enr ?? []).forEach((e) => {
        const p = e.profiles;
        if (p && !map[p.id]) map[p.id] = { id: p.id, name: p.name };
      });
      setStudents(Object.values(map));
    })();
  }, [selClass]);

  // 3) 학생 선택 → 탭별 현황 집계 (제출된 답변 기준)
  useEffect(() => {
    if (!selClass || !selStudent) { setTabStats({}); return; }
    (async () => {
      const { category_key, sub_key } = selClass.assignment;

      let q = supabase
        .from("interview_questions_v2")
        .select("id, tab_key")
        .eq("category_key", category_key)
        .eq("is_active", true);
      q = sub_key ? q.eq("sub_key", sub_key) : q.is("sub_key", null);
      const { data: qs } = await q;

      const tabOf = {};
      (qs ?? []).forEach((x) => { tabOf[x.id] = x.tab_key; });
      const ids = Object.keys(tabOf);
      if (ids.length === 0) { setTabStats({}); return; }

      const { data: ans } = await supabase
        .from("interview_answers_v2")
        .select("question_id, student_answer, teacher_feedback, submitted_at")
        .eq("student_id", selStudent.id)
        .in("question_id", ids);

      const stats = {};
      (ans ?? []).forEach((a) => {
        const tk = tabOf[a.question_id];
        if (!tk) return;
        // 제출된 답변만 집계
        if (!a.submitted_at || !a.student_answer?.trim()) return;
        stats[tk] = stats[tk] || { answered: 0, feedbacked: 0 };
        stats[tk].answered++;
        if (a.teacher_feedback) stats[tk].feedbacked++;
      });
      setTabStats(stats);
    })();
  }, [selClass, selStudent]);

  // 4) 탭 로드 — 선택 학생 기준
  const loadTab = async () => {
    if (!selClass || !selStudent || !activeTab) { setRows([]); return; }
    setLoading(true);
    const { category_key, sub_key } = selClass.assignment;

    let q = supabase
      .from("interview_questions_v2")
      .select("*")
      .eq("category_key", category_key)
      .eq("tab_key", activeTab)
      .eq("is_active", true)
      .order("seq");
    q = sub_key ? q.eq("sub_key", sub_key) : q.is("sub_key", null);

    const { data: qs } = await q;
    const questionList = qs ?? [];
    const ids = questionList.map((x) => x.id);

    let ansMap = {};
    const edits = {};
    if (ids.length > 0) {
      const { data: ans } = await supabase
        .from("interview_answers_v2")
        .select("*")
        .eq("student_id", selStudent.id)
        .in("question_id", ids);
      (ans ?? []).forEach((a) => {
        ansMap[a.question_id] = a;
        edits[a.id] = a.teacher_feedback ?? a.ai_draft ?? "";
      });
    }

    let merged = questionList.map((qq) => ({ ...qq, _answer: ansMap[qq.id] || null }));

    // 학생이 저장(제출)하지 않은 임시 답변은 선생님에게 노출하지 않음
    merged = merged.map((r) => {
      if (r._answer && !r._answer.submitted_at) {
        return { ...r, _answer: { ...r._answer, student_answer: null } };
      }
      return r;
    });

    // 기출문제는 학생마다 직렬이 다르므로, 제출한 것만 표시
    if (activeTab === "gichul") {
      merged = merged.filter((r) => r._answer?.student_answer?.trim());
    }

    setRows(merged);
    setDraftEdits(edits);
    setLoading(false);
  };

  useEffect(() => { loadTab(); /* eslint-disable-next-line */ },
    [selClass, selStudent, activeTab]);

  // AI 초안 1건
  const genOne = async (qRow, answerRow) => {
    if (!answerRow?.student_answer) return null;
    const { category_key, sub_key } = selClass.assignment;
    const fnName = getFnName(category_key);
    const { data, error } = await supabase.functions.invoke(fnName, {
      body: {
        category: getCategoryLabel(category_key),
        category_key: category_key,
        sub: getSubLabel(category_key, sub_key),
        sub_key: sub_key,
        tab: getTabLabel(category_key, activeTab),
        tab_key: activeTab,
        series_key: qRow.series_key ?? null,
        question: qRow.question,
        answer: answerRow.student_answer,
      },
    });

    if (error) {
      const detail = await extractFnError(error);
      console.error(`Edge Function 에러 [${fnName}]:`, detail);
      throw new Error(`[${fnName}] ${detail}`);
    }
    if (!data?.success) {
      throw new Error(`[${fnName}] ${data?.error || "AI 실패"}`);
    }

    const draft = data.feedback || data.text || "";
    await supabase
      .from("interview_answers_v2")
      .update({ ai_draft: draft, updated_at: new Date().toISOString() })
      .eq("id", answerRow.id);
    return draft;
  };

  const genSingle = async (qRow) => {
    const a = qRow._answer;
    if (!a?.student_answer) return alert("학생 답변이 없습니다.");
    setAiLoadingId(a.id);
    try {
      const draft = await genOne(qRow, a);
      setRows((prev) =>
        prev.map((r) => (r.id === qRow.id ? { ...r, _answer: { ...r._answer, ai_draft: draft } } : r))
      );
      setDraftEdits((prev) => ({ ...prev, [a.id]: draft }));
    } catch (e) {
      alert("AI 오류:\n\n" + e.message);
    } finally {
      setAiLoadingId(null);
    }
  };

  // 이 학생 · 이 탭의 미확정 답변 전부
  const genAllForStudent = async () => {
    const targets = rows.filter(
      (r) => r._answer?.student_answer?.trim() && !r._answer.teacher_feedback
    );
    if (targets.length === 0) return alert("AI 초안을 생성할 답변이 없습니다. (이미 확정된 것은 제외)");
    if (!window.confirm(
      `${selStudent.name} 학생의 ${getTabLabel(selClass.assignment.category_key, activeTab)} ${targets.length}건에 AI 초안을 생성합니다.\n` +
      `1건당 10~20초 걸리며, 이 화면을 닫으면 중단됩니다. 계속할까요?`
    )) return;

    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length });

    let firstError = null;
    let failCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const qRow = targets[i];
      const a = qRow._answer;
      try {
        const draft = await genOne(qRow, a);
        setRows((prev) =>
          prev.map((r) => (r.id === qRow.id ? { ...r, _answer: { ...r._answer, ai_draft: draft } } : r))
        );
        setDraftEdits((prev) => ({ ...prev, [a.id]: draft }));
      } catch (e) {
        console.error("AI 실패:", e.message);
        failCount++;
        if (!firstError) firstError = e.message;
      }
      setBulkProgress({ done: i + 1, total: targets.length });
    }

    setBulkRunning(false);
    if (failCount > 0) {
      alert(`${targets.length}건 중 ${failCount}건 실패했습니다.\n\n첫 에러:\n${firstError}`);
    } else {
      alert("AI 초안 생성 완료! 각 답변을 검토하고 확정하세요.");
    }
  };

  // 피드백 확정 1건
  const confirmOne = async (qRow) => {
    const a = qRow._answer;
    if (!a) return;
    const text = (draftEdits[a.id] ?? "").trim();
    if (!text) return alert("피드백 내용을 입력하세요.");
    setSavingId(a.id);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("interview_answers_v2")
      .update({ teacher_feedback: text, feedback_at: now, updated_at: now })
      .eq("id", a.id)
      .select()
      .maybeSingle();
    setSavingId(null);
    if (error) return alert("저장 실패: " + error.message);

    const wasNew = !a.teacher_feedback;
    setRows((prev) =>
      prev.map((r) => (r.id === qRow.id ? { ...r, _answer: { ...r._answer, ...data } } : r))
    );
    if (wasNew) {
      setTabStats((prev) => {
        const cur = prev[activeTab] || { answered: 0, feedbacked: 0 };
        return { ...prev, [activeTab]: { ...cur, feedbacked: cur.feedbacked + 1 } };
      });
    }
  };

  const cat = selClass ? getCategory(selClass.assignment.category_key) : null;
  const tabs = cat?.tabs ?? [];
  const pendingCount = rows.filter(
    (r) => r._answer?.student_answer?.trim() && !r._answer.teacher_feedback
  ).length;

  if (classesLoading) return <p className="text-slate-400">단체반 불러오는 중...</p>;

  return (
    <div>
      {/* 반 선택 */}
      <div className="mb-5">
        <p className="mb-2 text-sm font-medium text-slate-500">단체반 선택</p>
        {classes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
            면접 카테고리가 배정된 단체반이 없습니다. (어드민 &gt; 단체반 면접설정에서 배정)
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => {
              const on = selClass?.course.id === c.course.id;
              const badge = getCategoryLabel(c.assignment.category_key) +
                (getSubLabel(c.assignment.category_key, c.assignment.sub_key) ? `·${getSubLabel(c.assignment.category_key, c.assignment.sub_key)}` : "");
              return (
                <button key={c.course.id} type="button" onClick={() => setSelClass(c)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${on ? "border-seum-blue bg-seum-blue text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {c.course.title}
                  <span className={`ml-2 text-xs ${on ? "text-blue-100" : "text-slate-400"}`}>{badge}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!selClass ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          단체반을 선택해주세요.
        </p>
      ) : (
        <>
          {/* 학생 선택 */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">학생 선택</p>
              <span className="text-xs text-slate-400">
                {getCategoryLabel(selClass.assignment.category_key)}
                {getSubLabel(selClass.assignment.category_key, selClass.assignment.sub_key) &&
                  ` · ${getSubLabel(selClass.assignment.category_key, selClass.assignment.sub_key)}`}
                {` · 학생 ${students.length}명`}
              </span>
            </div>
            {students.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
                이 반에 등록된 학생이 없습니다.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {students.map((s) => {
                  const on = selStudent?.id === s.id;
                  return (
                    <button key={s.id} type="button" onClick={() => setSelStudent(s)}
                      className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${on ? "border-seum-navy bg-seum-navy text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!selStudent ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
              학생을 선택하면 답변과 피드백이 표시됩니다.
            </p>
          ) : (
            <>
              {/* 탭 */}
              <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                {tabs.map((t) => {
                  const on = activeTab === t.key;
                  const st = tabStats[t.key];
                  return (
                    <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${on ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {t.label}
                      {st?.answered > 0 && (
                        <span className={`rounded-full px-1.5 text-[10px] font-black ${
                          on
                            ? "bg-white/25 text-white"
                            : st.feedbacked >= st.answered
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {st.feedbacked}/{st.answered}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 학생 · 탭 헤더 + 일괄 AI */}
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold text-seum-navy">
                  {selStudent.name}
                  <span className="ml-2 text-xs font-medium text-slate-400">
                    {getTabLabel(selClass.assignment.category_key, activeTab)}
                    {pendingCount > 0 && ` · 미확정 ${pendingCount}건`}
                  </span>
                </div>
                <button type="button" onClick={genAllForStudent} disabled={bulkRunning || loading || pendingCount === 0}
                  className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
                  {bulkRunning ? `생성 중... (${bulkProgress.done}/${bulkProgress.total})` : "✨ 이 탭 전체 AI 초안"}
                </button>
              </div>

              {/* 진행 바 */}
              {bulkRunning && (
                <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-seum-blue transition-all"
                    style={{ width: `${bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }} />
                </div>
              )}

              {loading ? (
                <p className="py-10 text-center text-slate-400">불러오는 중...</p>
              ) : rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
                  {activeTab === "gichul"
                    ? "이 학생이 제출한 기출문제 답변이 없습니다."
                    : "이 탭에 등록된 질문이 없습니다."}
                </p>
              ) : (
                <div className="space-y-4">
                  {rows.map((qRow, i) => {
                    const a = qRow._answer;
                    const hasAnswer = !!a?.student_answer?.trim();

                    // 현재 편집중인 텍스트가 확정된 피드백과 같은지
                    const confirmed =
                      !!a?.teacher_feedback &&
                      (draftEdits[a.id] ?? "").trim() === a.teacher_feedback.trim();

                    return (
                      <div
                        key={qRow.id}
                        className={`rounded-xl border bg-white p-4 transition ${
                          confirmed ? "border-slate-300" : "border-slate-200"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="font-medium text-seum-navy">
                            <span className="mr-1 text-slate-400">{i + 1}.</span>
                            {qRow.question}
                          </p>
                          <span className="shrink-0 pt-0.5">
                            {confirmed ? (
                              <span className="text-xs text-green-600">
                                ✓ 전달됨 {a.feedback_at && <span className="text-slate-400">{fmtTime(a.feedback_at)}</span>}
                              </span>
                            ) : a?.teacher_feedback ? (
                              <span className="text-xs text-amber-600">수정됨 — 재전달 필요</span>
                            ) : a?.ai_draft ? (
                              <span className="text-xs text-amber-600">초안 대기</span>
                            ) : hasAnswer ? (
                              <span className="text-xs text-slate-400">미피드백</span>
                            ) : (
                              <span className="text-xs text-slate-300">미제출</span>
                            )}
                          </span>
                        </div>

                        {hasAnswer ? (
                          <>
                            <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2.5">
                              <div className="mb-1 flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">학생 답변</p>
                                {a.submitted_at && (
                                  <span className="text-[10px] text-slate-400">{fmtTime(a.submitted_at)} 제출</span>
                                )}
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{a.student_answer}</p>
                            </div>

                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-seum-blue">피드백</span>
                              <button type="button" onClick={() => genSingle(qRow)} disabled={aiLoadingId === a.id || bulkRunning}
                                className="rounded-md border border-seum-blue px-2.5 py-0.5 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-50">
                                {aiLoadingId === a.id ? "생성 중..." : a.ai_draft ? "🔄 다시" : "✨ AI"}
                              </button>
                            </div>
                            <textarea value={draftEdits[a.id] ?? ""} onChange={(e) => setDraftEdits((p) => ({ ...p, [a.id]: e.target.value }))}
                              rows={5}
                              placeholder="AI 초안 생성 또는 직접 작성"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => confirmOne(qRow)}
                                disabled={savingId === a.id || confirmed}
                                className={`rounded-lg px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-100 ${
                                  confirmed
                                    ? "cursor-default bg-slate-700"
                                    : "bg-seum-blue hover:bg-[#2a63c4]"
                                }`}
                              >
                                {savingId === a.id
                                  ? "저장 중..."
                                  : confirmed
                                  ? "✓ 전달 완료"
                                  : a.teacher_feedback
                                  ? "수정 내용 재전달"
                                  : "피드백 확정"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">아직 제출하지 않았습니다.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}