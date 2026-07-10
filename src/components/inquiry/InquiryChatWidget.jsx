import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const STORAGE_KEY = "seum_inquiry_id";

const CATEGORIES = [
  { key: "취업면접", label: "취업·공무원 면접" },
  { key: "스피치", label: "스피치" },
  { key: "발표불안", label: "발표불안" },
  { key: "보이스", label: "보이스" },
];

export default function InquiryChatWidget({ open, onClose }) {
  const [step, setStep] = useState("intro"); // intro(정보입력) | chat
  const [inquiryId, setInquiryId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // 최초 입력 정보
  const [nickname, setNickname] = useState("");
  const [last4, setLast4] = useState("");
  const [category, setCategory] = useState("");
  const [starting, setStarting] = useState(false);

  // 정보 요청/입력 (상담 중 상담원이 추가 정보 요청 시)
  const [infoRequested, setInfoRequested] = useState(false);
  const [infoSubmitted, setInfoSubmitted] = useState(false);
  const [vName, setVName] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  const bottomRef = useRef(null);
  const checkedRef = useRef(false);

  // 모바일 키보드 대응
  const [vp, setVp] = useState({ height: null, offsetTop: 0 });
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const vv = window.visualViewport;
    const update = () => {
      if (vv) setVp({ height: vv.height, offsetTop: vv.offsetTop || 0 });
      else setVp({ height: window.innerHeight, offsetTop: 0 });
    };
    update();
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, infoRequested, infoSubmitted, step]);

  // 위젯 열리면: 저장된 문의 있으면 바로 이어가기 (정보입력 건너뜀)
  useEffect(() => {
    if (!open) return;
    if (checkedRef.current) return;
    checkedRef.current = true;

    const checkExisting = async () => {
      let savedId = null;
      try { savedId = window.localStorage.getItem(STORAGE_KEY); } catch { savedId = null; }
      if (!savedId) return;

      const { data: existing } = await supabase
        .from("chat_inquiries")
        .select("*")
        .eq("id", savedId)
        .maybeSingle();

      if (existing && existing.status !== "closed") {
        setInquiryId(existing.id);
        setInfoRequested(!!existing.info_requested);
        setInfoSubmitted(!!existing.info_submitted);
        const { data: msgs } = await supabase
          .from("chat_inquiry_messages")
          .select("*")
          .eq("inquiry_id", existing.id)
          .order("created_at", { ascending: true });
        setMessages(msgs ?? []);
        setStep("chat"); // 이전 대화 있으니 바로 채팅
      } else {
        try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
      }
    };
    checkExisting();
  }, [open]);

  // 실시간 구독
  useEffect(() => {
    if (!inquiryId) return;
    const msgChannel = supabase
      .channel(`inquiry-msg-${inquiryId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_inquiry_messages", filter: `inquiry_id=eq.${inquiryId}` },
        (payload) => {
          const m = payload.new;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      ).subscribe();

    const inqChannel = supabase
      .channel(`inquiry-row-${inquiryId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_inquiries", filter: `id=eq.${inquiryId}` },
        (payload) => {
          const row = payload.new;
          setInfoRequested(!!row.info_requested);
          setInfoSubmitted(!!row.info_submitted);
          if (row.status === "closed") {
            try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(inqChannel);
    };
  }, [inquiryId]);

  // 정보 입력 후 상담 시작
  const startChat = async () => {
    if (!nickname.trim()) return alert("닉네임을 입력해주세요.");
    if (!/^\d{4}$/.test(last4)) return alert("숫자 4자리를 입력해주세요. (연락처 뒷자리 등)");
    if (!category) return alert("상담 분야를 선택해주세요.");

    setStarting(true);
    const { data, error } = await supabase
      .from("chat_inquiries")
      .insert({
        visitor_name: nickname.trim(),   // 닉네임을 이름 칸에도 저장
        nickname: nickname.trim(),
        phone_last4: last4,
        category: category,
        visitor_phone: "",
        status: "open",
      })
      .select()
      .single();

    if (error) {
      setStarting(false);
      return alert("상담 시작 실패: " + error.message);
    }
    setInquiryId(data.id);
    try { window.localStorage.setItem(STORAGE_KEY, data.id); } catch {}

    const greeting =
      `안녕하세요 ${nickname.trim()}님! 세움스피치입니다 😊\n` +
      `${CATEGORIES.find((c) => c.key === category)?.label ?? category} 관련 문의 주셨네요.\n` +
      `편하게 말씀해주시면 안내해드리겠습니다.`;
    const { data: msg } = await supabase
      .from("chat_inquiry_messages")
      .insert({ inquiry_id: data.id, sender: "staff", content: greeting })
      .select()
      .single();

    setMessages(msg ? [msg] : []);
    setStep("chat");
    setStarting(false);

    // 원장/스태프에게 푸시 알림 발송 (실패해도 상담엔 지장 없게)
    try {
      supabase.functions.invoke("send-push", {
        body: {
          title: "세움스피치 새 상담",
          body: `${nickname.trim()}님 (${CATEGORIES.find((c) => c.key === category)?.label ?? category}) 상담 문의`,
          url: "/admin",
        },
      });
    } catch (e) {
      // 알림 실패는 무시
    }
  };

  const send = async () => {
    if (!input.trim() || !inquiryId) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    const { data: msg, error } = await supabase
      .from("chat_inquiry_messages")
      .insert({ inquiry_id: inquiryId, sender: "visitor", content: text })
      .select()
      .single();
    await supabase.from("chat_inquiries").update({ updated_at: new Date().toISOString() }).eq("id", inquiryId);
    setSending(false);
    if (error) return alert("전송 실패: " + error.message);
    setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));

    // 방문자가 메시지 보낼 때마다 원장에게 푸시 (실패해도 무시)
    try {
      const who = nickname.trim() || "방문자";
      supabase.functions.invoke("send-push", {
        body: {
          title: `${who}님 메시지`,
          body: text.length > 40 ? text.slice(0, 40) + "..." : text,
          url: "/admin",
        },
      });
    } catch (e) {
      // 알림 실패 무시
    }
  };

  const submitInfo = async () => {
    if (!vName.trim()) return alert("이름을 입력해주세요.");
    if (!vPhone.trim()) return alert("연락처를 입력해주세요.");
    setSavingInfo(true);
    const { error } = await supabase
      .from("chat_inquiries")
      .update({
        visitor_name: vName.trim(),
        visitor_phone: vPhone.trim(),
        visitor_email: vEmail.trim() || null,
        info_submitted: true,
        info_requested: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiryId);
    setSavingInfo(false);
    if (error) return alert("저장 실패: " + error.message);
    setInfoSubmitted(true);
    setInfoRequested(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) return null;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const mobileStyle = isMobile
    ? (vp.height ? { height: `${vp.height}px`, top: `${vp.offsetTop}px` } : { height: "100dvh", top: 0 })
    : {};

  return (
    <div className="fixed inset-x-0 z-[70] flex flex-col bg-white sm:inset-auto sm:bottom-4 sm:right-4 sm:top-auto sm:h-[560px] sm:max-h-[85vh] sm:w-[360px] sm:max-w-[calc(100vw-2rem)] sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl"
      style={mobileStyle}>
      {/* 헤더 */}
      <div className="flex flex-shrink-0 items-center justify-between bg-seum-navy px-4 py-3 text-white">
        <div>
          <p className="text-sm font-bold">세움스피치 1:1 문의</p>
          <p className="text-[11px] text-white/70">보통 몇 분 내 답변드려요</p>
        </div>
        <button onClick={onClose} aria-label="닫기" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10">✕</button>
      </div>

      {step === "intro" ? (
        /* 최초 정보 입력 */
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-slate-600">
            원활한 상담을 위해 간단한 정보를 남겨주세요.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">닉네임 <span className="text-red-500">*</span></label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="예: 스피치왕"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">숫자 4자리 <span className="text-red-500">*</span></label>
            <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="연락처 뒷 4자리" inputMode="numeric" maxLength={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
            <p className="mt-1 text-[11px] text-slate-400">본인 확인용이에요. 연락처 뒷자리를 추천드려요.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">상담 분야 <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${category === c.key ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={startChat} disabled={starting}
            className="w-full rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
            {starting ? "연결 중..." : "1:1 상담 시작하기"}
          </button>
        </div>
      ) : (
        /* 채팅 */
        <>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
            {messages.map((m) => {
              const mine = m.sender === "visitor";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    mine ? "rounded-br-sm bg-seum-blue text-white" : "rounded-bl-sm bg-white text-slate-700 shadow-sm"
                  }`}>
                    {m.content}
                  </div>
                </div>
              );
            })}

            {/* 상담원 추가정보 요청 카드 */}
            {infoRequested && !infoSubmitted ? (
              <div className="rounded-xl border border-seum-blue/30 bg-white p-3 shadow-sm">
                <p className="mb-2 text-sm font-bold text-seum-navy">📩 상담 안내를 위한 정보 입력</p>
                <div className="space-y-2">
                  <input value={vName} onChange={(e) => setVName(e.target.value)} placeholder="이름 *"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                  <input value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="연락처 * (010-0000-0000)" inputMode="tel"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                  <input value={vEmail} onChange={(e) => setVEmail(e.target.value)} placeholder="이메일 (선택)" inputMode="email"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                  <button onClick={submitInfo} disabled={savingInfo}
                    className="w-full rounded-lg bg-seum-blue py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                    {savingInfo ? "저장 중..." : "정보 남기기"}
                  </button>
                </div>
              </div>
            ) : null}

            {infoSubmitted ? (
              <div className="rounded-lg bg-green-50 px-3 py-2 text-center text-xs text-green-600">
                ✓ 정보가 전달되었습니다. 곧 안내드릴게요!
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {/* 입력 */}
          <div className="flex flex-shrink-0 items-end gap-2 border-t border-slate-200 bg-white p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 300)}
              rows={1}
              placeholder="메시지를 입력하세요..."
              disabled={!inquiryId}
              className="max-h-24 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue disabled:bg-slate-100"
            />
            <button onClick={send} disabled={sending || !input.trim() || !inquiryId}
              className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
              전송
            </button>
          </div>
        </>
      )}
    </div>
  );
}