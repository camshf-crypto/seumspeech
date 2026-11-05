import { useState } from "react";
import { BRANCHES, CLASS_LIST } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { createOrder, runPayment } from "../lib/payment";
import { ONLINE_CLASSES, OnlineTopBar } from "./OnlineEnroll";

/**
 * 결제 페이지 (/checkout?type=offline|online&class=수업명)
 *   왼쪽: 주문 상품 · 수강권 선택 · 쿠폰
 *   오른쪽: 결제 금액 · 결제수단 · 약관 동의 · 결제하기
 * 결제는 lib/payment.js (PG 붙기 전에는 모의결제) → 원장 승인 후 수강 확정
 */

const won = (n) => `${Number(n || 0).toLocaleString()}원`;
const priceNum = (p) => Number(String(p ?? "").replace(/[^0-9]/g, "")) || 0;

const METHODS = [
  { key: "card", name: "신용·체크카드", desc: "국내 전 카드 · 최대 12개월 할부", icon: "💳", bg: "bg-slate-100" },
];

// 주소의 수업명으로 수업 찾기 → 결제 화면에 쓸 모양으로
function findItem() {
  const q = new URLSearchParams(window.location.search);
  const type = q.get("type") === "online" || window.location.pathname.startsWith("/online") ? "online" : "offline";
  const name = q.get("class");
  const c = (type === "online" ? ONLINE_CLASSES : CLASS_LIST).find((x) => x.name === name);
  if (!c) return null;
  const branchName = type === "online" ? "온라인" : BRANCHES.find((b) => b.id === c.branch)?.name ?? "";
  const price = priceNum(c.price);
  return {
    type,
    raw: c,
    name: c.name,
    sub: [branchName, c.teacher].filter(Boolean).join(" · "),
    branchName,
    thumb: c.thumb ?? c.name.replace(/\s*\(.*\)/, "").split(" ").join("\n"),
    tickets: [
      {
        key: "main",
        label: c.ticket ?? "정규반 수강권",
        price,
        listPrice: Math.max(priceNum(c.listPrice), price), // 정가 없으면 결제 금액과 같게
        lines: [c.period, c.time].filter(Boolean),
      },
    ],
  };
}

