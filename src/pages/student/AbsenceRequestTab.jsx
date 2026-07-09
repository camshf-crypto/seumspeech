import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const REASON_TYPES = [
  { key: "질병", label: "질병 (진단서·처방전 등)" },
  { key: "출장", label: "출장 (출장확인서 등)" },
  { key: "경조사", label: "경조사 (청첩장·부고 등)" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const fmtDate = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

// YYYY-MM-DD (로컬 기준)
const toYMD = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const STATUS_LABEL = {
  pending: { text: "검토 중", cls: "bg-amber-50 text-amber-600" },
  approved: { text: "인정됨", cls: "bg-green-50 text-green-600" },
  rejected: { text: "불인정", cls: "bg-red-50 text-red-500" },
};

// 수업 전날 밤 12시(자정)까지만 신청 가능
// = 수업 당일 00:00 전까지면 OK
const canRequest = (classDate) => {
  if (!classDate) return false;
  const now = new Date();
  const target = new Date(classDate);
  target.setHours(0, 0, 0, 0);
  return now < target;
};

export default function AbsenceRequestTab({ studentId }) {
  const [sessions, setSessions] = useState([]); // 결석 신청 가능한 수업 회차 목록
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedKey, setSelectedKey] = useState(""); // 선택한 회차 key
  const [reasonType, setReasonType] = useState("질병");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);

    // 1) 내 수강 등록 (단체반/1:1 공통)
    const { data: enr } = await supabase
      .from("enrollments")
      .select("id, course_id, courses(id, title, type, weekday, start_time, start_date, branch:branch_id(name))")
      .eq("student_id", studentId);
    const enrollments = enr ?? [];

    // 2) 내 1:1 예약 (오늘 이후)
    const todayYMD = toYMD(new Date());
    const { data: bookings } = await supabase
      .from("lesson_bookings")
      .select("id, date, start_time, end_time, enrollment_id")
      .eq("student_id", studentId)
      .gte("date", todayYMD)
      .order("date", { ascending: true });

    // enrollment_id -> course 매핑
    const enrById = {};
    enrollments.forEach((e) => { enrById[e.id] = e; });

    const list = [];

    // === 1:1 예약 회차 ===
    (bookings ?? []).forEach((b) => {
      const e = enrById[b.enrollment_id];
      const course = e?.courses;
      const d = new Date(b.date);
      const wd = WEEKDAYS[d.getDay()];
      const timeStr = b.start_time
        ? `${b.start_time.slice(0, 5)}${b.end_time ? `~${b.end_time.slice(0, 5)}` : ""}`
        : "";
      list.push({
        key: `booking-${b.id}`,
        bookingId: b.id,
        courseId: course?.id ?? e?.course_id ?? null,
        courseTitle: course?.title ?? "1:1 수업",
        branchName: course?.branch?.name ?? "",
        date: b.date,
        label: `${course?.title ?? "1:1 수업"}${course?.branch?.name ? ` (${course.branch.name})` : ""}`,
        dateLabel: `${fmtDate(b.date)} (${wd}) ${timeStr}`,
        allowed: canRequest(b.date),
      });
    });

    // === 단체반 반복 회차 (앞으로 4주치) ===
    const groupCourses = enrollments.filter(
      (e) => e.courses && e.courses.type === "group" && e.courses.weekday != null
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    groupCourses.forEach((e) => {
      const c = e.courses;
      const startDate = c.start_date ? new Date(c.start_date) : null;
      const timeStr = c.start_time ? c.start_time.slice(0, 5) : "";
      // 오늘부터 28일 안에서 해당 요일 뽑기
      for (let i = 0; i < 28; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() + i);
        if (day.getDay() !== c.weekday) continue;
        if (startDate && day < startDate) continue; // 개강 전 제외
        const ymd = toYMD(day);
        list.push({
          key: `group-${c.id}-${ymd}`,
          bookingId: null,
          courseId: c.id,
          courseTitle: c.title,
          branchName: c.branch?.name ?? "",
          date: ymd,
          label: `${c.title}${c.branch?.name ? ` (${c.branch.name})` : ""}`,
          dateLabel: `${fmtDate(ymd)} (${WEEKDAYS[c.weekday]}) ${timeStr}`,
          allowed: canRequest(ymd),
        });
      }
    });

    // 이미 신청한 건 목록에서 제외
    const { data: reqs } = await supabase
      .from("absence_requests")
      .select("*, courses(title)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    // 1:1은 booking_id로, 단체반은 course_id+date로 중복 판단
    const reqBookingSet = new Set(
      (reqs ?? []).filter((r) => r.booking_id).map((r) => r.booking_id)
    );
    const reqGroupSet = new Set(
      (reqs ?? []).filter((r) => !r.booking_id).map((r) => `${r.course_id}__${r.date}`)
    );

    const filtered = list.filter((s) => {
      if (s.bookingId) return !reqBookingSet.has(s.bookingId);
      return !reqGroupSet.has(`${s.courseId}__${s.date}`);
    });

    // 날짜순 정렬
    filtered.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    setSessions(filtered);
    setRequests(reqs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [studentId]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.key === selectedKey) ?? null,
    [sessions, selectedKey]
  );

  const submit = async () => {
    if (!selectedSession) return alert("결석할 수업을 선택하세요.");
    if (!selectedSession.allowed) {
      return alert("수업 전날 밤 12시까지만 신청할 수 있습니다. 신청 기한이 지났습니다.");
    }
    if (!reason.trim()) return alert("사유를 자세히 적어주세요.");
    if (!file) return alert("증빙 서류를 첨부해야 합니다. (질병=진단서, 출장=출장확인서 등)");

    setSaving(true);

    // 서류 업로드
    const ext = file.name.split(".").pop();
    const path = `${studentId}/absence/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("student-files").upload(path, file);
    if (upErr) {
      setSaving(false);
      return alert("서류 업로드 실패: " + upErr.message);
    }
    const { data: urlData } = supabase.storage.from("student-files").getPublicUrl(path);

    const { error } = await supabase.from("absence_requests").insert({
      student_id: studentId,
      course_id: selectedSession.courseId,
      booking_id: selectedSession.bookingId, // 1:1이면 예약 id, 단체반이면 null
      date: selectedSession.date,
      reason_type: reasonType,
      reason: reason.trim(),
      file_path: path,
      file_url: urlData.publicUrl,
      status: "pending",
    });

    setSaving(false);
    if (error) return alert("신청 실패: " + error.message);

    alert("결석 신청이 접수되었습니다. 서류 확인 후 인정 여부가 결정됩니다.");
    setSelectedKey(""); setReasonType("질병"); setReason(""); setFile(null);
    const input = document.getElementById("absence-file");
    if (input) input.value = "";
    load();
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      <h2 className="mb-1 font-bold text-seum-navy">결석 신청 (노쇼 방지)</h2>
      <p className="mb-4 text-sm text-slate-500">
        부득이하게 결석할 경우 <b>수업 전날 밤 12시까지</b> 사유와 증빙 서류를 제출해야 합니다.
        질병·출장·경조사 등 정당한 사유와 서류가 확인되면 수업 횟수가 차감되지 않습니다.
        (단순 개인사정·회식 등은 인정되지 않습니다.)
      </p>

      {/* 신청 폼 */}
      <div className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        {/* 결석할 수업 선택 (잡힌 스케줄) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">결석할 수업 선택</label>
          {sessions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
              신청 가능한 예정 수업이 없습니다.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {sessions.map((s) => {
                const active = selectedKey === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={!s.allowed}
                    onClick={() => setSelectedKey(s.key)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                      !s.allowed
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                        : active
                        ? "border-seum-blue bg-blue-50"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${active ? "text-seum-blue" : "text-slate-700"}`}>
                        {s.label}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{s.dateLabel}</p>
                    </div>
                    {!s.allowed ? (
                      <span className="flex-shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
                        신청 마감
                      </span>
                    ) : active ? (
                      <span className="flex-shrink-0 text-seum-blue">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">사유 종류</label>
          <div className="flex flex-wrap gap-2">
            {REASON_TYPES.map((r) => (
              <button key={r.key} type="button" onClick={() => setReasonType(r.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${reasonType === r.key ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">사유 상세</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="결석 사유를 구체적으로 적어주세요." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">증빙 서류 첨부 (필수)</label>
          <input id="absence-file" type="file" onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:text-slate-600" />
          <p className="mt-1 text-xs text-slate-400">진단서·처방전·출장확인서·청첩장 등 사진이나 PDF로 첨부하세요.</p>
        </div>

        <button type="button" onClick={submit} disabled={saving || !selectedSession}
          className="w-full rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
          {saving ? "제출 중..." : "결석 신청하기"}
        </button>
      </div>

      {/* 내 신청 내역 */}
      <h3 className="mb-2 font-bold text-seum-navy">내 결석 신청 내역</h3>
      {requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-slate-400">
          아직 신청 내역이 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const st = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
            return (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-seum-navy">
                      {r.courses?.title ?? "수업"} · {fmtDate(r.date)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {r.reason_type ? `[${r.reason_type}] ` : ""}{r.reason}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>{st.text}</span>
                </div>
                {r.file_url ? (
                  <button type="button" onClick={() => window.open(r.file_url, "_blank", "noopener,noreferrer")}
                    className="mt-1 text-xs font-medium text-seum-blue hover:underline">첨부 서류 보기</button>
                ) : null}
                {r.status === "rejected" && r.reject_reason ? (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">불인정 사유: {r.reject_reason}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}