import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const fmtDate = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function TeacherMemosTab({ teacherId }) {
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("teacher_memos")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    setMemos(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [teacherId]);

  // 새 메모 실시간
  useEffect(() => {
    const ch = supabase
      .channel(`teacher-memos-${teacherId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "teacher_memos", filter: `teacher_id=eq.${teacherId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teacherId]);

  const openMemo = async (m) => {
    setOpenId(openId === m.id ? null : m.id);
    // 읽음 처리
    if (!m.read_at) {
      await supabase.from("teacher_memos").update({ read_at: new Date().toISOString() }).eq("id", m.id);
      setMemos((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <h2 className="mb-4 font-bold text-seum-navy">받은 상담 메모</h2>

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : memos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          받은 상담 메모가 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {memos.map((m) => {
            const isOpen = openId === m.id;
            const unread = !m.read_at;
            return (
              <div key={m.id} className={`rounded-xl border p-4 ${unread ? "border-seum-blue bg-blue-50/40" : "border-slate-200"}`}>
                <button onClick={() => openMemo(m)} className="flex w-full items-start justify-between text-left">
                  <div>
                    <p className="font-bold text-seum-navy">
                      {unread ? <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-seum-blue align-middle" /> : null}
                      {m.title ?? "상담 메모"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{fmtDate(m.created_at)}</p>
                  </div>
                  <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen ? (
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                    {m.content}
                  </pre>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}