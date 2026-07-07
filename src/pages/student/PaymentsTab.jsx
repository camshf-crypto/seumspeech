import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const won = (n) => (n == null ? "-" : `${Number(n).toLocaleString("ko-KR")}원`);

const fmt = (ts) => {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

const METHOD_LABEL = {
  card: "카드",
  cash: "현금",
  transfer: "계좌이체",
};

const STATUS_LABEL = {
  paid: "결제완료",
  refunded: "환불",
  partial_refund: "부분환불",
  pending: "대기",
  cancelled: "취소",
};

const statusStyle = (status) => {
  if (status === "paid") return "bg-green-50 text-green-600";
  if (status === "refunded" || status === "partial_refund")
    return "bg-rose-50 text-rose-600";
  if (status === "pending") return "bg-amber-50 text-amber-600";
  if (status === "cancelled") return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-500";
};

export default function PaymentsTab({ studentId }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*, enrollment:enrollment_id(courses(title))")
      .eq("student_id", studentId)
      .order("paid_at", { ascending: false });
    setPayments(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [studentId]);

  const totalPaid = payments
    .filter((p) => p.status === "paid" || p.status === "partial_refund")
    .reduce((sum, p) => sum + (p.amount || 0) - (p.refund_amount || 0), 0);

  if (loading) {
    return (
      <div>
        <h2 className="mb-3 font-bold text-seum-navy">결제내역</h2>
        <p className="text-slate-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 font-bold text-seum-navy">결제내역</h2>

      {payments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          아직 결제내역이 없습니다.
        </p>
      ) : (
        <div>
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">총 결제금액 (환불 제외)</span>
              <span className="text-xl font-bold text-seum-blue">{won(totalPaid)}</span>
            </div>
          </div>

          <div className="space-y-2">
            {payments.map((p) => {
              const isRefund =
                p.status === "refunded" || p.status === "partial_refund";
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-seum-navy">
                        {p.enrollment?.courses?.title ?? "수강료"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {fmt(p.paid_at)} · {METHOD_LABEL[p.method] ?? p.method ?? "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-seum-navy">{won(p.amount)}</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(
                          p.status
                        )}`}
                      >
                        {STATUS_LABEL[p.status] ?? p.status ?? "-"}
                      </span>
                    </div>
                  </div>

                  {isRefund && (
                    <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm">
                      <div className="flex justify-between text-rose-600">
                        <span>환불금액</span>
                        <span className="font-bold">{won(p.refund_amount)}</span>
                      </div>
                      {p.refund_reason && (
                        <p className="mt-1 text-xs text-slate-500">
                          사유: {p.refund_reason}
                        </p>
                      )}
                      {p.refunded_at && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          환불일: {fmt(p.refunded_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}