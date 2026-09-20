import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * 선생님 — 면접 모의고사
 *
 * 수업이 끝나고 선생님이 범위를 골라 출제하면,
 * 학생은 집에서 '면접 시뮬레이션' 탭에 뜨는 모의고사를 본다.
 * 문항은 출제할 때 미리 뽑아 고정한다. (선생님이 보고 확인 후 발송)
 *
 * 저장 위치
 *   univ_simulations           is_mock = true 인 행
 *   univ_simulation_questions  미리 뽑아둔 문항
 */

const SCOPES = [
  { key: "insung", label: "기본 인성", hint: "학생이 답변한 인성 문항에서 뽑습니다" },
  { key: "saenggibu", label: "생기부", hint: "학생이 답변한 생기부 문항에서 뽑습니다" },
  { key: "gichul", label: "기출문제", hint: "학생이 답변한 기출 문항에서 뽑습니다" },
];
const scopeLabel = (k) => SCOPES.find((s) => s.key === k)?.label ?? k;

const STATUS = {
  ready: { label: "대기 중", cls: "bg-amber-50 text-amber-700" },
  doing: { label: "응시 중", cls: "bg-blue-50 text-seum-blue" },
  done: { label: "응시 완료", cls: "bg-green-50 text-green-600" },
};

const fmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const shuffle = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

