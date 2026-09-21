// src/pages/student/AiWorkTask.jsx
// AI 직무역량 — 학생 연습 화면
//
// 위쪽 탭으로 단계를 골라 연습한다.
//   1 문제 쪼개기   2 조건 정하기   3 되묻기
//   4 경험 섞기     5 내 판단       6 종합 실전
// 1~5 는 기술 하나만 짧게 연습하고, 6 에서 처음부터 끝까지 푼다.
//
// 이번 파일에는 탭 틀과 1단계만 들어 있다. 2~6단계는 이어서 붙인다.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const STEPS = [
  { no: 1, label: "문제 쪼개기", goal: "과제를 읽고, AI에게 보낼 첫 요청을 제대로 써봅니다." },
  { no: 2, label: "조건 정하기", goal: "같은 요청에 형식·분량·금지사항을 붙이면 답이 어떻게 달라지는지 봅니다." },
  { no: 3, label: "되묻기", goal: "AI 첫 답을 받고, 되물어서 고쳐갑니다." },
  { no: 4, label: "경험 섞기", goal: "AI가 모르는 내 경험과 현장 지식을 보탭니다." },
  { no: 5, label: "내 판단", goal: "AI 답에서 무엇을 왜 바꿨는지 적습니다." },
  { no: 6, label: "종합 실전", goal: "처음부터 끝까지 혼자 풀고 제출합니다." },
];

// 1단계 — 좋은 첫 요청에 들어가야 할 것
const STEP1_CHECKS = [
  { key: "role", label: "배경", hint: "나는 누구이고 어떤 상황인가" },
  { key: "goal", label: "목표", hint: "무엇을 알아내거나 만들어야 하는가" },
  { key: "cond", label: "조건", hint: "지켜야 할 제약 (기간, 대상, 숫자 등)" },
  { key: "out", label: "결과물", hint: "어떤 모양으로 받고 싶은가" },
];

