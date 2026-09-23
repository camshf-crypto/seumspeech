// src/pages/student/AiChatPanel.jsx
//
// 객관식 화면과 주관식 화면이 같이 쓰는 AI 채팅창.
// 대화 목록(messages)과 남은 횟수는 부모가 들고 있다 — 부모도 제출 검사·붙여넣기 판별에 쓰기 때문.

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase"; // ← PtPractice.jsx의 supabase import 줄과 같게

export default function AiChatPanel({
  sessionId,
  messages,
  setMessages,
  turnsLeft,
  setTurnsLeft,
  locked = false,
  lockedText = "제출한 문제입니다.",
  className = "",
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const disabled = locked || sending || turnsLeft <= 0;

  const send = async () => {
    const text = input.trim();
    if (!text || disabled || !sessionId) return;

    setSending(true);
    setError("");
    const tmpId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tmpId, role: "user", content: text }]);
    setInput("");

    const { data, error: fnErr } = await supabase.functions.invoke("aiwork-chat", {
      body: { session_id: sessionId, message: text },
    });

    if (fnErr || data?.error) {
      let code = data?.error;
      if (fnErr?.context?.json) {
        try {
          code = (await fnErr.context.json()).error;
        } catch {
          /* 무시 */
        }
      }
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      setInput(text);
      if (code === "turn_limit") {
        setTurnsLeft(0);
        setError("질문 횟수를 모두 사용했습니다.");
      } else if (code === "already_submitted") {
        setError("이미 제출했습니다.");
      } else {
        setError("답변을 받지 못했습니다. 잠시 후 다시 보내 주세요.");
      }
    } else {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: data.reply },
      ]);
      setTurnsLeft(data.turns_left);
    }
    setSending(false);
  };

  const placeholder = locked
    ? lockedText
    : turnsLeft <= 0
    ? "질문 횟수를 모두 사용했습니다."
    : "AI에게 요청할 내용을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)";

  return (
    <section className={`flex flex-col bg-white min-h-0 ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold">AI 어시스턴트</span>
        <span className="text-xs text-gray-500">
          남은 질문 <b className="text-gray-900">{Math.max(turnsLeft, 0)}</b>회
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <p className="text-[12.5px] leading-6 text-gray-500 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
          AI를 자유롭게 쓰세요. 주고받은 대화 전체가 기록되고 채점에 반영됩니다.
        </p>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-7 whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto bg-seum-blue text-white rounded-br-sm"
                : "mr-auto bg-gray-100 text-gray-800 rounded-bl-sm"
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="mr-auto bg-gray-100 text-gray-500 rounded-xl px-3.5 py-2.5 text-[13px]">
            답변 작성 중…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="px-4 py-2 text-[12.5px] text-red-700 bg-red-50 border-t border-red-100">
          {error}
        </p>
      )}

      <div className="border-t border-gray-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            disabled={disabled}
            rows={3}
            maxLength={4000}
            placeholder={placeholder}
            className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-[13.5px] leading-6 outline-none focus:border-seum-blue disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={disabled || !input.trim()}
            className="shrink-0 h-10 px-4 rounded-lg bg-seum-navy text-white text-sm font-semibold disabled:opacity-40"
          >
            보내기
          </button>
        </div>
        <p className="mt-1.5 text-right text-[11px] text-gray-400">
          {input.length.toLocaleString()} / 4,000자
        </p>
      </div>
    </section>
  );
}