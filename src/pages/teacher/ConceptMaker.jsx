// src/pages/teacher/ConceptMaker.jsx
// 면접 컨셉 만들기
//
// 선생님이 재료를 넣으면 AI 가 "어느 회사의 어떤 직무" 5개를 찾아준다.
//   ① 지원 학과        학생이 지원한 학교·학과
//   ② 졸업 후 진로      원하는 회사·분야 (CEO·창업이라고 적으면 창업 컨셉도 나온다)
//   ③ 생기부 활동       학년마다 "무슨 분야로 채웠는지 + 실제 활동"
//   ④ 임팩트 있는 활동   학년과 상관없이 내세울 것
//
// AI 는 활동 조합 → 제품·사업 → 그 일을 하는 회사 → 그 회사 직무 순서로 웹에서 찾는다.
// 웹 검색 때문에 30초~1분 걸려서, 기다리는 동안 진행률을 보여준다.
// "다시 뽑기"는 이미 나온 회사를 빼고 새 회사 5개를 찾는다.
//
// 적은 내용과 뽑은 결과는 학생별로 자동 저장된다 (student_concepts 테이블).
// 창을 닫았다 열어도, 다른 컴퓨터에서 열어도 그대로 남아 있다.
//
// 창이 멋대로 닫히던 문제
//   - 글자를 마우스로 끌어 선택하다 창 밖에서 손을 떼면 바깥 클릭으로 처리돼 닫혔다
//     → 바깥에서 누르고 바깥에서 뗀 경우에만 닫는다
//   - 백스페이스 같은 키가 뒤 화면 단축키로 넘어가던 것 → 창 안의 키 입력은 밖으로 안 보낸다

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const GRADES = [1, 2, 3];

// 결과 한 개 → 컨셉 칸에 들어갈 글
const conceptText = (c) =>
  c.kind === "창업" ? `${c.company} ${c.role || "대표"}` : `${c.company} ${c.role}`;

