import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const won = (n) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

export default function TeacherSettlementTab({ teacherId }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("teacher_settlement", {
      p_teacher: teacherId,
      p_year: year,
      p_month: month,
    });
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [teacherId, year, month]);

  const total = rows.reduce((sum, r) => sum + (r.subtotal || 0), 0);
  const totalSessions = rows.reduce((sum, r) => sum + (r.sessions || 0), 0);

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <h2 className="mb-4 font-bold text-seum-navy">수업 정산</h2>

      {/* 월 선택 */}
      <div className="mb-5 flex items-center justify-center gap-4">
        <button
          onClick={prevMonth}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
        >
          ← 이전달
        </button>
        <p className="text-lg font-bold text-seum-navy">
          {year}년 {month}월
        </p>
        <button
          onClick={nextMonth}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
        >
          다음달 →
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : (
        <div>
          {/* 총 정산액 */}
          <div className="mb-5 rounded-xl bg-seum-navy p-5 text-center text-white">
            <p className="text-sm text-blue-100">{month}월 총 정산액</p>
            <p className="mt-1 text-3xl font-bold">{won(total)}</p>
            <p className="mt-1 text-xs text-blue-100">총 {totalSessions}회 수업</p>
          </div>

          {/* 항목별 */}
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
              이 달에 정산할 수업이 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.course_type}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="font-bold text-seum-navy">{r.course_type}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {r.sessions}회 × {won(r.unit_price)}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-seum-blue">{won(r.subtotal)}</p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            출석 처리되어 차감된 수업 기준으로 계산됩니다.
          </p>
        </div>
      )}
    </div>
  );
}