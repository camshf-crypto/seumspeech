import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  getCategory,
  getSubLabel,
  getCategoryLabel,
  getTabLabel,
  getSeries,
} from "../../lib/interviewConfig";
import TeacherClassInterview from "./TeacherClassInterview";

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

// 선생님 면접 화면 진입점: 1:1 / 단체반 모드 토글
export default function TeacherInterviewTab({ students: studentsProp = null }) {
  const [mode, setMode] = useState("one"); // 'one' | 'class'

  return (
    <div>
      <div className="mb-5 flex gap-2">
        <button type="button" onClick={() => setMode("one")}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${mode === "one" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          1:1 면접
        </button>
        <button type="button" onClick={() => setMode("class")}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${mode === "class" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          단체반 면접
        </button>
      </div>
      {mode === "one" ? <OneOnOneInterview studentsProp={studentsProp} /> : <TeacherClassInterview />}
    </div>
  );
}

// ===== 1:1 면접 (기존 화면) =====
function OneOnOneInterview({ studentsProp = null }) {
  const [students, setStudents] = useState(studentsProp ?? []);
  const [studentsLoading, setStudentsLoading] = useState(!studentsProp);
  const [selStudent, setSelStudent] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [activeSeries, setActiveSeries] = useState(null); // 기출문제 직렬
  const [rows, setRows] = useState([]); // 질문 + 답변 머지
  const [loading, setLoading] = useState(false);

  // 편집 상태: { [answerId]: text }
  const [draftEdits, setDraftEdits] = useState({});
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  // 담임 학생 로드 (students prop이 없을 때만)
  useEffect(() => {
    if (studentsProp) { setStudents(studentsProp); return; }
    (async () => {
      setStudentsLoading(true);
      const { data: me } = await supabase.auth.getUser();
      const myId = me?.user?.id;
      if (!myId) { setStudentsLoading(false); return; }
      // 내가 담임인 수강의 학생들
      const { data: enr } = await supabase
        .from("enrollments")
        .select("student_id, profiles:student_id(id, name)")
        .eq("teacher_id", myId);
      // 중복 제거
      const map = {};
      (enr ?? []).forEach((e) => {
        const p = e.profiles;
        if (p && !map[p.id]) map[p.id] = { id: p.id, name: p.name };
      });
      setStudents(Object.values(map));
      setStudentsLoading(false);
    })();
  }, [studentsProp]);

  // 학생 선택 시 배정 로드
  useEffect(() => {
    if (!selStudent) { setAssignment(null); setActiveTab(null); setRows([]); return; }
    (async () => {
      const { data } = await supabase
        .from("interview_assignments")
        .select("category_key, sub_key")
        .eq("student_id", selStudent.id)
        .maybeSingle();
      setAssignment(data ?? null);
      const cat = data ? getCategory(data.category_key) : null;
      setActiveTab(cat?.tabs?.[0]?.key ?? null);
    })();
  }, [selStudent]);

  // 탭 로드
  const loadTab = async () => {
    if (!selStudent || !assignment || !activeTab) return;

    const seriesList = getSeries(assignment.category_key, assignment.sub_key);
    const needsSeries = activeTab === "gichul" && seriesList.length > 0;

    // 직렬 선택이 필요한데 아직 안 골랐으면 비워둠
    if (needsSeries && !activeSeries) {
      setRows([]);
      setDraftEdits({});
      return;
    }

    setLoading(true);
    let q = supabase
      .from("interview_questions_v2")
      .select("*")
      .eq("category_key", assignment.category_key)
      .eq("tab_key", activeTab)
      .eq("is_active", true)
      .order("seq");
    q = assignment.sub_key ? q.eq("sub_key", assignment.sub_key) : q.is("sub_key", null);
    if (needsSeries) q = q.eq("series_key", activeSeries);

    const { data: qs } = await q;
    const questionList = qs ?? [];
    const ids = questionList.map((x) => x.id);

    let answerMap = {};
    if (ids.length > 0) {
      const { data: ans } = await supabase
        .from("interview_answers_v2")
        .select("*")
        .eq("student_id", selStudent.id)
        .in("question_id", ids);
      (ans ?? []).forEach((a) => { answerMap[a.question_id] = a; });
    }

    const merged = questionList.map((qq) => ({ ...qq, _answer: answerMap[qq.id] || null }));
    setRows(merged);
    // 편집 상태 초기화: 확정 피드백 있으면 그걸, 없으면 ai_draft를 채움
    const edits = {};
    merged.forEach((qq) => {
      const a = qq._answer;
      if (a) edits[a.id] = a.teacher_feedback ?? a.ai_draft ?? "";
    });
    setDraftEdits(edits);
    setLoading(false);
  };

  useEffect(() => { loadTab(); /* eslint-disable-next-line */ },
    [selStudent, assignment, activeTab, activeSeries]);

  // 탭이 바뀌면 직렬 선택 초기화
  useEffect(() => { setActiveSeries(null); }, [activeTab]);

  // AI 초안 생성 (카테고리별 Edge Function 호출)
  const genAiDraft = async (row) => {
    const a = row._answer;
    if (!a?.student_answer) return alert("학생 답변이 아직 없습니다.");
    setAiLoadingId(a.id);
    try {
      const fnName = getFnName(assignment.category_key);
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: {
          category: getCategoryLabel(assignment.category_key),
          category_key: assignment.category_key,
          sub: getSubLabel(assignment.category_key, assignment.sub_key),
          sub_key: assignment.sub_key,
          tab: getTabLabel(assignment.category_key, activeTab),
          tab_key: activeTab,
          series_key: activeSeries,
          question: row.question,
          answer: a.student_answer,
        },
      });
      if (error || !data?.success) {
        alert(`AI 초안 생성 실패 [${fnName}]: ` + (error?.message || data?.error || "unknown"));
        return;
      }
      const draft = data.feedback || data.text || "";
      // ai_draft 저장 (검토 전, 학생 노출 X)
      await supabase
        .from("interview_answers_v2")
        .update({ ai_draft: draft, updated_at: new Date().toISOString() })
        .eq("id", a.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, _answer: { ...r._answer, ai_draft: draft } } : r)));
      setDraftEdits((prev) => ({ ...prev, [a.id]: draft })); // 편집창에 초안 채우기
    } catch (e) {
      alert("AI 처리 중 오류: " + e.message);
    } finally {
      setAiLoadingId(null);
    }
  };

  // 피드백 확정 (학생 노출)
  const confirmFeedback = async (row) => {
    const a = row._answer;
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
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, _answer: { ...r._answer, ...data } } : r)));
    alert("피드백이 확정되어 학생에게 전달되었습니다.");
  };

  const cat = assignment ? getCategory(assignment.category_key) : null;
  const tabs = cat?.tabs ?? [];
  const seriesList = assignment ? getSeries(assignment.category_key, assignment.sub_key) : [];
  const showSeriesPicker = activeTab === "gichul" && seriesList.length > 0;

  return (
    <div>
      <h2 className="mb-1 font-bold text-seum-navy">면접 피드백</h2>
      <p className="mb-4 text-sm text-slate-400">학생을 선택하고, 답변에 AI 초안을 생성한 뒤 검토·수정해서 확정하세요.</p>

      {/* 학생 선택 */}
      <div className="mb-5 flex flex-wrap gap-2">
        {studentsLoading ? (
          <span className="text-sm text-slate-400">학생 불러오는 중...</span>
        ) : students.length === 0 ? (
          <span className="text-sm text-slate-400">담당 학생이 없습니다.</span>
        ) : (
          students.map((s) => {
            const on = selStudent?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelStudent(s)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  on ? "border-seum-blue bg-seum-blue text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s.name}
              </button>
            );
          })
        )}
      </div>

      {!selStudent ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          학생을 선택해주세요.
        </p>
      ) : !assignment ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          이 학생은 아직 면접 카테고리가 배정되지 않았습니다.
        </p>
      ) : (
        <>
          <div className="mb-3 text-sm font-medium text-seum-navy">
            {getCategoryLabel(assignment.category_key)}
            {getSubLabel(assignment.category_key, assignment.sub_key) && (
              <span className="ml-1 text-seum-blue">· {getSubLabel(assignment.category_key, assignment.sub_key)}</span>
            )}
          </div>

          {/* 탭 */}
          <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {tabs.map((t) => {
              const on = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    on ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
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
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
              {showSeriesPicker && !activeSeries
                ? "직렬을 선택하면 해당 직렬의 기출문제가 표시됩니다."
                : "이 탭에 등록된 질문이 없습니다."}
            </p>
          ) : (
            <div className="space-y-4">
              {rows.map((row, i) => {
                const a = row._answer;
                const hasAnswer = !!a?.student_answer;
                return (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="mb-2 font-medium text-seum-navy">
                      <span className="mr-1 text-slate-400">{i + 1}.</span>
                      {row.question}
                    </p>

                    {/* 학생 답변 */}
                    {hasAnswer ? (
                      <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2.5">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">학생 답변</p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{a.student_answer}</p>
                      </div>
                    ) : (
                      <p className="mb-3 text-xs text-slate-400">아직 학생 답변이 없습니다.</p>
                    )}

                    {hasAnswer && (
                      <>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-seum-blue">선생님 피드백</p>
                          <button
                            type="button"
                            onClick={() => genAiDraft(row)}
                            disabled={aiLoadingId === a.id}
                            className="rounded-md border border-seum-blue px-3 py-1 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-50"
                          >
                            {aiLoadingId === a.id ? "AI 생성 중..." : a.ai_draft ? "🔄 AI 다시 생성" : "✨ AI 초안 생성"}
                          </button>
                        </div>
                        <textarea
                          value={draftEdits[a.id] ?? ""}
                          onChange={(e) => setDraftEdits((p) => ({ ...p, [a.id]: e.target.value }))}
                          rows={5}
                          placeholder="AI 초안을 생성하거나 직접 피드백을 작성하세요."
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                        />
                        <div className="mt-2 flex items-center justify-between">
                          {a.teacher_feedback ? (
                            <span className="text-xs text-green-600">✓ 확정됨 (학생에게 전달)</span>
                          ) : a.ai_draft ? (
                            <span className="text-xs text-amber-600">초안 상태 — 검토 후 확정하세요</span>
                          ) : (
                            <span className="text-xs text-slate-400">미작성</span>
                          )}
                          <button
                            type="button"
                            onClick={() => confirmFeedback(row)}
                            disabled={savingId === a.id}
                            className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50"
                          >
                            {savingId === a.id ? "저장 중..." : "피드백 확정"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}