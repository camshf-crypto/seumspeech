import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// DB값(영어) ↔ 화면(한글)
const STATUS = [
  { key: "new", label: "신규", color: "bg-amber-50 text-amber-600" },
  { key: "scheduled", label: "방문예약", color: "bg-blue-50 text-seum-blue" },
  { key: "done", label: "상담완료", color: "bg-green-50 text-green-600" },
  { key: "enrolled", label: "등록전환", color: "bg-emerald-100 text-emerald-700" },
  { key: "dropped", label: "미등록종료", color: "bg-slate-100 text-slate-500" },
];
const statusLabel = (s) => STATUS.find((x) => x.key === s)?.label ?? s ?? "신규";
const statusStyle = (s) => STATUS.find((x) => x.key === s)?.color ?? "bg-slate-100 text-slate-500";

const weekRange = (base) => {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
};

const fmtDate = (d) => `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function ConsultTab({ branchId }) {
  const [weekBase, setWeekBase] = useState(new Date());
  const [inquiries, setInquiries] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [scheduling, setScheduling] = useState(null);

  const { start, end } = weekRange(weekBase);

  const load = async () => {
    setLoading(true);

    const { data: inq } = await supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: allCons } = await supabase
      .from("consultations")
      .select("inquiry_id");
    const usedIds = new Set((allCons ?? []).map((c) => c.inquiry_id).filter(Boolean));
    setInquiries((inq ?? []).filter((q) => !usedIds.has(q.id)));

    const { data } = await supabase
      .from("consultations")
      .select("*")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [weekBase]);

  const prevWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); };
  const nextWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); };
  const thisWeek = () => setWeekBase(new Date());

  const byDay = {};
  items.forEach((it) => {
    const d = new Date(it.scheduled_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (byDay[key] = byDay[key] || []).push(it);
  });

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const deleteInquiry = async (id) => {
    if (!window.confirm("이 문의를 삭제할까요?")) return;
    await supabase.from("inquiries").delete().eq("id", id);
    load();
  };

  // 문의를 바로 '상담완료'로 처리 (전화로 끝난 경우)
  const phoneClose = async (q) => {
    if (!window.confirm("전화 상담으로 종료 처리할까요?")) return;
    const { error } = await supabase.from("consultations").insert({
      inquiry_id: q.id,
      name: q.name,
      phone: q.phone,
      needs: q.message,
      status: "done",
      scheduled_at: new Date().toISOString(),
    });
    if (error) return alert("처리 실패: " + error.message);
    load();
  };

  return (
    <div>
      {/* 새 문의 */}
      <div className="mb-6">
        <h2 className="mb-3 font-bold text-seum-navy">
          새 상담 문의
          {inquiries.length > 0 ? (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
              {inquiries.length}
            </span>
          ) : null}
        </h2>
        {inquiries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
            새로 들어온 문의가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {inquiries.map((q) => (
              <div key={q.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-seum-navy">{q.name || "이름없음"}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{q.phone || "-"}</p>
                    {q.message ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{q.message}</p> : null}
                    <p className="mt-1 text-xs text-slate-400">{new Date(q.created_at).toLocaleString("ko-KR")}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col gap-1">
                    <button onClick={() => setScheduling(q)} className="rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a63c4]">방문 예약</button>
                    <button onClick={() => phoneClose(q)} className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50">전화상담 종료</button>
                    <button onClick={() => deleteInquiry(q.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-white">삭제</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 주간 일정 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-seum-navy">상담 일정</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">← 이전주</button>
          <button onClick={thisWeek} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">이번 주</button>
          <button onClick={nextWeek} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">다음주 →</button>
        </div>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        {start.getFullYear()}.{fmtDate(start)} ~ {fmtDate(new Date(end.getTime() - 86400000))}
        <span className="ml-2 text-slate-400">· 총 {items.length}건</span>
      </p>

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayItems = byDay[key] ?? [];
            const isToday = new Date().toDateString() === day.toDateString();
            return (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`text-sm font-bold ${isToday ? "text-seum-blue" : "text-seum-navy"}`}>
                    {day.getMonth() + 1}월 {day.getDate()}일 ({WEEKDAYS[day.getDay()]})
                  </span>
                  {isToday ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-seum-blue">오늘</span> : null}
                  <span className="text-xs text-slate-400">{dayItems.length}건</span>
                </div>
                {dayItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-300">상담 없음</p>
                ) : (
                  <div className="space-y-2">
                    {dayItems.map((it) => (
                      <button key={it.id} onClick={() => setSelected(it)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-seum-blue">{fmtTime(it.scheduled_at)}</span>
                          <div>
                            <p className="text-sm font-medium text-seum-navy">{it.name || "이름없음"}</p>
                            <p className="text-xs text-slate-400">{it.phone || "-"}</p>
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(it.status)}`}>{statusLabel(it.status)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {scheduling ? (
        <ScheduleModal inquiry={scheduling} onClose={() => setScheduling(null)} onSaved={() => { setScheduling(null); load(); }} />
      ) : null}
      {selected ? (
        <ConsultModal consult={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />
      ) : null}
    </div>
  );
}

