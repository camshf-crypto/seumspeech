import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function TeacherInterviewTab({ teacherId }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSet, setOpenSet] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [feedbacks, setFeedbacks] = useState({});
  const [savingId, setSavingId] = useState(null);

  const loadSets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("interview_question_sets")
      .select("*, student:student_id(name), enrollment:enrollment_id(company, exam_type, job_role, career_level, courses(title))")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    setSets(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadSets(); }, [teacherId]);

  const openQuestions = async (set) => {
    setOpenSet(set);
    const { data } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("set_id", set.id)
      .order("seq");
    setQuestions(data ?? []);
    const fb = {};
    (data ?? []).forEach((q) => { fb[q.id] = q.teacher_feedback ?? ""; });
    setFeedbacks(fb);
  };

  // 실시간 구독: 열려있는 세트의 질문이 바뀌면 자동 갱신 (학생 답변 등)
  useEffect(() => {
    if (!openSet) return;
    const channel = supabase
      .channel(`tiq-${openSet.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interview_questions", filter: `set_id=eq.${openSet.id}` },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          setQuestions((prev) => prev.map((q) => (q.id === row.id ? { ...q, ...row } : q)));
          setFeedbacks((prev) => {
            if (prev[row.id] !== undefined) return prev;
            return { ...prev, [row.id]: row.teacher_feedback ?? "" };
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [openSet]);

  const saveFeedback = async (q) => {
    setSavingId(q.id);
    const { error } = await supabase
      .from("interview_questions")
      .update({ teacher_feedback: feedbacks[q.id] ?? "" })
      .eq("id", q.id);
    setSavingId(null);
    if (error) return alert("저장 실패: " + error.message);
    setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, teacher_feedback: feedbacks[q.id] ?? "" } : x));
    alert("첨삭이 저장되어 학생에게 전달되었습니다.");
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  // 강사용 자료 상세
  if (openSet) {
    const ov = openSet.teacher_overview || {};
    const enr = openSet.enrollment || {};
    const prepScope = Array.isArray(ov.prep_scope) ? ov.prep_scope : [];
    const answerStructure = Array.isArray(ov.answer_structure) ? ov.answer_structure : [];
    const guideStandards = Array.isArray(ov.guide_standards) ? ov.guide_standards : [];
    const correctionFormulas = Array.isArray(ov.correction_formulas) ? ov.correction_formulas : [];

    const byCat = {};
    questions.forEach((q) => {
      const c = q.category || "기타";
      (byCat[c] = byCat[c] || []).push(q);
    });
    const cats = Object.keys(byCat);
    const answeredCount = questions.filter((q) => q.student_answer).length;

    return (
      <div>
        <button type="button" onClick={() => { setOpenSet(null); loadSets(); }} className="mb-4 text-sm text-seum-blue hover:underline">← 목록으로</button>
        <h2 className="font-bold text-seum-navy">{openSet.title} <span className="text-sm font-normal text-slate-400">| 강사용</span></h2>
        <p className="mb-1 text-sm text-slate-500">
          {openSet.student?.name}
          {enr.company ? ` · ${enr.company}` : ""}
          {enr.exam_type ? ` · ${enr.exam_type}` : ""}
          {enr.job_role ? ` · ${enr.job_role}` : ""}
          {enr.career_level ? ` · ${enr.career_level}` : ""}
        </p>
        <p className="mb-5 text-xs text-slate-400">총 {questions.length}문항 · 학생 답변 {answeredCount}개 <span className="ml-1 text-green-500">● 실시간</span></p>

        {/* 상단 공통 자료 */}
        <div className="mb-6 space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
          {prepScope.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-seum-navy">핵심 준비 범위</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400"><th className="py-1 pr-3 font-medium">구분</th><th className="py-1 pr-3 font-medium">준비 내용</th><th className="py-1 font-medium">핵심 목표</th></tr></thead>
                  <tbody>
                    {prepScope.map((row, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="py-1.5 pr-3 font-medium text-slate-700">{row.구분}</td>
                        <td className="py-1.5 pr-3 text-slate-600">{row.준비내용}</td>
                        <td className="py-1.5 text-slate-600">{row.핵심목표}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {answerStructure.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-seum-navy">답변 기본 구조</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400"><th className="py-1 pr-3 font-medium">질문 유형</th><th className="py-1 font-medium">추천 답변 구조</th></tr></thead>
                  <tbody>
                    {answerStructure.map((row, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="py-1.5 pr-3 font-medium text-slate-700">{row.질문유형}</td>
                        <td className="py-1.5 text-slate-600">{row.추천답변구조}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {guideStandards.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-seum-navy">핵심 지도 기준 <span className="text-xs font-normal text-slate-400">(강사용)</span></h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400"><th className="py-1 pr-3 font-medium">기준</th><th className="py-1 font-medium">지도 포인트</th></tr></thead>
                  <tbody>
                    {guideStandards.map((g, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="py-1.5 pr-3 font-medium text-slate-700">{g.기준}</td>
                        <td className="py-1.5 text-slate-600">{g.포인트}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {correctionFormulas.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-seum-navy">답변 교정 공식 <span className="text-xs font-normal text-slate-400">(강사용)</span></h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400"><th className="py-1 pr-3 font-medium">유형</th><th className="py-1 font-medium">공식</th></tr></thead>
                  <tbody>
                    {correctionFormulas.map((c, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="py-1.5 pr-3 font-medium text-slate-700">{c.유형}</td>
                        <td className="py-1.5 text-slate-600">{c.공식}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 카테고리별 질문 */}
        <div className="space-y-6">
          {cats.map((cat) => (
            <div key={cat}>
              <h3 className="mb-3 border-l-4 border-seum-blue pl-2 font-bold text-seum-navy">{cat}</h3>
              <div className="space-y-3">
                {byCat[cat].map((q) => (
                  <div key={q.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {/* 질문 */}
                    <div className="px-5 pt-4 pb-3">
                      <span className="mb-1.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{q.category}</span>
                      <p className="text-base font-bold leading-snug text-seum-navy">
                        <span className="mr-1 text-slate-400">{q.seq}.</span>{q.question}
                      </p>
                    </div>

                    {/* 강사용 지도자료 */}
                    {(q.prep_point || q.keywords) ? (
                      <div className="border-l-2 border-slate-200 bg-slate-50 px-5 py-3">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">강사 지도자료</p>
                        {q.prep_point ? (
                          <div className="mb-2 text-sm leading-relaxed text-slate-600">
                            <span className="mr-1.5 font-medium text-slate-500">준비 포인트</span>{q.prep_point}
                          </div>
                        ) : null}
                        {q.keywords ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="mr-0.5 text-xs font-medium text-slate-500">필수 키워드</span>
                            {q.keywords.split(",").map((kw, i) => (
                              <span key={i} className="rounded bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">{kw.trim()}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* 학생 답변 */}
                    <div className="border-l-2 border-slate-300 bg-slate-50/60 px-5 py-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">학생 답변</p>
                      {q.student_answer ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{q.student_answer}</p>
                      ) : (
                        <p className="text-sm text-slate-300">아직 작성 안 함</p>
                      )}
                    </div>

                    {/* 선생님 첨삭 (블루 포인트) */}
                    <div className="border-l-2 border-seum-blue bg-blue-50/40 px-5 py-3">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-seum-blue">선생님 첨삭</p>
                      <textarea
                        value={feedbacks[q.id] ?? ""}
                        onChange={(e) => setFeedbacks((p) => ({ ...p, [q.id]: e.target.value }))}
                        rows={3}
                        placeholder="학생 답변에 대한 첨삭·피드백을 작성하세요. (학생에게 전달됩니다)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-seum-blue"
                      />
                      <div className="mt-2 flex justify-end">
                        <button type="button" onClick={() => saveFeedback(q)} disabled={savingId === q.id}
                          className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                          {savingId === q.id ? "저장 중..." : "첨삭 저장"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 세트 목록
  return (
    <div>
      <h2 className="mb-1 font-bold text-seum-navy">면접 강사 자료</h2>
      <p className="mb-4 text-sm text-slate-400">담당 학생의 면접 질문 지도자료와 학생 답변을 확인합니다.</p>
      {sets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">아직 생성된 면접 자료가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {sets.map((s) => (
            <button key={s.id} type="button" onClick={() => openQuestions(s)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50">
              <div>
                <p className="font-bold text-seum-navy">{s.student?.name} <span className="ml-1 text-sm font-normal text-slate-400">{s.title}</span></p>
                <p className="text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString("ko-KR")}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "answered" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                {s.status === "answered" ? "답변완료" : "답변대기"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}