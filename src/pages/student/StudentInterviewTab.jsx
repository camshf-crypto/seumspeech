import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import DebateSession from "./DebateSession";
import {
  getCategory,
  getSubLabel,
  getCategoryLabel,
  getSeries,
  getMaterials,
  getTabLabel,
  getSeriesLabel,
} from "../../lib/interviewConfig";

const AXES = [
  { key: "소통·공감", label: "소통 · 공감", re: /소통\s*[·ㆍ・]?\s*공감/ },
  { key: "헌신·열정", label: "헌신 · 열정", re: /헌신\s*[·ㆍ・]?\s*열정/ },
  { key: "창의·혁신", label: "창의 · 혁신", re: /창의\s*[·ㆍ・]?\s*혁신/ },
  { key: "윤리·책임", label: "윤리 · 책임", re: /윤리\s*[·ㆍ・]?\s*책임/ },
];

const GRADE_SCORE = { 상: 3, 중: 2, 하: 1 };

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #itv-print, #itv-print * { visibility: visible !important; }
  #itv-print {
    position: absolute !important;
    left: 0; top: 0; width: 100%;
  }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .print-card {
    page-break-inside: avoid;
    break-inside: avoid;
    border: 1px solid #cbd5e1 !important;
    border-radius: 6px;
    background: #fff !important;
    padding: 10px 12px !important;
    margin-bottom: 10px;
  }
  .print-answer {
    white-space: pre-wrap;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.7;
    min-height: 48px;
    color: #1e293b;
  }
  @page { margin: 14mm; }
}
.print-only { display: none; }
`;

function parseGrades(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const result = {};
  for (const axis of AXES) {
    for (const line of lines) {
      if (!axis.re.test(line)) continue;
      let m = line.match(/[(（]\s*([상중하])\s*[)）]/);
      if (!m) m = line.match(/[:：]\s*([상중하])(?=\s|$|[—\-–,.])/);
      if (m) {
        result[axis.key] = { grade: m[1], score: GRADE_SCORE[m[1]] };
        break;
      }
    }
  }
  const found = AXES.filter((a) => result[a.key]).length;
  return found === AXES.length ? result : null;
}

function stripDiagnosis(text) {
  if (!text) return "";
  const lines = text.split("\n");
  const out = [];
  let skipping = false;
  for (const line of lines) {
    const isDiagHeader = /\[\s*(인재상별|평정요소별)\s*진단\s*\]/.test(line);
    const isOtherHeader = /^\s*\[.+?\]\s*$/.test(line);
    if (isDiagHeader) { skipping = true; continue; }
    if (skipping) {
      if (isOtherHeader) { skipping = false; out.push(line); }
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/^\s*\n+/, "").trim();
}

function RadarChart({ grades }) {
  const W = 300;
  const H = 260;
  const cx = W / 2;
  const cy = H / 2;
  const R = 76;
  const angles = [-90, 0, 90, 180].map((d) => (d * Math.PI) / 180);
  const pt = (i, r) => [cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i])];
  const rings = [1, 2, 3].map((lv) => {
    const rad = (R * lv) / 3;
    return { lv, rad, pts: AXES.map((_, i) => pt(i, rad).join(",")).join(" ") };
  });
  const maxPts = AXES.map((_, i) => pt(i, R).join(",")).join(" ");
  const dataPts = AXES.map((a, i) => pt(i, (R * grades[a.key].score) / 3).join(",")).join(" ");
  const LABEL_GAP = 22;
  const labelDy = [-9, 4, 15, 4];

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} className="max-w-[300px]">
      {rings.map((r) => (
        <polygon key={r.lv} points={r.pts} fill="none" stroke="#f1f5f9" strokeWidth="1" />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#f1f5f9" strokeWidth="1" />;
      })}
      <polygon points={maxPts} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeLinejoin="round" />
      <polygon
        points={dataPts}
        fill="#3b82f6"
        fillOpacity="0.08"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {rings.map((r) => (
        <text key={`t${r.lv}`} x={cx + 6} y={cy - r.rad + 4} fontSize="9" fontWeight="600" fill="#e2e8f0">
          {r.lv}
        </text>
      ))}
      {AXES.map((a, i) => {
        const [x, y] = pt(i, R + LABEL_GAP);
        return (
          <text key={a.key} x={x} y={y + labelDy[i]} textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

function DiagnosisContent({ grades }) {
  const total = AXES.reduce((s, a) => s + grades[a.key].score, 0);
  const lowCount = AXES.filter((a) => grades[a.key].grade === "하").length;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-center">
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-2 py-2">
        <RadarChart grades={grades} />
        <div className="mt-1 flex items-center justify-center gap-4 pb-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            만점 기준
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            내 진단 결과
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {AXES.map((a) => {
          const sc = grades[a.key].score;
          const g = grades[a.key].grade;
          return (
            <div key={a.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[13px] font-bold text-slate-700">{a.label}</span>
                <span className="text-[13px] font-black text-blue-600">
                  {g} <span className="text-[11px] font-bold text-slate-400">{sc}/3</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                  style={{ width: `${(sc / 3) * 100}%` }}
                />
              </div>
            </div>
          );
        })}

        <div
          className={`mt-1 flex items-center justify-between rounded-xl px-3 py-2 text-[11px] font-bold ${
            lowCount >= 2
              ? "bg-red-50 text-red-600"
              : total >= 10
              ? "bg-blue-50 text-blue-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <span>
            {lowCount >= 2
              ? `⚠ '하' ${lowCount}개 — 보완 시급`
              : total >= 10
              ? "✓ 전반적으로 안정적"
              : "개선 포인트 확인 필요"}
          </span>
          <span className="shrink-0 text-[13px] font-black">{total} / 12점</span>
        </div>
      </div>
    </div>
  );
}