// ─────────────────────────────────────────────────────────
// Edge Function 호출
// ─────────────────────────────────────────────────────────
async function askAi(sessionId, message) {
  const { data, error } = await supabase.functions.invoke("aiwork-chat", {
    body: { session_id: sessionId, message },
  });
  if (error) {
    let detail = error.message;
    try {
      const body = await error.context?.json();
      detail = body?.error || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  if (!data?.success) throw new Error(data?.error || "AI 호출 실패");
  return data;
}

// ─────────────────────────────────────────────────────────
// 과제 카드 — 모든 단계에서 같이 쓴다
// ─────────────────────────────────────────────────────────
function TaskCard({ task }) {
  if (!task) return null;
  const reqs = Array.isArray(task.requirements) ? task.requirements : [];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-bold text-seum-blue">{task.job}</p>
      <h3 className="mt-0.5 font-bold text-seum-navy">{task.title}</h3>

      {task.background && (
        <div className="mt-3">
          <p className="text-[11px] font-bold text-slate-400">배경</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{task.background}</p>
        </div>
      )}
      {task.problem && (
        <div className="mt-3">
          <p className="text-[11px] font-bold text-slate-400">해결할 문제</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{task.problem}</p>
        </div>
      )}
      {reqs.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold text-slate-400">요구사항</p>
          <ul className="mt-0.5 space-y-0.5 text-sm text-slate-700">
            {reqs.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
      {task.submit_format && (
        <div className="mt-3">
          <p className="text-[11px] font-bold text-slate-400">제출 형식</p>
          <p className="mt-0.5 text-sm text-slate-700">{task.submit_format}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 1단계 — 문제 쪼개기
// 첫 요청 하나만 써서 보내본다. 체크리스트로 스스로 점검.
// ─────────────────────────────────────────────────────────
function Step1({ task, studentId, locked }) {
  const [text, setText] = useState("");
  const [checks, setChecks] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  // 과제가 바뀌면 새로 시작
  useEffect(() => {
    setText("");
    setChecks({});
    setSessionId(null);
    setReply("");
  }, [task?.id]);

  const checked = STEP1_CHECKS.filter((c) => checks[c.key]).length;

  const send = async () => {
    const msg = text.trim();
    if (!msg) return alert("요청을 입력하세요.");
    if (checked < STEP1_CHECKS.length) {
      const ok = window.confirm(
        `체크리스트 ${STEP1_CHECKS.length}개 중 ${checked}개만 확인했습니다.\n그래도 보낼까요?`
      );
      if (!ok) return;
    }

    setSending(true);
    try {
      // 1단계 응시를 하나 만들고 거기에 대화를 쌓는다
      let sid = sessionId;
      if (!sid) {
        const { data, error } = await supabase
          .from("aiwork_sessions")
          .insert({ task_id: task.id, student_id: studentId, mode: "practice", step: 1 })
          .select("id")
          .single();
        if (error) throw error;
        sid = data.id;
        setSessionId(sid);
      }
      const out = await askAi(sid, msg);
      setReply(out.reply);
    } catch (e) {
      alert("보내기 실패:\n\n" + e.message);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setText("");
    setChecks({});
    setSessionId(null);
    setReply("");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <TaskCard task={task} />

      <div className="space-y-4">
        {/* 요청 작성 */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-seum-navy">AI에게 보낼 첫 요청</p>
            <span className="text-[11px] text-slate-400">{text.length}자</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            disabled={locked || !!reply}
            placeholder="과제를 AI가 이해할 수 있게 설명하고, 무엇을 해달라고 할지 써보세요."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-seum-blue disabled:bg-slate-50"
          />
        </div>

        {/* 체크리스트 */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-seum-navy">내 요청에 들어갔나요?</p>
            <span className={`text-xs font-bold ${checked === STEP1_CHECKS.length ? "text-green-600" : "text-slate-400"}`}>
              {checked} / {STEP1_CHECKS.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {STEP1_CHECKS.map((c) => (
              <label key={c.key}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={!!checks[c.key]}
                  onChange={(e) => setChecks((p) => ({ ...p, [c.key]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-sm">
                  <b className="text-seum-navy">{c.label}</b>
                  <span className="ml-1.5 text-xs text-slate-400">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {!reply ? (
            <button type="button" onClick={send} disabled={locked || sending || !text.trim()}
              className="mt-3 w-full rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-40">
              {sending ? "AI가 답하는 중..." : "AI에게 보내보기"}
            </button>
          ) : (
            <button type="button" onClick={reset}
              className="mt-3 w-full rounded-lg border border-seum-blue py-2.5 text-sm font-bold text-seum-blue hover:bg-blue-50">
              다시 써보기
            </button>
          )}
        </div>

        {/* AI 답 */}
        {reply && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <p className="mb-1.5 text-[11px] font-bold text-seum-blue">AI 답변</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{reply}</p>
            <p className="mt-3 border-t border-blue-100 pt-2 text-xs text-slate-500">
              AI가 과제를 제대로 이해했나요? 엉뚱한 답이 왔다면 요청에서 빠진 게 있다는 뜻입니다.
              체크리스트를 다시 보고 [다시 써보기]로 고쳐보세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 아직 안 만든 단계
// ─────────────────────────────────────────────────────────
function ComingSoon({ step }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
      <p className="text-sm font-bold text-slate-500">{step.no}단계 · {step.label}</p>
      <p className="mt-1 text-xs text-slate-400">준비 중입니다.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 화면
// ─────────────────────────────────────────────────────────
export default function AiWorkTask({ studentId, locked = false }) {
  const [tasks, setTasks] = useState([]);
  const [taskId, setTaskId] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("aiwork_tasks")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) console.error("과제 조회 실패:", error);
      const list = data ?? [];
      setTasks(list);
      setTaskId(list[0]?.id ?? "");
      setLoading(false);
    })();
  }, []);

  const task = tasks.find((t) => t.id === taskId) ?? null;
  const cur = STEPS.find((s) => s.no === step);

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
        아직 등록된 과제가 없습니다.
      </p>
    );
  }

  return (
    <div>
      {/* 과제 선택 */}
      {tasks.length > 1 && (
        <div className="mb-3">
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum-blue sm:w-auto">
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>[{t.job}] {t.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* 단계 탭 */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((s) => {
          const on = step === s.no;
          const isFinal = s.no === 6;
          return (
            <button key={s.no} type="button" onClick={() => setStep(s.no)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${
                on
                  ? isFinal ? "bg-seum-navy text-white" : "bg-seum-blue text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}>
              <span className={`mr-1 ${on ? "opacity-70" : "text-slate-400"}`}>{s.no}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* 이 단계에서 할 일 */}
      <div className="mb-4 rounded-lg bg-slate-50 px-4 py-2.5">
        <p className="text-sm text-slate-600">
          <b className="text-seum-navy">{cur.no}단계</b> · {cur.goal}
        </p>
      </div>

      {step === 1 ? (
        <Step1 task={task} studentId={studentId} locked={locked} />
      ) : (
        <ComingSoon step={cur} />
      )}
    </div>
  );
}