// src/pages/student/AiWorkQuiz.jsx
//
// 객관식 풀이 — 왼쪽 문항(65%) | 오른쪽 AI 채팅(35%).
// AI는 문항을 모른다. 학생이 필요한 걸 골라 물어야 한다.
// 제출하면 정답·해설이 나오고 채팅이 잠긴다. "다시 풀기"는 새 응시로 시작.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase"; // ← PtPractice.jsx의 supabase import 줄과 같게
import { stageOf } from "../../lib/aiworkConfig";
import AiChatPanel from "./AiChatPanel";

const MARKS = ["①", "②", "③", "④", "⑤"];

export default function AiWorkQuiz({ task: base, userId, onBack }) {
  const [task, setTask] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [turnsLeft, setTurnsLeft] = useState(0);
  const [choice, setChoice] = useState(null);
  const [result, setResult] = useState(null); // { is_correct, answer_index, explanation }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submitted = !!session?.submitted_at;

  const grade = async (sid) => {
    const { data, error: gErr } = await supabase.rpc("aiwork_grade_mcq", { p_session: sid });
    if (gErr) {
      console.error("aiwork_grade_mcq", gErr);
      setError("채점 결과를 불러오지 못했습니다.");
      return;
    }
    setResult(data?.[0] ?? null);
  };

  // 가장 최근 응시를 연다. 제출된 것이면 결과를 보여주고, 없거나 fresh면 새로 시작.
  const load = async (fresh = false) => {
    if (!userId) return;
    setError("");
    setResult(null);
    setChoice(null);

    const { data: full, error: tErr } = await supabase
      .from("aiwork_tasks")
      .select("*")
      .eq("id", base.id)
      .single();
    if (tErr) {
      console.error(tErr);
      setError("문항을 불러오지 못했습니다.");
      return;
    }

    let s = null;
    if (!fresh) {
      const { data } = await supabase
        .from("aiwork_sessions")
        .select("*")
        .eq("task_id", base.id)
        .eq("student_id", userId)
        .order("started_at", { ascending: false })
        .limit(1);
      s = data?.[0] ?? null;
    }
    if (!s) {
      const { data, error: iErr } = await supabase
        .from("aiwork_sessions")
        .insert({
          task_id: base.id,
          student_id: userId,
          mode: full.stage === 6 ? "exam" : "practice",
          lang: full.lang ?? "ko",
        })
        .select()
        .single();
      if (iErr) {
        console.error(iErr);
        setError("문항을 시작하지 못했습니다.");
        return;
      }
      s = data;
    }

    const { data: msgs, error: mErr } = await supabase
      .from("aiwork_messages")
      .select("id, role, content")
      .eq("session_id", s.id)
      .order("id", { ascending: true });
    if (mErr) console.error(mErr);

    const used = (msgs ?? []).filter((m) => m.role === "user").length;
    setTask(full);
    setSession(s);
    setMessages(msgs ?? []);
    setTurnsLeft((full.turn_limit ?? 10) - used);

    if (s.answer != null && /^\d+$/.test(s.answer)) setChoice(Number(s.answer));
    if (s.submitted_at) await grade(s.id);
  };

  useEffect(() => {
    load();
  }, [base.id, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (choice == null) {
      setError("답을 하나 고르세요.");
      return;
    }
    if (!window.confirm("제출하면 답을 바꿀 수 없습니다. 제출할까요?")) return;

    setBusy(true);
    setError("");
    const now = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("aiwork_sessions")
      .update({ answer: String(choice), submitted_at: now })
      .eq("id", session.id);
    if (uErr) {
      console.error(uErr);
      setError("제출하지 못했습니다. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    setSession((s) => ({ ...s, submitted_at: now, answer: String(choice) }));
    await grade(session.id);
    setBusy(false);
  };

  if (!task || !session) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-600 border border-gray-200 rounded-md px-3 py-1.5"
        >
          목록
        </button>
        <p className="mt-6 text-sm text-gray-500">{error || "불러오는 중…"}</p>
      </div>
    );
  }

  const st = stageOf(task.stage);
  const options = Array.isArray(task.options) ? task.options : [];

  const optionClass = (i) => {
    if (!result) {
      return choice === i
        ? "border-seum-blue bg-blue-50"
        : "border-gray-200 bg-white hover:border-seum-blue";
    }
    if (i === result.answer_index) return "border-emerald-500 bg-emerald-50";
    if (i === choice) return "border-red-400 bg-red-50";
    return "border-gray-200 bg-white opacity-70";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-gray-600 border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50"
          >
            목록
          </button>
          <span className="text-sm text-gray-500 truncate">
            {String(st.stage).padStart(2, "0")} {st.name} · 객관식 · {task.title}
          </span>
        </div>
        {submitted ? (
          <button
            type="button"
            onClick={() => load(true)}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50"
          >
            다시 풀기
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={busy || choice == null}
            className="text-sm font-semibold bg-seum-navy text-white rounded-md px-4 py-2 disabled:opacity-40"
          >
            제출
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* 문항 */}
        <div className="flex-[65] min-w-0 overflow-y-auto p-6">
          <div className="max-w-[760px] mx-auto space-y-6">
            {task.passage && (
              <div className="relative bg-white border border-gray-200 rounded-xl px-6 pt-6 pb-5">
                <span className="absolute -top-2.5 left-5 bg-gray-50 px-2 text-[11.5px] font-semibold text-seum-blue">
                  지문
                </span>
                <p className="text-[15px] leading-8 text-gray-700 whitespace-pre-line">
                  {task.passage}
                </p>
              </div>
            )}

            <h2 className="text-[17px] font-semibold leading-8 text-gray-900">{task.question}</h2>

            <div className="space-y-2.5">
              {options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={submitted}
                  onClick={() => setChoice(i)}
                  className={`w-full text-left border rounded-lg px-4 py-3.5 flex gap-3 items-start transition ${optionClass(i)}`}
                >
                  <span className="text-[15px] font-semibold text-gray-500 shrink-0">
                    {MARKS[i]}
                  </span>
                  <span className="flex-1 text-[14.5px] leading-7 text-gray-800">{opt}</span>
                  {result && i === result.answer_index && (
                    <span className="shrink-0 text-xs font-semibold text-emerald-700">정답</span>
                  )}
                  {result && i === choice && i !== result.answer_index && (
                    <span className="shrink-0 text-xs font-semibold text-red-600">내 선택</span>
                  )}
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {result && (
              <div
                className={`rounded-xl border px-5 py-4 ${
                  result.is_correct
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <p
                  className={`text-[15px] font-bold mb-1.5 ${
                    result.is_correct ? "text-emerald-800" : "text-red-700"
                  }`}
                >
                  {result.is_correct ? "정답입니다" : `오답입니다 — 정답은 ${MARKS[result.answer_index]}`}
                </p>
                {result.explanation && (
                  <p className="text-[14px] leading-7 text-gray-700">{result.explanation}</p>
                )}
                <p className="mt-2 text-[12.5px] text-gray-500">
                  AI와 나눈 대화 {messages.filter((m) => m.role === "user").length}회도 함께 기록됐습니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* AI 채팅 */}
        <AiChatPanel
          className="flex-[35] min-w-[320px] border-l border-gray-200"
          sessionId={session.id}
          messages={messages}
          setMessages={setMessages}
          turnsLeft={turnsLeft}
          setTurnsLeft={setTurnsLeft}
          locked={submitted}
          lockedText="제출한 문항입니다. 다시 풀기로 새로 시작할 수 있습니다."
        />
      </div>
    </div>
  );
}