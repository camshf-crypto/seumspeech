import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * 현장 면접 대기 (학생 핸드폰 · 태블릿) — 비커스 LiveStudentRoom 에서 옮김
 *
 * 학원에서 선생님이 현장 모의면접을 진행할 때 학생 핸드폰으로 내 대답을 같이 녹음한다.
 *   선생님이 [녹음 시작] → 이 화면도 녹음 시작
 *   선생님이 [끝]       → 녹음을 멈추고 파일을 올린 뒤 선생님 화면에 알려 준다
 * 채널: live-mock-{내 id} (선생님 TeacherMockPanel 과 같은 이름)
 * 파일: simulation-recordings / {내 id}/live/{녹음 번호}.webm (아이폰은 .mp4)
 */

const BUCKET = "simulation-recordings";

function pickAudioType() {
  if (typeof MediaRecorder === "undefined") return { mime: "", ext: "webm" };
  if (MediaRecorder.isTypeSupported("audio/webm")) return { mime: "audio/webm", ext: "webm" };
  if (MediaRecorder.isTypeSupported("audio/mp4")) return { mime: "audio/mp4", ext: "mp4" };   // 아이폰 사파리
  return { mime: "", ext: "webm" };
}

const mmss = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export default function LiveMockRoom({ onClose }) {
  const [uid, setUid] = useState(null);
  const [stage, setStage] = useState("ask");   // ask | ready | rec | upload | err
  const [teacher, setTeacher] = useState(false);
  const [question, setQuestion] = useState("");
  const [msg, setMsg] = useState("");
  const [sec, setSec] = useState(0);
  const [lastSent, setLastSent] = useState(0);

  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const chRef = useRef(null);
  const recIdRef = useRef(null);
  const startedAtRef = useRef(0);
  const wakeRef = useRef(null);
  const timerRef = useRef(null);
  const uidRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUid(data.user?.id ?? null);
      uidRef.current = data.user?.id ?? null;
    });
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recRef.current?.state === "recording") recRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try { wakeRef.current?.release?.(); } catch (_) { /* 무시 */ }
      if (chRef.current) { chRef.current.untrack?.(); supabase.removeChannel(chRef.current); }
    };
  }, []);

  // 화면 꺼짐 방지 — 다른 앱 갔다 오면 다시 요청
  const keepAwake = async () => {
    try { wakeRef.current = await navigator.wakeLock?.request("screen"); } catch (_) { /* 지원 안 하는 기기 */ }
  };
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && stage !== "ask") keepAwake(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [stage]);

  // 녹음 파일 올리고 선생님 화면에 알려 줌 (실패해도 선생님 노트북 녹음으로 저장된다)
  const upload = async (mimeType) => {
    const recId = recIdRef.current;
    const me = uidRef.current;
    if (!recId || !me) return;
    setStage("upload");
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const blob = new Blob(chunksRef.current, { type: mimeType || `audio/${ext}` });
    const path = `${me}/live/${recId}.${ext}`;
    let ok = false;
    try {
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
      ok = !error;
      if (error) console.error("[현장 면접] 업로드 실패", error);
    } catch (e) {
      console.error("[현장 면접] 업로드 실패", e);
    }
    chRef.current?.send({ type: "broadcast", event: "uploaded", payload: { recId, path: ok ? path : null, startedAt: startedAtRef.current } });
    recIdRef.current = null;
    setQuestion("");
    if (ok) setLastSent((n) => n + 1);
    setStage("ready");
  };

  // 선생님이 녹음 시작
  const begin = (payload) => {
    if (!streamRef.current || recRef.current?.state === "recording") return;
    recIdRef.current = String(payload?.recId ?? "");
    setQuestion(String(payload?.question ?? ""));
    chunksRef.current = [];
    const { mime } = pickAudioType();
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => { upload(rec.mimeType || mime); };
    rec.start();
    recRef.current = rec;
    startedAtRef.current = Date.now();
    setSec(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setSec((s) => s + 1), 1000);
    setStage("rec");
  };

  // 선생님이 끝
  const finish = (recId) => {
    if (!recIdRef.current || recId !== recIdRef.current) return;
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (recRef.current?.state === "recording") recRef.current.stop();
  };

  // 마이크 켜고 대기
  const enable = async () => {
    if (!uid) { setMsg("로그인 정보를 확인할 수 없어요. 다시 로그인해 주세요."); setStage("err"); return; }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (_) {
      setMsg("마이크를 쓸 수 없어요. 주소창 왼쪽(아이폰은 aA 버튼) → 마이크 허용으로 바꾼 뒤 다시 눌러 주세요.");
      setStage("err");
      return;
    }
    await keepAwake();
    const ch = supabase.channel(`live-mock-${uid}`, { config: { broadcast: { self: false }, presence: { key: "student" } } });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState();
      setTeacher(!!st.teacher?.length);
    });
    ch.on("broadcast", { event: "start" }, ({ payload }) => begin(payload));
    ch.on("broadcast", { event: "stop" }, ({ payload }) => finish(String(payload?.recId ?? "")));
    ch.subscribe((status) => { if (status === "SUBSCRIBED") ch.track({ role: "student", mic: true }); });
    chRef.current = ch;
    setStage("ready");
  };

  const dark = stage === "rec";

  return (
    <div className={`fixed inset-0 z-[300] flex flex-col ${dark ? "bg-seum-navy text-white" : "bg-slate-50 text-seum-navy"}`}>
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="font-extrabold">현장 면접</div>
        {stage !== "rec" && stage !== "upload" && (
          <button type="button" onClick={onClose}
            className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600">나가기</button>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        {stage === "ask" && (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-4xl">🎙</div>
            <div className="text-2xl font-extrabold leading-snug">현장 면접 대기</div>
            <div className="text-[15px] leading-relaxed text-slate-600">
              선생님이 녹음을 시작하면<br />이 기기로 내 대답이 녹음돼요.
            </div>
            <button type="button" onClick={enable}
              className="h-16 w-full max-w-[320px] rounded-2xl bg-seum-blue text-lg font-extrabold text-white shadow-lg">
              마이크 켜고 대기하기
            </button>
            <div className="text-[13px] text-slate-500">마이크를 물어보면 <b>허용</b>을 눌러 주세요</div>
          </>
        )}

        {stage === "ready" && (
          <>
            <div className={`flex items-center gap-2 text-[15px] font-bold ${teacher ? "text-emerald-700" : "text-amber-800"}`}>
              <span className={`h-3 w-3 rounded-full ${teacher ? "bg-emerald-500" : "bg-amber-500"}`} />
              {teacher ? "선생님과 연결됐어요" : "선생님 화면을 기다리는 중"}
            </div>
            <div className="text-2xl font-extrabold leading-snug">내 차례가 되면<br />자동으로 녹음돼요</div>
            <div className="w-full max-w-[340px] rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm leading-loose text-slate-700">
              · <b>화면을 켜 둔 채로</b> 두세요 (잠금 버튼 누르면 녹음이 안 돼요)<br />
              · 다른 앱으로 나가지 마세요<br />
              · <b>방해금지 모드</b>를 켜 두면 알림 소리가 안 들어가요<br />
              · 핸드폰은 입 앞 30cm쯤에 두세요
            </div>
            {lastSent > 0 && <div className="text-[13px] text-slate-500">대답 {lastSent}개를 선생님께 보냈어요</div>}
          </>
        )}

        {stage === "rec" && (
          <>
            <div className="flex items-center gap-2 text-[15px] font-bold text-red-300">
              <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-red-500" />
              녹음 중 {mmss(sec)}
            </div>
            <div className="text-3xl font-extrabold leading-tight">지금 대답하세요</div>
            {question && (
              <div className="w-full max-w-[380px] rounded-2xl bg-white/10 p-5 text-left">
                <div className="mb-1.5 text-xs font-bold text-slate-300">질문</div>
                <div className="text-lg font-bold leading-relaxed">{question}</div>
              </div>
            )}
            <div className="text-[13px] text-slate-400">선생님이 끝을 누르면 자동으로 멈춰요</div>
          </>
        )}

        {stage === "upload" && (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-seum-blue" />
            <div className="text-lg font-bold">대답을 보내는 중…</div>
          </>
        )}

        {stage === "err" && (
          <>
            <div className="text-lg font-bold text-red-600">{msg}</div>
            <button type="button" onClick={() => setStage("ask")}
              className="h-12 rounded-xl bg-seum-blue px-6 text-[15px] font-bold text-white">다시 하기</button>
          </>
        )}
      </div>
    </div>
  );
}