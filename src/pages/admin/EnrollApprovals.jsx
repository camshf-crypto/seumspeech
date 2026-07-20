import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// 결제된 수강신청 승인 (결제/환불 탭에 삽입)
// 결제 완료(paid) & 아직 수강 미확정(enrollment_id 없음) 건을 승인 → enrollment 생성
export default function EnrollApprovals({ branchId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null); // 승인 모달 대상 order + student
  const [sessions, setSessions] = useState(0);
  const [teacherId, setTeacherId] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [approving, setApproving] = useState(false);

  const load = async () => {
    setLoading(true);
    // 승인 대기 = paid & enrollment_id 없음
    let q = supabase
      .from("orders")
      .select("*, student:student_id(id, name, email, phone)")
      .eq("status", "paid")
      .is("enrollment_id", null)
      .order("paid_at", { ascending: false });
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    setOrders(data ?? []);

    const { data: tc } = await supabase.from("profiles").select("id, name").eq("role", "teacher");
    setTeachers(tc ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [branchId]);

  // 결제 알림 실시간 (새 주문 들어오면 갱신)
  useEffect(() => {
    const ch = supabase
      .channel("orders-approvals")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branchId]);

  const openApprove = (o) => {
    setTarget(o);
    setSessions(o.sessions ?? 6);
    setTeacherId("");
  };

  const approve = async () => {
    if (!target) return;
    setApproving(true);
    const now = new Date().toISOString();

    // 1) enrollment 생성 (수강 확정)
    const total = Number(sessions) || 6;
    const { data: enr, error: enrErr } = await supabase
      .from("enrollments")
      .insert({
        student_id: target.student_id,
        course_id: target.course_id,
        teacher_id: teacherId || null,
        total_sessions: total,
        remaining_sessions: total,
        status: "active",
      })
      .select()
      .single();
    if (enrErr) { setApproving(false); return alert("수강 등록 실패: " + enrErr.message); }

    // 2) order에 enrollment 연결 (승인 완료 표시)
    const { error: updErr } = await supabase
      .from("orders")
      .update({ enrollment_id: enr.id, updated_at: now })
      .eq("id", target.id);
    if (updErr) { setApproving(false); return alert("주문 갱신 실패: " + updErr.message); }

    // 3) payments에도 enrollment 연결 (매출 화면에서 과정명 표시)
    try {
      await supabase
        .from("payments")
        .update({ enrollment_id: enr.id })
        .eq("order_id", target.id);
    } catch (e) { /* noop */ }

    setApproving(false);
    setTarget(null);
    alert("수강신청이 승인되어 수강이 확정되었습니다.");
    load();
  };

  const fmtDate = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-seum-navy">수강신청 승인 대기</h3>
        {orders.length > 0 && (
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-500">{orders.length}건</span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">불러오는 중...</p>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
          승인 대기 중인 수강신청이 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="font-bold text-seum-navy">
                  {o.student?.name ?? "학생"}
                  <span className="ml-2 text-sm font-normal text-slate-500">{o.course_title}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {o.amount?.toLocaleString()}원 · 결제 {fmtDate(o.paid_at)}
                  {o.student?.phone ? ` · ${o.student.phone}` : ""}
                </p>
              </div>
              <button onClick={() => openApprove(o)}
                className="flex-shrink-0 rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4]">
                승인
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 승인 모달 */}
      {target && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">수강신청 승인</h3>
              <button onClick={() => setTarget(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="mb-4 rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-bold text-seum-navy">{target.student?.name}</p>
              <p className="text-slate-500">{target.course_title}</p>
              <p className="mt-1 text-xs text-slate-400">{target.amount?.toLocaleString()}원 결제 완료</p>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">등록 회차</label>
              <input type="number" value={sessions} onChange={(e) => setSessions(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
              <p className="mt-1 text-[11px] text-slate-400">기본값은 결제한 과정의 회차입니다. 필요시 조정.</p>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-slate-500">담당 선생님 (선택)</label>
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
                <option value="">미지정</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <button onClick={approve} disabled={approving}
              className="w-full rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
              {approving ? "승인 중..." : "승인하고 수강 확정"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}