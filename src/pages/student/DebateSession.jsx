import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const MAX_TURNS = 3;

export default function DebateSession({ question, studentId, existingAnswer, onSaved, onExit }) {
  // 찬반형 여부 — DB의 debate_type 기준 (없으면 토의형으로 간주)
  const isProsCons = question?.debate_type === "pros_cons";

  const [stance, setStance] = useState(null);
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState([]);
  const [turn, setTurn] = useState(1);
  const [aiThinking, setAiThinking] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);

  const [recording, setRecording] = useState(false);
  const [sttLoading, setSttLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const timerRef = useRef(null);
  const logRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const pcmRef = useRef([]);
  const sampleRateRef = useRef(16000);

  const done = turn > MAX_TURNS;
  // 찬반형만 입장 선택 필요, 토의형은 바로 시작 가능
  const canStart = isProsCons ? !!stance : true;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [history, aiThinking]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      processorRef.current?.disconnect();
      processorRef.current?._stream?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    } catch (_) {}
  }, []);

  // ── 녹음 시작 (WebAudio로 PCM 수집)
  const toggleRecord = async () => {
    if (recording) {
      stopRecord();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      sampleRateRef.current = ctx.sampleRate;
      pcmRef.current = [];

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const ch = e.inputBuffer.getChannelData(0);
        pcmRef.current.push(new Float32Array(ch));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      processor._stream = stream;
      processor._source = source;

      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((v) => v + 1), 1000);
    } catch (e) {
      alert("마이크를 사용할 수 없습니다. 직접 입력을 이용해주세요.\n" + e.message);
      setTyping(true);
    }
  };

  // ── 녹음 종료 → wav 변환 → STT 전송
  const stopRecord = () => {
    clearInterval(timerRef.current);
    setRecording(false);
    setElapsed(0);

    const processor = processorRef.current;
    if (!processor) return;

    processor.disconnect();
    processor._source?.disconnect();
    processor._stream?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();

    const chunks = pcmRef.current;
    const len = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Float32Array(len);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }

    if (len < 8000) {
      alert("녹음이 너무 짧습니다. 조금 더 길게 말해주세요.");
      return;
    }

    const wav = encodeWav(merged, sampleRateRef.current, 16000);
    sendToStt(wav);
  };

  // ── Float32 PCM → 16kHz 16bit WAV Blob
  const encodeWav = (samples, inRate, outRate) => {
    let data = samples;
    if (outRate !== inRate) {
      const ratio = inRate / outRate;
      const newLen = Math.round(samples.length / ratio);
      const res = new Float32Array(newLen);
      for (let i = 0; i < newLen; i++) res[i] = samples[Math.floor(i * ratio)];
      data = res;
    }

    const buffer = new ArrayBuffer(44 + data.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + data.length * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, outRate, true);
    view.setUint32(28, outRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, data.length * 2, true);

    let o = 44;
    for (let i = 0; i < data.length; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([view], { type: "audio/wav" });
  };

  // ── STT 전송
  const sendToStt = async (blob) => {
    setSttLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stt-clova`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "음성 인식 실패");
      setDraft((prev) => (prev ? prev + " " : "") + (data.text || ""));
    } catch (e) {
      alert("음성 인식에 실패했습니다. 직접 입력해주세요.\n" + e.message);
      setTyping(true);
    } finally {
      setSttLoading(false);
    }
  };

  // ── 발언 전송
  const submitTurn = async () => {
    const text = draft.trim();
    if (!text) return alert("발언 내용을 입력하거나 녹음해주세요.");

    const nextHistory = [...history, { role: "student", text }];
    setHistory(nextHistory);
    setDraft("");
    setAiThinking(true);

    try {
      const { data, error } = await supabase.functions.invoke("interview-debate", {
        body: {
          mode: "reply",
          debate_type: isProsCons ? "pros_cons" : "discussion",
          topic: question.question,
          my_stance: isProsCons ? stance : null,
          history: nextHistory,
          turn,
        },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "AI 응답 실패");
      setHistory([...nextHistory, { role: "ai", text: data.text }]);
    } catch (e) {
      alert("AI 오류: " + e.message);
      setHistory(nextHistory);
    } finally {
      setAiThinking(false);
      setTurn((v) => v + 1);
    }
  };

  // ── 종료 + 저장 + 자동 피드백
  const finish = async () => {
    if (history.length === 0) return alert("토론 내용이 없습니다.");
    if (!window.confirm("토론을 종료하고 저장할까요? AI 피드백이 자동으로 생성됩니다.")) return;

    setSaving(true);
    try {
      const header = isProsCons
        ? `[토론 주제] ${question.question}\n[내 입장] ${stance}\n\n`
        : `[토의 주제] ${question.question}\n\n`;

      const transcript =
        header +
        history
          .map((h) => `${h.role === "student" ? "나" : isProsCons ? "상대" : "동료"}: ${h.text}`)
          .join("\n\n");

      let feedback = "";
      try {
        const { data } = await supabase.functions.invoke("interview-debate", {
          body: {
            mode: "feedback",
            debate_type: isProsCons ? "pros_cons" : "discussion",
            topic: question.question,
            my_stance: isProsCons ? stance : null,
            history,
          },
        });
        if (data?.success) feedback = data.feedback || "";
      } catch (e) {
        console.error("피드백 생성 실패:", e.message);
      }

      const now = new Date().toISOString();
      const payload = {
        question_id: question.id,
        student_id: studentId,
        student_answer: transcript,
        answered_at: now,
        submitted_at: now,
        updated_at: now,
      };
      if (feedback) {
        payload.ai_draft = feedback;
        payload.teacher_feedback = feedback;
        payload.feedback_at = now;
      }

      const { error } = await supabase
        .from("interview_answers_v2")
        .upsert(payload, { onConflict: "question_id,student_id" });
      if (error) throw error;

      alert(isProsCons ? "토론이 저장되었습니다." : "토의가 저장되었습니다.");
      onSaved?.();
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── 시작 전 화면
  if (!started) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <button
          type="button"
          onClick={onExit}
          className="mb-4 text-xs font-bold text-slate-400 hover:text-slate-600"
        >
          ← 주제 목록으로
        </button>

        <div className="mb-1 flex items-center gap-2">
          <p className="text-xs font-bold text-slate-400">
            {isProsCons ? "토론 주제" : "토의 주제"}
          </p>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              isProsCons ? "bg-blue-50 text-seum-blue" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {isProsCons ? "찬반형" : "토의형"}
          </span>
        </div>
        <p className="mb-6 text-lg font-bold text-seum-navy">{question.question}</p>

        {existingAnswer?.submitted_at && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            이미 완료한 기록이 있습니다. 새로 시작하면 기존 기록이 덮어써집니다.
          </div>
        )}

        {isProsCons && (
          <>
            <p className="mb-2 text-sm font-bold text-slate-600">내 입장을 선택하세요</p>
            <div className="mb-6 flex gap-2">
              {["찬성", "반대"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStance(s)}
                  className={`rounded-lg px-6 py-2 text-sm font-bold transition ${
                    stance === s
                      ? "bg-seum-blue text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mb-6 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          {isProsCons ? (
            <>
              실제 집단토론처럼 <b className="text-slate-700">3회</b> 발언합니다.
              <br />
              발언 → 상대 반론 → 재반박 → 상대 재반론 → 최종 정리 순서로 진행됩니다.
              <br />
              마이크로 말하거나 직접 입력할 수 있습니다.
            </>
          ) : (
            <>
              찬반을 나누지 않고 <b className="text-slate-700">함께 방안을 도출</b>하는 토의입니다.
              <br />
              실제 집단토의처럼 <b className="text-slate-700">3회</b> 발언하며, 동료 토의자가 다른
              관점과 보완점을 제시합니다.
              <br />
              마이크로 말하거나 직접 입력할 수 있습니다.
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setStarted(true)}
          disabled={!canStart}
          className="w-full rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-40"
        >
          {isProsCons ? "토론 시작" : "토의 시작"}
        </button>
      </div>
    );
  }

  // ── 진행 화면
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-0.5 text-[11px] text-slate-400">
              {isProsCons ? "토론 주제" : "토의 주제"}
            </p>
            <p className="text-sm font-bold text-seum-navy">{question.question}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-seum-blue">
            {done ? "발언 완료" : `발언 ${turn} / ${MAX_TURNS}`}
          </span>
        </div>

        {isProsCons ? (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-slate-400">내 입장</span>
            <span className="rounded bg-seum-blue px-2 py-0.5 font-bold text-white">{stance}</span>
            <span className="text-slate-400">상대</span>
            <span className="rounded bg-slate-200 px-2 py-0.5 font-bold text-slate-600">
              {stance === "찬성" ? "반대" : "찬성"}
            </span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-600">
              토의형
            </span>
            <span className="text-slate-400">동료와 함께 방안을 도출합니다</span>
          </div>
        )}
      </div>

      <div ref={logRef} className="max-h-[420px] space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
        {history.length === 0 && !aiThinking && (
          <p className="py-10 text-center text-sm text-slate-400">
            {isProsCons
              ? "모두발언으로 본인의 입장과 근거를 말해주세요."
              : "모두발언으로 주제에 대한 본인의 생각과 방안을 말해주세요."}
          </p>
        )}

        {history.map((h, i) =>
          h.role === "ai" ? (
            <div key={i} className="flex gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isProsCons ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {isProsCons ? "상대" : "동료"}
              </span>
              <div className="max-w-[80%] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{h.text}</p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-end gap-2">
              <div className="max-w-[80%] rounded-xl bg-seum-blue px-3.5 py-2.5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">{h.text}</p>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-seum-blue text-[11px] font-bold text-white">
                나
              </span>
            </div>
          )
        )}

        {aiThinking && (
          <div className="flex gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                isProsCons ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isProsCons ? "상대" : "동료"}
            </span>
            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
              <p className="text-sm text-slate-400">생각하는 중...</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        {done ? (
          <div className="text-center">
            <p className="mb-3 text-sm font-bold text-slate-600">3회 발언이 모두 끝났습니다.</p>
            <button
              type="button"
              onClick={finish}
              disabled={saving}
              className="w-full rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50"
            >
              {saving
                ? "저장하고 AI 피드백 생성 중..."
                : isProsCons
                ? "토론 종료하고 저장"
                : "토의 종료하고 저장"}
            </button>
          </div>
        ) : (
          <>
            {(draft || typing) && (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="발언 내용을 입력하세요."
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
              />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleRecord}
                disabled={aiThinking || sttLoading}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-white transition disabled:opacity-40 ${
                  recording ? "bg-red-500 animate-pulse" : "bg-seum-blue hover:bg-[#2a63c4]"
                }`}
              >
                {recording ? "■" : "🎤"}
              </button>

              <div className="min-w-0 flex-1">
                {recording ? (
                  <p className="text-sm font-bold text-red-500">듣고 있습니다... {mmss(elapsed)}</p>
                ) : sttLoading ? (
                  <p className="text-sm text-slate-500">음성을 텍스트로 변환 중...</p>
                ) : (
                  <p className="text-sm text-slate-400">마이크를 눌러 말하거나 직접 입력하세요</p>
                )}
                <p className="text-[11px] text-slate-400">
                  {recording ? "말을 마치면 버튼을 다시 눌러주세요" : `${turn}번째 발언`}
                </p>
              </div>

              {!typing && !draft && (
                <button
                  type="button"
                  onClick={() => setTyping(true)}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  직접 입력
                </button>
              )}

              {draft.trim() && (
                <button
                  type="button"
                  onClick={submitTurn}
                  disabled={aiThinking || recording || sttLoading}
                  className="shrink-0 rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50"
                >
                  발언
                </button>
              )}
            </div>
          </>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
          <span className="text-[11px] text-slate-400">
            종료하면 대화 전체가 저장되고 AI 피드백이 생성됩니다
          </span>
          {!done && history.length > 0 && (
            <button
              type="button"
              onClick={finish}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "지금 종료"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}