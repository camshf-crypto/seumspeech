import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const timeFmt = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const dateFmt = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const endDate = (startDate, total) => {
  if (!startDate || !total) return null;
  const d = new Date(startDate);
  d.setDate(d.getDate() + (total - 1) * 7);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

// 완료로 간주할 status (실제 값 다르면 여기만 수정)
const DONE_STATUS = ["완료", "completed", "done", "finished", "종료", "수강완료"];

export default function TeacherChatTab({ teacherId, onRead }) {
  const [groupCards, setGroupCards] = useState([]);
  const [oneCards, setOneCards] = useState([]);
  const [courseType, setCourseType] = useState("group");
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const loadCards = async () => {
    setLoading(true);

    // ✅ 담당으로 배정된 학생만: enrollments.teacher_id = 나
    const { data: enr } = await supabase
      .from("enrollments")
      .select(
        "student_id, status, total_sessions, remaining_sessions, " +
          "courses(title, type, weekday, start_time, start_date, branch:branch_id(name)), " +
          "student:student_id(id, name)"
      )
      .eq("teacher_id", teacherId);

    const all = enr ?? [];

    // 완료 거르기
    const active = all.filter((e) => {
      const st = (e.status ?? "").toString();
      const done =
        DONE_STATUS.includes(st) ||
        DONE_STATUS.includes(st.toLowerCase()) ||
        e.remaining_sessions === 0;
      return !done;
    });

    // 학생+반 단위로 카드 만들기 (중복 제거: studentId+title)
    const seen = new Set();
    const groups = [];
    const ones = [];

    for (const e of active) {
      if (!e.student?.id) continue;
      const key = `${e.student.id}-${e.courses?.title ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const isOne = e.courses?.type === "oneonone";
      const card = {
        studentId: e.student.id,
        studentName: e.student.name,
        courseTitle: e.courses?.title ?? "-",
        branchName: e.courses?.branch?.name ?? null,
        weekday: e.courses?.weekday,
        startTime: e.courses?.start_time,
        startDate: e.courses?.start_date,
        totalSessions: e.total_sessions,
        remaining: e.remaining_sessions,
        isOne,
      };
      (isOne ? ones : groups).push(card);
    }

    // 각 학생 방 확보 + 안읽음 수
    const attachRoom = async (cards) => {
      const out = [];
      for (const c of cards) {
        let { data: room } = await supabase
          .from("chat_rooms")
          .select("*")
          .eq("student_id", c.studentId)
          .eq("teacher_id", teacherId)
          .maybeSingle();
        if (!room) {
          const { data: created } = await supabase
            .from("chat_rooms")
            .insert({ student_id: c.studentId, teacher_id: teacherId })
            .select()
            .single();
          room = created;
        }
        const { data: unreadMsgs } = await supabase
          .from("chat_messages")
          .select("id")
          .eq("room_id", room.id)
          .neq("sender_id", teacherId)
          .is("read_at", null);
        out.push({ ...c, roomId: room.id, unread: unreadMsgs ? unreadMsgs.length : 0 });
      }
      return out;
    };

    setGroupCards(await attachRoom(groups));
    setOneCards(await attachRoom(ones));
    setLoading(false);
  };

  useEffect(() => {
    loadCards();
  }, [teacherId]);

  const markRead = async (roomId) => {
    await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .neq("sender_id", teacherId)
      .is("read_at", null);
    if (onRead) onRead();
  };

  const openRoom = async (card) => {
    setActiveRoom(card);
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", card.roomId)
      .order("created_at", { ascending: true });
    setMessages(msgs ?? []);
    await markRead(card.roomId);
    const setter = card.isOne ? setOneCards : setGroupCards;
    setter((prev) =>
      prev.map((r) => (r.roomId === card.roomId ? { ...r, unread: 0 } : r))
    );
    scrollToBottom();
  };

  const backToList = () => {
    setActiveRoom(null);
    setMessages([]);
  };

  useEffect(() => {
    if (!activeRoom) return;
    const channel = supabase
      .channel(`troom-${activeRoom.roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${activeRoom.roomId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          if (payload.new.sender_id !== teacherId) markRead(activeRoom.roomId);
          scrollToBottom();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom]);

  const send = async () => {
    const body = text.trim();
    if (!body || !activeRoom) return;
    setSending(true);
    setText("");
    const { data: inserted, error } = await supabase
      .from("chat_messages")
      .insert({ room_id: activeRoom.roomId, sender_id: teacherId, content: body })
      .select()
      .single();
    if (!error && inserted) {
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
      );
      await supabase
        .from("chat_rooms")
        .update({ last_message: body, last_message_at: new Date().toISOString() })
        .eq("id", activeRoom.roomId);
      scrollToBottom();
    }
    setSending(false);
  };

  const cards = courseType === "oneonone" ? oneCards : groupCards;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      {!activeRoom ? (
        <div>
          <h2 className="mb-4 font-bold text-seum-navy">학생 채팅</h2>

          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setCourseType("group")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                courseType === "group"
                  ? "bg-seum-blue text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              단체반 ({groupCards.length})
            </button>
            <button
              onClick={() => setCourseType("oneonone")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                courseType === "oneonone"
                  ? "bg-seum-blue text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              1:1 ({oneCards.length})
            </button>
          </div>

          {loading ? (
            <p className="text-slate-400">불러오는 중...</p>
          ) : cards.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
              진행 중인 학생이 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {cards.map((c) => (
                <button
                  key={c.roomId}
                  onClick={() => openRoom(c)}
                  className="relative flex flex-col rounded-xl border border-slate-200 p-3 text-left transition hover:border-seum-blue hover:bg-slate-50"
                >
                  {c.unread > 0 ? (
                    <span className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                      {c.unread}
                    </span>
                  ) : null}

                  <p className="truncate text-sm font-bold text-seum-navy">{c.studentName}</p>

                  {!c.isOne ? (
                    <>
                      <p className="mt-1 truncate text-xs font-medium text-slate-600">
                        {c.courseTitle}
                      </p>
                      {c.branchName ? (
                        <span className="mt-1 inline-block w-fit rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-seum-blue">
                          {c.branchName}
                        </span>
                      ) : null}
                      <p className="mt-1 text-[11px] text-slate-400">
                        매주 {WEEKDAYS[c.weekday] ?? "-"} {c.startTime?.slice(0, 5) ?? ""}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {dateFmt(c.startDate)} ~ {endDate(c.startDate, c.totalSessions) ?? "-"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 truncate text-xs font-medium text-slate-600">
                        {c.courseTitle}
                      </p>
                      <span className="mt-1 inline-block w-fit rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        1:1
                      </span>
                    </>
                  )}

                  <p className="mt-2 text-[11px] text-slate-400">잔여 {c.remaining ?? "-"}회</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-[65vh] flex-col">
          <div className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3">
            <button
              onClick={backToList}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
            >
              ← 목록
            </button>
            <div>
              <p className="font-bold text-seum-navy">{activeRoom.studentName} 학생</p>
              <p className="text-xs text-slate-400">
                {activeRoom.courseTitle}
                {activeRoom.branchName ? ` · ${activeRoom.branchName}` : ""}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
            {messages.length === 0 ? (
              <p className="pt-10 text-center text-sm text-slate-400">아직 대화가 없습니다.</p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === teacherId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`flex max-w-[75%] items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          mine ? "bg-seum-blue text-white" : "border border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">{timeFmt(m.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="메시지를 입력하세요"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
            />
            <button
              onClick={send}
              disabled={sending}
              className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
            >
              전송
            </button>
          </div>
        </div>
      )}
    </div>
  );
}