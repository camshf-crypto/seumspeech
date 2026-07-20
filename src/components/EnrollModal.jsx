import { useState } from "react";
import { supabase } from "../lib/supabase";
import { createOrder, runPayment } from "../lib/payment";

// 수강신청 모달
// props:
//   open, onClose
//   course: { id, title, price(또는 amount), sessions_total, branch_id, start_date, ... }
//   user: 로그인 사용자 (없으면 로그인 유도)
//   onLoginRequest: 로그인/회원가입 화면으로 보내는 콜백
//   onDone: 결제 완료 콜백
export default function EnrollModal({ open, onClose, course, user, onLoginRequest, onDone }) {
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(null); // 완료된 order

  if (!open || !course) return null;

  const amount = course.price ?? course.amount ?? course.tuition ?? 0;
  const loggedIn = !!user;

  const handlePay = async () => {
    if (!loggedIn) { onLoginRequest?.(); return; }
    setProcessing(true);
    try {
      const order = await createOrder({
        studentId: user.id,
        course,
        branchId: course.branch_id,
      });
      const result = await runPayment(order);
      if (result.cancelled) { setProcessing(false); return; }
      if (!result.success) {
        alert("결제 실패: " + (result.error ?? "알 수 없는 오류"));
        setProcessing(false);
        return;
      }
      setDone(result.order);
      onDone?.(result);
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        {done ? (
          /* 완료 화면 */
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-3xl">✓</div>
            <h3 className="mb-1 text-lg font-bold text-seum-navy">신청 완료!</h3>
            <p className="mb-4 text-sm text-slate-500">
              {done.course_title} 결제가 완료되었습니다.<br />
              원장님 확인 후 수강이 확정되며, 곧 안내 연락을 드립니다.<br />
              <span className="text-xs text-slate-400">주문번호 {done.order_no}</span>
            </p>
            <button onClick={() => { setDone(null); onClose?.(); }}
              className="w-full rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4]">
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">수강신청</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {/* 과정 정보 */}
            <div className="mb-4 rounded-xl bg-slate-50 p-4">
              <p className="font-bold text-seum-navy">{course.title}</p>
              {course.start_date && (
                <p className="mt-1 text-xs text-slate-500">개강 {course.start_date}</p>
              )}
              {course.sessions_total && (
                <p className="text-xs text-slate-500">총 {course.sessions_total}회</p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-sm text-slate-500">결제 금액</span>
                <span className="text-lg font-bold text-seum-blue">{amount.toLocaleString()}원</span>
              </div>
            </div>

            {/* 로그인 안내 */}
            {!loggedIn && (
              <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                수강신청은 로그인 후 진행됩니다. 계속하면 로그인/회원가입 화면으로 이동해요.
              </div>
            )}

            <button onClick={handlePay} disabled={processing}
              className="w-full rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
              {processing ? "처리 중..." : loggedIn ? `${amount.toLocaleString()}원 결제하기` : "로그인하고 신청하기"}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              결제 시스템 준비 중 — 현재는 신청 접수로 처리됩니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}