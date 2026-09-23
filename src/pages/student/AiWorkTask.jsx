// src/pages/student/AiWorkTask.jsx
//
// 주관식 화면. 모든 단계가 과제 | 답안 | AI 3분할이고, 단계에 따라 이것만 다르다.
//  - 1~5단계 훈련: 타이머 없음, 과제 아래 점검 체크리스트 → 제출하면 AI 즉시 피드백 → 다시 연습
//  - 6단계 실전:  타이머 있음 → 제출하면 선생님 채점 대기
// 목록은 AiWorkHome.jsx에 있다.

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase"; // ← PtPractice.jsx의 supabase import 줄과 같게
import { stageOf } from "../../lib/aiworkConfig";
import AiChatPanel from "./AiChatPanel";

const fmt = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function AiWorkTask({ task: base, userId, onBack }) {
  const [task, setTask] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [turnsLeft, setTurnsLeft] = useState(0);

  const [answer, setAnswer] = useState("");
  const [pastes, setPastes] = useState([]);
  const [savedAt, setSavedAt] = useState(null);

  const [feedback, setFeedback] = useState(null);
  const [fbLoading, setFbLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const autoSubmitted = useRef(false);

  const submitted = !!session?.submitted_at;
  const isExam = task?.stage === 6;

  // ── 불러오기: 가장 최근 응시. 제출된 것이면 결과(피드백/채점 대기)를 보여준다.
  const load = async (fresh = false) => {
    if (!userId) return;
    setError("");
    setFeedback(null);
    autoSubmitted.current = false;

    const { data: full, error: tErr } = await supabase
      .from("aiwork_tasks")
      .select("*")
      .eq("id", base.id)
      .single();
    if (tErr) {
      console.error(tErr);
      setError("과제를 불러오지 못했습니다.");
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
        setError("과제를 시작하지 못했습니다.");
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
    setTurnsLeft((full.turn_limit ?? (full.stage === 6 ? 20 : 10)) - used);
    setAnswer(s.answer ?? "");
    setPastes(s.paste_events ?? []);
    setSavedAt(null);
    if (s.ai_feedback) setFeedback(s.ai_feedback);
  };

  useEffect(() => {
    load();
  }, [base.id, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 실전 답안 자동 저장 (입력 멈추고 1.5초 뒤)
  useEffect(() => {
    if (!session || submitted) return;
    const t = setTimeout(async () => {
      const { error: sErr } = await supabase
        .from("aiwork_sessions")
        .update({ answer, paste_events: pastes })
        .eq("id", session.id);
      if (sErr) console.error("autosave", sErr);
      else setSavedAt(new Date());
    }, 1500);
    return () => clearTimeout(t);
  }, [answer, pastes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 실전 타이머
  useEffect(() => {
    if (!isExam || submitted) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isExam, submitted]);

  const remainingSec =
    isExam && session
      ? new Date(session.started_at).getTime() / 1000 +
        (task.time_limit_min ?? 40) * 60 -
        now / 1000
      : null;
  const timeUp = isExam && remainingSec != null && remainingSec <= 0;

  useEffect(() => {
    if (timeUp && !submitted && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit(true);
    }
  }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 붙여넣기 기록 — '인간의 판단' 채점 근거
  const onPaste = (e) => {
    const txt = e.clipboardData.getData("text");
    if (!txt) return;
    const probe = txt.trim().slice(0, 40);
    const fromAi = messages.some(
      (m) => m.role === "assistant" && probe && m.content.includes(probe)
    );
    setPastes((prev) => [
      ...prev,
      { at: new Date().toISOString(), length: txt.length, from_ai: fromAi },
    ]);
  };

  // ── 즉시 피드백 요청 (1~5단계)
  const requestFeedback = async (sid) => {
    setFbLoading(true);
    const { data, error: fnErr } = await supabase.functions.invoke("aiwork-feedback", {
      body: { session_id: sid },
    });
    if (fnErr || data?.error) {
      console.error("aiwork-feedback", fnErr ?? data);
      setError("피드백을 받지 못했습니다. 잠시 후 목록에서 다시 열어 주세요.");
    } else {
      setFeedback(data);
    }
    setFbLoading(false);
  };

  // ── 제출
  const submit = async (auto = false) => {
    if (!auto) {
      const userTurns = messages.filter((m) => m.role === "user").length;
      if (userTurns === 0) {
        setError("AI와 한 번 이상 대화한 뒤 제출할 수 있습니다.");
        return;
      }
      if (!answer.trim()) {
        setError("답안을 작성한 뒤 제출할 수 있습니다.");
        return;
      }
      if (!window.confirm("제출하면 더 이상 수정할 수 없습니다. 제출할까요?")) return;
    }

    setError("");
    const at = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("aiwork_sessions")
      .update({ answer, paste_events: pastes, submitted_at: at })
      .eq("id", session.id);
    if (uErr) {
      console.error(uErr);
      setError("제출하지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    setSession((s) => ({ ...s, submitted_at: at }));
    if (!isExam) requestFeedback(session.id);
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
  const reqs = Array.isArray(task.requirements) ? task.requirements : [];
  const files = Array.isArray(task.attachments) ? task.attachments : [];
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];

  // ── 과제 설명 (훈련·실전 공통)
  const taskInfo = (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-seum-blue mb-1">{task.job}</p>
        <h2 className="text-[17px] font-bold leading-snug text-gray-900">{task.title}</h2>
      </div>
      {task.background && (
        <section>
          <h3 className="text-sm font-semibold mb-1.5">{isExam ? "해결 과제" : "업무 상황"}</h3>
          <p className="text-[13.5px] leading-7 text-gray-600 whitespace-pre-line">{task.background}</p>
        </section>
      )}
      {task.problem && (
        <section>
          <h3 className="text-sm font-semibold mb-1.5">과제</h3>
          <p className="text-[13.5px] leading-7 text-gray-600 whitespace-pre-line">{task.problem}</p>
        </section>
      )}
      {reqs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-1.5">{isExam ? "요구사항" : "과제"}</h3>
          <ul className="list-disc pl-4 space-y-1">
            {reqs.map((r, i) => (
              <li key={i} className="text-[13.5px] leading-7 text-gray-600">{r}</li>
            ))}
          </ul>
        </section>
      )}
      {isExam && (
        <section className="bg-white border border-gray-200 rounded-lg p-3 text-[13px] text-gray-600 space-y-1">
          <p>
            <b className="text-gray-900">제출 형식</b> {task.submit_format || `텍스트 ${(task.char_limit ?? 2000).toLocaleString()}자 이내`}
          </p>
          <p>
            <b className="text-gray-900">제한 시간</b> {task.time_limit_min ?? 40}분
          </p>
        </section>
      )}
      {files.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">첨부 자료</h3>
          <div className="space-y-2">
            {files.map((f, i) => (
              <details key={i} className="bg-white border border-gray-200 rounded-lg">
                <summary className="px-3 py-2.5 text-[13px] font-medium cursor-pointer">{f.name}</summary>
                <pre className="px-3 pb-3 text-[12px] leading-6 text-gray-600 whitespace-pre-wrap font-sans">{f.text}</pre>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  // ── 훈련: 체크리스트 / 피드백
  const trainingSide = !submitted ? (
    checklist.length > 0 && (
      <section className="bg-white border-2 border-seum-blue/40 rounded-xl p-4">
        <h3 className="text-sm font-bold text-seum-navy mb-2">제출 전 스스로 점검</h3>
        <ul className="list-disc pl-4 space-y-1.5">
          {checklist.map((c, i) => (
            <li key={i} className="text-[13.5px] leading-6 text-gray-700">{c}</li>
          ))}
        </ul>
      </section>
    )
  ) : fbLoading ? (
    <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-4">
      대화를 읽고 피드백을 만드는 중입니다…
    </p>
  ) : feedback ? (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-seum-navy">피드백</h3>
      <ul className="space-y-3">
        {(feedback.items ?? []).map((it, i) => (
          <li key={i} className="border-l-2 pl-3 border-gray-200">
            <p className="text-[13px] font-semibold text-gray-900 flex items-center gap-2">
              <span
                className={`text-[11px] font-bold rounded px-1.5 py-0.5 ${
                  it.met ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                }`}
              >
                {it.met ? "충족" : "보완 필요"}
              </span>
              {it.text}
            </p>
            <p className="text-[13px] leading-6 text-gray-600 mt-1">{it.comment}</p>
          </li>
        ))}
      </ul>
      {feedback.summary && <p className="text-[13.5px] leading-7 text-gray-800">{feedback.summary}</p>}
      {feedback.next_tip && (
        <p className="text-[13px] leading-6 text-seum-navy bg-blue-50 rounded-md px-3 py-2">
          <b>다음 연습에서</b> {feedback.next_tip}
        </p>
      )}
    </section>
  ) : null;

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
            {String(st.stage).padStart(2, "0")} {st.name} · {isExam ? "실전" : "주관식"} · {task.title}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isExam && !submitted && (
            <span className={`text-sm font-mono font-semibold ${remainingSec < 300 ? "text-red-600" : "text-gray-700"}`}>
              남은 시간 {fmt(remainingSec)}
            </span>
          )}
          {submitted ? (
            <>
              <span className="text-sm font-semibold text-seum-blue">
                {isExam ? "제출 완료 · 선생님 채점 대기" : "제출 완료"}
              </span>
              {!isExam && (
                <button
                  type="button"
                  onClick={() => load(true)}
                  className="text-sm border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50"
                >
                  다시 연습
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => submit(false)}
              className="text-sm font-semibold bg-seum-navy text-white rounded-md px-4 py-2"
            >
              제출
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* 과제 (+ 훈련: 체크리스트·피드백) */}
        <aside className="w-[28%] min-w-[280px] shrink-0 overflow-y-auto bg-slate-50 border-r border-gray-200 p-5 space-y-5">
          {taskInfo}
          {!isExam && trainingSide}
        </aside>

        {/* 답안 */}
        <section className="flex-1 min-w-0 flex flex-col p-4">
          <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
            {isExam
              ? "채점은 답안 내용과 AI를 활용한 과정을 함께 봅니다. AI 답을 그대로 옮기기보다 내 판단으로 정리하세요."
              : "과제에서 요구한 내용을 여기에 정리하세요. 오른쪽 AI와 나눈 대화와 이 답안을 함께 보고 피드백합니다."}
          </p>
          <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-lg min-h-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-sm font-semibold">답안 작성</span>
              <span className="text-xs text-gray-500">{savedAt ? "자동 저장됨" : ""}</span>
            </div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onPaste={onPaste}
              disabled={submitted || timeUp}
              maxLength={task.char_limit ?? (isExam ? 2000 : 1500)}
              placeholder={
                isExam
                  ? "AI와 대화한 내용을 바탕으로, 내 판단으로 최종 답안을 작성하세요."
                  : "AI와 함께 풀어본 내용을 과제 순서대로 내 말로 정리하세요."
              }
              className="flex-1 resize-none px-4 py-3 text-[14px] leading-7 outline-none disabled:bg-gray-50"
            />
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
              <span>AI 답변을 붙여넣은 기록은 따로 남습니다</span>
              <span>
                <b className="text-gray-900">{answer.length.toLocaleString()}</b> /{" "}
                {(task.char_limit ?? (isExam ? 2000 : 1500)).toLocaleString()}자
              </span>
            </div>
          </div>
        </section>

        {/* AI */}
        <AiChatPanel
          className="w-[30%] min-w-[300px] shrink-0 border-l border-gray-200"
          sessionId={session.id}
          messages={messages}
          setMessages={setMessages}
          turnsLeft={turnsLeft}
          setTurnsLeft={setTurnsLeft}
          locked={submitted || timeUp}
          lockedText={
            timeUp
              ? "시간이 끝났습니다."
              : isExam
              ? "제출한 과제입니다."
              : "제출한 과제입니다. 다시 연습으로 새로 시작할 수 있습니다."
          }
        />
      </div>
    </div>
  );
}