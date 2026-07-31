import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

// 배포된 Edge Function만 등록. 없으면 fallback.
const FN_MAP = {
  gov: "interview-ai-gov",
  public_corp: "interview-ai-public",
};
const FN_FALLBACK = "interview-ai-feedback";
const getFnName = (categoryKey) => FN_MAP[categoryKey] ?? FN_FALLBACK;

const mmss = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function PtPractice({ studentId, categoryKey, subKey, locked = false }) {
  // step: list | prep | speak | result
  const [step, setStep] = useState("list");
  const [topics, setTopics] = useState([]);
  const [sessions, setSessions] = useState([]);   // 내 연습 기록 전체
  const [loading, setLoading] = useState(true);

  const [topic, setTopic] = useState(null);
  const [outline, setOutline] = useState("");
  const [prepLeft, setPrepLeft] = useState(0);
  const [speakLeft, setSpeakLeft] = useState(0);
  const [showOutline, setShowOutline] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState("");        // 저장 단계 안내문
  const [result, setResult] = useState(null);      // 방금 끝낸 pt_sessions 행
  const [aiLoading, setAiLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordedMimeRef = useRef("audio/webm");
  const recordStartRef = useRef(0);
  const timerRef = useRef(null);

  // ── 데이터 로드 ─────────────────────────────
  const load = async () => {
    setLoading(true);
    // PT 주제는 지역(sub_key) 구분 없이 전 지역 공통으로 쓴다.
    const { data: tp, error: tErr } = await supabase
      .from("pt_topics")
      .select("*")
      .eq("category_key", categoryKey)
      .eq("is_active", true)
      .order("seq");
    if (tErr) console.error("pt_topics 조회 실패:", tErr);

    const { data: ss, error: sErr } = await supabase
      .from("pt_sessions")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (sErr) console.error("pt_sessions 조회 실패:", sErr);

    setTopics(tp ?? []);
    setSessions(ss ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [studentId, categoryKey, subKey]);

  // 마이크 정리
  useEffect(() => () => {
    clearInterval(timerRef.current);
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // ── 준비 시간 카운트다운 ─────────────────────
  useEffect(() => {
    if (step !== "prep") return;
    timerRef.current = setInterval(() => {
      setPrepLeft((v) => {
        if (v <= 1) { clearInterval(timerRef.current); return 0; }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  // ── 발표 시간 카운트다운 ─────────────────────
  useEffect(() => {
    if (step !== "speak") return;
    timerRef.current = setInterval(() => {
      setSpeakLeft((v) => {
        if (v <= 1) {
          clearInterval(timerRef.current);
          finishSpeaking();   // 시간 다 되면 자동 종료
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [step]);

  // ── 녹음 ────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = candidates.find(
        (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)
      ) || "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordedMimeRef.current = recorder.mimeType || mimeType || "audio/webm";
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      recordStartRef.current = Date.now();
      setIsRecording(true);
      return true;
    } catch (e) {
      console.error(e);
      alert("마이크 권한이 필요해요. 브라우저 설정에서 허용해주세요.");
      return false;
    }
  };

  const stopRecording = () =>
    new Promise((resolve) => {
      const rec = mediaRecorderRef.current;
      if (!rec || rec.state === "inactive") { resolve({ blob: null, durationSec: 0 }); return; }
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recordedMimeRef.current || "audio/webm" });
        const durationSec = Math.floor((Date.now() - recordStartRef.current) / 1000);
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        setIsRecording(false);
        resolve({ blob, durationSec });
      };
      rec.stop();
    });

  const runStt = async (blob) => {
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
      const data = await res.json();
      return data?.success && data?.text ? data.text : "";
    } catch (e) {
      console.error("STT 실패:", e);
      return "";
    }
  };

  // ── 흐름 ────────────────────────────────────
  const pickTopic = (t) => {
    setTopic(t);
    setOutline("");
    setPrepLeft(t.prep_seconds ?? 600);
    setSpeakLeft(t.speak_seconds ?? 300);
    setResult(null);
    setStep("prep");
  };

  const goSpeak = async () => {
    const ok = await startRecording();
    if (!ok) return;
    setSpeakLeft(topic.speak_seconds ?? 300);
    setStep("speak");
  };

  const finishSpeaking = async () => {
    clearInterval(timerRef.current);
    setSaving("녹음 정리 중...");
    const { blob, durationSec } = await stopRecording();

    let audioPath = null;
    if (blob) {
      setSaving("녹음 파일 저장 중...");
      const ext = recordedMimeRef.current.includes("mp4") ? "m4a" : "webm";
      const path = `pt/${studentId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("simulation-recordings")
        .upload(path, blob, { contentType: recordedMimeRef.current, upsert: true });
      if (upErr) console.error("녹음 업로드 실패:", upErr);
      else audioPath = path;
    }

    setSaving("발표 내용을 글로 옮기는 중...");
    const transcript = blob ? await runStt(blob) : "";

    setSaving("저장 중...");
    const { data, error } = await supabase
      .from("pt_sessions")
      .insert({
        topic_id: topic.id,
        student_id: studentId,
        outline: outline || null,
        audio_path: audioPath,
        transcript: transcript || null,
        spoke_seconds: durationSec,
      })
      .select()
      .maybeSingle();

    setSaving("");
    if (error) {
      alert("저장 실패: " + error.message);
      setStep("prep");
      return;
    }

    setResult(data);
    setStep("result");
    load();
  };

  const genAiFeedback = async () => {
    if (!result?.transcript?.trim()) return alert("발표 내용이 인식되지 않아 피드백을 만들 수 없습니다.");
    setAiLoading(true);
    try {
      const fnName = getFnName(categoryKey);
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: {
          category_key: categoryKey,
          sub_key: subKey,
          tab_key: "pt",
          question:
            `[PT 발표 제시문]\n${topic.passage}\n\n` +
            `위 제시문으로 진행한 ${Math.round((topic.speak_seconds ?? 300) / 60)}분 발표입니다. ` +
            `내용 구성(서론-본론-결론), 논리, 근거의 타당성, 시간 배분, 전달력 관점에서 평가해주세요.`,
          answer: result.transcript,
        },
      });
      if (error) throw new Error(error.message);
      const text = data?.feedback || data?.text || "";
      if (!text) throw new Error(data?.error || "AI 응답이 비어 있습니다.");

      const { data: updated, error: uErr } = await supabase
        .from("pt_sessions")
        .update({ ai_feedback: text })
        .eq("id", result.id)
        .select()
        .maybeSingle();
      if (uErr) throw uErr;

      setResult(updated);
      load();
    } catch (e) {
      alert("AI 피드백 실패:\n\n" + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const exitToList = () => {
    clearInterval(timerRef.current);
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    setStep("list");
    setTopic(null);
    setResult(null);
  };

  // ── 화면 ────────────────────────────────────
  if (loading) return <p className="py-10 text-center text-slate-400">불러오는 중...</p>;

  // 저장 진행 중
  if (saving) {
    return (
      <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        <p className="text-sm">{saving}</p>
        <p className="mt-2 text-xs text-white/50">창을 닫지 마세요.</p>
      </div>
    );
  }

  // 발표 중 (전체화면)
  if (step === "speak") {
    const over = speakLeft <= 0;
    return (
      <div className="fixed inset-0 z-[300] flex flex-col bg-slate-900 p-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-white/50">발표 중</p>
            <p className="font-bold">{topic.title}</p>
          </div>
          <div className={`text-3xl font-black tabular-nums ${speakLeft <= 30 ? "text-red-400" : ""}`}>
            {mmss(speakLeft)}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${isRecording ? "animate-pulse bg-red-500" : "bg-white/30"}`} />
          <span className="text-sm text-white/70">{isRecording ? "녹음 중" : "녹음 대기"}</span>
          <button type="button" onClick={() => setShowOutline((v) => !v)}
            className="ml-auto rounded-lg border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10">
            {showOutline ? "개요 숨기기" : "개요 보기"}
          </button>
        </div>

        {showOutline && (
          <div className="mb-4 flex-1 overflow-y-auto rounded-xl bg-white/5 p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/40">내 개요</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
              {outline || "작성한 개요가 없습니다."}
            </p>
          </div>
        )}

        <button type="button" onClick={finishSpeaking}
          className="w-full rounded-xl bg-red-500 py-4 text-lg font-bold text-white hover:bg-red-600">
          발표 종료
        </button>
        {over && <p className="mt-2 text-center text-xs text-red-300">시간이 종료되었습니다.</p>}
      </div>
    );
  }

  // 준비 시간
  if (step === "prep") {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">PT 발표 준비</p>
            <h3 className="text-lg font-bold text-seum-navy">{topic.title}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">남은 준비 시간</p>
            <p className={`text-2xl font-black tabular-nums ${prepLeft <= 60 ? "text-red-500" : "text-seum-navy"}`}>
              {mmss(prepLeft)}
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">제시문</p>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{topic.passage}</p>
          {topic.image_url && (
            <img src={topic.image_url} alt="제시 자료" className="mt-4 w-full rounded-lg border border-slate-200" />
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">발표 개요</label>
          <textarea
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            rows={8}
            disabled={locked}
            placeholder={"서론 - 문제 제기\n본론 1 -\n본론 2 -\n결론 - 대책 및 각오"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-seum-blue disabled:bg-slate-50"
          />
          <p className="mt-1 text-xs text-slate-400">발표 중에도 이 개요를 볼 수 있습니다.</p>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={exitToList}
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50">
            그만두기
          </button>
          <button type="button" onClick={goSpeak} disabled={locked}
            className="flex-1 rounded-lg bg-seum-blue py-3 font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
            발표 시작 ({mmss(topic.speak_seconds ?? 300)})
          </button>
        </div>
      </div>
    );
  }

  // 결과
  if (step === "result" && result) {
    return (
      <div>
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="font-bold text-green-700">발표를 마쳤습니다</p>
          <p className="mt-0.5 text-sm text-green-600">
            {topic.title} · 발표 시간 {mmss(result.spoke_seconds ?? 0)}
            {topic.speak_seconds ? ` / 목표 ${mmss(topic.speak_seconds)}` : ""}
          </p>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">내 발표 내용</p>
          {result.transcript ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{result.transcript}</p>
          ) : (
            <p className="text-sm text-slate-400">음성 인식 결과가 없습니다. 녹음은 저장되었습니다.</p>
          )}
        </div>

        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-black tracking-wide text-seum-blue">AI 발표 피드백</p>
            <button type="button" onClick={genAiFeedback} disabled={aiLoading}
              className="rounded-md border border-seum-blue px-3 py-1 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-50">
              {aiLoading ? "생성 중..." : result.ai_feedback ? "🔄 다시 받기" : "✨ 피드백 받기"}
            </button>
          </div>
          {result.ai_feedback ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{result.ai_feedback}</p>
          ) : (
            <p className="text-sm text-slate-400">
              {aiLoading ? "발표 내용을 분석하고 있습니다. 10~20초 걸려요." : "버튼을 누르면 발표 내용을 분석해 드립니다."}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={exitToList}
            className="flex-1 rounded-lg border border-slate-300 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
            주제 목록으로
          </button>
          <button type="button" onClick={() => pickTopic(topic)}
            className="flex-1 rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4]">
            이 주제 다시 연습
          </button>
        </div>
      </div>
    );
  }

  // 주제 목록
  const countOf = (topicId) => sessions.filter((s) => s.topic_id === topicId).length;
  const lastOf = (topicId) => sessions.find((s) => s.topic_id === topicId);

  return (
    <div>
      <div className="mb-4 rounded-xl border border-seum-blue/20 bg-seum-blue/5 p-4 text-sm text-slate-600">
        <b className="text-seum-navy">📢 PT 발표 연습</b><br />
        주제를 고르면 <b>제시문 확인 → 개요 작성(준비 시간) → 발표 녹음</b> 순으로 진행됩니다.
        발표가 끝나면 음성이 글로 옮겨지고 AI 피드백을 받을 수 있어요.
      </div>

      {topics.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          등록된 PT 주제가 아직 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {topics.map((t, i) => {
            const cnt = countOf(t.id);
            const last = lastOf(t.id);
            return (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-seum-navy">
                      <span className="mr-1 text-slate-400">{i + 1}.</span>
                      {t.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{t.passage}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      준비 {mmss(t.prep_seconds ?? 600)} · 발표 {mmss(t.speak_seconds ?? 300)}
                      {cnt > 0 && ` · 연습 ${cnt}회`}
                      {last && ` · 최근 ${fmtDate(last.created_at)}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => pickTopic(t)} disabled={locked}
                    className="shrink-0 rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-40">
                    {cnt > 0 ? "다시 연습" : "연습 시작"}
                  </button>
                </div>

                {cnt > 0 && (
                  <details className="mt-3 border-t border-slate-100 pt-2">
                    <summary className="cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-700">
                      지난 발표 기록 {cnt}건
                    </summary>
                    <div className="mt-2 space-y-2">
                      {sessions.filter((s) => s.topic_id === t.id).map((s) => (
                        <div key={s.id} className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-xs font-medium text-slate-500">
                            {fmtDate(s.created_at)} · {mmss(s.spoke_seconds ?? 0)}
                            {s.teacher_feedback ? " · 선생님 피드백 있음" : s.ai_feedback ? " · AI 피드백 있음" : ""}
                          </p>
                          {s.transcript && (
                            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{s.transcript}</p>
                          )}
                          {s.teacher_feedback && (
                            <p className="mt-2 whitespace-pre-wrap border-l-2 border-seum-blue pl-2 text-xs leading-relaxed text-slate-700">
                              {s.teacher_feedback}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}