export default function TeacherMockPanel({ student, teacherId, concept }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // 출제 팝업
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("insung");
  const [picks, setPicks] = useState([]);       // 학생 지원 목록 (기출용)
  const [pick, setPick] = useState(null);
  const [count, setCount] = useState(5);
  const [picked, setPicked] = useState([]);     // 뽑힌 문항
  const [poolSize, setPoolSize] = useState(null); // 답변한 문항 수
  const [drawing, setDrawing] = useState(false);
  const [sending, setSending] = useState(false);

  // 결과 보기
  const [selExam, setSelExam] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [fbEdits, setFbEdits] = useState({});
  const [savingFb, setSavingFb] = useState(null);
  const [sttId, setSttId] = useState(null);
  const [aiId, setAiId] = useState(null);
  const [aiAll, setAiAll] = useState(null);   // { done, total }

  const load = async () => {
    if (!student) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("univ_simulations")
      .select("*")
      .eq("student_id", student.id)
      .eq("is_mock", true)
      .order("created_at", { ascending: false });
    if (error) console.error("모의고사 조회 실패:", error);
    setExams(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); setSelExam(null); /* eslint-disable-next-line */ }, [student?.id]);

  // 학생 지원 목록 (기출 출제용)
  useEffect(() => {
    if (!student) return;
    (async () => {
      const { data } = await supabase
        .from("student_univ_picks")
        .select("*")
        .eq("student_id", student.id)
        .order("created_at");
      setPicks(data ?? []);
      setPick((data ?? [])[0] ?? null);
    })();
  }, [student?.id]);

  // 선택한 모의고사의 문항·답변
  useEffect(() => {
    if (!selExam) { setItems([]); return; }
    (async () => {
      setItemsLoading(true);
      const { data, error } = await supabase
        .from("univ_simulation_questions")
        .select("*")
        .eq("simulation_id", selExam.id)
        .order("order", { ascending: true });
      if (error) console.error("문항 조회 실패:", error);
      const list = data ?? [];
      setItems(list);
      const e = {};
      list.forEach((x) => { e[x.id] = x.teacher_feedback ?? ""; });
      setFbEdits(e);
      setItemsLoading(false);
    })();
  }, [selExam]);

  // ── 문항 뽑기 ─────────────────────────────────────────
  // 모의고사는 연습한 것을 확인하는 자리다.
  // 그래서 학생이 실제로 답변한 문항에서만 뽑는다.
  const fetchPool = async () => {
    // 이 학생이 답변한 문항 id
    const { data: ans, error: aErr } = await supabase
      .from("interview_answers_v2")
      .select("question_id, student_answer")
      .eq("student_id", student.id);
    if (aErr) throw aErr;

    const answered = (ans ?? [])
      .filter((a) => a.student_answer?.trim())
      .map((a) => a.question_id);
    if (answered.length === 0) return [];

    const idSet = new Set(answered);

    if (scope === "insung") {
      const { data } = await supabase
        .from("interview_questions_v2")
        .select("id, question")
        .eq("category_key", "univ")
        .eq("tab_key", "insung")
        .eq("is_active", true);
      return (data ?? []).filter((q) => idSet.has(q.id)).map((q) => q.question);
    }

    if (scope === "saenggibu") {
      const { data } = await supabase
        .from("student_questions")
        .select("id, question")
        .eq("student_id", student.id)
        .eq("tab_key", "saenggibu")
        .eq("is_active", true);
      return (data ?? []).filter((q) => idSet.has(q.id)).map((q) => q.question);
    }

    // 기출 — 고른 지원 학교의 문항 중 답변한 것만
    if (!pick) return [];
    const { data } = await supabase
      .from("univ_questions")
      .select("id, question")
      .eq("univ", pick.univ)
      .eq("major", pick.major)
      .eq("admission", pick.admission)
      .eq("is_active", true);
    return (data ?? []).filter((q) => idSet.has(q.id)).map((q) => q.question);
  };

  const clean = (list) =>
    [...new Set((list ?? []).map((q) => (q ?? "").trim()))].filter(Boolean);

  const draw = async () => {
    if (scope === "gichul" && !pick) return alert("지원 학교를 선택하세요.");
    setDrawing(true);
    setPicked([]);
    try {
      const pool = clean(await fetchPool());
      setPoolSize(pool.length);

      if (pool.length === 0) {
        setDrawing(false);
        return alert(
          `${student.name} 학생이 ${scopeLabel(scope)}에서 답변한 문항이 없습니다.\n\n` +
          `모의고사는 연습한 문항에서 출제됩니다. 먼저 답변을 받아주세요.`
        );
      }

      const n = Math.min(count, pool.length);
      if (n < count) {
        alert(`답변한 문항이 ${pool.length}개뿐입니다. ${n}문항으로 출제합니다.`);
      }
      setPicked(shuffle(pool, n));
    } catch (e) {
      alert("문항 뽑기 실패: " + e.message);
    } finally {
      setDrawing(false);
    }
  };

  const replaceOne = async (idx) => {
    try {
      const cur = new Set(picked);
      const rest = clean(await fetchPool()).filter((q) => !cur.has(q));
      if (rest.length === 0) return alert("바꿀 문항이 더 없습니다.");
      const next = [...picked];
      next[idx] = rest[Math.floor(Math.random() * rest.length)];
      setPicked(next);
    } catch (e) {
      alert("문항 교체 실패: " + e.message);
    }
  };

  // ── 학생에게 보내기 ────────────────────────────────────
  const send = async () => {
    if (picked.length === 0) return alert("먼저 문항을 뽑으세요.");
    if (scope === "gichul" && !pick) return alert("지원 학교를 선택하세요.");

    const ok = window.confirm(
      `${student.name} 학생에게 모의고사를 보냅니다.\n\n` +
      `범위: ${scopeLabel(scope)}${scope === "gichul" ? ` (${pick.univ} · ${pick.major})` : ""}\n` +
      `문항: ${picked.length}개\n\n` +
      `학생 화면의 '면접 시뮬레이션'에 바로 나타납니다.`
    );
    if (!ok) return;

    setSending(true);
    try {
      const round = exams.length + 1;
      const { data: sim, error } = await supabase
        .from("univ_simulations")
        .insert({
          student_id: student.id,
          teacher_id: teacherId ?? null,
          question_type: scope,
          tail_question_enabled: false,
          question_mode: "text",
          university: scope === "gichul" ? pick.univ : null,
          department: scope === "gichul" ? pick.major : null,
          admission_type: scope === "gichul" ? pick.admission : null,
          question_count: picked.length,
          is_mock: true,
          mock_round: round,
          opened_at: new Date().toISOString(),
          status: "ready",
        })
        .select()
        .single();
      if (error) throw error;

      const rows = picked.map((q, i) => ({
        simulation_id: sim.id,
        student_id: student.id,
        order: i + 1,
        question_text: q,
        is_tail: false,
      }));
      const { error: qErr } = await supabase.from("univ_simulation_questions").insert(rows);
      if (qErr) throw qErr;

      setOpen(false);
      setPicked([]);
      load();
    } catch (e) {
      alert("보내기 실패: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const removeExam = async (exam) => {
    if (!window.confirm("이 모의고사를 지울까요? 학생 답변과 녹음도 함께 사라집니다.")) return;
    const { error } = await supabase.from("univ_simulations").delete().eq("id", exam.id);
    if (error) return alert("삭제 실패: " + error.message);
    if (selExam?.id === exam.id) setSelExam(null);
    load();
  };

  // 녹음은 있는데 글이 없을 때 — 여기서 다시 변환한다
  const runStt = async (item) => {
    if (!item.recording_url) return;
    setSttId(item.id);
    try {
      const audio = await fetch(item.recording_url);
      if (!audio.ok) throw new Error("녹음 파일을 불러오지 못했습니다.");
      const blob = await audio.blob();

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stt-clova`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/octet-stream",
          },
          body: blob,
        }
      );
      const out = await res.json();
      if (!out?.success || !out?.text) {
        throw new Error(out?.error || "음성을 알아듣지 못했습니다.");
      }

      const { data, error } = await supabase
        .from("univ_simulation_questions")
        .update({ transcript: out.text })
        .eq("id", item.id)
        .select()
        .maybeSingle();
      if (error) throw error;

      setItems((p) => p.map((x) => (x.id === item.id ? { ...x, ...data } : x)));
    } catch (e) {
      alert("음성 변환 실패:\n\n" + e.message);
    } finally {
      setSttId(null);
    }
  };

  // 한 문항 진단
  const runAi = async (item, sim) => {
    if (!item.transcript?.trim()) {
      alert("음성 텍스트가 없습니다. 먼저 [음성 → 텍스트]를 눌러주세요.");
      return null;
    }

    const { data, error } = await supabase.functions.invoke("interview-ai-mock", {
      body: {
        question: item.question_text,
        transcript: item.transcript,
        concept: concept || null,
        scope: sim.question_type,
        univ: sim.university,
        major: sim.department,
        speech: {
          duration_sec: item.duration_sec,
          speed_label: item.speed_label,
          filler_count: item.filler_count,
          pause_count: item.pause_count,
          clarity_label: item.clarity_label,
        },
      },
    });

    if (error) {
      let detail = error.message;
      try {
        const body = await error.context?.json();
        detail = body?.error || detail;
      } catch (_) {}
      throw new Error(detail);
    }
    if (!data?.success) throw new Error(data?.error || "AI 실패");

    const { data: saved, error: uErr } = await supabase
      .from("univ_simulation_questions")
      .update({ ai_feedback: data.feedback, ai_scores: data.scores })
      .eq("id", item.id)
      .select()
      .maybeSingle();
    if (uErr) throw uErr;

    setItems((p) => p.map((x) => (x.id === item.id ? { ...x, ...saved } : x)));
    return saved;
  };

  const genOne = async (item, sim) => {
    setAiId(item.id);
    try {
      await runAi(item, sim);
    } catch (e) {
      alert("AI 진단 실패:\n\n" + e.message);
    } finally {
      setAiId(null);
    }
  };

  // 이 모의고사 전체 진단
  const genAll = async (sim) => {
    const targets = items.filter((x) => x.transcript?.trim() && !x.ai_feedback);
    if (targets.length === 0) {
      return alert("진단할 문항이 없습니다. (텍스트가 없거나 이미 진단했습니다)");
    }
    if (!window.confirm(`${targets.length}문항을 진단합니다. 1문항당 10~20초 걸립니다.`)) return;

    setAiAll({ done: 0, total: targets.length });
    let fail = 0;
    let firstErr = "";
    for (let i = 0; i < targets.length; i++) {
      try {
        await runAi(targets[i], sim);
      } catch (e) {
        fail += 1;
        if (!firstErr) firstErr = e.message;
      }
      setAiAll({ done: i + 1, total: targets.length });
    }
    setAiAll(null);
    if (fail > 0) alert(`${targets.length}건 중 ${fail}건 실패했습니다.\n\n${firstErr}`);
  };

  const saveFeedback = async (item) => {
    const text = (fbEdits[item.id] ?? "").trim();
    if (!text) return alert("피드백을 입력하세요.");
    setSavingFb(item.id);
    const { data, error } = await supabase
      .from("univ_simulation_questions")
      .update({ teacher_feedback: text, feedback_at: new Date().toISOString() })
      .eq("id", item.id)
      .select()
      .maybeSingle();
    setSavingFb(null);
    if (error) return alert("저장 실패: " + error.message);
    setItems((p) => p.map((x) => (x.id === item.id ? { ...x, ...data } : x)));
  };

  if (!student) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
        학생을 선택해주세요.
      </p>
    );
  }

  const openModal = () => {
    setOpen(true);
    setScope("insung");
    setCount(5);
    setPicked([]);
    setPoolSize(null);
  };

  return (
    <div>
      {/* 머리 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold text-seum-navy">
          {student.name}
          <span className="ml-2 text-xs font-medium text-slate-400">
            모의고사 {exams.length}회
            {concept ? ` · 컨셉 ${concept}` : ""}
          </span>
        </div>
        <button type="button" onClick={openModal}
          className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4]">
          모의고사 출제
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <p className="py-10 text-center text-slate-400">불러오는 중...</p>
      ) : exams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          아직 출제한 모의고사가 없습니다. 수업이 끝나면 위에서 출제하세요.
        </p>
      ) : (
        <div className="space-y-2">
          {exams.map((ex) => {
            const st = STATUS[ex.status ?? "done"] ?? STATUS.done;
            const on = selExam?.id === ex.id;
            return (
              <div key={ex.id}
                className={`rounded-xl border bg-white transition ${on ? "border-seum-blue" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-3 p-4">
                  <button type="button" onClick={() => setSelExam(on ? null : ex)}
                    className="min-w-0 flex-1 text-left">
                    <p className="font-medium text-seum-navy">
                      <span className="mr-1.5 text-slate-400">{ex.mock_round ?? "-"}차</span>
                      {scopeLabel(ex.question_type)}
                      {ex.university && (
                        <span className="ml-1.5 text-xs font-normal text-slate-500">
                          {ex.university} · {ex.department}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {fmt(ex.opened_at ?? ex.created_at)} 출제 · {ex.question_count}문항
                    </p>
                  </button>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>
                    {st.label}
                  </span>
                  <button type="button" onClick={() => removeExam(ex)}
                    className="shrink-0 text-xs text-slate-300 hover:text-red-500">✕</button>
                </div>

                {on && (
                  <div className="border-t border-slate-100 p-4">
                    {items.length > 0 && (
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-slate-400">
                          진단 {items.filter((x) => x.ai_feedback).length} / {items.length}문항
                        </span>
                        <button type="button" onClick={() => genAll(ex)}
                          disabled={!!aiAll}
                          className="rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
                          {aiAll ? `진단 중... (${aiAll.done}/${aiAll.total})` : "✨ 전체 AI 진단"}
                        </button>
                      </div>
                    )}

                    {itemsLoading ? (
                      <p className="py-6 text-center text-sm text-slate-400">불러오는 중...</p>
                    ) : items.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-400">문항이 없습니다.</p>
                    ) : (
                      <div className="space-y-3">
                        {items.map((it) => {
                          const fbDirty = (fbEdits[it.id] ?? "") !== (it.teacher_feedback ?? "");
                          return (
                          <div key={it.id} className="rounded-lg border border-slate-200 p-3">
                            <p className="text-sm font-medium text-seum-navy">
                              <span className="mr-1 text-slate-400">{it.order}.</span>
                              {it.question_text}
                            </p>

                            {it.recording_url ? (
                              <audio controls src={it.recording_url} className="mt-2 h-8 w-full" />
                            ) : (
                              <p className="mt-2 text-xs text-slate-400">아직 답변하지 않았습니다.</p>
                            )}

                            {it.recording_url && (
                              it.transcript ? (
                                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                                  <p className="mb-1 text-[11px] font-bold text-slate-400">음성 텍스트</p>
                                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                    {it.transcript}
                                  </p>
                                </div>
                              ) : (
                                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
                                  <p className="text-xs text-slate-400">
                                    음성 텍스트가 없습니다.
                                  </p>
                                  <button type="button" onClick={() => runStt(it)}
                                    disabled={sttId === it.id}
                                    className="shrink-0 rounded-md border border-seum-blue px-2.5 py-0.5 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-50">
                                    {sttId === it.id ? "변환 중..." : "음성 → 텍스트"}
                                  </button>
                                </div>
                              )
                            )}

                            {/* 말하기 지표 */}
                            {(it.speech_speed || it.filler_count != null || it.clarity_score != null) && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {it.speed_label && (
                                  <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-seum-blue">
                                    속도 {it.speed_label}
                                  </span>
                                )}
                                {it.filler_count != null && (
                                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                    군말 {it.filler_count}회
                                  </span>
                                )}
                                {it.pause_count != null && (
                                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                                    멈춤 {it.pause_count}회
                                  </span>
                                )}
                                {it.clarity_label && (
                                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                    발음 {it.clarity_label}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* AI 진단 — 선생님만 본다 */}
                            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50">
                              <div className="flex items-center justify-between px-3 py-2">
                                <p className="text-[11px] font-black text-slate-500">
                                  AI 진단
                                  <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 font-bold">선생님만 봄</span>
                                </p>
                                <button type="button" onClick={() => genOne(it, ex)}
                                  disabled={!it.transcript?.trim() || aiId === it.id || !!aiAll}
                                  className="shrink-0 rounded-md border border-seum-blue px-2.5 py-0.5 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-40">
                                  {aiId === it.id ? "진단 중..." : it.ai_feedback ? "🔄 다시" : "✨ AI 진단"}
                                </button>
                              </div>

                              {it.ai_feedback ? (
                                <>
                                  {Array.isArray(it.ai_scores) && it.ai_scores.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 border-t border-slate-200 px-3 py-2">
                                      {it.ai_scores.map((sc) => (
                                        <span key={sc.label}
                                          className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                                            sc.grade === "상" ? "bg-green-50 text-green-700"
                                            : sc.grade === "중" ? "bg-amber-50 text-amber-700"
                                            : "bg-red-50 text-red-600"
                                          }`}>
                                          {sc.label} {sc.grade}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <p className="whitespace-pre-wrap border-t border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
                                    {it.ai_feedback}
                                  </p>
                                </>
                              ) : (
                                <p className="border-t border-slate-200 px-3 py-2.5 text-xs text-slate-400">
                                  {it.transcript?.trim()
                                    ? "아직 진단하지 않았습니다."
                                    : "음성 텍스트가 있어야 진단할 수 있습니다."}
                                </p>
                              )}
                            </div>

                            {/* 선생님 피드백 */}
                            <div className="mt-2">
                              <textarea
                                value={fbEdits[it.id] ?? ""}
                                onChange={(e) => setFbEdits((p) => ({ ...p, [it.id]: e.target.value }))}
                                rows={3}
                                placeholder="학생에게 전할 피드백"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                              />
                              <div className="mt-1.5 flex items-center justify-end gap-2">
                                {it.feedback_at && !fbDirty && (
                                  <span className="text-[11px] text-slate-400">
                                    {fmt(it.feedback_at)} 저장됨
                                  </span>
                                )}
                                <button type="button" onClick={() => saveFeedback(it)}
                                  disabled={savingFb === it.id || !fbDirty}
                                  className={`rounded-lg px-3 py-1 text-xs font-bold text-white transition disabled:opacity-100 ${
                                    !fbDirty && it.teacher_feedback
                                      ? "cursor-default bg-green-600"
                                      : "bg-seum-blue hover:bg-[#2a63c4] disabled:opacity-40"
                                  }`}>
                                  {savingFb === it.id
                                    ? "저장 중..."
                                    : !fbDirty && it.teacher_feedback
                                    ? "✓ 저장됨"
                                    : "피드백 저장"}
                                </button>
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== 출제 팝업 ===== */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setOpen(false)}>
          <div className="my-8 w-full max-w-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4">
              <h3 className="text-lg font-bold text-seum-navy">모의고사 출제 · {student.name}</h3>
              <button type="button" onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {/* 범위 */}
            <div className="border-t border-slate-200 pt-4">
              <label className="mb-1.5 block text-xs font-bold text-slate-500">범위</label>
              <div className="flex gap-1.5">
                {SCOPES.map((s) => (
                  <button key={s.key} type="button"
                    onClick={() => { setScope(s.key); setPicked([]); setPoolSize(null); }}
                    className={`flex-1 rounded-md py-2 text-sm font-bold transition ${
                      scope === s.key ? "bg-seum-navy text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                {SCOPES.find((s) => s.key === scope)?.hint}
              </p>
            </div>

            {/* 기출이면 학교 선택 */}
            {scope === "gichul" && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <label className="mb-1.5 block text-xs font-bold text-slate-500">지원 학교</label>
                {picks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 py-3 text-center text-xs text-slate-400">
                    학생이 아직 지원 학교를 고르지 않았습니다.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {picks.map((p) => {
                      const on = pick?.id === p.id;
                      return (
                        <button key={p.id} type="button"
                          onClick={() => { setPick(p); setPicked([]); setPoolSize(null); }}
                          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                            on ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}>
                          {p.univ} · {p.major}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 문항 수 */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <label className="mb-1.5 block text-xs font-bold text-slate-500">문항 수</label>
              <div className="flex gap-1.5">
                {[3, 5, 7, 10].map((n) => (
                  <button key={n} type="button"
                    onClick={() => { setCount(n); setPicked([]); }}
                    className={`flex-1 rounded-md py-2 text-sm font-bold transition ${
                      count === n ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}>
                    {n}개
                  </button>
                ))}
              </div>
            </div>

            {/* 뽑기 */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500">
                  출제 문항 {picked.length > 0 && `(${picked.length}개)`}
                  {poolSize != null && (
                    <span className="ml-1.5 font-normal text-slate-400">
                      답변한 문항 {poolSize}개 중
                    </span>
                  )}
                </label>
                <button type="button" onClick={draw} disabled={drawing}
                  className="rounded-md border border-seum-blue px-2.5 py-0.5 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-50">
                  {drawing ? "뽑는 중..." : picked.length > 0 ? "🔄 전체 다시 뽑기" : "문항 뽑기"}
                </button>
              </div>

              {picked.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">
                  문항 뽑기를 누르면 여기에 표시됩니다.
                  <br />학생이 답변한 문항에서만 출제됩니다.
                </p>
              ) : (
                <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
                  {picked.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2">
                      <span className="w-4 shrink-0 pt-0.5 text-xs font-bold text-slate-400">{i + 1}</span>
                      <p className="min-w-0 flex-1 text-sm text-slate-700">{q}</p>
                      <button type="button" onClick={() => replaceOne(i)}
                        title="이 문항만 바꾸기"
                        className="shrink-0 text-xs text-slate-400 hover:text-seum-blue">바꾸기</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 보내기 */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <button type="button" onClick={send}
                disabled={sending || picked.length === 0}
                className="w-full bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-40">
                {sending ? "보내는 중..." : "학생에게 보내기"}
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                보내면 학생 화면의 '면접 시뮬레이션'에 바로 나타납니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}