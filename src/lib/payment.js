// src/lib/payment.js
// 결제 로직을 여기 한 곳에 격리한다.
// 지금은 "모의결제"(바로 성공 처리). 나중에 PG(포트원 등) 붙일 때 runPayment 내부만 교체.

import { supabase } from "./supabase";

// 주문번호 생성 (표시/merchant_uid용)
export function makeOrderNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SEUM-${ymd}-${rand}`;
}

// 주문 생성 (pending 상태)
export async function createOrder({ studentId, course, branchId }) {
  const orderNo = makeOrderNo();
  const amount = course.price ?? course.amount ?? course.tuition ?? 0;
  const sessions = course.sessions_total ?? null;

  const { data, error } = await supabase
    .from("orders")
    .insert({
      order_no: orderNo,
      student_id: studentId,
      course_id: course.id,
      branch_id: branchId ?? course.branch_id ?? null,
      course_title: course.title,
      amount,
      sessions,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error("주문 생성 실패: " + error.message);
  return data;
}

// ===== 결제 실행 =====
// ★ 나중에 PG 붙일 때 이 함수 내부만 교체하면 됨.
//    (포트원 SDK 호출 → 성공 콜백에서 아래 markPaid 호출)
export async function runPayment(order) {
  // ---- 지금: 모의결제 (사용자 확인만 받고 성공 처리) ----
  const ok = window.confirm(
    `[모의결제]\n${order.course_title}\n금액: ${order.amount.toLocaleString()}원\n\n실제 결제는 아직 연동 전입니다. 결제 완료로 처리할까요?`
  );
  if (!ok) return { success: false, cancelled: true };

  return await markPaid(order, { pay_method: "mock", pg_provider: "mock", pg_tx_id: "MOCK-" + order.order_no });

  // ---- 나중: 포트원 예시 (교체 시 참고) ----
  // const { IMP } = window;
  // IMP.init("가맹점식별코드");
  // return new Promise((resolve) => {
  //   IMP.request_pay({
  //     pg: "tosspayments", pay_method: "card",
  //     merchant_uid: order.order_no, name: order.course_title, amount: order.amount,
  //   }, async (rsp) => {
  //     if (rsp.success) resolve(await markPaid(order, { pay_method: "card", pg_provider: "portone", pg_tx_id: rsp.imp_uid }));
  //     else resolve({ success: false, error: rsp.error_msg });
  //   });
  // });
}

// 결제 성공 처리 (승인대기 상태로). enrollment는 원장 승인 시 생성.
export async function markPaid(order, payInfo = {}) {
  const now = new Date().toISOString();

  // 1) 주문 상태 paid로 (수강 확정은 원장 승인 후)
  const { data: updated, error: updErr } = await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: now,
      updated_at: now,
      pay_method: payInfo.pay_method ?? null,
      pg_provider: payInfo.pg_provider ?? null,
      pg_tx_id: payInfo.pg_tx_id ?? null,
    })
    .eq("id", order.id)
    .select()
    .single();
  if (updErr) throw new Error("주문 갱신 실패: " + updErr.message);

  // 2) 기존 payments 테이블에도 기록 (매출/환불 관리 일원화)
  try {
    await supabase.from("payments").insert({
      student_id: order.student_id,
      amount: order.amount,
      method: "card",
      status: "paid",
      paid_at: now,
      order_id: order.id,   // orders와 연결 (컬럼 없으면 무시됨)
    });
  } catch (e) { /* payments 기록 실패해도 결제 자체는 유효 */ }

  // 3) 원장에게 알림 (실패해도 무시)
  try {
    supabase.functions.invoke("send-push", {
      body: {
        title: "세움스피치 새 수강신청",
        body: `${order.course_title} 결제 완료 (${order.amount.toLocaleString()}원) — 승인 대기`,
        url: "/admin",
      },
    });
  } catch (e) { /* noop */ }

  return { success: true, order: updated };
}