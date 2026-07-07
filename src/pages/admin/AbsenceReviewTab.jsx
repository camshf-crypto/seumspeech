import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const fmtDate = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const STATUS_TABS = [
  { key: "pending", label: "검토 대기" },
  { key: "approved", label: "인정" },
  { key: "rejected", label: "불인정" },
];

// reviewerId: 처리하는 사람(선생님/원장) id
// isAdmin: true면 전체, false면 자기 담당 학생만
export default function AbsenceReviewTab({ reviewerId, isAdmin = false }) {
  const [tab, setTab] = useState("pending");
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const load = async () => {
    setLoading(true);

    // 선생님이면 담당 학생(enrollment teacher_id = 나)만 필터
    let myStudentIds = null;
    if (!isAdmin) {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("teacher_id", reviewerId);
      myStudentIds = [...new Set((enr ?? []).map((e) => e.student_id))];
      if (myStudentIds.length === 0) {
        setReqs([]);
        setPendingCount(0);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from("absence_requests")
      .select("*, student:student_id(name), courses(title, branch:branch_id(name))")
      .eq("status", tab)
      .order("created_at", { ascending: false });

    if (!isAdmin && myStudentIds) {
      query = query.in("student_id", myStudentIds);
    }

    const { data } = await query;
    setReqs(data ?? []);

    // 대기 건수
    let countQuery = supabase
      .from("absence_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (!isAdmin && myStudentIds) countQuery = countQuery.in("student_id", myStudentIds);
    const { count } = await countQuery;
    setPendingCount(count ?? 0);

    setLoading(false);
  };

  useEffect(() => { load(); }, [tab, reviewerId, isAdmin]);

  const approve = async (r) => {
    setBusyId(r.id);
    const { error } = await supabase
      .from("absence_requests")
      .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    setBusyId(null);
    if (error) return alert("처리 실패: " + error.message);
    alert(`${r.student?.name ?? "학생"}님의 결석을 인정 처리했습니다. (수업 횟수 차감 안 됨)`);
    load();
  };

  const reject = async (r) => {
    const reason = window.prompt("불인정 사유를 입력하세요. (학생에게 표시됩니다)\n예: 증빙 서류가 사유와 맞지 않습니다.");
    if (reason === null) return; // 취소
    setBusyId(r.id);
    const { error } = await supabase
      .from("absence_requests")
      .update({ status: "rejected", reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), reject_reason: reason || "사유 불충분" })
      .eq("id", r.id);
    setBusyId(null);
    if (error) return alert("처리 실패: " + error.message);
    alert("불인정 처리했습니다. (수업 횟수 차감 대상)");
    load();
  };

  const restore = async (r) => {
    setBusyId(r.id);
    await supabase.from("absence_requests").update({ status: "pending", reviewed_at: null, reject_reason: null }).eq("id", r.id);
    setBusyId(null);
    load();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-seum-navy">결석 신청 검토</h2>
        {pendingCount > 0 ? (
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-500">대기 {pendingCount}건</span>
        ) : null}
      </div>

      <div className="mb-4 flex gap-2">
        {STATUS_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === t.key ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : reqs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          {tab === "pending" ? "검토 대기 중인 결석 신청이 없습니다." : tab === "approved" ? "인정된 신청이 없습니다." : "불인정된 신청이 없습니다."}
        </p>
      ) : (
        <div className="space-y-3">
          {reqs.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-seum-navy">
                    {r.student?.name ?? "학생"}
                    <span className="ml-2 text-xs font-normal text-slate-400">{r.courses?.title}{r.courses?.branch?.name ? ` · ${r.courses.branch.name}` : ""}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    결석일 {fmtDate(r.date)}
                    {r.reason_type ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{r.reason_type}</span> : null}
                  </p>
                </div>
                <span className="text-xs text-slate-400">{fmtDate(r.created_at)} 신청</span>
              </div>

              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{r.reason}</p>

              {r.file_url ? (
                <button type="button" onClick={() => window.open(r.file_url, "_blank", "noopener,noreferrer")}
                  className="mt-2 text-sm font-medium text-seum-blue hover:underline">📎 증빙 서류 보기</button>
              ) : (
                <p className="mt-2 text-xs text-red-500">증빙 서류 없음</p>
              )}

              {r.status === "rejected" && r.reject_reason ? (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">불인정 사유: {r.reject_reason}</p>
              ) : null}

              <div className="mt-3 flex justify-end gap-2">
                {tab === "pending" && (
                  <>
                    <button type="button" onClick={() => reject(r)} disabled={busyId === r.id}
                      className="rounded-lg border border-red-200 px-4 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-60">
                      불인정 (차감)
                    </button>
                    <button type="button" onClick={() => approve(r)} disabled={busyId === r.id}
                      className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                      {busyId === r.id ? "처리 중..." : "인정 (차감 안 함)"}
                    </button>
                  </>
                )}
                {(tab === "approved" || tab === "rejected") && (
                  <button type="button" onClick={() => restore(r)} disabled={busyId === r.id}
                    className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                    다시 검토로
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}