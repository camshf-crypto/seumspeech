// src/pages/student/SpeechDrill.jsx
// 스피치 연습 (클로즈 스피치)
//
// 완성한 답변을 스피치 구조 블록으로 나누고, 단계마다 블록을 통째로 가려가며 말로 복원한다.
// 낱말 빈칸 채우기가 아니라, 가려진 문단을 자기 말로 풀어내는 연습이다.
//   1 한 블록    블록 하나를 가림
//   2 두 블록    블록 둘을 가림
//   3 첫 블록만  첫 블록만 남기고 전부 가림 (시작 실마리만)
//   4 구조만     문장은 다 가리고 블록 이름만
//   5 실전       질문만
//
// 흐름: 가린 화면 보기 → 준비 20초 → 말하기 60초 → 글로 옮기기 → 판정 → 기록
// 판정(speech-judge)은 따로 붙인다. 없으면 글로 옮긴 내용만 보여준다.

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const PREP_SEC = 20;
const SPEAK_SEC = 60;          // 음성 인식이 60초까지 받는다
const PASS = 70;               // 이 유지율을 넘으면 그 단계를 통과한 것으로 표시한다 (잠그지는 않는다)
const BUCKET = "simulation-recordings";

const LEVELS = [
  { no: 1, label: "한 블록" },
  { no: 2, label: "두 블록" },
  { no: 3, label: "첫 블록만" },
  { no: 4, label: "구조만" },
  { no: 5, label: "실전" },
];


// 핵심어를 가린 문장
const maskKeywords = (text, keywords) => {
  let t = text;
  (keywords ?? []).forEach((k) => {
    if (k) t = t.split(k).join("█".repeat(Math.min(k.length, 8)));
  });
  return t;
};

// 몇 번 블록을 가릴지 — 앞선 연습에서 자주 빠뜨린 블록부터.
// 기록이 없으면 첫 블록은 남기고 가운데부터 가린다. (첫 문장은 실마리로 둔다)
function pickHidden(blocks, drills, count) {
  const n = blocks.length;
  if (n === 0 || count <= 0) return [];
  if (count >= n) return blocks.map((_, i) => i);

  const weak = {};
  (drills ?? []).forEach((d) => {
    (d.result ?? []).forEach((r) => {
      if (r.status === "miss") weak[r.label] = (weak[r.label] || 0) + 2;
      else if (r.status === "partial") weak[r.label] = (weak[r.label] || 0) + 1;
    });
  });

  // 1) 자주 빠뜨린 블록  2) 경험 블록  3) 첫 블록이 아닌 것  4) 앞쪽부터
  const isExp = (b) => /경험|활동|사례/.test(b.label ?? "");
  const order = blocks
    .map((b, i) => ({ i, w: weak[b.label] || 0, exp: isExp(b) ? 1 : 0 }))
    .sort((a, b) => b.w - a.w || b.exp - a.exp || (a.i === 0) - (b.i === 0) || a.i - b.i);

  return order.slice(0, count).map((x) => x.i).sort((a, b) => a - b);
}

// 함수가 실패했을 때 화면에서 직접 나눈다 — 문장 단위로 구조 수만큼 고르게
const DEFAULT_FRAMES = {
  saenggibu: "활동 동기 + 맡은 역할과 과정 + 어려움과 해결 + 배운 점 + 전공 연결",
  default: "결론 + 이유 + 경험 + 배운 점",
};
function localBlocks(text, structure, tabKey) {
  const frame = (structure && structure.trim()) || DEFAULT_FRAMES[tabKey] || DEFAULT_FRAMES.default;
  const labels = frame.split("+").map((x) => x.trim()).filter(Boolean)
    .map((x) => x.replace(/\(.*?\)/g, "").trim().slice(0, 10));
  const sents = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。])\s+|(?<=다)\s+(?=[가-힣A-Za-z0-9])/)
    .map((x) => x.trim())
    .filter(Boolean);
  const n = Math.max(1, Math.min(labels.length, sents.length));
  const per = Math.ceil(sents.length / n);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = sents.slice(i * per, (i + 1) * per).join(" ");
    if (t) out.push({ label: labels[i] ?? `부분 ${i + 1}`, text: t, keywords: [] });
  }
  return out;
}

