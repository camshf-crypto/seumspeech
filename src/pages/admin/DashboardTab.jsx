import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const won = (n) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

export default function DashboardTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [revenue, setRevenue] = useState([]);
  const [consult, setConsult] = useState(null);
  const [students, setStudents] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [rev, con, stu] = await Promise.all([
      supabase.rpc("branch_revenue", { p_year: year, p_month: month }),
      supabase.rpc("consult_stats", { p_year: year, p_month: month }),
      supabase.rpc("student_stats"),
    ]);
    setRevenue(rev.data ?? []);
    setConsult(con.data?.[0] ?? null);
    setStudents(stu.data?.[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const totalPaid = revenue.reduce((s, r) => s + Number(r.paid_total || 0), 0);
  const totalRefund = revenue.reduce((s, r) => s + Number(r.refund_total || 0), 0);
  const totalNet = revenue.reduce((s, r) => s + Number(r.net_total || 0), 0);

  // 전환율: 등록전환 / (상담완료+등록전환+미등록종료)
  const consultTotal = consult
    ? (consult.done_count + consult.enrolled_count + consult.dropped_count)
    : 0;
  const convRate = consultTotal > 0
    ? Math.round((consult.enrolled_count / consultTotal) * 100)
    : 0;

  return (
    <div>
      <h2 className="mb-4 font-bold text-seum-navy">대시보드</h2>

      <div className="mb-5 flex items-center justify-center gap-4">
        <button onClick={prevMonth} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">← 이전달</button>
        <p className="text-lg font-bold text-seum-navy">{year}년 {month}월</p>
        <button onClick={nextMonth} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">다음달 →</button>
      </div>

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : (
        <div className="space-y-8">
          {/* 매출 */}
          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-600">매출</h3>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs text-slate-400">총 결제</p>
                <p className="mt-1 text-lg font-bold text-seum-navy">{won(totalPaid)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs text-slate-400">총 환불</p>
                <p className="mt-1 text-lg font-bold text-rose-500">{won(totalRefund)}</p>
              </div>
              <div className="rounded-xl border border-seum-blue bg-blue-50 p-4 text-center">
                <p className="text-xs text-seum-blue">실매출</p>
                <p className="mt-1 text-lg font-bold text-seum-blue">{won(totalNet)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {revenue.map((r) => (
                <div key={r.branch_id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-bold text-seum-navy">{r.branch_name}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-400">결제 <span className="font-medium text-slate-700">{won(r.paid_total)}</span></span>
                    <span className="text-slate-400">환불 <span className="font-medium text-rose-500">{won(r.refund_total)}</span></span>
                    <span className="font-bold text-seum-blue">{won(r.net_total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 상담 전환 */}
          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-600">상담 전환</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs text-slate-400">신규 문의</p>
                <p className="mt-1 text-2xl font-bold text-seum-navy">{consult?.total_inquiries ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs text-slate-400">상담 완료</p>
                <p className="mt-1 text-2xl font-bold text-slate-700">{consult?.done_count ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs text-slate-400">등록 전환</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{consult?.enrolled_count ?? 0}</p>
              </div>
              <div className="rounded-xl border border-seum-blue bg-blue-50 p-4 text-center">
                <p className="text-xs text-seum-blue">전환율</p>
                <p className="mt-1 text-2xl font-bold text-seum-blue">{convRate}%</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">전환율 = 등록전환 ÷ (상담완료 + 등록전환 + 미등록종료)</p>
          </section>

          {/* 학생 현황 */}
          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-600">학생 현황</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-seum-navy bg-seum-navy p-4 text-center text-white">
                <p className="text-xs text-blue-100">전체 학생</p>
                <p className="mt-1 text-2xl font-bold">{students?.total ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs text-slate-400">수강중</p>
                <p className="mt-1 text-2xl font-bold text-green-600">{students?.active ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs text-slate-400">등록 대기</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{students?.waiting ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs text-slate-400">완료</p>
                <p className="mt-1 text-2xl font-bold text-slate-500">{students?.done ?? 0}</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}