function ScheduleModal({ inquiry, onClose, onSaved }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!date || !time) return alert("날짜와 시간을 선택하세요.");
    setSaving(true);
    const scheduledAt = new Date(`${date}T${time}:00`);
    const { error } = await supabase.from("consultations").insert({
      inquiry_id: inquiry.id,
      name: inquiry.name,
      phone: inquiry.phone,
      needs: inquiry.message,
      status: "scheduled",
      scheduled_at: scheduledAt.toISOString(),
    });
    setSaving(false);
    if (error) return alert("예약 실패: " + error.message);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md space-y-4 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-seum-navy">방문 상담 예약</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-seum-navy">{inquiry.name}</p>
          <p>{inquiry.phone}</p>
          {inquiry.message ? <p className="mt-1 whitespace-pre-wrap">{inquiry.message}</p> : null}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-slate-500">날짜</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm text-slate-500">시간</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          </div>
        </div>
        <button onClick={save} disabled={saving} className="w-full rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
          {saving ? "저장 중..." : "예약 확정"}
        </button>
      </div>
    </div>
  );
}

function ConsultModal({ consult, onClose, onSaved }) {
  const [status, setStatus] = useState(consult.status || "new");
  const [memo, setMemo] = useState(consult.memo || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("consultations")
      .update({ status, memo, updated_at: new Date().toISOString() })
      .eq("id", consult.id);
    setSaving(false);
    if (error) return alert("저장 실패: " + error.message);
    onSaved();
  };

  const del = async () => {
    if (!window.confirm("이 상담을 삭제할까요?")) return;
    const { error } = await supabase.from("consultations").delete().eq("id", consult.id);
    if (error) return alert("삭제 실패: " + error.message);
    onSaved();
  };

  const d = consult.scheduled_at ? new Date(consult.scheduled_at) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md space-y-4 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-seum-navy">{consult.name || "상담"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="space-y-1 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p>연락처: {consult.phone || "-"}</p>
          <p>일시: {d ? `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${WEEKDAYS[d.getDay()]}) ${fmtTime(consult.scheduled_at)}` : "-"}</p>
          {consult.needs ? <p className="whitespace-pre-wrap">내용: {consult.needs}</p> : null}
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-slate-600">상태</p>
          <div className="flex flex-wrap gap-2">
            {STATUS.map((s) => (
              <button key={s.key} onClick={() => setStatus(s.key)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${status === s.key ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>{s.label}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">전화로 끝나면 '상담완료', 방문 예약이면 '방문예약', 학원 등록하면 '등록전환', 안 하면 '미등록종료'</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-slate-600">상담 메모</p>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={4} placeholder="상담 내용·결과를 기록하세요." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button>
          <button onClick={del} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50">삭제</button>
        </div>
      </div>
    </div>
  );
}