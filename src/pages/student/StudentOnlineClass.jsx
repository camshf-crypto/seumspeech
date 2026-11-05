// src/pages/student/StudentOnlineClass.jsx
// 학생 화면 · 온라인 단체반
//  1) 다음 수업 + 줌 입장
//  2) 받은 피드백 (주차별)
//  3) 숙제 녹음·제출 → 음성 분석 결과
// 메뉴 노출: StudentLayout에서 hasOnlineClass()가 true인 학생만 탭을 보여줌
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

// 온라인 반 수강 여부 (메뉴 노출용)
export async function hasOnlineClass(userId) {
  const { data } = await supabase
    .from("enrollments")
    .select("course_id, courses!inner ( is_online )")
    .eq("student_id", userId)
    .eq("courses.is_online", true)
    .limit(1);
  return (data || []).length > 0;
}

const fmt = (d, opt) => new Date(d).toLocaleString("ko-KR", opt);
const DAY = { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" };

export default function StudentOnlineClass() {
  const [me, setMe] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [sessions, setSessions] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [homework, setHomework] = useState([]);
  const [tab, setTab] = useState("home");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user);
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id, courses!inner ( id, title, is_online )")
        .eq("student_id", user.id)
        .eq("courses.is_online", true);
      if (error) return setMsg(`수업 조회 실패: ${error.message}`);
      const list = (data || []).map((e) => e.courses);
      setCourses(list);
      if (list[0]) setCourseId(list[0].id);
    })();
  }, []);

  useEffect(() => {
    if (courseId && me) loadAll();
  }, [courseId, me]);

  async function loadAll() {
    const { data: ss, error } = await supabase
      .from("online_sessions")
      .select("*")
      .eq("course_id", courseId)
      .order("week_no");
    if (error) return setMsg(`회차 조회 실패: ${error.message}`);
    setSessions(ss || []);
    const ids = (ss || []).map((s) => s.id);
    if (!ids.length) return;

    const [{ data: fbs }, { data: hws }] = await Promise.all([
      supabase.from("practice_feedbacks").select("*").in("session_id", ids).eq("student_id", me.id),
      supabase
        .from("online_homework")
        .select("*, homework_submissions ( id, submitted_at, duration_sec, speech_analyses ( * ) )")
        .in("session_id", ids)
        .eq("student_id", me.id)
        .order("due_at"),
    ]);
    setFeedbacks(fbs || []);
    setHomework(hws || []);
  }

  const weekOf = (sid) => sessions.find((s) => s.id === sid)?.week_no;
  const now = Date.now();
  const nextSession = sessions.find((s) => new Date(s.starts_at).getTime() + 2.5 * 3600e3 > now);
  const openHw = homework.filter((h) => !(h.homework_submissions || []).length);

  if (!courses.length) {
    return <p className="text-gray-500">수강 중인 온라인 단체반이 없어요.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-seum-navy mr-auto">온라인 단체반</h2>
        {courses.length > 1 && (
          <select className="border px-2 py-1" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
      </div>
      {msg && <div className="bg-blue-50 border border-seum-blue text-seum-navy px-4 py-2 text-sm">{msg}</div>}

      <div className="flex border-b text-sm">
        {[["home", "홈"], ["feedback", `피드백 ${feedbacks.length}`], ["homework", `숙제 ${openHw.length ? `· ${openHw.length}개 남음` : ""}`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 -mb-px border-b-2 ${tab === k ? "border-seum-navy font-semibold" : "border-transparent text-gray-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <div className="space-y-4">
          {nextSession ? <NextSessionCard s={nextSession} /> : <p className="text-gray-500">모든 수업이 끝났어요. 수고하셨어요!</p>}

          {openHw[0] && (
            <button onClick={() => setTab("homework")} className="w-full text-left border border-seum-blue bg-blue-50 p-4">
              <div className="text-sm text-seum-blue font-semibold">해야 할 숙제</div>
              <div className="font-semibold">{openHw[0].title}</div>
              <div className="text-sm text-gray-600">마감 {fmt(openHw[0].due_at, DAY)}</div>
            </button>
          )}

          {feedbacks[0] && (
            <button onClick={() => setTab("feedback")} className="w-full text-left border p-4 bg-white">
              <div className="text-sm text-gray-500">최근 피드백 · {weekOf(latest(feedbacks).session_id)}주차</div>
              <div className="mt-1">{latest(feedbacks).fix_point}</div>
            </button>
          )}

          <ol className="grid grid-cols-6 gap-1 text-center text-xs">
            {sessions.map((s) => {
              const done = new Date(s.starts_at).getTime() + 2 * 3600e3 < now;
              return (
                <li key={s.id} className={`py-2 border ${done ? "bg-seum-navy text-white" : s.id === nextSession?.id ? "border-seum-blue text-seum-blue font-semibold" : "text-gray-400"}`}>
                  {s.week_no}주차
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {tab === "feedback" && (
        <div className="space-y-3">
          {feedbacks.length === 0 && <p className="text-gray-500">수업이 끝나면 강사님 피드백이 여기에 와요.</p>}
          {[...feedbacks].sort((a, b) => weekOf(b.session_id) - weekOf(a.session_id)).map((f) => (
            <div key={f.id} className="border p-4 bg-white space-y-2">
              <div className="text-sm text-gray-500">{weekOf(f.session_id)}주차 · {fmt(f.sent_at, { month: "numeric", day: "numeric" })}</div>
              {f.good_point && <Row label="잘한 점" text={f.good_point} />}
              {f.fix_point && <Row label="고칠 점" text={f.fix_point} strong />}
              {f.improved && <Row label="다시 말하기에서 좋아진 점" text={f.improved} />}
            </div>
          ))}
        </div>
      )}

      {tab === "homework" && (
        <div className="space-y-3">
          {homework.length === 0 && <p className="text-gray-500">수업이 끝나면 숙제가 여기에 와요.</p>}
          {homework.map((h) => (
            <HomeworkCard key={h.id} h={h} week={weekOf(h.session_id)} me={me} onDone={loadAll} setMsg={setMsg} />
          ))}
        </div>
      )}
    </div>
  );
}

const latest = (fbs) => [...fbs].sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];

function Row({ label, text, strong }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={strong ? "font-semibold text-seum-navy" : ""}>{text}</div>
    </div>
  );
}

function NextSessionCard({ s }) {
  const start = new Date(s.starts_at).getTime();
  const now = Date.now();
  const canJoin = now > start - 10 * 60e3 && now < start + 2.5 * 3600e3; // 10분 전부터 입장
  return (
    <div className="border p-4 bg-white space-y-2">
      <div className="text-sm text-gray-500">다음 수업 · {s.week_no}주차</div>
      <div className="text-lg font-semibold">{fmt(s.starts_at, DAY)}</div>
      <div className="text-sm text-gray-600">전체 강의 {s.lecture_min}분 → 실습 방 {s.practice_min}분</div>
      {s.join_url ? (
        <a href={canJoin ? s.join_url : undefined} target="_blank" rel="noreferrer"
          className={`block text-center py-3 font-semibold ${canJoin ? "bg-seum-navy text-white" : "bg-gray-100 text-gray-400 pointer-events-none"}`}>
          {canJoin ? "수업 입장하기" : "수업 10분 전부터 입장할 수 있어요"}
        </a>
      ) : (
        <div className="text-sm text-gray-400">입장 링크는 수업 전에 열려요.</div>
      )}
    </div>
  );
}

function HomeworkCard({ h, week, me, onDone, setMsg }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState(null); // { blob, url, sec }
  const [busy, setBusy] = useState("");
  const recRef = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);
  const started = useRef(0);

  const sub = (h.homework_submissions || []).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];
  const analysis = sub?.speech_analyses?.[0] || sub?.speech_analyses;
  const overdue = !sub && new Date(h.due_at).getTime() < Date.now();

  useEffect(() => () => clearInterval(timer.current), []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const sec = Math.round((Date.now() - started.current) / 1000);
        setPreview({ blob, url: URL.createObjectURL(blob), sec });
      };
      rec.start(1000);
      recRef.current = rec;
      started.current = Date.now();
      setElapsed(0);
      setPreview(null);
      setRecording(true);
      timer.current = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    } catch (e) {
      setMsg(`마이크를 켤 수 없어요: ${e.message}`);
    }
  }

  function stop() {
    clearInterval(timer.current);
    recRef.current?.stop();
    setRecording(false);
  }

  async function submit() {
    setBusy("제출 중");
    const path = `${me.id}/${h.id}-${Date.now()}.webm`;
    const { error: upErr } = await supabase.storage.from("homework-audio").upload(path, preview.blob, { contentType: "audio/webm" });
    if (upErr) { setBusy(""); return setMsg(`업로드 실패: ${upErr.message}`); }

    const { data: row, error } = await supabase
      .from("homework_submissions")
      .insert({ homework_id: h.id, student_id: me.id, storage_path: path, duration_sec: preview.sec })
      .select("id")
      .single();
    if (error) { setBusy(""); return setMsg(`제출 실패: ${error.message}`); }

    setBusy("음성 분석 중");
    const { error: aErr } = await supabase.functions.invoke("online-speech-analysis", { body: { submission_id: row.id } });
    setBusy("");
    if (aErr) setMsg("제출은 됐어요. 분석 결과는 잠시 후에 볼 수 있어요.");
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    onDone();
  }

  const mmss = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  const target = h.target_sec;

  return (
    <div className="border p-4 bg-white space-y-3">
      <div className="flex items-start gap-2">
        <div className="mr-auto">
          <div className="text-sm text-gray-500">{week}주차 숙제</div>
          <div className="font-semibold">{h.title}</div>
          {h.instructions && <div className="text-sm text-gray-600 mt-1">{h.instructions}</div>}
        </div>
        <span className={`text-xs border px-2 py-0.5 ${sub ? "text-seum-blue border-seum-blue" : overdue ? "text-red-600 border-red-600" : ""}`}>
          {sub ? "제출 완료" : overdue ? "마감 지남" : `마감 ${fmt(h.due_at, DAY)}`}
        </span>
      </div>

      {!sub && (
        <div className="space-y-2">
          {recording ? (
            <button onClick={stop} className="w-full bg-red-600 text-white py-3 font-semibold">
              정지 {mmss(elapsed)}{target ? ` / 목표 ${mmss(target)}` : ""}
            </button>
          ) : (
            <button onClick={start} disabled={!!busy} className="w-full border border-red-600 text-red-600 py-3 font-semibold disabled:opacity-40">
              {preview ? "다시 녹음" : "녹음 시작"}
            </button>
          )}
          {preview && !recording && (
            <div className="space-y-2">
              <audio controls src={preview.url} className="w-full" />
              <button onClick={submit} disabled={!!busy} className="w-full bg-seum-navy text-white py-3 font-semibold disabled:opacity-50">
                {busy ? `${busy}…` : `이 녹음으로 제출 (${mmss(preview.sec)})`}
              </button>
            </div>
          )}
        </div>
      )}

      {sub && !analysis && <p className="text-sm text-gray-500">음성 분석 결과를 준비하고 있어요.</p>}
      {analysis && <AnalysisSummary a={analysis} target={target} />}
    </div>
  );
}

function AnalysisSummary({ a, target }) {
  const speed = a.syllables_per_min;
  const speedNote = speed == null ? "" : speed > 330 ? "조금 빨라요" : speed < 250 ? "조금 느려요" : "알맞아요";
  const items = [
    ["말 속도", speed != null ? `분당 ${Math.round(speed)}음절 · ${speedNote}` : "-"],
    ["군말", a.filler_count != null ? `${a.filler_count}회${a.filler_words ? ` (${Object.entries(a.filler_words).map(([w, n]) => `${w} ${n}`).join(", ")})` : ""}` : "-"],
    ["긴 멈춤", a.long_pause_count != null ? `${a.long_pause_count}회` : "-"],
    ["시간", a.duration_sec != null ? `${a.duration_sec}초${target ? (a.within_target ? " · 목표 안에 끝냄" : ` · 목표 ${target}초`) : ""}` : "-"],
  ];
  return (
    <div className="bg-gray-50 p-3 space-y-2">
      <div className="text-sm font-semibold text-seum-navy">음성 분석</div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {items.map(([k, v]) => (
          <div key={k}><dt className="text-gray-500 text-xs">{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {a.content_review?.summary && <p className="text-sm">{a.content_review.summary}</p>}
    </div>
  );
}