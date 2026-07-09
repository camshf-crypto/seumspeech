import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function InquiryAdminTab() {
  const { profile } = useAuth();
  const [inquiries, setInquiries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open"); // open | all
  const bottomRef = useRef(null);

  // AI 요약 / 전송
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [sendToTeacher, setSendToTeacher] = useState("");
  const [sendingMemo, setSendingMemo] = useState(false);

  const loadInquiries = async () => {
    let q = supabase
      .from("chat_inquiries")
      .select("*")
      .order("updated_at", { ascending: false });
    if (filter === "open") q = q.eq("status", "open");
    const { data } = await q;
    setInquiries(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadInquiries(); }, [filter]);

  // 선생님 목록 로드 (요약 전송용)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "teacher")
        .order("name");
      setTeachers(data ?? []);
    })();
  }, []);

  // 문의 목록 실시간
  useEffect(() => {
    const ch = supabase
      .channel("admin-inquiries")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_inquiries" }, () => loadInquiries())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [filter]);

  // 선택한 문의 메시지 로드 + 실시간
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setSummary(selected.summary ?? ""); // 기존 요약 있으면 표시
    setSendToTeacher("");
    (async () => {
      const { data } = await supabase
        .from("chat_inquiry_messages")
        .select("*")
        .eq("inquiry_id", selected.id)
        .order("created_at", { ascending: true });
      if (active) setMessages(data ?? []);
    })();

    const ch = supabase
      .channel(`admin-msg-${selected.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_inquiry_messages", filter: `inquiry_id=eq.${selected.id}` },
        (payload) => {
          const m = payload.new;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();

    const ch2 = supabase
      .channel(`admin-inq-${selected.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_inquiries", filter: `id=eq.${selected.id}` },
        (payload) => setSelected((prev) => (prev ? { ...prev, ...payload.new } : prev))
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
      supabase.removeChannel(ch2);
    };
  }, [selected?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !selected) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    const { data: msg, error } = await supabase
      .from("chat_inquiry_messages")
      .insert({ inquiry_id: selected.id, sender: "staff", sender_id: profile.id, content: text })
      .select()
      .single();
    await supabase.from("chat_inquiries").update({ updated_at: new Date().toISOString() }).eq("id", selected.id);
    setSending(false);
    if (error) return alert("전송 실패: " + error.message);
    setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
  };

  const requestInfo = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("chat_inquiries")
      .update({ info_requested: true })
      .eq("id", selected.id);
    if (error) return alert("요청 실패: " + error.message);
    await supabase.from("chat_inquiry_messages").insert({
      inquiry_id: selected.id,
      sender: "staff",
      sender_id: profile.id,
      content: "상담 안내를 위해 성함과 연락처를 남겨주시겠어요? 아래 입력창에 작성해주세요 🙏",
    });
    setSelected((prev) => (prev ? { ...prev, info_requested: true } : prev));
  };

  const closeInquiry = async () => {
    if (!selected) return;
    if (!window.confirm("이 상담을 종료 처리할까요?")) return;
    await supabase.from("chat_inquiries").update({ status: "closed" }).eq("id", selected.id);
    setSelected(null);
    loadInquiries();
  };

  // AI 요약 실행 (Edge Function 호출)
  const runSummary = async () => {
    if (!selected) return;
    setSummarizing(true);
    setSummary("");
    try {
      const { data, error } = await supabase.functions.invoke("summarize-inquiry", {
        body: { inquiry_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSummary(data.summary ?? "");
      setSelected((prev) => (prev ? { ...prev, summary: data.summary } : prev));
    } catch (e) {
      alert("요약 실패: " + (e?.message ?? e));
    } finally {
      setSummarizing(false);
    }
  };

  // 요약을 선택한 선생님 메모로 전송
  const sendMemo = async () => {
    if (!summary) return alert("먼저 AI 요약을 생성하세요.");
    if (!sendToTeacher) return alert("전송할 선생님을 선택하세요.");
    setSendingMemo(true);

    // 개인정보는 메모에 함께 저장 (DB에서 직접 - AI 안 거침)
    const who = selected.info_submitted ? selected.visitor_name : "방문자";
    const contact = selected.info_submitted
      ? `\n\n[연락처] ${selected.visitor_phone ?? "-"}${selected.visitor_email ? ` / ${selected.visitor_email}` : ""}`
      : "";
    const memoContent = summary + contact;

    const { error } = await supabase.from("teacher_memos").insert({
      teacher_id: sendToTeacher,
      title: `홈페이지 상담 요약 - ${who}`,
      content: memoContent,
      source: "inquiry",
      inquiry_id: selected.id,
      created_by: profile.id,
    });
    setSendingMemo(false);
    if (error) return alert("전송 실패: " + error.message);
    const tName = teachers.find((t) => t.id === sendToTeacher)?.name ?? "선생님";
    alert(`${tName}님께 상담 요약을 전송했습니다.`);
    setSendToTeacher("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-seum-navy">1:1 문의 (홈페이지 채팅)</h2>
        <div className="flex gap-2">
          <button onClick={() => setFilter("open")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === "open" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600"}`}>
            진행중
          </button>
          <button onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === "all" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600"}`}>
            전체
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 문의 목록 */}
        <div className="md:col-span-1">
          {loading ? (
            <p className="text-sm text-slate-400">불러오는 중...</p>
          ) : inquiries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
              {filter === "open" ? "진행중인 문의가 없습니다." : "문의가 없습니다."}
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {inquiries.map((q) => {
                const isSel = selected?.id === q.id;
                return (
                  <button key={q.id} onClick={() => setSelected(q)}
                    className={`w-full rounded-xl border p-3 text-left transition ${isSel ? "border-seum-blue bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-seum-navy">
                        {q.info_submitted ? q.visitor_name : "방문자"}
                        {q.status === "closed" ? <span className="ml-1 text-[10px] text-slate-400">(종료)</span> : null}
                      </span>
                      <span className="text-[11px] text-slate-400">{fmtTime(q.updated_at)}</span>
                    </div>
                    {q.info_submitted && q.visitor_phone ? (
                      <p className="mt-0.5 text-xs text-slate-500">{q.visitor_phone}</p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-amber-500">정보 미입력</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 채팅 영역 */}
        <div className="md:col-span-2">
          {!selected ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
              왼쪽에서 문의를 선택하세요.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex h-[50vh] flex-col overflow-hidden rounded-xl border border-slate-200">
                {/* 방문자 정보 헤더 */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <div className="text-sm">
                    <span className="font-bold text-seum-navy">
                      {selected.info_submitted ? selected.visitor_name : "방문자"}
                    </span>
                    {selected.info_submitted ? (
                      <span className="ml-2 text-xs text-slate-500">
                        {selected.visitor_phone}
                        {selected.visitor_email ? ` · ${selected.visitor_email}` : ""}
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-amber-500">정보 미입력</span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {!selected.info_submitted ? (
                      <button onClick={requestInfo} disabled={selected.info_requested}
                        className="rounded-lg border border-seum-blue px-2.5 py-1 text-xs font-medium text-seum-blue hover:bg-blue-50 disabled:opacity-50">
                        {selected.info_requested ? "요청함" : "정보 요청"}
                      </button>
                    ) : null}
                    {selected.status !== "closed" ? (
                      <button onClick={closeInquiry}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100">
                        상담 종료
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* 메시지 */}
                <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
                  {messages.map((m) => {
                    const staff = m.sender === "staff";
                    return (
                      <div key={m.id} className={`flex ${staff ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                          staff ? "rounded-br-sm bg-seum-blue text-white" : "rounded-bl-sm bg-white text-slate-700 shadow-sm"
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* 입력 */}
                {selected.status !== "closed" ? (
                  <div className="flex items-end gap-2 border-t border-slate-200 p-2">
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} rows={1}
                      placeholder="답변을 입력하세요..."
                      className="max-h-24 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                    <button onClick={send} disabled={sending || !input.trim()}
                      className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                      전송
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-slate-200 bg-slate-50 py-3 text-center text-xs text-slate-400">
                    종료된 상담입니다.
                  </div>
                )}
              </div>

              {/* AI 요약 + 선생님 전송 */}
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-seum-navy">AI 상담 요약</h4>
                  <button onClick={runSummary} disabled={summarizing}
                    className="rounded-lg bg-seum-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-[#24386f] disabled:opacity-60">
                    {summarizing ? "요약 중..." : summary ? "다시 요약" : "AI 요약"}
                  </button>
                </div>

                {summary ? (
                  <>
                    <pre className="mb-3 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                      {summary}
                    </pre>
                    {/* 선생님 선택 + 전송 */}
                    <div className="flex items-center gap-2">
                      <select value={sendToTeacher} onChange={(e) => setSendToTeacher(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
                        <option value="">선생님 선택...</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button onClick={sendMemo} disabled={sendingMemo || !sendToTeacher}
                        className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                        {sendingMemo ? "전송 중..." : "선생님께 전송"}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">※ 요약은 대화 내용만 AI로 처리됩니다. 연락처 등 개인정보는 전송 시 별도로 첨부됩니다.</p>
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 py-4 text-center text-xs text-slate-400">
                    "AI 요약" 버튼을 누르면 상담 내용을 정리해드립니다.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}