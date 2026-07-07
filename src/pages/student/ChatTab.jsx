import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const timeFmt = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function ChatTab({ studentId, locked = false }) {
  const [teacher, setTeacher] = useState(null);
  const [roomId, setRoomId] = useState(null);
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

  const init = async () => {
    setLoading(true);

    const { data: enr } = await supabase
      .from("enrollments")
      .select("teacher_id, teacher:teacher_id(id, name), courses(teacher_id)")
      .eq("student_id", studentId);

    let teacherId = null;
    if (enr && enr.length > 0) {
      const withTeacher = enr.find((e) => e.teacher_id);
      if (withTeacher) {
        teacherId = withTeacher.teacher_id;
      } else {
        const withCourseTeacher = enr.find((e) => e.courses?.teacher_id);
        if (withCourseTeacher) teacherId = withCourseTeacher.courses.teacher_id;
      }
    }

    if (!teacherId) {
      setTeacher(null);
      setLoading(false);
      return;
    }

    const { data: tProfile } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("id", teacherId)
      .single();

    if (!tProfile) {
      setTeacher(null);
      setLoading(false);
      return;
    }
    setTeacher(tProfile);

    let { data: room } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("student_id", studentId)
      .eq("teacher_id", tProfile.id)
      .maybeSingle();

    if (!room) {
      const { data: created } = await supabase
        .from("chat_rooms")
        .insert({ student_id: studentId, teacher_id: tProfile.id })
        .select()
        .single();
      room = created;
    }

    if (room) {
      setRoomId(room.id);
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });
      setMessages(msgs ?? []);
      scrollToBottom();
    }
    setLoading(false);
  };

  useEffect(() => {
    init();
  }, [studentId]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const send = async () => {
    if (locked) return alert("수강이 종료되어 메시지를 보낼 수 없습니다. 재등록 후 이용해주세요.");
    const body = text.trim();
    if (!body || !roomId) return;
    setSending(true);
    setText("");

    const { data: inserted, error } = await supabase
      .from("chat_messages")
      .insert({ room_id: roomId, sender_id: studentId, content: body })
      .select()
      .single();

    if (!error && inserted) {
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
      );
      await supabase
        .from("chat_rooms")
        .update({ last_message: body, last_message_at: new Date().toISOString() })
        .eq("id", roomId);
      scrollToBottom();
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div>
        <h2 className="mb-3 font-bold text-seum-navy">선생님과 채팅</h2>
        <p className="text-slate-400">불러오는 중...</p>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div>
        <h2 className="mb-3 font-bold text-seum-navy">선생님과 채팅</h2>
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          아직 담임 선생님이 지정되지 않았습니다. 원장님께 문의해주세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 font-bold text-seum-navy">선생님과 채팅</h2>
      <p className="mb-3 text-sm text-slate-500">{teacher.name} 선생님</p>

      <div className="flex h-[60vh] flex-col rounded-xl border border-slate-200 bg-white">
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="pt-10 text-center text-sm text-slate-400">
              아직 대화가 없습니다. 먼저 인사를 건네보세요.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === studentId;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex max-w-[75%] items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "bg-seum-blue text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {timeFmt(m.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {locked ? (
          <div className="border-t border-slate-100 p-3">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
              수강이 종료되어 메시지를 보낼 수 없습니다. 지난 대화는 계속 확인하실 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="flex gap-2 border-t border-slate-100 p-3">
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
              type="button"
              onClick={send}
              disabled={sending}
              className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
            >
              전송
            </button>
          </div>
        )}
      </div>
    </div>
  );
}