// src/pages/student/AiWorkHome.jsx
//
// AI 과제 첫 화면. 학생 메뉴는 이 컴포넌트를 연결한다.
// 단계 탭(01~06) → 객관식 | 주관식 탭 → 목록 → 문제를 누르면 풀이 화면으로.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase"; // ← PtPractice.jsx의 supabase import 줄과 같게
import { STAGES } from "../../lib/aiworkConfig";
import AiWorkQuiz from "./AiWorkQuiz";
import AiWorkTask from "./AiWorkTask";

const KINDS = [
  { key: "mcq", label: "객관식" },
  { key: "written", label: "주관식" },
];

function Badge({ tone, children }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span className={`text-[11.5px] font-semibold border rounded px-2 py-0.5 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function AiWorkHome() {
  const [userId, setUserId] = useState(null);
  const [stage, setStage] = useState(1);
  const [kind, setKind] = useState("mcq");
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);

      const { data: list, error } = await supabase
        .from("aiwork_tasks")
        .select("id, stage, kind, case_key, job, title, turn_limit")
        .eq("stage", stage)
        .eq("kind", kind)
        .eq("is_active", true)
        .order("case_key", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) console.error("aiwork_tasks", error);

      const ids = (list ?? []).map((t) => t.id);
      const st = {};

      if (kind === "mcq") {
        const { data: res, error: rErr } = await supabase.rpc("aiwork_my_mcq_results", {
          p_stage: stage,
        });
        if (rErr) console.error("aiwork_my_mcq_results", rErr);
        (res ?? []).forEach((r) => {
          st[r.task_id] = r.is_correct ? "correct" : "wrong";
        });
      } else if (ids.length) {
        // 과제 수가 단계당 몇 개뿐이라 .in()을 써도 URL 길이 문제 없음
        const { data: ss, error: sErr } = await supabase
          .from("aiwork_sessions")
          .select("task_id, submitted_at, ai_feedback")
          .eq("student_id", userId)
          .in("task_id", ids);
        if (sErr) console.error("aiwork_sessions", sErr);
        (ss ?? []).forEach((s) => {
          const cur = st[s.task_id] ?? { submitted: 0, open: false, feedback: false };
          if (s.submitted_at) cur.submitted += 1;
          else cur.open = true;
          if (s.ai_feedback) cur.feedback = true;
          st[s.task_id] = cur;
        });
      }

      if (alive) {
        setTasks(list ?? []);
        setStatus(st);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, stage, kind, reload]);

  const back = () => {
    setOpen(null);
    setReload((n) => n + 1);
  };

  if (open) {
    return open.kind === "mcq" ? (
      <AiWorkQuiz task={open} userId={userId} onBack={back} />
    ) : (
      <AiWorkTask task={open} userId={userId} onBack={back} />
    );
  }

  const renderStatus = (t) => {
    const s = status[t.id];
    if (kind === "mcq") {
      if (s === "correct") return <Badge tone="green">정답</Badge>;
      if (s === "wrong") return <Badge tone="red">오답</Badge>;
      return <Badge tone="gray">안 풂</Badge>;
    }
    if (!s) return <Badge tone="gray">시작 전</Badge>;
    return (
      <span className="flex items-center gap-1.5">
        {s.open && <Badge tone="blue">진행 중</Badge>}
        {s.submitted > 0 && <Badge tone="gray">제출 {s.submitted}회</Badge>}
        {s.feedback && t.stage < 6 && <Badge tone="green">피드백 받음</Badge>}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6">
      {/* 단계 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STAGES.map((s) => (
          <button
            key={s.stage}
            type="button"
            onClick={() => setStage(s.stage)}
            className={`px-4 py-2.5 rounded-lg border text-left transition ${
              stage === s.stage
                ? "bg-seum-navy text-white border-seum-navy"
                : "bg-white text-gray-700 border-gray-200 hover:border-seum-blue"
            }`}
          >
            <span className="block text-[11px] opacity-70">
              {String(s.stage).padStart(2, "0")} · {s.sub}
            </span>
            <span className="block text-sm font-semibold">{s.name}</span>
          </button>
        ))}
      </div>

      {/* 객관식 | 주관식 */}
      <div className="flex border-b border-gray-200 mb-4">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              kind === k.key
                ? "border-seum-navy text-seum-navy"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-10 text-center">불러오는 중…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-gray-500 py-10 text-center">
          이 단계에 등록된 {kind === "mcq" ? "객관식 문항" : "주관식 과제"}이 아직 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpen(t)}
                className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-3.5 hover:border-seum-blue transition flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-semibold text-gray-400 w-6 shrink-0">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-gray-500 mb-0.5">
                      {t.case_key ? `CASE ${t.case_key.replace(/^[A-Z]/, "")} · ` : ""}
                      {t.job}
                    </span>
                    <span className="block text-[15px] font-semibold text-gray-900 truncate">
                      {t.title}
                    </span>
                  </span>
                </span>
                <span className="shrink-0">{renderStatus(t)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}