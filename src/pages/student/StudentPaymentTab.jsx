import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { runPayment } from "../../lib/payment";

// 학생: 원장이 열어준 결제창(청구서) 확인 후 결제
export default function StudentPaymentTab({ studentId }) {
  const [orders, setOrders] = useState([]);   // pending (결제할 것)
  const [history, setHistory] = useState([]); // paid (결제 완료)
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("student_id", studentId)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false });
    const all = data ?? [];
    setOrders(all.filter((o) => o.status === "pending"));
    setHistory(all.filter((o) => o.status === "paid"));
    setLoading(false);
  };

  useEffect(() => { if (studentId) load(); }, [studentId]);

  // 실시간: 원장이 결제창 열면 바로 뜨게
  useEffect(() => {
    if (!studentId) return;
    const ch = supabase
      .channel(`student-orders-${studentId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `student_id=eq.${studentId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [studentId]);

  const pay = async (order) => {
    setPayingId(order.id);
    try {
      const result = await runPayment(order);
      if (result.cancelled) { setPayingId(null); return; }
      if (!result.success) {
        alert("결제 실패: " + (result.error ?? "알 수 없는 오류"));
        setPayingId(null);
        return;
      }
      alert("결제가 완료되었습니다!\n원장님 확인 후 수강이 확정됩니다.");
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setPayingId(null);
    }
  };

  const fmtDate = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      <h2 className="mb-1 font-bold text-seum-navy">수강 결제</h2>
      <p className="mb-4 text-sm text-slate-400">원장님이 열어주신 결제 항목을 확인하고 결제하세요.</p>

      {/* 결제할 항목 */}
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          결제할 항목이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border-2 border-seum-blue bg-blue-50/30 p-4">
              <div className="mb-3">
                <p className="font-bold text-seum-navy">{o.course_title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{o.sessions}회</p>
              </div>
              <div className="mb-3 flex items-center justify-between border-t border-blue-100 pt-3">
                <span className="text-sm text-slate-500">결제 금액</span>
                <span className="text-xl font-bold text-seum-blue">{Number(o.amount).toLocaleString()}원</span>
              </div>
              <button onClick={() => pay(o)} disabled={payingId === o.id}
                className="w-full rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                {payingId === o.id ? "결제 처리 중..." : "결제하기"}
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                결제 후 원장님 확인을 거쳐 수강이 확정됩니다.
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 결제 내역 */}
      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-bold text-slate-600">결제 내역</h3>
          <div className="space-y-2">
            {history.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-medium text-seum-navy">{o.course_title}</p>
                  <p className="text-xs text-slate-400">
                    {o.sessions}회 · {fmtDate(o.paid_at)} · 주문번호 {o.order_no}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-700">{Number(o.amount).toLocaleString()}원</p>
                  <span className={`text-xs ${o.enrollment_id ? "text-green-600" : "text-amber-600"}`}>
                    {o.enrollment_id ? "✓ 수강 확정" : "승인 대기"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}