function FeedbackAccordion({ grades, text }) {
  const [open, setOpen] = useState(false);
  const total = grades ? AXES.reduce((s, a) => s + grades[a.key].score, 0) : null;
  const lowCount = grades ? AXES.filter((a) => grades[a.key].grade === "하").length : 0;

  return (
    <div className="no-print mt-3 overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-blue-50"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-xs font-black tracking-wide text-seum-blue">면접 진단 결과</span>
          {!open && (
            <>
              {grades && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                    lowCount >= 2
                      ? "bg-red-100 text-red-600"
                      : total >= 10
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {total} / 12점
                </span>
              )}
              <span className="truncate text-[11px] font-medium text-slate-400">
                인재상 진단 · 개선 포인트
              </span>
            </>
          )}
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-seum-blue transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="space-y-3 border-t border-blue-100 bg-white/60 px-4 py-4">
          {grades && (
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4">
              <p className="mb-3 text-xs font-black tracking-wide text-seum-blue">공무원 인재상 진단</p>
              <DiagnosisContent grades={grades} />
            </div>
          )}
          {text && (
            <div className="rounded-2xl border-l-2 border-seum-blue bg-blue-50/50 px-4 py-3">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-seum-blue">첨삭</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DebateTopicList({ questions, locked, onPick }) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => {
        const a = q._answer;
        const fb = a?.teacher_feedback || "";
        const grades = fb ? parseGrades(fb) : null;
        const fbText = grades ? stripDiagnosis(fb) : fb;
        const done = !!a?.submitted_at;

        return (
          <div
            key={q.id}
            className={`rounded-xl border bg-white p-4 ${done ? "border-green-200" : "border-slate-200"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-seum-navy">
                <span className="mr-1 text-slate-400">{i + 1}.</span>
                {q.question}
              </p>
              <button
                type="button"
                onClick={() => onPick(q)}
                disabled={locked}
                className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-bold transition disabled:opacity-40 ${
                  done
                    ? "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    : "bg-seum-blue text-white hover:bg-[#2a63c4]"
                }`}
              >
                {done ? "다시 토론" : "토론 시작"}
              </button>
            </div>

            {done && <p className="mt-2 text-xs font-bold text-green-600">✓ 토론 완료</p>}

            {a?.student_answer && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-700">
                  토론 기록 보기
                </summary>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
                  {a.student_answer}
                </p>
              </details>
            )}

            {fb ? <FeedbackAccordion grades={grades} text={fbText} /> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function StudentInterviewTab({ studentId, locked = false }) {
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [activeSeries, setActiveSeries] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [autoSavingIds, setAutoSavingIds] = useState({});
  const [autoSavedIds, setAutoSavedIds] = useState({});
  const [debateQ, setDebateQ] = useState(null);
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: personal } = await supabase
        .from("interview_assignments")
        .select("category_key, sub_key")
        .eq("student_id", studentId)
        .maybeSingle();

      let resolved = personal ?? null;

      if (!resolved) {
        const { data: enr } = await supabase
          .from("enrollments")
          .select("courses(type, course_kind, interview_category, interview_sub)")
          .eq("student_id", studentId);
        const itvCourse = (enr ?? [])
          .map((e) => e.courses)
          .find((c) => c && c.type === "group" && c.course_kind === "interview" && c.interview_category);
        if (itvCourse) {
          resolved = { category_key: itvCourse.interview_category, sub_key: itvCourse.interview_sub };
        }
      }

      if (!alive) return;
      setAssignment(resolved);
      if (resolved) {
        const cat = getCategory(resolved.category_key);
        if (cat?.tabs?.length) setActiveTab(cat.tabs[0].key);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [studentId]);

  const loadTab = async (categoryKey, subKey, tabKey, seriesKey) => {
    if (tabKey === "materials") {
      setQuestions([]);
      setLoadingQ(false);
      return;
    }

    setLoadingQ(true);
    const seriesList = getSeries(categoryKey, subKey);
    const needsSeries = tabKey === "gichul" && seriesList.length > 0;

    if (needsSeries && !seriesKey) {
      setQuestions([]);
      setLoadingQ(false);
      return;
    }

    let q = supabase
      .from("interview_questions_v2")
      .select("*")
      .eq("category_key", categoryKey)
      .eq("tab_key", tabKey)
      .eq("is_active", true)
      .order("seq");
    q = subKey ? q.eq("sub_key", subKey) : q.is("sub_key", null);
    if (needsSeries) q = q.eq("series_key", seriesKey);

    const { data: qs } = await q;
    const questionList = qs ?? [];
    const ids = questionList.map((x) => x.id);
    let answerMap = {};

    if (ids.length > 0) {
      const { data: ans } = await supabase
        .from("interview_answers_v2")
        .select("*")
        .eq("student_id", studentId)
        .in("question_id", ids);
      (ans ?? []).forEach((a) => { answerMap[a.question_id] = a; });
    }

    const merged = questionList.map((qq) => ({ ...qq, _answer: answerMap[qq.id] || null }));
    setQuestions(merged);
    setAnswers((prev) => {
      const next = { ...prev };
      merged.forEach((qq) => {
        if (next[qq.id] === undefined) next[qq.id] = qq._answer?.student_answer ?? "";
      });
      return next;
    });
    setLoadingQ(false);
  };

  useEffect(() => {
    if (!assignment || !activeTab) return;
    loadTab(assignment.category_key, assignment.sub_key, activeTab, activeSeries);
    // eslint-disable-next-line
  }, [assignment, activeTab, activeSeries, studentId]);

  useEffect(() => {
    setActiveSeries(null);
    setDebateQ(null);
  }, [activeTab]);

  useEffect(() => {
    if (!studentId) return;
    const channel = supabase
      .channel(`iav2-${studentId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interview_answers_v2", filter: `student_id=eq.${studentId}` },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          setQuestions((prev) =>
            prev.map((q) => (q.id === row.question_id ? { ...q, _answer: { ...(q._answer || {}), ...row } } : q))
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [studentId]);

  const persistAnswer = async (questionId, text, submit = false) => {
    const now = new Date().toISOString();
    const payload = {
      question_id: questionId,
      student_id: studentId,
      student_answer: text,
      answered_at: now,
      updated_at: now,
    };
    if (submit) payload.submitted_at = now;

    const { data, error } = await supabase
      .from("interview_answers_v2")
      .upsert(payload, { onConflict: "question_id,student_id" })
      .select()
      .maybeSingle();
    if (error) throw error;
    setQuestions((prev) =>
      prev.map((x) => (x.id === questionId ? { ...x, _answer: { ...(x._answer || {}), ...data } } : x))
    );
    return data;
  };

  useEffect(() => {
    if (locked || activeTab === "debate") return;
    const timer = setTimeout(async () => {
      const targets = questionsRef.current.filter((q) => {
        const t = answers[q.id] ?? "";
        const saved = q._answer?.student_answer ?? "";
        return t.trim() !== "" && t !== saved;
      });
      if (targets.length === 0) return;

      for (const q of targets) {
        setAutoSavingIds((p) => ({ ...p, [q.id]: true }));
        try {
          await persistAnswer(q.id, answers[q.id] ?? "", false);
          setAutoSavedIds((p) => ({ ...p, [q.id]: true }));
          setTimeout(() => {
            setAutoSavedIds((p) => {
              const next = { ...p };
              delete next[q.id];
              return next;
            });
          }, 2500);
        } catch (e) {
          console.error("자동 저장 실패:", e.message);
        } finally {
          setAutoSavingIds((p) => {
            const next = { ...p };
            delete next[q.id];
            return next;
          });
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [answers, locked, studentId, activeTab]);

  const saveAnswer = async (q) => {
    if (locked) return alert("수강이 종료되어 답변을 저장할 수 없습니다. 재등록 후 이용해주세요.");
    const t = (answers[q.id] ?? "").trim();
    if (!t) return alert("답변을 작성해주세요.");

    setSavingId(q.id);
    try {
      await persistAnswer(q.id, answers[q.id] ?? "", true);
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  if (!assignment) {
    return (
      <div>
        <h2 className="mb-1 font-bold text-seum-navy">면접 질문</h2>
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          아직 배정된 면접 카테고리가 없습니다. 선생님/원장님께 문의해주세요.
        </p>
      </div>
    );
  }

  const cat = getCategory(assignment.category_key);
  const subLabel = getSubLabel(assignment.category_key, assignment.sub_key);
  const tabs = cat?.tabs ?? [];
  const seriesList = getSeries(assignment.category_key, assignment.sub_key);
  const showSeriesPicker = activeTab === "gichul" && seriesList.length > 0;
  const materials = getMaterials(assignment.category_key, assignment.sub_key);
  const isMaterialsTab = activeTab === "materials";
  const isDebateTab = activeTab === "debate";
  const canPrint = !isMaterialsTab && !isDebateTab && questions.length > 0;

  const fileUrl = (path) =>
    `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/student-files/${encodeURI(path)}`;

  const printTitle = () => {
    const c = getCategoryLabel(assignment.category_key);
    const s = subLabel ? ` · ${subLabel}` : "";
    const tb = activeTab ? ` — ${getTabLabel(assignment.category_key, activeTab)}` : "";
    const sr =
      activeSeries && showSeriesPicker
        ? ` (${getSeriesLabel(assignment.category_key, assignment.sub_key, activeSeries)})`
        : "";
    return `${c}${s} 면접${tb}${sr}`;
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  const renderBody = () => {
    if (isMaterialsTab) {
      return (
        <div className="space-y-3">
          {materials.map((m) => (
            <div
              key={m.path}
              onClick={() => window.open(fileUrl(m.path), "_blank")}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-seum-blue hover:bg-blue-50/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[11px] font-black text-red-500">
                  PDF
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-seum-navy">{m.title}</p>
                  {m.description && <p className="truncate text-xs text-slate-400">{m.description}</p>}
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white">
                다운로드
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (isDebateTab) {
      if (debateQ) {
        return (
          <DebateSession
            question={debateQ}
            studentId={studentId}
            existingAnswer={debateQ._answer}
            onExit={() => setDebateQ(null)}
            onSaved={() => {
              setDebateQ(null);
              loadTab(assignment.category_key, assignment.sub_key, activeTab, activeSeries);
            }}
          />
        );
      }
      if (loadingQ) return <p className="py-10 text-center text-slate-400">불러오는 중...</p>;
      if (questions.length === 0) {
        return (
          <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
            등록된 토론 주제가 아직 없습니다.
          </p>
        );
      }
      return <DebateTopicList questions={questions} locked={locked} onPick={setDebateQ} />;
    }

    if (loadingQ) return <p className="py-10 text-center text-slate-400">불러오는 중...</p>;

    if (questions.length === 0) {
      return (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          {showSeriesPicker && !activeSeries
            ? "직렬을 선택하면 해당 직렬의 기출문제가 표시됩니다."
            : "이 탭에 등록된 질문이 아직 없습니다."}
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {questions.map((q, i) => {
          const a = q._answer;
          const fb = a?.teacher_feedback || "";
          const grades = fb ? parseGrades(fb) : null;
          const fbText = grades ? stripDiagnosis(fb) : fb;
          const t = answers[q.id] ?? "";
          const dirty = t !== (a?.student_answer ?? "");
          const submitted = !!a?.submitted_at && !dirty && !!t.trim();

          return (
            <div
              key={q.id}
              className={`print-card rounded-xl border bg-white p-4 transition ${
                submitted ? "border-green-200" : "border-slate-200"
              }`}
            >
              <p className="mb-2 font-medium text-seum-navy">
                <span className="mr-1 text-slate-400">{i + 1}.</span>
                {q.question}
              </p>

              <textarea
                value={t}
                onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                rows={4}
                disabled={locked}
                placeholder={locked ? "수강 종료로 답변을 작성할 수 없습니다." : "답변을 작성하세요. 자동 저장됩니다."}
                className="no-print w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue disabled:bg-slate-50 disabled:text-slate-400"
              />

              <div className="print-only print-answer">{t || " "}</div>

              <div className="no-print mt-2 flex items-center justify-between gap-2">
                {submitted ? (
                  <span className="text-xs font-bold text-green-600">✓ 선생님께 전달됨</span>
                ) : autoSavingIds[q.id] ? (
                  <span className="text-xs text-slate-400">저장 중...</span>
                ) : autoSavedIds[q.id] ? (
                  <span className="text-xs text-blue-600">임시 저장됨 — 저장을 눌러 전달하세요</span>
                ) : t.trim() ? (
                  <span className="text-xs text-amber-500">
                    {a?.submitted_at ? "수정됨 — 다시 전달하세요" : "저장을 눌러 선생님께 전달하세요"}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">미작성</span>
                )}
                <button
                  type="button"
                  onClick={() => saveAnswer(q)}
                  disabled={savingId === q.id || locked || submitted}
                  className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-100 ${
                    submitted ? "cursor-default bg-green-600" : "bg-seum-blue hover:bg-[#2a63c4]"
                  }`}
                >
                  {savingId === q.id
                    ? "저장 중..."
                    : submitted
                    ? "✓ 전달 완료"
                    : a?.submitted_at
                    ? "다시 전달"
                    : "저장"}
                </button>
              </div>

              {fb ? (
                <FeedbackAccordion grades={grades} text={fbText} />
              ) : submitted ? (
                <p className="no-print mt-3 text-xs text-slate-400">선생님 피드백을 기다리는 중이에요.</p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div id="itv-print">
      <style>{PRINT_CSS}</style>

      <div className="print-only" style={{ marginBottom: 16, borderBottom: "2px solid #1e293b", paddingBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{printTitle()}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>세움스피치 · 출력일 {todayStr}</div>
      </div>

      <div className="no-print mb-4">
        <h2 className="font-bold text-seum-navy">
          {getCategoryLabel(assignment.category_key)}
          {subLabel && <span className="ml-2 text-seum-blue">· {subLabel}</span>} 면접
        </h2>
        <p className="text-sm text-slate-400">
          {isMaterialsTab
            ? "면접 준비에 필요한 자료를 다운로드하세요."
            : isDebateTab
            ? "주제를 선택하면 AI 상대와 실전처럼 토론합니다."
            : "작성 중인 내용은 자동 저장됩니다. 저장 버튼을 눌러야 선생님께 전달됩니다."}
        </p>
      </div>

      {locked && (
        <div className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          수강이 종료되어 답변 저장은 할 수 없습니다. 받은 질문과 첨삭은 계속 확인하실 수 있습니다.
        </div>
      )}

      <div className="no-print mb-5 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
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

        {materials.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("materials")}
            className={`ml-auto rounded-full px-4 py-1.5 text-sm font-bold transition ${
              isMaterialsTab
                ? "bg-seum-navy text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            자료집 다운로드
          </button>
        )}
      </div>

      {showSeriesPicker && (
        <div className="no-print mb-5">
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

      {canPrint && (
        <div className="no-print mb-4 flex items-center justify-between">
          <span className="text-xs text-slate-400">총 {questions.length}문항</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            인쇄 / PDF 저장
          </button>
        </div>
      )}

      {renderBody()}
    </div>
  );
}