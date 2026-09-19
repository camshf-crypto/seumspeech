import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const METHODS = ["현금", "계좌이체", "카드"];

const won = (n) => Number(n || 0).toLocaleString() + "원";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// 학생 상세 모달 안에 들어가는 결제 섹션
// 회당 단가가 정해져 있으므로 "몇 회분 받았는지"만 고르면 금액은 자동 계산된다.
// 매출·정산이 payments 를 읽으므로 기록은 payments 에 남긴다.
export default function StudentPaymentSection({ student }) {
  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [enrollId, setEnrollId] = useState("");
  const [count, setCount] = useState(1);
  const [method, setMethod] = useState("현금");
  const [paidDate, setPaidDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);

    const { data: enr, error: enrErr } = await supabase
      .from("enrollments")
      .select("id, total_sessions, courses(title, type, price)")
      .eq("student_id", student.id);
    if (enrErr) console.error("수강 조회 실패:", enrErr);

    const { data: pay, error: payErr } = await supabase
      .from("payments")
      .select("*")
      .eq("student_id", student.id)
      .order("paid_at", { ascending: false });
    if (payErr) console.error("결제 조회 실패:", payErr);

    const list = enr ?? [];
    setEnrollments(list);
    setPayments(pay ?? []);
    // 수강이 하나뿐이면 자동 선택
    if (list.length === 1) setEnrollId(list[0].id);
    setLoading(false);
  };

  useEffect(() => { if (student?.id) load(); }, [student?.id]);

  const isOne = (e) => e?.courses?.type === "oneonone";
  // 1:1은 회당 단가, 단체반은 반 가격 통으로
  const unitOf = (e) => e?.courses?.price ?? 0;
  const feeOf = (e) => (isOne(e) ? unitOf(e) * (e.total_sessions ?? 0) : unitOf(e));

  const totalFee = enrollments.reduce((sum, e) => sum + feeOf(e), 0);
  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount ?? 0) - (p.refund_amount ?? 0), 0);
  const unpaid = totalFee - totalPaid;
  const sel = enrollments.find((e) => e.id === enrollId);
  const unit = sel ? (isOne(sel) ? unitOf(sel) : feeOf(sel)) : 0;
  const amount = sel ? (isOne(sel) ? unit * count : unit) : 0;

  // 이 수강에서 아직 안 낸 회차 수
  const paidForSel = payments
    .filter((p) => p.status === "paid" && p.enrollment_id === enrollId)
    .reduce((sum, p) => sum + (p.amount ?? 0) - (p.refund_amount ?? 0), 0);
  const remainCount =
    sel && isOne(sel) && unit > 0
      ? Math.max(0, (sel.total_sessions ?? 0) - Math.round(paidForSel / unit))
      : 0;

  // 화면 전체 합계 — 1:1은 회차, 단체반은 1건으로 센다
  const paidCountOf = (e) => {
    const u = isOne(e) ? unitOf(e) : feeOf(e);
    if (!u) return 0;
    const sum = payments
      .filter((p) => p.status === "paid" && p.enrollment_id === e.id)
      .reduce((acc, p) => acc + (p.amount ?? 0) - (p.refund_amount ?? 0), 0);
    return Math.round(sum / u);
  };
  const totalCount = enrollments.reduce(
    (sum, e) => sum + (isOne(e) ? e.total_sessions ?? 0 : 1),
    0
  );
  const paidCount = enrollments.reduce((sum, e) => sum + paidCountOf(e), 0);

  const onPickEnroll = (id) => {
    setEnrollId(id);
    setCount(1);
  };

  const save = async () => {
    if (!enrollId) return alert("어느 수강에 대한 결제인지 선택하세요.");
    if (!amount || amount < 1) return alert("금액이 0원입니다. 수업 가격이 설정되어 있는지 확인하세요.");

    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      student_id: student.id,
      enrollment_id: enrollId,
      amount,
      method,
      status: "paid",
      paid_at: new Date(paidDate + "T09:00:00").toISOString(),
    });
    setSaving(false);

    if (error) return alert("등록 실패: " + error.message);

    setCount(1); setMethod("현금"); setPaidDate(today());
    setShowForm(false);
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`${won(p.amount)} 결제 기록을 삭제할까요?`)) return;
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) return alert("삭제 실패: " + error.message);
    load();
  };

  // 결제 1건이 몇 회분인지
  const countOfPayment = (p) => {
    const e = enrollments.find((x) => x.id === p.enrollment_id);
    if (!e) return 1;
    const u = isOne(e) ? unitOf(e) : feeOf(e);
    if (!u) return 1;
    return Math.max(1, Math.round((p.amount ?? 0) / u));
  };

  const fmtDate = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-bold text-seum-navy">결제</h4>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="bg-seum-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a63c4]"
        >
          {showForm ? "닫기" : "+ 결제 등록"}
        </button>
      </div>

      {/* 납부 현황 — 금액과 회차를 함께 */}
      <div className="mb-3 grid grid-cols-3 border border-slate-200 bg-slate-50 text-center">
        <div className="border-r border-slate-200 py-2.5">
          <p className="text-[11px] text-slate-400">총 수강료 {totalCount}회</p>
          <p className="text-sm font-bold text-slate-700">{won(totalFee)}</p>
        </div>
        <div className="border-r border-slate-200 py-2.5">
          <p className="text-[11px] text-slate-400">납부 {paidCount}회</p>
          <p className="text-sm font-bold text-green-600">{won(totalPaid)}</p>
        </div>
        <div className="py-2.5">
          <p className="text-[11px] text-slate-400">
            미납 {totalCount - paidCount > 0 ? `${totalCount - paidCount}회` : ""}
          </p>
          <p className={`text-sm font-bold ${unpaid > 0 ? "text-red-500" : "text-slate-400"}`}>
            {unpaid > 0 ? won(unpaid) : "완납"}
          </p>
        </div>
      </div>

      {totalFee === 0 && enrollments.length > 0 && (
        <p className="mb-3 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          수업에 가격이 설정되어 있지 않습니다. 수업 관리에서 가격을 넣어주세요.
        </p>
      )}

      {/* 결제 등록 */}
      {showForm && (
        <div className="mb-3 space-y-3 border border-dashed border-seum-blue bg-blue-50/30 p-3">
          {enrollments.length === 0 ? (
            <p className="text-xs text-slate-500">배정된 수강이 없습니다. 먼저 수강을 등록해주세요.</p>
          ) : (
            <>
              <div>
                <label className="mb-0.5 block text-[11px] text-slate-500">수강</label>
                <select
                  value={enrollId}
                  onChange={(e) => onPickEnroll(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                >
                  <option value="">선택...</option>
                  {enrollments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.courses?.title}{isOne(e) ? ` (회당 ${won(unitOf(e))})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {sel && isOne(sel) && (
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">
                    몇 회분을 받으셨나요?
                    {remainCount > 0 && (
                      <span className="ml-1 text-seum-blue">· 아직 {remainCount}회분 남음</span>
                    )}
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 3, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCount(n)}
                        className={`border px-3 py-1.5 text-sm font-bold transition ${
                          count === n
                            ? "border-seum-blue bg-seum-blue text-white"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {n}회
                      </button>
                    ))}
                    {remainCount > 0 && ![1, 3, 6].includes(remainCount) && (
                      <button
                        type="button"
                        onClick={() => setCount(remainCount)}
                        className={`border px-3 py-1.5 text-sm font-bold transition ${
                          count === remainCount
                            ? "border-seum-blue bg-seum-blue text-white"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        남은 {remainCount}회
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={count}
                        onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                        className="w-16 border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue"
                      />
                      <span className="text-sm text-slate-500">회</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] text-slate-500">결제 방법</label>
                <div className="flex gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`flex-1 border py-2 text-sm font-medium transition ${
                        method === m
                          ? "border-seum-blue bg-seum-blue text-white"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-0.5 block text-[11px] text-slate-500">결제일</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                />
              </div>

              {amount > 0 && (
                <p className="text-sm font-bold text-seum-blue">
                  {won(amount)} · {method}
                </p>
              )}

              <button
                type="button"
                onClick={save}
                disabled={saving || !enrollId || amount < 1}
                className="w-full bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
              >
                {saving ? "등록 중..." : "결제 등록"}
              </button>
            </>
          )}
        </div>
      )}

      {/* 결제 내역 */}
      {loading ? (
        <p className="text-xs text-slate-400">불러오는 중...</p>
      ) : payments.length === 0 ? (
        <p className="bg-slate-50 px-3 py-2 text-xs text-slate-400">결제 기록이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border border-slate-200 bg-white px-3 py-2">
              <div>
                <p className="text-sm font-medium text-seum-navy">
                  {won(p.amount)}
                  <span className="ml-1.5 text-xs text-slate-400">{countOfPayment(p)}회분</span>
                  {p.refund_amount ? (
                    <span className="ml-2 text-xs text-red-500">환불 {won(p.refund_amount)}</span>
                  ) : null}
                </p>
                <p className="text-[11px] text-slate-500">
                  {fmtDate(p.paid_at)} · {p.method || "방법 미기재"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(p)}
                className="px-2 py-0.5 text-xs text-red-400 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}