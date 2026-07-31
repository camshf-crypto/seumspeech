import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// 배포된 Edge Function만 등록. 없으면 fallback.
const FN_MAP = {
  gov: "interview-ai-gov",
  public_corp: "interview-ai-public",
};
const FN_FALLBACK = "interview-ai-feedback";
const getFnName = (categoryKey) => FN_MAP[categoryKey] ?? FN_FALLBACK;

const mmss = (sec) => {
  const s = Math.max(0, Math.floor(sec ?? 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ============================================================
// 선생님 — PT 발표 검토
//
// 학생이 같은 주제를 여러 번 연습하므로 2단계로 접어서 보여준다.
//   1단계: 주제 한 줄 (발표 N회 · 미피드백 n건)
//   2단계: 주제를 열면 회차 목록 → 회차를 열면 녹음·개요·발표문·피드백
// ============================================================
export default function PtReview({ studentId, studentName, categoryKey, subKey }) {
  const [sessions, setSessions] = useState([]);
  const [topics, setTopics] = useState({});
  const [loading, setLoading] = useState(true);

  const [openTopic, setOpenTopic] = useState(null);   // 펼친 주제
  const [openSession, setOpenSession] = useState(null); // 펼친 회차

  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [aiLoadingId, setAiLoadingId] = useState(null);

  const load = async () => {
    setLoading(true);

    const { data: ss, error: sErr } = await supabase
      .from("pt_sessions")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (sErr) console.error("pt_sessions 조회 실패:", sErr);

    const { data: tp, error: tErr } = await supabase
      .from("pt_topics")
      .select("*")
      .eq("category_key", categoryKey);
    if (tErr) console.error("pt_topics 조회 실패:", tErr);

    const tMap = {};
    (tp ?? []).forEach((t) => { tMap[t.id] = t; });

    const edits = {};
    (ss ?? []).forEach((s) => {
      edits[s.id] = s.teacher_feedback ?? s.ai_feedback ?? "";
    });

    setTopics(tMap);
    setSessions(ss ?? []);
    setDrafts(edits);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [studentId, categoryKey]);
  useEffect(() => { setOpenTopic(null); setOpenSession(null); }, [studentId]);

  const audioUrl = (path) => {
    if (!path) return null;
    const { data } = supabase.storage.from("simulation-recordings").getPublicUrl(path);
    return data?.publicUrl ?? null;
  };

  const genAi = async (s) => {
    const topic = topics[s.topic_id];
    if (!s.transcript?.trim()) return alert("발표 내용이 인식되지 않아 피드백을 만들 수 없습니다.");
    setAiLoadingId(s.id);
    try {
      const fnName = getFnName(categoryKey);
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: {
          category_key: categoryKey,
          sub_key: subKey,
          tab_key: "pt",
          question:
            `[PT 발표 제시문]\n${topic?.passage ?? ""}\n\n` +
            `위 제시문으로 진행한 ${Math.round((topic?.speak_seconds ?? 300) / 60)}분 발표입니다. ` +
            `내용 구성(서론-본론-결론), 논리, 근거의 타당성, 시간 배분, 전달력 관점에서 평가해주세요.`,
          answer: s.transcript,
        },
      });
      if (error) throw new Error(error.message);
      const text = data?.feedback || data?.text || "";
      if (!text) throw new Error(data?.error || "AI 응답이 비어 있습니다.");

      const { error: uErr } = await supabase
        .from("pt_sessions").update({ ai_feedback: text }).eq("id", s.id);
      if (uErr) throw uErr;

      setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, ai_feedback: text } : x)));
      setDrafts((prev) => ({ ...prev, [s.id]: text }));
    } catch (e) {
      alert("AI 오류:\n\n" + e.message);
    } finally {
      setAiLoadingId(null);
    }
  };

  const confirmOne = async (s) => {
    const text = (drafts[s.id] ?? "").trim();
    if (!text) return alert("피드백 내용을 입력하세요.");
    setSavingId(s.id);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("pt_sessions")
      .update({ teacher_feedback: text, feedback_at: now })
      .eq("id", s.id)
      .select()
      .maybeSingle();
    setSavingId(null);
    if (error) return alert("저장 실패: " + error.message);
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...data } : x)));
  };

  if (loading) return <p className="py-10 text-center text-slate-400">불러오는 중...</p>;

  if (sessions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
        {studentName} 학생의 PT 발표 기록이 없습니다.
      </p>
    );
  }

  // 주제별로 묶기 (sessions 는 이미 최신순)
  const groups = [];
  const byTopic = new Map();
  sessions.forEach((s) => {
    if (!byTopic.has(s.topic_id)) {
      const g = { topicId: s.topic_id, items: [] };
      byTopic.set(s.topic_id, g);
      groups.push(g);
    }
    byTopic.get(s.topic_id).items.push(s);
  });

  const statusOf = (s) => {
    if (s.teacher_feedback) return { label: "전달 완료", cls: "bg-green-50 text-green-600" };
    if (s.ai_feedback) return { label: "초안 대기", cls: "bg-amber-50 text-amber-600" };
    return { label: "미피드백", cls: "bg-slate-100 text-slate-500" };
  };

  const totalPending = sessions.filter((s) => !s.teacher_feedback).length;

  return (
    <div>
      <div className="mb-3 text-sm font-bold text-seum-navy">
        {studentName}
        <span className="ml-2 text-xs font-medium text-slate-400">
          주제 {groups.length}개 · 발표 {sessions.length}회
          {totalPending > 0 && ` · 미피드백 ${totalPending}건`}
        </span>
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {groups.map((g) => {
          const topic = topics[g.topicId];
          const openT = openTopic === g.topicId;
          const pending = g.items.filter((s) => !s.teacher_feedback).length;
          const latest = g.items[0];

          return (
            <div key={g.topicId}>
              {/* 1단계 — 주제 */}
              <button
                type="button"
                onClick={() => { setOpenTopic(openT ? null : g.topicId); setOpenSession(null); }}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 ${openT ? "bg-slate-50" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-seum-navy">
                    {topic?.title ?? "삭제된 주제"}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    발표 {g.items.length}회 · 최근 {fmtDate(latest.created_at)}
                  </span>
                </span>
                {pending > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                    미피드백 {pending}
                  </span>
                )}
                <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${openT ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 2단계 — 회차 목록 */}
              {openT && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                  {topic?.passage && (
                    <details className="mb-2 px-1">
                      <summary className="cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-700">
                        제시문 보기
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-600">
                        {topic.passage}
                      </p>
                    </details>
                  )}

                  <div className="space-y-1.5">
                    {g.items.map((s, idx) => {
                      const openS = openSession === s.id;
                      const st = statusOf(s);
                      const url = audioUrl(s.audio_path);
                      const confirmed =
                        !!s.teacher_feedback &&
                        (drafts[s.id] ?? "").trim() === s.teacher_feedback.trim();
                      const round = g.items.length - idx; // 최신이 가장 큰 회차

                      return (
                        <div key={s.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setOpenSession(openS ? null : s.id)}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-50 ${openS ? "bg-slate-50" : ""}`}
                          >
                            <span className="shrink-0 text-xs font-bold text-slate-500">{round}회차</span>
                            {s.submitted_at && (
                              <span className="shrink-0 rounded bg-seum-blue/10 px-1.5 py-0.5 text-[10px] font-bold text-seum-blue">
                                제출
                              </span>
                            )}
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${st.cls}`}>
                              {st.label}
                            </span>
                            <span className="ml-auto shrink-0 text-xs text-slate-400">
                              {fmtDate(s.created_at)} · {mmss(s.spoke_seconds)}
                            </span>
                            <svg className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${openS ? "rotate-180" : ""}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* 3단계 — 상세 */}
                          {openS && (
                            <div className="border-t border-slate-100 px-3 py-3">
                              <div className="mb-3">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">녹음</p>
                                {url ? (
                                  <audio controls src={url} className="w-full" />
                                ) : (
                                  <p className="text-xs text-slate-400">저장된 녹음이 없습니다.</p>
                                )}
                              </div>

                              <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2.5">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">학생 개요</p>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                  {s.outline || "작성한 개요가 없습니다."}
                                </p>
                              </div>

                              <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2.5">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">발표 내용 (음성 인식)</p>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                  {s.transcript || "음성 인식 결과가 없습니다."}
                                </p>
                              </div>

                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-seum-blue">피드백</span>
                                <button type="button" onClick={() => genAi(s)} disabled={aiLoadingId === s.id}
                                  className="rounded-md border border-seum-blue px-2.5 py-0.5 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-50">
                                  {aiLoadingId === s.id ? "생성 중..." : s.ai_feedback ? "🔄 다시" : "✨ AI"}
                                </button>
                              </div>
                              <textarea
                                value={drafts[s.id] ?? ""}
                                onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: e.target.value }))}
                                rows={6}
                                placeholder="AI 초안 생성 또는 직접 작성"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                              />
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => confirmOne(s)}
                                  disabled={savingId === s.id || confirmed}
                                  className={`rounded-lg px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-100 ${
                                    confirmed ? "cursor-default bg-slate-700" : "bg-seum-blue hover:bg-[#2a63c4]"
                                  }`}
                                >
                                  {savingId === s.id
                                    ? "저장 중..."
                                    : confirmed
                                    ? "✓ 전달 완료"
                                    : s.teacher_feedback
                                    ? "수정 내용 재전달"
                                    : "피드백 확정"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}