// 블록 다듬기 — 이름은 짧게, 핵심어가 비면 명사 위주로 채운다.
// 저장돼 있던 예전 블록도 여기를 거치므로 1단계에서 항상 뭔가 가려진다.
const STOP_WORDS = new Set([
  "저는", "제가", "그래서", "그리고", "하지만", "때문에", "생각합니다", "되었습니다",
  "하였습니다", "있습니다", "싶습니다", "합니다", "입니다", "감사합니다", "안녕하세요",
]);
function pickKeywords(text, n = 2) {
  const VERB_END = /(다|요|죠|고|며|서|면|게|지|어|아|워|해|는데|니다|습니다)$/;
  const PARTICLE = /(으로|에서|에게|까지|부터|처럼|이라|을|를|이|가|은|는|에|의|로|와|과|도|만)$/;
  const words = String(text ?? "")
    .replace(/[.,!?"'()·]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !STOP_WORDS.has(w) && !VERB_END.test(w))
    .map((w) => { const stem = w.replace(PARTICLE, ""); return stem.length >= 2 ? stem : w; })
    .filter((w) => w.length >= 2 && String(text).includes(w));
  const uniq = [...new Set(words)];
  uniq.sort((a, b) => b.length - a.length);
  return uniq.slice(0, n);
}
const shortLabel = (s) => {
  const t = String(s ?? "").replace(/\(.*?\)/g, "").trim();
  return t.length <= 10 ? t : t.slice(0, 10);
};
function tidyBlocks(list) {
  return (list ?? [])
    .filter((b) => b && String(b.text ?? "").trim())
    .map((b) => {
      const text = String(b.text).trim();
      const kws = (b.keywords ?? []).filter((k) => k && text.includes(k));
      return {
        label: shortLabel(b.label) || "부분",
        text,
        keywords: kws.length > 0 ? kws : pickKeywords(text),
      };
    });
}
// 저장된 블록이 예전 방식(긴 이름, 빈 핵심어)이면 다시 나누게 한다
const isStale = (list) =>
  !Array.isArray(list) || list.length === 0 ||
  list.some((b) => String(b.label ?? "").length > 12 || !(b.keywords?.length > 0));

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function SpeechDrill({ studentId, question, answer, tabKey, onClose }) {
  // 연습할 답변 — 학생이 완성한 답변 (완성본이 없으면 선생님이 고쳐준 답변, 그다음 학생 답변)
  const source = (answer?.final_answer || answer?.teacher_answer || answer?.student_answer || "").trim();

  const [blocks, setBlocks] = useState(null);
  const [blockErr, setBlockErr] = useState("");
  const [drills, setDrills] = useState([]);
  const [level, setLevel] = useState(1);

  // ready → prep → speak → saving → result
  const [phase, setPhase] = useState("ready");
  const [prepLeft, setPrepLeft] = useState(PREP_SEC);
  const [speakSec, setSpeakSec] = useState(0);
  const [result, setResult] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const startAtRef = useRef(0);
  const mimeRef = useRef("audio/webm");

  // ── 블록 준비 ─────────────────────────────────────
  useEffect(() => {
    if (!answer?.id || !source) return;
    let alive = true;
    (async () => {
      // 저장해 둔 블록이 지금 답변과 같으면 그대로 쓴다
      if (answer.speech_blocks_source === source && !isStale(answer.speech_blocks)) {
        setBlocks(tidyBlocks(answer.speech_blocks));
        return;
      }
      const { data, error } = await supabase.functions.invoke("speech-blocks", {
        body: {
          question: question?.question,
          answer: source,
          speech_structure: question?.speech_structure ?? null,
          tab_key: tabKey,
        },
      });
      if (!alive) return;
      let got = data?.success ? data.blocks : null;
      if (!got || got.length === 0) {
        // 함수가 없거나 실패 — 이유를 남기고 화면에서 나눈다
        let detail = error?.message || data?.error || "알 수 없음";
        try { const b = await error?.context?.json(); detail = b?.error || detail; } catch (_) {}
        console.error("speech-blocks 실패, 화면에서 대신 나눔:", detail);
        got = tidyBlocks(localBlocks(source, question?.speech_structure, tabKey));
        if (got.length === 0) {
          setBlockErr("답변을 나누지 못했습니다. 답변 내용을 확인해 주세요.");
          return;
        }
        // 대신 나눈 것은 저장하지 않는다 — 함수가 살아나면 제대로 다시 나누게
        setBlocks(got);
        return;
      }
      got = tidyBlocks(got);
      setBlocks(got);
      // AI 가 제대로 나눈 것만 저장한다. 안전장치로 나눈 것은 다음에 다시 시도하게 둔다.
      if (!data.fallback) {
        await supabase
          .from("interview_answers_v2")
          .update({ speech_blocks: got, speech_blocks_source: source })
          .eq("id", answer.id);
      }
    })();
    return () => { alive = false; };
  }, [answer?.id, source]);

  // ── 지난 연습 ─────────────────────────────────────
  const loadDrills = async () => {
    if (!answer?.id) return;
    const { data } = await supabase
      .from("speech_drills")
      .select("*")
      .eq("answer_id", answer.id)
      .order("created_at", { ascending: false });
    setDrills(data ?? []);
    return data ?? [];
  };

  useEffect(() => {
    (async () => {
      const list = await loadDrills();
      // 아직 통과하지 못한 첫 단계에서 시작
      setLevel(Math.min(5, unlockedFrom(list)));
    })();
    // eslint-disable-next-line
  }, [answer?.id]);

  // 1단계는 항상 열림. n 단계를 PASS 이상으로 통과하면 n+1 이 열린다.
  function unlockedFrom(list) {
    let top = 1;
    for (let lv = 1; lv <= 4; lv++) {
      const passed = (list ?? []).some((d) => d.level === lv && (d.retention ?? 0) >= PASS);
      if (passed) top = lv + 1;
      else break;
    }
    return top;
  }
  const unlocked = unlockedFrom(drills);
  // 단계별 통과 여부 — 탭에 ✓ 로 보여준다
  const passedLv = (lv) => drills.some((d) => d.level === lv && (d.retention ?? 0) >= PASS);

  // ── 타이머 ────────────────────────────────────────
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepLeft <= 0) { startSpeak(); return; }
    const t = setTimeout(() => setPrepLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [phase, prepLeft]);

  useEffect(() => {
    if (phase !== "speak") return;
    if (speakSec >= SPEAK_SEC) { stopSpeak(); return; }
    const t = setTimeout(() => setSpeakSec((s) => s + 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [phase, speakSec]);

  // 창을 닫으면 마이크를 끈다
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  // ── 가릴 블록 ─────────────────────────────────────
  // 단계별로 가릴 블록 수. 블록이 적으면 그만큼만.
  const nBlocks = blocks?.length ?? 0;
  const hideCount =
    level === 1 ? Math.min(1, nBlocks)
    : level === 2 ? Math.min(2, nBlocks)
    : level === 3 ? Math.max(0, nBlocks - 1)
    : 0;
  const hidden = !blocks
    ? []
    : level === 3
    ? blocks.map((_, i) => i).filter((i) => i > 0)
    : pickHidden(blocks, drills, hideCount);

  // ── 녹음 ─────────────────────────────────────────
  const startPrep = () => {
    setResult(null);
    setShowTranscript(false);
    setPrepLeft(PREP_SEC);
    setPhase("prep");
  };

  const startSpeak = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mime = cands.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)) || "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mimeRef.current = rec.mimeType || mime || "audio/webm";
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start();
      recRef.current = rec;
      startAtRef.current = Date.now();
      setSpeakSec(0);
      setPhase("speak");
    } catch (e) {
      console.error(e);
      alert("마이크 권한이 필요해요. 브라우저 설정에서 허용해주세요.");
      setPhase("ready");
    }
  };

  const stopSpeak = () => {
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      const dur = Math.round((Date.now() - startAtRef.current) / 1000);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      finish(blob, dur);
    };
    rec.stop();
    setPhase("saving");
  };

  // ── 저장 · 글로 옮기기 · 판정 ───────────────────────
  const finish = async (blob, dur) => {
    let recordingUrl = null;
    let transcript = "";
    let judge = null;

    // 녹음 올리기
    try {
      const path = `speech/${studentId}/${answer.id}-${Date.now()}.webm`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: mimeRef.current,
        upsert: false,
      });
      if (!error) recordingUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } catch (e) {
      console.error("녹음 업로드 실패:", e);
    }

    // 글로 옮기기
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stt-clova`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/octet-stream",
        },
        body: blob,
      });
      const out = await res.json();
      transcript = out?.success ? (out.text ?? "") : "";
      if (!out?.success) console.error("STT 실패:", out?.error);
    } catch (e) {
      console.error("STT 실패:", e);
    }

    // 판정 — 함수가 아직 없거나 실패해도 기록은 남긴다
    if (transcript) {
      try {
        const { data, error } = await supabase.functions.invoke("speech-judge", {
          body: {
            question: question?.question,
            blocks,
            hidden,
            level,
            transcript,
            duration_sec: dur,
          },
        });
        if (!error && data?.success) judge = data;
      } catch (e) {
        console.warn("판정 함수 없음 또는 실패:", e);
      }
    }

    const row = {
      answer_id: answer.id,
      student_id: studentId,
      question_id: question.id,
      level,
      hidden,
      recording_url: recordingUrl,
      transcript: transcript || null,
      duration_sec: dur,
      retention: judge?.retention ?? null,
      result: judge?.result ?? null,
      missions: judge?.missions ?? null,
      first_point_sec: judge?.first_point_sec ?? null,
    };
    const { error: insErr } = await supabase.from("speech_drills").insert(row);
    if (insErr) console.error("연습 기록 실패:", insErr);

    const prev = drills.find((d) => d.level === level && d.retention != null);
    setResult({ ...row, prevRetention: prev?.retention ?? null });
    await loadDrills();
    setPhase("result");
  };

  // ── 화면 ─────────────────────────────────────────
  const busy = phase === "prep" || phase === "speak" || phase === "saving";

  const renderCloze = () => {
    if (!blocks) return null;

    if (level === 5) {
      return (
        <p className="py-10 text-center text-sm text-white/50">
          질문만 보고 말해보세요. 준비한 구조를 떠올리면서요.
        </p>
      );
    }

    if (level === 4) {
      return (
        <div className="flex flex-wrap items-center justify-center gap-2 py-6">
          {blocks.map((b, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="rounded-lg bg-white/10 px-3 py-2 text-base font-bold text-white">{b.label}</span>
              {i < blocks.length - 1 && <span className="text-white/40">→</span>}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {blocks.map((b, i) => {
          const hide = hidden.includes(i);
          const shown = b.text;
          return (
            <div key={i} className="flex gap-3">
              <span className="w-20 shrink-0 pt-0.5 text-right text-xs font-bold text-blue-300">{b.label}</span>
              {hide ? (
                // 원문을 투명하게 깔아 높이를 그대로 맞추고, 그 위를 막대로 덮는다.
                // (글자 수로 막대를 만들면 줄바꿈이 안 돼 상자 밖으로 삐져나간다)
                <span className="relative min-w-0 flex-1 select-none">
                  <span aria-hidden className="invisible block text-base leading-relaxed">{b.text}</span>
                  <span className="absolute inset-0 flex flex-col justify-center gap-1.5 py-1">
                    {Array.from({ length: Math.max(1, Math.round(b.text.length / 42)) }).map((_, k, arr) => (
                      <span key={k}
                        className="block h-3.5 rounded bg-white/25"
                        style={{ width: k === arr.length - 1 && arr.length > 1 ? "60%" : "100%" }} />
                    ))}
                  </span>
                </span>
              ) : (
                <span className="min-w-0 flex-1 text-base leading-relaxed text-white/90">{shown}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const statusIcon = (s) => (s === "ok" ? "✓" : s === "partial" ? "△" : "✗");
  const statusCls = (s) =>
    s === "ok" ? "text-green-600" : s === "partial" ? "text-amber-600" : "text-red-500";

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-[#0b1220]">
      {/* 머리 */}
      <div className="flex items-center justify-between px-5 py-3">
        <button type="button" onClick={() => { if (!busy || window.confirm("연습을 그만둘까요?")) onClose(); }}
          className="text-sm text-white/70 hover:text-white">
          ← 나가기
        </button>
        <p className="text-sm font-bold text-white">스피치 연습</p>
        <span className="w-12" />
      </div>

      {/* 단계 탭 */}
      <div className="flex justify-center gap-1.5 px-4 pb-3">
        {LEVELS.map((lv) => {
          const on = level === lv.no;
          const passed = passedLv(lv.no);
          return (
            <button key={lv.no} type="button"
              disabled={busy}
              onClick={() => { setLevel(lv.no); setPhase("ready"); setResult(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                on ? "bg-seum-blue text-white"
                : passed ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}>
              {passed && "✓ "}{lv.no} {lv.label}
            </button>
          );
        })}
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mx-auto max-w-2xl">
          <p className="mb-5 text-lg font-bold leading-snug text-white">Q. {question?.question}</p>

          {blockErr ? (
            <p className="rounded-lg bg-red-500/20 px-4 py-3 text-sm text-red-200">{blockErr}</p>
          ) : !blocks ? (
            <p className="py-10 text-center text-sm text-white/50">답변을 구조대로 나누는 중...</p>
          ) : phase === "result" && result ? (
            // ── 결과 ──
            <div className="rounded-2xl bg-white p-5">
              {result.retention != null ? (
                <div className="mb-4 flex items-end gap-3">
                  <p className="text-4xl font-black text-seum-navy">{result.retention}%</p>
                  <p className="pb-1 text-sm text-slate-500">
                    내용 유지율
                    {result.prevRetention != null && (
                      <span className={`ml-2 font-bold ${result.retention >= result.prevRetention ? "text-green-600" : "text-red-500"}`}>
                        지난번 {result.prevRetention}% → {result.retention >= result.prevRetention ? "+" : ""}{result.retention - result.prevRetention}
                      </span>
                    )}
                  </p>
                </div>
              ) : (
                <p className="mb-4 text-sm text-slate-500">말한 내용을 저장했어요. 판정은 곧 붙습니다.</p>
              )}

              {Array.isArray(result.result) && result.result.length > 0 && (
                <div className="mb-4 space-y-1.5 border-t border-slate-100 pt-3">
                  {result.result.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="w-20 shrink-0 font-bold text-slate-600">{r.label}</span>
                      <span className={`w-4 font-black ${statusCls(r.status)}`}>{statusIcon(r.status)}</span>
                      <span className="flex-1 text-slate-600">{r.note}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="mb-3 text-xs text-slate-400">
                말한 시간 {result.duration_sec}초
                {result.first_point_sec != null && ` · 첫 핵심까지 ${result.first_point_sec}초`}
              </p>

              {Array.isArray(result.missions) && result.missions.length > 0 && (
                <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3">
                  <p className="mb-1 text-xs font-bold text-seum-blue">이번 미션</p>
                  {result.missions.map((m, i) => (
                    <p key={i} className="text-sm text-slate-700">{"①②③"[i] ?? "·"} {m}</p>
                  ))}
                </div>
              )}

              {result.transcript && (
                <div className="mb-4">
                  <button type="button" onClick={() => setShowTranscript((v) => !v)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700">
                    내가 말한 내용 {showTranscript ? "접기 ▴" : "보기 ▾"}
                  </button>
                  {showTranscript && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                      {result.transcript}
                    </p>
                  )}
                </div>
              )}
              {!result.transcript && (
                <p className="mb-4 text-xs text-red-500">말한 내용을 글로 옮기지 못했어요. 조금 더 크게 말해보세요.</p>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => setPhase("ready")}
                  className="flex-1 rounded-lg border border-seum-blue py-2.5 text-sm font-bold text-seum-blue hover:bg-blue-50">
                  다시 말하기
                </button>
                {level < 5 && (
                  <button type="button" onClick={() => { setLevel(level + 1); setPhase("ready"); setResult(null); }}
                    className="flex-1 rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4]">
                    다음 단계 →
                  </button>
                )}
              </div>
              {result.retention != null && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  {result.retention >= PASS
                    ? `${level}단계 통과! 다음 단계로 넘어가 보세요.`
                    : `유지율 ${PASS}%를 넘으면 이 단계를 통과해요. 다시 말해봐도 좋고, 다음 단계로 가도 돼요.`}
                </p>
              )}
            </div>
          ) : (
            // ── 가린 화면 · 준비 · 말하기 ──
            <>
              <div className="rounded-2xl bg-white/5 p-5">{renderCloze()}</div>

              <div className="mt-8 flex flex-col items-center gap-3">
                {phase === "ready" && (
                  <>
                    <p className="text-sm text-white/60">
                      처음부터 끝까지 말하되, 가려진 부분은 내 말로 풀어서 채워보세요. 글자 그대로 외울 필요는 없어요.
                    </p>
                    <button type="button" onClick={startPrep}
                      className="rounded-full bg-seum-blue px-8 py-3 text-base font-bold text-white hover:bg-[#2a63c4]">
                      준비 시작 ({PREP_SEC}초)
                    </button>
                  </>
                )}

                {phase === "prep" && (
                  <>
                    <p className="text-5xl font-black text-white">{prepLeft}</p>
                    <p className="text-sm text-white/60">준비 시간이 끝나면 녹음이 시작돼요</p>
                    <button type="button" onClick={startSpeak}
                      className="rounded-full border border-white/40 px-6 py-2 text-sm font-bold text-white hover:bg-white/10">
                      바로 말하기
                    </button>
                  </>
                )}

                {phase === "speak" && (
                  <>
                    <p className="flex items-center gap-2 text-3xl font-black text-white">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                      {fmt(speakSec)} / {fmt(SPEAK_SEC)}
                    </p>
                    <button type="button" onClick={stopSpeak}
                      className="rounded-full bg-red-500 px-8 py-3 text-base font-bold text-white hover:bg-red-600">
                      말하기 끝
                    </button>
                  </>
                )}

                {phase === "saving" && (
                  <p className="text-sm text-white/70">말한 내용을 정리하고 있어요...</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}