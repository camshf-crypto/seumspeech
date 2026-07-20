import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { makeOrderNo } from "../../lib/payment";

// 학생 상세 모달 안에 들어가는 결제 섹션
// 결제창 발행 / 결제 대기 / 결제 완료 를 한 곳에서
export default function StudentPaymentSection({ student, branchId, courses = [] }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);

  // 발행 폼
  const [courseId, setCourseId] = useState("");
  const [sessions, setSessions] = useState(6);
  const [amount, setAmount] = useState(0);
  const [amountTouched, setAmountTouched] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("student_id", student.id)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (student?.id) load(); }, [student?.id]);

  const selCourse = courses.find((c) => c.id === courseId);
  const isOneOnOne = selCourse?.type === "oneonone";
  const unitPrice = selCourse?.price ?? 0;

  // 금액 자동계산
  useEffect(() => {
    if (!selCourse || amountTouched) return;
    setAmount(isOneOnOne ? unitPrice * (Number(sessions) || 0) : unitPrice);
  }, [courseId, sessions, selCourse, isOneOnOne, unitPrice, amountTouched]);

  const onPickCourse = (id) => {
    setCourseId(id);
    setAmountTouched(false);
    const c = courses.find((x) => x.id === id);
    setSessions(c?.sessions_total ?? 6);
  };

  const issue = async () => {
    if (!courseId) return alert("과정을 선택하세요.");
    if (!sessions || sessions < 1) return alert("회차를 입력하세요.");
    if (!amount || amount < 1) return alert("금액을 확인하세요.");

    setIssuing(true);
    const { error } = await supabase.from("orders").insert({
      order_no: makeOrderNo(),
      student_id: student.id,
      course_id: courseId,
      branch_id: branchId ?? selCourse?.branch_id ?? null,
      course_title: selCourse?.title ?? "",
      amount: Number(amount),
      sessions: Number(sessions),
      status: "pending",
    });
    setIssuing(false);
    if (error) return alert("발행 실패: " + error.message);

    try {
      supabase.functions.invoke("send-push", {
        body: {
          title: "세움스피치 결제 안내",
          body: `${selCourse?.title} ${sessions}회 · ${Number(amount).toLocaleString()}원 결제가 요청되었습니다.`,
          url: "/student",
        },
      });
    } catch (e) { /* noop */ }

    alert("결제창이 열렸습니다. 학생이 로그인해서 결제할 수 있습니다.");
    setCourseId(""); setSessions(6); setAmount(0); setAmountTouched(false);
    setShowIssue(false);
    load();
  };

  const cancelOrder = async (o) => {
    if (!window.confirm(`"${o.course_title}" 결제 요청을 취소할까요?`)) return;
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    if (error) return alert("취소 실패: " + error.message);
    load();
  };

  const pending = orders.filter((o) => o.status === "pending");
  const paid = orders.filter((o) => o.status === "paid");

  const fmtDate = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-bold text-seum-navy">결제</h4>
        <button type="button" onClick={() => setShowIssue((v) => !v)}
          className="rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a63c4]">
          {showIssue ? "닫기" : "+ 결제창 발행"}
        </button>
      </div>

      {/* 결제창 발행 폼 */}
      {showIssue && (
        <div className="mb-3 space-y-2 rounded-lg border border-dashed border-seum-blue bg-blue-50/30 p-3">
          <select value={courseId} onChange={(e) => onPickCourse(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
            <option value="">과정 선택...</option>
            <optgroup label="1:1">
              {courses.filter((c) => c.type === "oneonone").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title.replace("1:1 ", "")}{c.price ? ` (회당 ${Number(c.price).toLocaleString()}원)` : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="단체반">
              {courses.filter((c) => c.type === "group" && (!branchId || c.branch_id === branchId)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}{c.price ? ` (${Number(c.price).toLocaleString()}원)` : ""}
                </option>
              ))}
            </optgroup>
          </select>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-0.5 block text-[11px] text-slate-500">
                회차{isOneOnOne && unitPrice > 0 && <span className="text-seum-blue"> · 회당 {Number(unitPrice).toLocaleString()}원</span>}
              </label>
              <input type="number" min={1} value={sessions}
                onChange={(e) => { setSessions(Number(e.target.value)); setAmountTouched(false); }}
                disabled={!!selCourse && !isOneOnOne}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue disabled:bg-slate-100 disabled:text-slate-400" />
            </div>
            <div className="flex-1">
              <label className="mb-0.5 block text-[11px] text-slate-500">
                금액{!amountTouched && selCourse && <span className="text-slate-400"> · 자동</span>}
              </label>
              <input type="number" value={amount}
                onChange={(e) => { setAmount(Number(e.target.value)); setAmountTouched(true); }}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
            </div>
          </div>

          {amount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-seum-blue">{Number(amount).toLocaleString()}원</span>
              {amountTouched && (
                <button type="button" onClick={() => setAmountTouched(false)}
                  className="text-[11px] text-slate-400 underline hover:text-slate-600">자동계산으로</button>
              )}
            </div>
          )}

          <button type="button" onClick={issue} disabled={issuing}
            className="w-full rounded-lg bg-seum-blue py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
            {issuing ? "발행 중..." : "결제창 열기"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">불러오는 중...</p>
      ) : (
        <div className="space-y-3">
          {/* 결제 대기 */}
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              결제 대기 {pending.length > 0 && <span className="text-amber-600">({pending.length})</span>}
            </p>
            {pending.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">없음</p>
            ) : (
              <div className="space-y-1.5">
                {pending.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-seum-navy">{o.course_title}</p>
                      <p className="text-[11px] text-slate-500">
                        {o.sessions}회 · {Number(o.amount).toLocaleString()}원 · 결제 대기중
                      </p>
                    </div>
                    <button type="button" onClick={() => cancelOrder(o)}
                      className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-50">취소</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 결제 완료 */}
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              결제 완료 {paid.length > 0 && <span className="text-green-600">({paid.length})</span>}
            </p>
            {paid.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">없음</p>
            ) : (
              <div className="space-y-1.5">
                {paid.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-seum-navy">{o.course_title}</p>
                      <p className="text-[11px] text-slate-500">
                        {o.sessions}회 · {Number(o.amount).toLocaleString()}원 · {fmtDate(o.paid_at)} 결제
                      </p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      o.enrollment_id ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                    }`}>
                      {o.enrollment_id ? "✓ 수강 확정" : "승인 대기"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}