export default function Checkout() {
  const { user, profile, role } = useAuth();
  const [item] = useState(findItem);
  const [ticketKey, setTicketKey] = useState("main");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [method, setMethod] = useState("card");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  if (!item) {
    return (
      <Shell>
        <p className="py-32 text-center text-slate-400">신청할 수업을 찾을 수 없어요. 수강신청 화면에서 다시 골라 주세요.</p>
      </Shell>
    );
  }

  // 로그인 안 됨 → 로그인하고 이 화면으로 돌아오기
  if (!user) {
    const here = window.location.pathname + window.location.search;
    window.location.replace(`/login?${new URLSearchParams({ next: here })}`);
    return null;
  }
  if (role && role !== "student") {
    return (
      <Shell>
        <p className="py-32 text-center text-slate-500">학생 계정으로 로그인해야 결제할 수 있어요. (지금 로그인: {profile?.name ?? "관리자"})</p>
      </Shell>
    );
  }

  const ticket = item.tickets.find((t) => t.key === ticketKey) ?? item.tickets[0];
  const saleOff = ticket.listPrice - ticket.price; // 정가에서 할인된 금액
  const discount = 0; // 쿠폰 생기면 여기서 빼기
  const total = Math.max(0, ticket.price - discount);

  const pay = async () => {
    if (!agree) { alert("결제 진행 및 이용약관에 동의해 주세요."); return; }
    setBusy(true);
    try {
      let branchId = null;
      if (item.type === "offline") {
        const { data: br } = await supabase.from("branches").select("id, name");
        const key = item.branchName.replace(/서울|인천|점|\s/g, "");
        branchId = (br ?? []).find((b) => key && b.name.replace(/\s/g, "").includes(key))?.id ?? null;
      }
      const order = await createOrder({
        studentId: user.id,
        course: { id: null, title: `${item.name} · ${item.branchName} · ${ticket.label}`, price: total },
        branchId,
      });
      const result = await runPayment(order, method);
      if (result.cancelled) return;
      if (!result.success) throw new Error(result.error ?? "결제 실패");
      setDone(result.order);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-24 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl text-seum-blue">✓</div>
          <h1 className="mb-2 text-2xl font-extrabold text-slate-800">결제가 완료되었어요</h1>
          <p className="mb-1 text-slate-500">{item.name}</p>
          <p className="mb-6 text-sm leading-relaxed text-slate-500">
            원장님 확인 후 수강이 확정되며, 곧 안내 연락을 드립니다.
            <br /><span className="text-xs text-slate-400">주문번호 {done.order_no} · {won(done.amount)}</span>
          </p>
          <button type="button" onClick={() => (window.location.href = "/my")}
            className="w-full rounded-xl bg-seum-blue py-4 font-bold text-white hover:bg-[#2a63c4]">
            내 강의실로 가기
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start">
        {/* ───── 왼쪽 ───── */}
        <div>
          <h2 className="mb-4 text-2xl font-extrabold text-slate-800">주문 상품</h2>
          <div className="mb-10 flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex h-[92px] w-[150px] shrink-0 items-center rounded-xl bg-gradient-to-br from-seum-navy to-seum-blue px-4">
              <p className="whitespace-pre-line text-[15px] font-extrabold leading-tight text-white">{item.thumb}</p>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-sm text-slate-400">{item.sub}</p>
              <p className="mb-2 font-bold text-slate-800">{item.name}</p>
              <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-seum-blue">
                {item.type === "online" ? "온라인 수업" : "오프라인 수업"}
              </span>
            </div>
          </div>

          <h2 className="mb-4 text-2xl font-extrabold text-slate-800">수강권 선택</h2>
          <button type="button" onClick={() => setTicketOpen((v) => !v)}
            className="mb-3 flex w-full items-center justify-between rounded-2xl border-2 border-seum-blue bg-white px-5 py-4 text-left">
            <span>
              <span className="block font-bold text-seum-blue">{ticket.label}</span>
              <span className="text-sm text-slate-500">
                {saleOff > 0 && <span className="mr-2 text-slate-400 line-through">{won(ticket.listPrice)}</span>}
                {won(ticket.price)}
              </span>
            </span>
            <span className={`text-seum-blue transition ${ticketOpen ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {ticketOpen && item.tickets.length > 1 && (
            <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {item.tickets.map((t) => (
                <button key={t.key} type="button" onClick={() => { setTicketKey(t.key); setTicketOpen(false); }}
                  className="block w-full border-b border-slate-100 px-5 py-3 text-left last:border-0 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">{t.label}</span>
                  <span className="ml-2 text-sm text-slate-400">{won(t.price)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mb-10 rounded-2xl bg-slate-50 p-6">
            <p className="mb-1 flex items-center gap-2 font-bold text-slate-800">
              {ticket.label}
              <span className="rounded bg-seum-blue px-2 py-0.5 text-xs font-bold text-white">대표</span>
            </p>
            <p className="mb-4 text-sm text-slate-400">{item.type === "online" ? "온라인 화상 수업" : item.branchName}</p>
            {ticket.lines.map((l) => (
              <p key={l} className="mb-1.5 flex items-center gap-2 text-sm text-slate-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] text-seum-blue">✓</span>
                {l}
              </p>
            ))}
          </div>

          <h2 className="mb-4 text-2xl font-extrabold text-slate-800">쿠폰</h2>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-400">
            <span>🎟 사용 가능한 쿠폰이 없어요</span>
            <span>⌄</span>
          </div>
        </div>

        {/* ───── 오른쪽: 결제 ───── */}
        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-7 lg:sticky lg:top-28">
          <h2 className="mb-4 border-b border-slate-200 pb-4 text-lg font-extrabold text-slate-800">결제 금액</h2>
          <div className="flex justify-between border-b border-slate-200 pb-4 text-slate-500">
            <span>정가</span><span className="text-slate-700">{won(ticket.listPrice)}</span>
          </div>
          {saleOff > 0 && (
            <div className="flex justify-between border-b border-slate-200 py-4 text-slate-500">
              <span>할인</span>
              <span className="font-semibold text-red-500">
                -{won(saleOff)} <span className="text-xs">({Math.round((saleOff / ticket.listPrice) * 100)}%)</span>
              </span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between border-b border-slate-200 py-4 text-slate-500">
              <span>쿠폰 할인</span><span className="text-red-500">-{won(discount)}</span>
            </div>
          )}
          <div className="flex items-end justify-between border-b border-slate-200 py-6">
            <span className="font-bold text-slate-800">최종 결제금액</span>
            <span className="text-3xl font-extrabold text-slate-900">
              {total.toLocaleString()}<span className="text-base font-bold">원</span>
            </span>
          </div>

          <h3 className="mb-3 mt-6 font-bold text-slate-800">결제수단</h3>
          <div className="space-y-3">
            {METHODS.map((m) => {
              const on = method === m.key;
              return (
                <button key={m.key} type="button" onClick={() => setMethod(m.key)}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition ${on ? "border-seum-blue" : "border-slate-200 hover:border-slate-300"}`}>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${m.bg}`}>{m.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-800">{m.name}</span>
                    <span className="block text-sm text-slate-400">{m.desc}</span>
                  </span>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-seum-blue" : "border-slate-300"}`}>
                    {on && <span className="h-3 w-3 rounded-full bg-seum-blue" />}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="mt-6 flex cursor-pointer items-center gap-3 text-slate-700">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-5 w-5 accent-seum-blue" />
            <span>[필수] 결제 진행 및 이용약관에 동의합니다</span>
          </label>

          <button type="button" onClick={pay} disabled={busy || total <= 0}
            className={`mt-5 w-full rounded-xl py-4 text-lg font-bold text-white transition ${agree ? "bg-seum-blue hover:bg-[#2a63c4]" : "bg-slate-300"} disabled:opacity-60`}>
            {busy ? "처리 중..." : "결제하기"}
          </button>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  // 온라인 화면엔 위 헤더가 없어서 위 여백을 줄인다
  const online = window.location.pathname.startsWith("/online");
  return (
    <>
      {online && <OnlineTopBar />}
      <section className={`min-h-screen bg-white pb-24 ${online ? "pt-12" : "pt-28"}`}>
        <div className="mx-auto max-w-6xl px-4 md:px-6">{children}</div>
      </section>
    </>
  );
}