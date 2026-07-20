import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  getCategory,
  getSubLabel,
  getCategoryLabel,
  getTabLabel,
  getSeries,
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

// 선생님 단체반 모드: 반 선택 → 반 배정 카테고리 → 탭 → 질문마다 반 학생 전원 답변 → 전체 AI
export default function TeacherClassInterview() {
  const [classes, setClasses] = useState([]); // [{course, assignment}]
  const [classesLoading, setClassesLoading] = useState(true);

  const [selClass, setSelClass] = useState(null); // { course, assignment }
  const [students, setStudents] = useState([]);   // 반 학생 [{id, name}]
  const [activeTab, setActiveTab] = useState(null);
  const [activeSeries, setActiveSeries] = useState(null); // 기출문제 직렬
  const [questions, setQuestions] = useState([]); // 이 탭 질문들
  const [answersByQ, setAnswersByQ] = useState({}); // { [questionId]: { [studentId]: answerRow } }
  const [loading, setLoading] = useState(false);

  const [draftEdits, setDraftEdits] = useState({}); // { [answerId]: text }
  const [savingId, setSavingId] = useState(null);
  const [aiLoadingId, setAiLoadingId] = useState(null);

  // 전체 AI 진행 상태
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // 1) 면접 단체반 로드 (courses.course_kind='interview')
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

      // 담당 선생님 지정된 반이 있으면 내 것만, 아니면 전체
      if (myId) {
        const mine = list.filter((c) => c.course.teacher_id === myId);
        if (mine.length > 0) list = mine;
      }

      setClasses(list);
      setClassesLoading(false);
    })();
  }, []);

  // 2) 반 선택 시: 반 학생 목록 로드
  useEffect(() => {
    if (!selClass) { setStudents([]); setActiveTab(null); setQuestions([]); setAnswersByQ({}); return; }
    (async () => {
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

  // 3) 탭 로드: 질문 + 학생별 답변
  const loadTab = async () => {
    if (!selClass || !activeTab || students.length === 0) return;
    const { category_key, sub_key } = selClass.assignment;

    const seriesList = getSeries(category_key, sub_key);
    const needsSeries = activeTab === "gichul" && seriesList.length > 0;

    // 직렬 선택이 필요한데 아직 안 골랐으면 비워둠
    if (needsSeries && !activeSeries) {
      setQuestions([]);
      setAnswersByQ({});
      setDraftEdits({});
      return;
    }

    setLoading(true);

    let q = supabase
      .from("interview_questions_v2")
      .select("*")
      .eq("category_key", category_key)
      .eq("tab_key", activeTab)
      .eq("is_active", true)
      .order("seq");
    q = sub_key ? q.eq("sub_key", sub_key) : q.is("sub_key", null);
    if (needsSeries) q = q.eq("series_key", activeSeries);

    const { data: qs } = await q;
    const questionList = qs ?? [];
    const qIds = questionList.map((x) => x.id);
    const sIds = students.map((s) => s.id);

    let ansMap = {}; // questionId -> studentId -> row
    const edits = {};
    if (qIds.length > 0 && sIds.length > 0) {
      const { data: ans } = await supabase
        .from("interview_answers_v2")
        .select("*")
        .in("question_id", qIds)
        .in("student_id", sIds);
      (ans ?? []).forEach((a) => {
        (ansMap[a.question_id] = ansMap[a.question_id] || {})[a.student_id] = a;
        edits[a.id] = a.teacher_feedback ?? a.ai_draft ?? "";
      });
    }

    setQuestions(questionList);
    setAnswersByQ(ansMap);
    setDraftEdits(edits);
    setLoading(false);
  };

  useEffect(() => { loadTab(); /* eslint-disable-next-line */ },
    [selClass, activeTab, activeSeries, students]);

  // 탭이 바뀌면 직렬 선택 초기화
  useEffect(() => { setActiveSeries(null); }, [activeTab]);

  // AI 초안 1건 (카테고리별 Edge Function 호출)
  const genOne = async (qRow, studentId, answerRow) => {
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
        series_key: activeSeries,
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

  const genSingle = async (qRow, studentId) => {
    const a = answersByQ[qRow.id]?.[studentId];
    if (!a?.student_answer) return alert("학생 답변이 없습니다.");
    setAiLoadingId(a.id);
    try {
      const draft = await genOne(qRow, studentId, a);
      setAnswersByQ((prev) => {
        const next = { ...prev };
        next[qRow.id] = { ...next[qRow.id], [studentId]: { ...a, ai_draft: draft } };
        return next;
      });
      setDraftEdits((prev) => ({ ...prev, [a.id]: draft }));
    } catch (e) {
      alert("AI 오류:\n\n" + e.message);
    } finally {
      setAiLoadingId(null);
    }
  };

  // 전체 AI 초안 — 이 탭의 답변 있는 것 전부 (아직 확정 안 된 것만)
  const genAll = async () => {
    // 대상 수집
    const targets = [];
    questions.forEach((qRow) => {
      students.forEach((s) => {
        const a = answersByQ[qRow.id]?.[s.id];
        if (a?.student_answer && !a.teacher_feedback) targets.push({ qRow, studentId: s.id, a });
      });
    });
    if (targets.length === 0) return alert("AI 초안을 생성할 답변이 없습니다. (이미 확정된 것은 제외)");
    if (!window.confirm(`${targets.length}개 답변에 AI 초안을 생성합니다. 계속할까요?`)) return;

    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length });

    let firstError = null;
    let failCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const { qRow, studentId, a } = targets[i];
      try {
        const draft = await genOne(qRow, studentId, a);
        setAnswersByQ((prev) => {
          const next = { ...prev };
          next[qRow.id] = { ...next[qRow.id], [studentId]: { ...next[qRow.id][studentId], ai_draft: draft } };
          return next;
        });
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
      alert("전체 AI 초안 생성 완료! 각 답변을 검토하고 확정하세요.");
    }
  };

  // 피드백 확정 1건
  const confirmOne = async (qRow, studentId) => {
    const a = answersByQ[qRow.id]?.[studentId];
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
    setAnswersByQ((prev) => {
      const next = { ...prev };
      next[qRow.id] = { ...next[qRow.id], [studentId]: { ...a, ...data } };
      return next;
    });
  };

  const cat = selClass ? getCategory(selClass.assignment.category_key) : null;
  const tabs = cat?.tabs ?? [];
  const seriesList = selClass
    ? getSeries(selClass.assignment.category_key, selClass.assignment.sub_key)
    : [];
  const showSeriesPicker = activeTab === "gichul" && seriesList.length > 0;

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
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">단체반을 선택해주세요.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-seum-navy">
              {getCategoryLabel(selClass.assignment.category_key)}
              {getSubLabel(selClass.assignment.category_key, selClass.assignment.sub_key) && (
                <span className="ml-1 text-seum-blue">· {getSubLabel(selClass.assignment.category_key, selClass.assignment.sub_key)}</span>
              )}
              <span className="ml-2 text-xs text-slate-400">학생 {students.length}명</span>
            </div>
            <button type="button" onClick={genAll} disabled={bulkRunning || loading}
              className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
              {bulkRunning ? `생성 중... (${bulkProgress.done}/${bulkProgress.total})` : "✨ 전체 AI 초안 생성"}
            </button>
          </div>

          {/* 진행 바 */}
          {bulkRunning && (
            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-seum-blue transition-all"
                style={{ width: `${bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }} />
            </div>
          )}

          {/* 탭 */}
          <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {tabs.map((t) => {
              const on = activeTab === t.key;
              return (
                <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${on ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 직렬 선택 (기출문제 탭 전용) */}
          {showSeriesPicker && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-bold text-slate-500">직렬 선택</p>
              <div className="flex flex-wrap gap-2">
                {seriesList.map((s) => {
                  const on = activeSeries === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setActiveSeries(on ? null : s.key)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        on
                          ? "bg-seum-navy text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <p className="py-10 text-center text-slate-400">불러오는 중...</p>
          ) : questions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
              {showSeriesPicker && !activeSeries
                ? "직렬을 선택하면 해당 직렬의 기출문제가 표시됩니다."
                : "이 탭에 등록된 질문이 없습니다."}
            </p>
          ) : (
            <div className="space-y-6">
              {questions.map((qRow, qi) => (
                <div key={qRow.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 font-bold text-seum-navy">
                    <span className="mr-1 text-slate-400">{qi + 1}.</span>{qRow.question}
                  </p>

                  {/* 학생별 답변 */}
                  <div className="space-y-3">
                    {students.map((s) => {
                      const a = answersByQ[qRow.id]?.[s.id];
                      const hasAnswer = !!a?.student_answer;
                      return (
                        <div key={s.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-sm font-bold text-seum-navy">{s.name}</span>
                            {a?.teacher_feedback ? (
                              <span className="text-xs text-green-600">✓ 확정됨</span>
                            ) : a?.ai_draft ? (
                              <span className="text-xs text-amber-600">초안 대기</span>
                            ) : hasAnswer ? (
                              <span className="text-xs text-slate-400">미피드백</span>
                            ) : (
                              <span className="text-xs text-slate-300">미답변</span>
                            )}
                          </div>

                          {hasAnswer ? (
                            <>
                              <p className="mb-2 whitespace-pre-wrap rounded bg-white px-2.5 py-2 text-sm leading-relaxed text-slate-700">{a.student_answer}</p>
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-seum-blue">피드백</span>
                                <button type="button" onClick={() => genSingle(qRow, s.id)} disabled={aiLoadingId === a.id || bulkRunning}
                                  className="rounded-md border border-seum-blue px-2.5 py-0.5 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-50">
                                  {aiLoadingId === a.id ? "생성 중..." : a.ai_draft ? "🔄 다시" : "✨ AI"}
                                </button>
                              </div>
                              <textarea value={draftEdits[a.id] ?? ""} onChange={(e) => setDraftEdits((p) => ({ ...p, [a.id]: e.target.value }))}
                                rows={3}
                                placeholder="AI 초안 생성 또는 직접 작성"
                                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-seum-blue" />
                              <div className="mt-1.5 flex justify-end">
                                <button type="button" onClick={() => confirmOne(qRow, s.id)} disabled={savingId === a.id}
                                  className="rounded-lg bg-seum-blue px-3 py-1 text-xs font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
                                  {savingId === a.id ? "저장 중..." : "확정"}
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-slate-400">아직 답변하지 않았습니다.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}