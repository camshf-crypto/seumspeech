// src/pages/teacher/TeacherOnlineRoom.jsx
// 방 강사 화면 · 온라인 단체반 실습
//  1) 내가 맡은 방 선택 → 발표 순서대로 학생 목록
//  2) 학생 차례마다 녹음 (발표 + 피드백 + 다시 말하기) → 업로드 → AI 피드백 초안
//  3) 초안 수정·확정 + 숙제 확인
//  4) 수업 종료 → 피드백·숙제 전체 전달
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const TAG_LABELS = { speed: "말 속도", filler: "군말", pause: "멈춤", volume: "목소리 크기", tone: "억양", structure: "구조", time: "시간" };
const STATUS_LABEL = { draft: "초안", confirmed: "확정", sent: "전달 완료" };

export default function TeacherOnlineRoom() {
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [members, setMembers] = useState([]);
  const [feedbacks, setFeedbacks] = useState({}); // student_id → feedback row
  const [homework, setHomework] = useState({});   // student_id → homework draft
  const [recordingFor, setRecordingFor] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [working, setWorking] = useState({});     // student_id → '업로드 중' 등
  const [msg, setMsg] = useState("");

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);

  const room = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);

  // ── 내 방 목록 (최근 회차 순)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user);
      const { data, error } = await supabase
        .from("practice_rooms")
        .select("id, room_no, session_id, online_sessions ( id, week_no, starts_at, course_id, courses ( title ) )")
        .eq("coach_id", user.id);
      if (error) return setMsg(`방 조회 실패: ${error.message}`);
      const sorted = (data || []).sort(
        (a, b) => new Date(b.online_sessions.starts_at) - new Date(a.online_sessions.starts_at)
      );
      setRooms(sorted);
      if (sorted[0]) setRoomId(sorted[0].id);
    })();
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (room) loadRoom();
  }, [roomId]);

  async function loadRoom() {
    const { data: ms, error: e1 } = await supabase
      .from("practice_room_members")
      .select("speak_order, profiles:student_id ( id, name )")
      .eq("room_id", roomId)
      .order("speak_order");
    if (e1) return setMsg(`학생 조회 실패: ${e1.message}`);
    const list = (ms || []).map((m) => m.profiles).filter(Boolean);
    setMembers(list);

    const ids = list.map((s) => s.id);
    const sid = room.session_id;
    const [{ data: fbs }, { data: hws }] = await Promise.all([
      supabase.from("practice_feedbacks").select("*").eq("session_id", sid).in("student_id", ids),
      supabase.from("online_homework").select("*").eq("session_id", sid).in("student_id", ids),
    ]);
    setFeedbacks(Object.fromEntries((fbs || []).map((f) => [f.student_id, f])));
    setHomework(Object.fromEntries((hws || []).map((h) => [h.student_id, h])));
  }

  // ── 녹음
  async function startRecording(studentId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const sec = Math.round((Date.now() - startedAtRef.current) / 1000);
        uploadAndDraft(studentId, blob, sec);
      };
      rec.start(1000);
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecordingFor(studentId);
      timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    } catch (e) {
      setMsg(`마이크를 켤 수 없어요: ${e.message}`);
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecordingFor(null);
  }

  // ── 업로드 → 녹음 기록 → AI 초안
  async function uploadAndDraft(studentId, blob, sec) {
    const mark = (t) => setWorking((w) => ({ ...w, [studentId]: t }));
    mark("업로드 중");
    const path = `${room.session_id}/${roomId}/${studentId}-${Date.now()}.webm`;
    const { error: upErr } = await supabase.storage.from("room-recordings").upload(path, blob, { contentType: "audio/webm" });
    if (upErr) { mark(""); return setMsg(`업로드 실패: ${upErr.message}`); }

    const { data: rec, error: recErr } = await supabase
      .from("room_recordings")
      .insert({ room_id: roomId, student_id: studentId, storage_path: path, duration_sec: sec })
      .select("id")
      .single();
    if (recErr) { mark(""); return setMsg(`녹음 기록 실패: ${recErr.message}`); }

    mark("AI 분석 중");
    const { data, error } = await supabase.functions.invoke("online-room-feedback", {
      body: { recording_id: rec.id },
    });
    mark("");
    if (error) return setMsg(`AI 피드백 실패: ${error.message} — 직접 작성해도 돼요.`);
    if (data?.feedback) setFeedbacks((f) => ({ ...f, [studentId]: data.feedback }));
    if (data?.homework) setHomework((h) => ({ ...h, [studentId]: { ...h[studentId], ...data.homework } }));
  }

  // ── 피드백 수정·확정
  function editFeedback(studentId, patch) {
    setFeedbacks((f) => ({ ...f, [studentId]: { ...(f[studentId] || {}), ...patch } }));
  }

  function editHomework(studentId, patch) {
    setHomework((h) => ({ ...h, [studentId]: { ...(h[studentId] || {}), ...patch } }));
  }

  async function saveFeedback(studentId, status = "confirmed") {
    const f = feedbacks[studentId] || {};
    const row = {
      session_id: room.session_id,
      student_id: studentId,
      coach_id: me.id,
      recording_id: f.recording_id || null,
      good_point: f.good_point || "",
      fix_point: f.fix_point || "",
      improved: f.improved || "",
      tags: f.tags || [],
      ai_draft: f.ai_draft || null,
      status,
    };
    const { data, error } = await supabase
      .from("practice_feedbacks")
      .upsert(row, { onConflict: "session_id,student_id" })
      .select()
      .single();
    if (error) return setMsg(`피드백 저장 실패: ${error.message}`);
    setFeedbacks((x) => ({ ...x, [studentId]: data }));
    setMsg("저장했어요.");
  }

  // ── 수업 종료: 확정된 피드백 전달 + 숙제 생성
  async function sendAll() {
    const notReady = members.filter((m) => !["confirmed", "sent"].includes(feedbacks[m.id]?.status));
    if (notReady.length && !confirm(`확정 안 된 학생 ${notReady.length}명(${notReady.map((m) => m.name).join(", ")})은 빼고 전달할까요?`)) return;

    // 숙제 마감: 다음 회차 시작 이틀 전 (다음 회차가 없으면 5일 뒤)
    const s = room.online_sessions;
    const { data: next } = await supabase
      .from("online_sessions")
      .select("starts_at")
      .eq("course_id", s.course_id)
      .eq("week_no", s.week_no + 1)
      .maybeSingle();
    const due = next
      ? new Date(new Date(next.starts_at).getTime() - 2 * 864e5)
      : new Date(Date.now() + 5 * 864e5);
    due.setHours(23, 59, 0, 0);

    const ready = members.filter((m) => feedbacks[m.id]?.status === "confirmed");
    const now = new Date().toISOString();

    const fbIds = ready.map((m) => feedbacks[m.id].id);
    const { error: fbErr } = await supabase
      .from("practice_feedbacks")
      .update({ status: "sent", sent_at: now })
      .in("id", fbIds);
    if (fbErr) return setMsg(`전달 실패: ${fbErr.message}`);

    const hwRows = ready
      .filter((m) => homework[m.id]?.title)
      .map((m) => ({
        session_id: room.session_id,
        student_id: m.id,
        feedback_id: feedbacks[m.id].id,
        title: homework[m.id].title,
        instructions: homework[m.id].instructions || "",
        target_sec: homework[m.id].target_sec ? Number(homework[m.id].target_sec) : null,
        due_at: due.toISOString(),
      }));
    if (hwRows.length) {
      const { error: hwErr } = await supabase.from("online_homework").upsert(hwRows, { onConflict: "session_id,student_id" });
      if (hwErr) return setMsg(`숙제 저장 실패: ${hwErr.message}`);
    }

    setMsg(`${ready.length}명에게 피드백, ${hwRows.length}명에게 숙제를 보냈어요. 마감 ${due.toLocaleString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })}`);
    loadRoom();
  }

  const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-seum-navy">온라인 단체반 · 내 실습 방</h2>
      {msg && <div className="bg-blue-50 border border-seum-blue text-seum-navy px-4 py-2 text-sm">{msg}</div>}

      <select className="border px-3 py-2 w-full" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
        {rooms.length === 0 && <option>맡은 방이 없어요</option>}
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.online_sessions.courses?.title} · {r.online_sessions.week_no}주차 · {r.room_no}번 방 (
            {new Date(r.online_sessions.starts_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" })})
          </option>
        ))}
      </select>

      {room && (
        <>
          <p className="text-sm text-gray-600">
            학생 차례가 시작되면 <b>녹음</b>, 발표·피드백·다시 말하기가 끝나면 <b>정지</b>를 누르세요. 줌 소리가 함께 녹음되도록 이어폰 대신 스피커를 써주세요.
          </p>

          <div className="space-y-4">
            {members.map((s, i) => {
              const f = feedbacks[s.id] || {};
              const h = homework[s.id] || {};
              const isRec = recordingFor === s.id;
              const sent = f.status === "sent";
              return (
                <div key={s.id} className={`border p-4 space-y-3 bg-white ${isRec ? "border-red-500" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{i + 1}</span>
                    <span className="font-semibold mr-auto">{s.name}</span>
                    {f.status && <span className="text-xs border px-2 py-0.5">{STATUS_LABEL[f.status]}</span>}
                    {working[s.id] && <span className="text-xs text-seum-blue">{working[s.id]}…</span>}
                    {isRec ? (
                      <button onClick={stopRecording} className="bg-red-600 text-white px-3 py-1 text-sm">정지 {mmss(elapsed)}</button>
                    ) : (
                      <button disabled={!!recordingFor || sent} onClick={() => startRecording(s.id)}
                        className="border border-red-600 text-red-600 px-3 py-1 text-sm disabled:opacity-40">
                        {f.recording_id ? "다시 녹음" : "녹음"}
                      </button>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 text-sm">
                    {[["good_point", "잘한 점"], ["fix_point", "고칠 점"], ["improved", "다시 말하기에서 좋아진 점"]].map(([k, label]) => (
                      <label key={k} className="flex flex-col gap-1">
                        <span className="text-gray-500">{label}</span>
                        <textarea rows={3} disabled={sent} className="border px-2 py-1" value={f[k] || ""}
                          onChange={(e) => editFeedback(s.id, { [k]: e.target.value })} />
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {Object.entries(TAG_LABELS).map(([k, label]) => {
                      const on = (f.tags || []).includes(k);
                      return (
                        <button key={k} disabled={sent}
                          onClick={() => editFeedback(s.id, { tags: on ? f.tags.filter((t) => t !== k) : [...(f.tags || []), k] })}
                          className={`border px-2 py-0.5 ${on ? "bg-seum-navy text-white" : ""}`}>{label}</button>
                      );
                    })}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[2fr_3fr_1fr] text-sm">
                    <input disabled={sent} className="border px-2 py-1" placeholder="숙제 제목 (예: 1분 자기소개 녹음)"
                      value={h.title || ""} onChange={(e) => editHomework(s.id, { title: e.target.value })} />
                    <input disabled={sent} className="border px-2 py-1" placeholder="숙제 안내"
                      value={h.instructions || ""} onChange={(e) => editHomework(s.id, { instructions: e.target.value })} />
                    <input disabled={sent} type="number" className="border px-2 py-1" placeholder="목표 초"
                      value={h.target_sec || ""} onChange={(e) => editHomework(s.id, { target_sec: e.target.value })} />
                  </div>

                  {!sent && (
                    <div className="text-right">
                      <button onClick={() => saveFeedback(s.id)} className="bg-seum-blue text-white px-3 py-1 text-sm">확정</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 bg-white border-t py-3 flex items-center gap-3">
            <span className="text-sm text-gray-600 mr-auto">
              확정 {members.filter((m) => feedbacks[m.id]?.status === "confirmed").length} · 전달 완료 {members.filter((m) => feedbacks[m.id]?.status === "sent").length} / {members.length}명
            </span>
            <button onClick={sendAll} className="bg-seum-navy text-white px-5 py-2">수업 종료 · 피드백과 숙제 보내기</button>
          </div>
        </>
      )}
    </div>
  );
}