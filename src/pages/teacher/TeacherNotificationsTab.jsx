import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const timeAgo = (ts) => {
  const d = new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const ICON = { chat: "💬", homework: "📝", payment: "💳", refund: "↩️" };

export default function TeacherNotificationsTab({ userId, onGoTab, onRead }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [userId]);

  const markOneRead = async (n) => {
    if (!n.read_at) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      );
      if (onRead) onRead();
    }
    if (n.link_tab && onGoTab) onGoTab(n.link_tab);
  };

  const markAllRead = async () => {
    const now = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    if (onRead) onRead();
  };

  const unreadCount = items.filter((x) => !x.read_at).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-seum-navy">알림</h2>
        {unreadCount > 0 ? (
          <button onClick={markAllRead} className="text-sm font-medium text-seum-blue hover:underline">
            모두 읽음
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          알림이 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const unread = !n.read_at;
            return (
              <button
                key={n.id}
                onClick={() => markOneRead(n)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                  unread
                    ? "border-blue-100 bg-blue-50 hover:bg-blue-100"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">{ICON[n.type] ?? "🔔"}</span>
                <div className="flex-1">
                  <p className="font-medium text-seum-navy">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-sm text-slate-600">{n.body}</p> : null}
                  <p className="mt-1 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                </div>
                {unread ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-seum-blue" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}