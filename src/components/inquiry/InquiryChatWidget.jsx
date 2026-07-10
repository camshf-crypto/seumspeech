import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const STORAGE_KEY = "seum_inquiry_id"; // 브라우저에 문의 ID 저장

export default function InquiryChatWidget({ open, onClose }) {
  const [inquiryId, setInquiryId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);

  // 정보 요청/입력
  const [infoRequested, setInfoRequested] = useState(false);
  const [infoSubmitted, setInfoSubmitted] = useState(false);
  const [vName, setVName] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  const bottomRef = useRef(null);
  const startedRef = useRef(false);

  // 모바일 키보드 대응 (사파리/크롬/네이버앱/카톡 인앱 브라우저 전부 커버)
  // visualViewport로 실제 보이는 높이와 위치를 추적. 없으면 window.innerHeight fallback.
  const [vp, setVp] = useState({ height: null, offsetTop: 0 });
  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const vv = window.visualViewport;
    const update = () => {
      if (vv) {
        setVp({ height: vv.height, offsetTop: vv.offsetTop || 0 });
      } else {
        // 인앱 브라우저 중 visualViewport 없는 구형 대비
        setVp({ height: window.innerHeight, offsetTop: 0 });
      }
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
  }, [messages, infoRequested, infoSubmitted]);

  // 위젯 열리면: 저장된 문의 있으면 이어가고, 없으면 새로 생성
  useEffect(() => {
    if (!open) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const init = async () => {
      setStarting(true);

      // 1) 브라우저에 저장된 문의 ID 확인
      let savedId = null;
      try {
        savedId = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        savedId = null;
      }

      if (savedId) {
        // 저장된 문의가 아직 유효한지(진행중인지) 확인
        const { data: existing } = await supabase
          .from("chat_inquiries")
          .select("*")
          .eq("id", savedId)
          .maybeSingle();

        if (existing && existing.status !== "closed") {
          // 이전 대화 이어가기
          setInquiryId(existing.id);
          setInfoRequested(!!existing.info_requested);
          setInfoSubmitted(!!existing.info_submitted);

          const { data: msgs } = await supabase
            .from("chat_inquiry_messages")
            .select("*")
            .eq("inquiry_id", existing.id)
            .order("created_at", { ascending: true });
          setMessages(msgs ?? []);
          setStarting(false);
          return;
        }
        // 종료됐거나 없어진 문의 → 저장 삭제하고 새로 시작
        try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
      }

      // 2) 새 문의 생성
      const { data, error } = await supabase
        .from("chat_inquiries")
        .insert({ visitor_name: "방문자", visitor_phone: "", status: "open" })
        .select()
        .single();

      if (error) {
        setStarting(false);
        alert("문의 연결 실패: " + error.message);
        return;
      }
      setInquiryId(data.id);
      try { window.localStorage.setItem(STORAGE_KEY, data.id); } catch {}

      const greeting =
        "안녕하세요! 세움스피치입니다 😊\n" +
        "무엇을 도와드릴까요? 편하게 문의 남겨주세요.";
      const { data: msg } = await supabase
        .from("chat_inquiry_messages")
        .insert({ inquiry_id: data.id, sender: "staff", content: greeting })
        .select()
        .single();

      setMessages(msg ? [msg] : []);
      setStarting(false);
    };
    init();
  }, [open]);

  // 실시간 구독
  useEffect(() => {
    if (!inquiryId) return;

    const msgChannel = supabase
      .channel(`inquiry-msg-${inquiryId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_inquiry_messages", filter: `inquiry_id=eq.${inquiryId}` },
        (payload) => {
          const m = payload.new;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();

    const inqChannel = supabase
      .channel(`inquiry-row-${inquiryId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_inquiries", filter: `id=eq.${inquiryId}` },
        (payload) => {
          const row = payload.new;
          setInfoRequested(!!row.info_requested);
          setInfoSubmitted(!!row.info_submitted);
          // 상담원이 종료하면 저장 삭제 (다음엔 새로 시작)
          if (row.status === "closed") {
            try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(inqChannel);
    };
  }, [inquiryId]);

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

  // 데스크탑(sm 이상 640px)에선 인라인 높이/위치 스타일 안 줌 (CSS 클래스로 처리)
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

      {/* 채팅 */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
        {starting && messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">연결 중...</p>
        ) : null}
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

        {/* 정보 입력 카드 */}
        {infoRequested && !infoSubmitted ? (
          <div className="rounded-xl border border-seum-blue/30 bg-white p-3 shadow-sm">
            <p className="mb-2 text-sm font-bold text-seum-navy">📩 상담 안내를 위한 정보 입력</p>
            <p className="mb-3 text-xs text-slate-500">남겨주신 정보로 상담 일정과 안내를 도와드려요.</p>
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
    </div>
  );
}