import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const REASON_TYPES = [
  { key: "질병", label: "질병 (진단서·처방전 등)" },
  { key: "출장", label: "출장 (출장확인서 등)" },
  { key: "경조사", label: "경조사 (청첩장·부고 등)" },
];

const fmtDate = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const STATUS_LABEL = {
  pending: { text: "검토 중", cls: "bg-amber-50 text-amber-600" },
  approved: { text: "인정됨", cls: "bg-green-50 text-green-600" },
  rejected: { text: "불인정", cls: "bg-red-50 text-red-500" },
};

// 수업 전날 밤 12시(자정)까지만 신청 가능
// = 신청하려는 수업 날짜의 "전날 24:00" 전까지. 즉 오늘이 수업 전날 이전이면 OK.
const canRequest = (classDate) => {
  if (!classDate) return false;
  const now = new Date();
  const target = new Date(classDate);
  target.setHours(0, 0, 0, 0); // 수업 당일 00:00
  // 수업 당일 00:00 = 전날 자정. 그 전까지 신청 가능.
  return now < target;
};

export default function AbsenceRequestTab({ studentId }) {
  const [enrollments, setEnrollments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState("");
  const [reasonType, setReasonType] = useState("질병");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: enr } = await supabase
      .from("enrollments")
      .select("course_id, courses(title, type, weekday, start_time, branch:branch_id(name))")
      .eq("student_id", studentId);
    setEnrollments(enr ?? []);

    const { data: reqs } = await supabase
      .from("absence_requests")
      .select("*, courses(title)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    setRequests(reqs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [studentId]);

  const submit = async () => {
    if (!courseId) return alert("수업을 선택하세요.");
    if (!date) return alert("결석할 날짜를 선택하세요.");
    if (!canRequest(date)) {
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
      course_id: courseId,
      date,
      reason_type: reasonType,
      reason: reason.trim(),
      file_path: path,
      file_url: urlData.publicUrl,
      status: "pending",
    });

    setSaving(false);
    if (error) return alert("신청 실패: " + error.message);

    alert("결석 신청이 접수되었습니다. 서류 확인 후 인정 여부가 결정됩니다.");
    setCourseId(""); setDate(""); setReasonType("질병"); setReason(""); setFile(null);
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">수업 선택</label>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
            <option value="">수업을 선택하세요...</option>
            {enrollments.map((e) => (
              <option key={e.course_id} value={e.course_id}>
                {e.courses?.title}{e.courses?.branch?.name ? ` (${e.courses.branch.name})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">결석할 날짜</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          {date && !canRequest(date) ? (
            <p className="mt-1 text-xs text-red-500">신청 기한(수업 전날 밤 12시)이 지났습니다.</p>
          ) : null}
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

        <button type="button" onClick={submit} disabled={saving}
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