import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function StudentInterviewTab({ studentId, locked = false }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSet, setOpenSet] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [savingId, setSavingId] = useState(null);

  const loadSets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("interview_question_sets")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    setSets(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadSets(); }, [studentId]);

  const loadQuestions = async (setId) => {
    const { data } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("set_id", setId)
      .order("seq");
    setQuestions(data ?? []);
    setAnswers((prev) => {
      const ans = { ...prev };
      (data ?? []).forEach((q) => {
        if (ans[q.id] === undefined) ans[q.id] = q.student_answer ?? "";
      });
      return ans;
    });
  };

  const openQuestions = async (set) => {
    setOpenSet(set);
    setAnswers({});
    await loadQuestions(set.id);
  };

  useEffect(() => {
    if (!openSet) return;
    const channel = supabase
      .channel(`iq-${openSet.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interview_questions", filter: `set_id=eq.${openSet.id}` },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          setQuestions((prev) => prev.map((q) => (q.id === row.id ? { ...q, ...row } : q)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [openSet]);

  const saveAnswer = async (q) => {
    if (locked) return alert("수강이 종료되어 답변을 저장할 수 없습니다. 재등록 후 이용해주세요.");
    setSavingId(q.id);
    const { error } = await supabase
      .from("interview_questions")
      .update({ student_answer: answers[q.id] ?? "", answered_at: new Date().toISOString() })
      .eq("id", q.id);
    setSavingId(null);
    if (error) return alert("저장 실패: " + error.message);
    await supabase.from("interview_question_sets").update({ status: "answered" }).eq("id", openSet.id);
    setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, answered_at: new Date().toISOString(), student_answer: answers[q.id] ?? "" } : x));
    alert("답변이 저장되어 선생님에게 전달되었습니다.");
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  // 질문 풀이 화면
  if (openSet) {
    const ov = openSet.teacher_overview || {};
    const prepScope = Array.isArray(ov.prep_scope) ? ov.prep_scope : [];
    const answerStructure = Array.isArray(ov.answer_structure) ? ov.answer_structure : [];

    const byCat = {};
    questions.forEach((q) => {
      const c = q.category || "기타";
      (byCat[c] = byCat[c] || []).push(q);
    });
    const cats = Object.keys(byCat);

    return (
      <div>
        <button type="button" onClick={() => { setOpenSet(null); loadSets(); }} className="mb-4 text-sm text-seum-blue hover:underline">← 목록으로</button>
        <h2 className="font-bold text-seum-navy">{openSet.title}</h2>
        <p className="mb-4 text-sm text-slate-400">총 {questions.length}문항</p>

        {locked && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            수강이 종료되어 답변 저장은 할 수 없습니다. 받은 질문과 첨삭은 계속 확인하실 수 있습니다.
          </div>
        )}

        {(prepScope.length > 0 || answerStructure.length > 0) && (
          <div className="mb-6 space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
            {prepScope.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-seum-navy">핵심 준비 범위</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="py-1 pr-3 font-medium">구분</th>
                        <th className="py-1 pr-3 font-medium">준비 내용</th>
                        <th className="py-1 font-medium">핵심 목표</th>
                      </tr>
                    </thead>
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
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="py-1 pr-3 font-medium">질문 유형</th>
                        <th className="py-1 font-medium">추천 답변 구조</th>
                      </tr>
                    </thead>
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
          </div>
        )}

        <div className="space-y-6">
          {cats.map((cat) => (
            <div key={cat}>
              <h3 className="mb-3 border-l-4 border-seum-blue pl-2 font-bold text-seum-navy">{cat}</h3>
              <div className="space-y-4">
                {byCat[cat].map((q) => (
                  <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="mb-2 font-medium text-seum-navy">
                      <span className="mr-1 text-slate-400">{q.seq}.</span>{q.question}
                    </p>
                    <textarea
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                      rows={4}
                      disabled={locked}
                      placeholder={locked ? "수강 종료로 답변을 작성할 수 없습니다." : "답변을 작성하세요."}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      {q.answered_at ? (
                        <span className="text-xs text-green-600">✓ 저장됨</span>
                      ) : <span className="text-xs text-slate-400">미작성</span>}
                      <button type="button" onClick={() => saveAnswer(q)} disabled={savingId === q.id || locked}
                        className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
                        {savingId === q.id ? "저장 중..." : "저장"}
                      </button>
                    </div>

                    {q.teacher_feedback ? (
                      <div className="mt-3 border-l-2 border-seum-blue bg-blue-50/40 px-4 py-2.5">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-seum-blue">선생님 첨삭</p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{q.teacher_feedback}</p>
                      </div>
                    ) : null}
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
      <h2 className="mb-1 font-bold text-seum-navy">면접 질문</h2>
      <p className="mb-4 text-sm text-slate-400">선생님이 보낸 면접 질문에 답변을 작성하세요.</p>
      {sets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">아직 받은 면접 질문이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {sets.map((s) => (
            <button key={s.id} type="button" onClick={() => openQuestions(s)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50">
              <div>
                <p className="font-bold text-seum-navy">{s.title}</p>
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