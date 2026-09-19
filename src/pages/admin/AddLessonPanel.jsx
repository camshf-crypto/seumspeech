import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const MINUTES = [0, 10, 20, 30, 40, 50];
const AM_HOURS = [10, 11];
const PM_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

const addMinutes = (hhmm, min) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const diffMinutes = (a, b) => {
  if (!a || !b) return 60;
  const [ah, am] = a.slice(0, 5).split(":").map(Number);
  const [bh, bm] = b.slice(0, 5).split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
};

// 시각을 버튼으로 고르는 공용 블록
function TimePicker({ h24, setH24, min, setMin, len, setLen }) {
  const isAm = h24 < 12;
  const label12 = (h) => (h === 12 ? "12" : h > 12 ? String(h - 12) : String(h));
  const start = `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

  return (
    <div className="border border-slate-200 bg-slate-50 p-3">
      <div className="mb-1.5 flex gap-1.5">
        <button type="button" onClick={() => setH24(AM_HOURS[0])}
          className={`flex-1 border py-1.5 text-xs font-bold ${isAm ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
          오전
        </button>
        <button type="button" onClick={() => setH24(PM_HOURS[2])}
          className={`flex-1 border py-1.5 text-xs font-bold ${!isAm ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
          오후
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-5 gap-1">
        {(isAm ? AM_HOURS : PM_HOURS).map((h) => (
          <button key={h} type="button" onClick={() => setH24(h)}
            className={`border py-1.5 text-xs font-bold ${h24 === h ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
            {label12(h)}
          </button>
        ))}
      </div>

      <div className="mb-1.5 grid grid-cols-6 gap-1">
        {MINUTES.map((m) => (
          <button key={m} type="button" onClick={() => setMin(m)}
            className={`border py-1.5 text-xs font-bold ${min === m ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
            {String(m).padStart(2, "0")}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {[60, 90].map((m) => (
          <button key={m} type="button" onClick={() => setLen(m)}
            className={`border px-3 py-1.5 text-xs font-bold ${len === m ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600"}`}>
            {m}분
          </button>
        ))}
        <span className="ml-auto text-sm font-bold text-seum-blue">
          {start} ~ {addMinutes(start, len)}
        </span>
      </div>
    </div>
  );
}

// 날짜 상세 패널 안에서 수업을 추가하는 목록
// 잔여가 남은 1:1 수강만 보여준다. 0회면 재등록 안내.
export default function AddLessonPanel({ branchId, date, defaultTeacherId, open: isOpen, onToggle, onDone }) {
  const [enrolls, setEnrolls] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState(null);
  const [teacherId, setTeacherId] = useState("");
  const [h24, setH24] = useState(14);
  const [min, setMin] = useState(0);
  const [len, setLen] = useState(60);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("enrollments")
      .select("id, total_sessions, remaining_sessions, teacher_id, student:student_id(id, name, branch_id), courses(title, type)")
      .eq("status", "active");
    if (error) console.error("수강 조회 실패:", error);

    const { data: tc } = await supabase.from("profiles").select("id, name").eq("role", "teacher");

    // 1:1 수강만, 이 지점 학생만
    setEnrolls(
      (data ?? []).filter(
        (e) => e.courses?.type === "oneonone" && (!branchId || e.student?.branch_id === branchId)
      )
    );
    setTeachers(tc ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [branchId]);

  const open = (e) => {
    if ((e.remaining_sessions ?? 0) <= 0) {
      return alert(`${e.student?.name}님은 잔여 횟수가 없습니다.\n수강생 관리에서 재등록해주세요.`);
    }
    setTarget(e);
    setTeacherId(e.teacher_id || defaultTeacherId || "");
    setH24(14); setMin(0); setLen(60);
  };

  const start = `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  const end = addMinutes(start, len);

  const save = async () => {
    if (!teacherId) return alert("담임 선생님이 지정되지 않았습니다.");
    setSaving(true);

    const { error } = await supabase.from("lesson_bookings").insert({
      teacher_id: teacherId,
      student_id: target.student?.id,
      enrollment_id: target.id,
      date,
      start_time: start,
      end_time: end,
      branch_id: branchId ?? null,
    });
    if (error) { setSaving(false); return alert("수업 예약 실패: " + error.message); }

    await supabase
      .from("enrollments")
      .update({ remaining_sessions: Math.max(0, (target.remaining_sessions ?? 1) - 1) })
      .eq("id", target.id);

    setSaving(false);
    setTarget(null);
    await load();
    if (onDone) onDone();
  };

  if (loading || !date) return null;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full border px-3 py-2.5 text-sm font-bold transition ${
          isOpen ? "border-seum-blue bg-seum-blue text-white" : "border-seum-blue bg-white text-seum-blue hover:bg-blue-50"
        }`}
      >
        수업 추가 {enrolls.length > 0 && `(${enrolls.length})`}
      </button>

      {isOpen && (
      <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
        {enrolls.length === 0 && (
          <p className="bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">수강 중인 학생이 없습니다.</p>
        )}
        {enrolls.map((e) => {
          const left = e.remaining_sessions ?? 0;
          const zero = left <= 0;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => open(e)}
              className={`flex w-full items-center justify-between border px-3 py-2 text-left ${
                zero
                  ? "border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-300 bg-white hover:bg-blue-50"
              }`}
            >
              <span className="text-sm font-bold">
                {e.student?.name}
                <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                  {e.courses?.title?.replace("1:1 ", "")}
                </span>
              </span>
              <span className={`text-[11px] font-bold ${zero ? "text-red-400" : "text-seum-blue"}`}>
                {zero ? "재등록 필요" : `${left}/${e.total_sessions}회`}
              </span>
            </button>
          );
        })}
      </div>
      )}

      {/* 수업 잡기 창 */}
      {target && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setTarget(null)}>
          <div className="my-8 w-full max-w-md space-y-4 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">
                {target.student?.name} · 수업 추가
              </h3>
              <button type="button" onClick={() => setTarget(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {date.slice(5).replace("-", ".")} · {target.courses?.title?.replace("1:1 ", "")} · 잔여 {target.remaining_sessions}회
            </p>

            <div>
              <label className="mb-1 block text-xs text-slate-500">담임 선생님</label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
              >
                <option value="">선택...</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <TimePicker h24={h24} setH24={setH24} min={min} setMin={setMin} len={len} setLen={setLen} />

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
            >
              {saving ? "저장 중..." : "수업 잡기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 잡힌 수업을 눌렀을 때 시간 변경·삭제
export function EditLessonPopup({ booking, onClose, onDone }) {
  const startInit = booking.start_time?.slice(0, 5) ?? "14:00";
  const [h24, setH24] = useState(Number(startInit.slice(0, 2)));
  const [min, setMin] = useState(Number(startInit.slice(3, 5)));
  const [len, setLen] = useState(diffMinutes(booking.start_time, booking.end_time) || 60);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);

  const start = `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  const end = addMinutes(start, len);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("lesson_bookings")
      .update({ start_time: start, end_time: end })
      .eq("id", booking.id);
    setSaving(false);
    if (error) return alert("변경 실패: " + error.message);
    onClose();
    if (onDone) onDone();
  };

  const remove = async () => {
    setSaving(true);
    const { error } = await supabase.from("lesson_bookings").delete().eq("id", booking.id);
    if (error) { setSaving(false); return alert("삭제 실패: " + error.message); }

    // 잔여 1회 복구
    if (booking.enrollment_id) {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("remaining_sessions, total_sessions")
        .eq("id", booking.enrollment_id)
        .single();
      if (enr && enr.remaining_sessions < enr.total_sessions) {
        await supabase.from("enrollments")
          .update({ remaining_sessions: enr.remaining_sessions + 1 })
          .eq("id", booking.enrollment_id);
      }
    }
    setSaving(false);
    onClose();
    if (onDone) onDone();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md space-y-4 bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-seum-navy">
            {booking.student?.name ?? "수업"} · 시간 변경
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <p className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {booking.date?.slice(5).replace("-", ".")} · 현재 {booking.start_time?.slice(0, 5)}
          {booking.end_time ? `~${booking.end_time.slice(0, 5)}` : ""}
          {booking.teacher?.name ? ` · ${booking.teacher.name}쌤` : ""}
        </p>

        {confirmDel ? (
          <>
            <p className="bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-600">
              이 수업을 삭제할까요?
            </p>
            <p className="text-center text-xs text-slate-500">잔여 횟수가 1회 돌아갑니다.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDel(false)}
                className="flex-1 border border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                취소
              </button>
              <button type="button" onClick={remove} disabled={saving}
                className="flex-1 bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60">
                삭제
              </button>
            </div>
          </>
        ) : (
          <>
            <TimePicker h24={h24} setH24={setH24} min={min} setMin={setMin} len={len} setLen={setLen} />

            <button type="button" onClick={save} disabled={saving}
              className="w-full bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
              {saving ? "저장 중..." : `${start} ~ ${end} 으로 변경`}
            </button>
            <button type="button" onClick={() => setConfirmDel(true)}
              className="w-full border border-red-300 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50">
              이 수업 삭제
            </button>
          </>
        )}
      </div>
    </div>
  );
}