export default function ConceptMaker({ student, univPicks = [], onPick, onClose }) {
  // ① 지원 학과 — 학생이 기출문제 탭에서 고른 지원 목록이 있으면 미리 채운다
  const [majors, setMajors] = useState("");
  const [career, setCareer] = useState("");
  const [rows, setRows] = useState(
    GRADES.map((g) => ({ grade: g, field: "", acts: "" }))
  );
  const [impact, setImpact] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);   // [{ kind, company, role, product, base, link, from, ref }]
  const [shown, setShown] = useState([]);       // 지금까지 보여준 회사 (다시 뽑기 때 뺀다)
  const [round, setRound] = useState(0);        // 몇 번째 뽑기인지
  const [open, setOpen] = useState(null);       // 펼쳐 본 카드 번호
  const [err, setErr] = useState("");

  // ── 자동 저장 ─────────────────────────────────
  const studentId = student?.id;
  const [loaded, setLoaded] = useState(false);  // 저장된 내용을 다 불러왔는지
  const [saveState, setSaveState] = useState(""); // "" | saving | saved | error
  const pending = useRef(null);                 // 아직 저장 안 된 내용
  const timer = useRef(null);
  const myId = useRef(null);
  const filledOnce = useRef(false);             // 지원 목록 자동 채우기는 딱 한 번만
  const [autoFilled, setAutoFilled] = useState(false);

  const picksText = univPicks
    .map((p) => `${p.univ} ${p.major}${p.admission ? ` (${p.admission})` : ""}`)
    .join("\n");

  // 창을 열 때 저장된 내용 불러오기
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      myId.current = u?.user?.id ?? null;
      if (!studentId) { setLoaded(true); return; }

      const { data, error } = await supabase
        .from("student_concepts").select("*").eq("student_id", studentId).maybeSingle();
      if (!alive) return;
      if (error) console.error("컨셉 불러오기 오류:", error);

      if (data) {
        filledOnce.current = true; // 한 번이라도 저장된 학생은 자동으로 채우지 않는다 (지운 것도 존중)
        setMajors(data.majors ?? "");
        setCareer(data.career ?? "");
        setImpact(data.impact ?? "");
        const saved = Array.isArray(data.grades) ? data.grades : [];
        setRows(GRADES.map((g) => {
          const r = saved.find((x) => Number(x.grade) === g);
          return { grade: g, field: r?.field ?? "", acts: r?.acts ?? "" };
        }));
        if (Array.isArray(data.last_result) && data.last_result.length) {
          setResult(data.last_result);
          setRound(1);
        }
        setShown(data.shown ?? []);
        setSaveState("saved");
      }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [studentId]);

  // 처음 여는 학생(저장된 게 없음)일 때만 학생이 고른 지원 목록으로 한 번 채운다.
  // 그 뒤로는 선생님이 지우면 지운 대로 둔다. 다시 넣고 싶으면 "지원 목록 불러오기" 버튼.
  useEffect(() => {
    if (!loaded || filledOnce.current || !picksText) return;
    filledOnce.current = true;
    setMajors(picksText);
    setAutoFilled(true);
  }, [loaded, picksText]);

  const save = async (payload) => {
    if (!studentId || !payload) return;
    setSaveState("saving");
    const { error } = await supabase.from("student_concepts").upsert({
      student_id: studentId,
      ...payload,
      updated_by: myId.current,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("컨셉 저장 오류:", error);
      setSaveState("error");
    } else {
      if (pending.current === payload) pending.current = null;
      setSaveState("saved");
    }
  };

  // 적을 때마다 0.8초 뒤 저장 (계속 치는 중이면 기다렸다가 한 번에)
  useEffect(() => {
    if (!loaded || !studentId) return;
    const payload = {
      majors, career, impact,
      grades: rows.map((r) => ({ grade: r.grade, field: r.field, acts: r.acts })),
      last_result: result,
      shown,
    };
    pending.current = payload;
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(payload), 800);
    return () => clearTimeout(timer.current);
  }, [loaded, studentId, majors, career, impact, rows, result, shown]); // eslint-disable-line react-hooks/exhaustive-deps

  // 창을 닫을 때 저장 안 된 게 있으면 바로 저장
  useEffect(() => () => { if (pending.current) save(pending.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 팝업이 열려 있는 동안 뒤 화면은 스크롤되지 않게
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── 창 닫기 ─────────────────────────────────
  // 바깥에서 누르고 바깥에서 뗀 경우에만 닫는다 (글자 끌어 선택하다 밖에서 떼도 안 닫힘)
  const downOnBackdrop = useRef(false);

  const setRow = (g, key, v) =>
    setRows((p) => p.map((r) => (r.grade === g ? { ...r, [key]: v } : r)));

  const filled = rows.filter((r) => r.field.trim() || r.acts.trim());
  const canRun = majors.trim() || filled.length > 0;

  // again = true 면 다시 뽑기 (이미 나온 회사 제외)
  const run = async (again = false) => {
    if (!canRun) return alert("지원 학과나 생기부 활동 중 하나는 적어주세요.");
    setLoading(true);
    setErr("");
    setOpen(null);
    if (!again) {
      setResult(null);
      setShown([]);
    }
    try {
      const { data, error } = await supabase.functions.invoke("interview-concept", {
        body: {
          student_name: student?.name ?? null,
          majors: majors.trim(),
          career: career.trim(),
          grades: filled.map((r) => ({ grade: r.grade, field: r.field.trim(), acts: r.acts.trim() })),
          impact: impact.trim(),
          exclude: again ? shown : [],
        },
      });
      if (error) {
        let detail = error.message;
        try { const b = await error.context?.json(); detail = b?.error || detail; } catch (_) {}
        throw new Error(detail);
      }
      if (!data?.success) throw new Error(data?.error || "컨셉을 뽑지 못했습니다.");

      // 예전 함수(이름만 주던 버전)가 배포돼 있어도 보이게
      const list = Array.isArray(data.concepts) && data.concepts.length
        ? data.concepts
        : (data.jobs ?? []).map((j) => ({ kind: "취업", company: "", role: j }));

      setResult(list);
      setShown((p) => [...new Set([...(again ? p : []), ...list.map((c) => c.company).filter(Boolean)])]);
      setRound((n) => (again ? n + 1 : 1));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (!loading && downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}>
      {/* 팝업: 제목 줄은 고정, 내용만 팝업 안에서 스크롤 */}
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col bg-white"
        onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 pb-4 pt-6">
          <div>
            <h3 className="text-lg font-bold text-seum-navy">면접 컨셉 만들기</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {student?.name ? `${student.name} 학생 · ` : ""}
              재료를 적으면 AI가 활동에 맞는 회사와 직무를 찾아줍니다.
            </p>
          </div>
          <span className={`ml-auto mr-4 text-[11px] ${saveState === "error" ? "text-red-500" : "text-slate-400"}`}>
            {!loaded ? "불러오는 중..." :
              saveState === "saving" ? "저장 중..." :
              saveState === "saved" ? "✓ 자동 저장됨" :
              saveState === "error" ? "저장 실패 — 인터넷을 확인하세요" : ""}
          </span>
          <button type="button" onClick={onClose} disabled={loading}
            className="text-slate-400 hover:text-slate-700 disabled:opacity-30">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {!loaded ? (
          <p className="py-10 text-center text-sm text-slate-400">저장된 내용을 불러오는 중...</p>
        ) : (<>
        {/* ① 지원 학과 */}
        <div className="pt-4">
          <label className="mb-1.5 block text-xs font-bold text-slate-500">
            ① 지원 학과
            {autoFilled && (
              <span className="ml-1.5 font-medium text-slate-400">학생이 고른 지원 목록을 가져왔어요</span>
            )}
            {!autoFilled && picksText && majors.trim() !== picksText.trim() && (
              <button type="button"
                onClick={() => { setMajors(picksText); setAutoFilled(true); }}
                className="ml-1.5 font-medium text-seum-blue hover:underline">
                학생 지원 목록 불러오기
              </button>
            )}
          </label>
          <textarea
            value={majors}
            onChange={(e) => { setMajors(e.target.value); setAutoFilled(false); }}
            rows={3}
            placeholder={"숭실대 경영학부\n인하대 미디어커뮤니케이션학과"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-seum-blue"
          />
        </div>

        {/* ② 졸업 후 진로 */}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <label className="mb-1.5 block text-xs font-bold text-slate-500">② 졸업 후 진로</label>
          <textarea
            value={career}
            onChange={(e) => setCareer(e.target.value)}
            rows={3}
            placeholder="원하는 회사·분야를 적으세요. 예: 한화시스템, 쎄트렉아이 / 산업안전 분야 / CEO, 창업"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-seum-blue"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            회사 이름은 정확하게 적어주세요. 여기 없는 회사도 AI가 활동을 보고 따로 찾습니다.
          </p>
        </div>

        {/* ③ 생기부 활동 */}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <label className="mb-1.5 block text-xs font-bold text-slate-500">③ 생기부 활동</label>
          <p className="mb-2 text-[11px] text-slate-400">
            학년마다 무슨 분야로 채웠는지와 실제 활동을 적으세요. 빈 학년은 비워둬도 됩니다.
          </p>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.grade} className="flex gap-2">
                <span className="w-12 shrink-0 pt-2 text-xs font-bold text-slate-500">{r.grade}학년</span>
                <input
                  value={r.field}
                  onChange={(e) => setRow(r.grade, "field", e.target.value)}
                  placeholder="분야 (예: 미디어)"
                  className="w-32 shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                />
                <input
                  value={r.acts}
                  onChange={(e) => setRow(r.grade, "acts", e.target.value)}
                  placeholder="활동 (예: 교내 방송부, 학교 신문 제작, 영상 공모전)"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ④ 임팩트 있는 활동 */}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <label className="mb-1.5 block text-xs font-bold text-slate-500">④ 임팩트 있는 활동 (선택)</label>
          <input
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="예: 전교 부회장, 3년 봉사 120시간, 교내 대회 대상"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
          />
        </div>

        <button type="button" onClick={() => run(false)} disabled={loading || !canRun}
          className="mt-5 w-full rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
          {loading ? "회사와 직무를 찾는 중..." : "✨ 컨셉 뽑기"}
        </button>

        {loading && <ConceptProgress />}

        {err && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>
        )}

        {/* 결과 */}
        {result && !loading && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-seum-navy">
                컨셉 후보 {result.length}개
                {round > 1 && <span className="ml-1.5 text-xs font-medium text-slate-400">{round}번째 뽑기</span>}
              </p>
              <span className="text-[11px] text-slate-400">이름을 누르면 컨셉 칸에 들어갑니다</span>
            </div>

            {result.length === 0 ? (
              <p className="text-sm text-slate-400">후보를 만들지 못했습니다. 활동을 조금 더 적어보세요.</p>
            ) : (
              <div className="space-y-2">
                {result.map((c, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 transition hover:border-seum-blue">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="w-5 shrink-0 text-xs font-bold text-slate-400">{i + 1}</span>

                      {c.kind === "창업" ? (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">창업</span>
                      ) : c.from === "진로" ? (
                        <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-seum-blue">진로</span>
                      ) : c.company ? (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">AI 발굴</span>
                      ) : null}

                      <button type="button" onClick={() => onPick(c.company ? conceptText(c) : c.role)}
                        className="min-w-0 flex-1 text-left text-sm text-seum-navy hover:text-seum-blue">
                        {c.company && <span className="font-bold">{c.company}</span>}
                        {c.company && <span className="mx-1 text-slate-300">·</span>}
                        <span className="font-medium">{c.role}</span>
                      </button>

                      {(c.link || c.product || c.base || c.ref) && (
                        <button type="button" onClick={() => setOpen(open === i ? null : i)}
                          className="shrink-0 text-xs text-slate-400 hover:text-seum-blue">
                          {open === i ? "접기 ▲" : "근거 ▼"}
                        </button>
                      )}
                    </div>

                    {open === i && (
                      <div className="space-y-1 border-t border-slate-100 bg-slate-50 px-3 py-2.5 pl-10 text-xs leading-relaxed text-slate-600">
                        {c.link && <p><b className="text-slate-500">활동 연결</b> {c.link}</p>}
                        {c.product && <p><b className="text-slate-500">제품·사업</b> {c.product}</p>}
                        {c.ref && <p><b className="text-slate-500">참고 회사</b> {c.ref}</p>}
                        {c.base && <p><b className="text-slate-500">공식 직업</b> {c.base}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400">
                학생과 함께 보고 고르세요. 고른 뒤 컨셉 칸에서 더 좁게 다듬어도 됩니다.
              </p>
              <button type="button" onClick={() => run(true)} disabled={loading}
                className="shrink-0 rounded-lg border border-seum-blue px-3 py-2 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-50">
                ↻ 다른 회사로 다시 뽑기
              </button>
            </div>
          </div>
        )}
        </>)}
        </div>
      </div>
    </div>
  );
}

// ── 기다리는 동안 보여줄 진행률 ─────────────────────
// 함수는 끝날 때 한 번에 답을 주기 때문에 진짜 진행 상황은 알 수 없다.
// 걸린 시간으로 단계를 보여주고, 막대는 답이 오기 전까지 95%에서 멈춘다.
const CONCEPT_STEPS = [
  { at: 0,  text: "학년별 활동 흐름을 읽고 있어요" },
  { at: 6,  text: "세 학년이 모두 쓰이는 제품·사업을 찾고 있어요" },
  { at: 12, text: "그 일을 실제로 하는 회사를 검색하고 있어요" },
  { at: 28, text: "회사 채용 공고에서 직무를 확인하고 있어요" },
  { at: 45, text: "5개로 정리하고 있어요" },
  { at: 75, text: "회사를 꼼꼼히 찾는 중이에요. 조금만 더 기다려 주세요" },
];

function ConceptProgress() {
  const [sec, setSec] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 처음엔 빠르게, 갈수록 천천히 차고 95%에서 멈춘다 (약 30초에 70%)
  const pct = Math.min(95, Math.round(95 * (1 - Math.exp(-sec / 25))));
  const step = [...CONCEPT_STEPS].reverse().find((s) => sec >= s.at);
  const stepNo = Math.min(CONCEPT_STEPS.indexOf(step) + 1, 5);

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-seum-blue">{stepNo}/5 · {step.text}</span>
        <span className="text-slate-500">{sec}초</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100">
        <div className="h-full rounded-full bg-seum-blue transition-all duration-1000"
          style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        웹에서 회사와 채용 공고를 찾느라 보통 30초~1분 걸립니다. 창을 닫지 마세요.
      </p>
    </div>
  );
}