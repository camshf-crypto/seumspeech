import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const MAX_TURNS = 3;

export default function DebateSession({ question, studentId, existingAnswer, onSaved, onExit }) {
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
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const logRef = useRef(null);

  const done = turn > MAX_TURNS;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [history, aiThinking]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  }, []);

  const toggleRecord = async () => {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timerRef.current);
        setRecording(false);
        setElapsed(0);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        await sendToStt(blob);
      };

      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((v) => v + 1), 1000);
    } catch (e) {
      alert("마이크를 사용할 수 없습니다. 직접 입력을 이용해주세요.\n" + e.message);
      setTyping(true);
    }
  };

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
          topic: question.question,
          my_stance: stance,
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

  const finish = async () => {
    if (history.length === 0) return alert("토론 내용이 없습니다.");
    if (!window.confirm("토론을 종료하고 저장할까요? AI 피드백이 자동으로 생성됩니다.")) return;

    setSaving(true);
    try {
      const transcript =
        `[토론 주제] ${question.question}\n[내 입장] ${stance}\n\n` +
        history.map((h) => `${h.role === "student" ? "나" : "상대"}: ${h.text}`).join("\n\n");

      let feedback = "";
      try {
        const { data } = await supabase.functions.invoke("interview-debate", {
          body: {
            mode: "feedback",
            topic: question.question,
            my_stance: stance,
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

      alert("토론이 저장되었습니다.");
      onSaved?.();
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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

        <p className="mb-1 text-xs font-bold text-slate-400">토론 주제</p>
        <p className="mb-6 text-lg font-bold text-seum-navy">{question.question}</p>

        {existingAnswer?.submitted_at && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            이미 완료한 토론이 있습니다. 새로 시작하면 기존 기록이 덮어써집니다.
          </div>
        )}

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

        <div className="mb-6 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          실제 집단토론처럼 <b className="text-slate-700">3회</b> 발언합니다.<br />
          발언 → 상대 반론 → 재반박 → 상대 재반론 → 최종 정리 순서로 진행됩니다.<br />
          마이크로 말하거나 직접 입력할 수 있습니다.
        </div>

        <button
          type="button"
          onClick={() => setStarted(true)}
          disabled={!stance}
          className="w-full rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-40"
        >
          토론 시작
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-0.5 text-[11px] text-slate-400">토론 주제</p>
            <p className="text-sm font-bold text-seum-navy">{question.question}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-seum-blue">
            {done ? "발언 완료" : `발언 ${turn} / ${MAX_TURNS}`}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-slate-400">내 입장</span>
          <span className="rounded bg-seum-blue px-2 py-0.5 font-bold text-white">{stance}</span>
          <span className="text-slate-400">상대</span>
          <span className="rounded bg-slate-200 px-2 py-0.5 font-bold text-slate-600">
            {stance === "찬성" ? "반대" : "찬성"}
          </span>
        </div>
      </div>

      <div ref={logRef} className="max-h-[420px] space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
        {history.length === 0 && !aiThinking && (
          <p className="py-10 text-center text-sm text-slate-400">
            모두발언으로 본인의 입장과 근거를 말해주세요.
          </p>
        )}

        {history.map((h, i) =>
          h.role === "ai" ? (
            <div key={i} className="flex gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
                상대
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
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
              상대
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
              {saving ? "저장하고 AI 피드백 생성 중..." : "토론 종료하고 저장"}
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