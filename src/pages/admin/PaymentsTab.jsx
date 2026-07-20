import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import EnrollApprovals from "./EnrollApprovals";

const won = (n) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

const methodLabel = (m) =>
  ({ card: "카드", transfer: "계좌이체", cash: "현금" }[m] ?? m);

export default function PaymentsTab({ branchId }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: pay } = await supabase
      .from("payments")
      .select("*, profiles(name), enrollment:enrollment_id(courses(title))")
      .order("paid_at", { ascending: false });
    setPayments(pay ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const refund = async (p) => {
    const reason = prompt("환불 사유를 입력하세요:");
    if (reason === null) return;
    const { error } = await supabase
      .from("payments")
      .update({
        status: "refunded",
        refund_amount: p.amount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (error) {
      alert("환불 실패: " + error.message);
      return;
    }
    load();
  };

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalRefund = payments.reduce((s, p) => s + (p.refund_amount || 0), 0);
  const netRevenue = totalPaid - totalRefund;
  const refundedCount = payments.filter((p) => p.status === "refunded").length;

  return (
    <div>
      {/* 결제 완료 → 수강 승인 대기 */}
      <EnrollApprovals branchId={branchId} />

      {/* 결제 내역 / 환불 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <h3 className="mb-4 font-bold text-seum-navy">결제 내역</h3>

        {loading ? (
          <p className="text-slate-400">불러오는 중...</p>
        ) : (
          <>
            {/* 요약 */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-seum-blue bg-blue-50 p-4 text-center">
                <p className="text-xl font-bold text-seum-blue">{won(netRevenue)}</p>
                <p className="text-xs text-seum-blue">실매출 (환불 제외)</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xl font-bold text-seum-navy">{payments.length}</p>
                <p className="text-xs text-slate-400">결제 건수</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xl font-bold text-rose-500">{refundedCount}</p>
                <p className="text-xs text-slate-400">환불 건수</p>
              </div>
            </div>

            {/* 결제 목록 */}
            {payments.length === 0 ? (
              <p className="py-10 text-center text-slate-400">결제 내역이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-bold text-seum-navy">
                        {p.profiles?.name ?? "학생"}
                        <span className="ml-2 text-xs text-slate-400">{methodLabel(p.method)}</span>
                        {p.enrollment?.courses?.title ? (
                          <span className="ml-2 text-xs text-slate-400">· {p.enrollment.courses.title}</span>
                        ) : (
                          <span className="ml-2 text-xs text-rose-400">· 수강 미연결</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString("ko-KR") : "-"}
                        {p.status === "refunded" && p.refund_reason ? ` · 환불사유: ${p.refund_reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${p.status === "refunded" ? "text-slate-400 line-through" : "text-seum-navy"}`}>
                        {won(p.amount)}
                      </span>
                      {p.status === "paid" ? (
                        <button
                          onClick={() => refund(p)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                        >
                          환불
                        </button>
                      ) : (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-500">환불됨</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}