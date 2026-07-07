import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const STATUS_LABEL = {
  new: "신규", scheduled: "방문예약", done: "상담완료",
  enrolled: "등록전환", dropped: "미등록종료",
};

export default function AdminScheduleTab({ branchId }) {
  const [slots, setSlots] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [consults, setConsults] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickTeacher, setPickTeacher] = useState("all");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const load = async () => {
    setLoading(true);
    const { data: av } = await supabase
      .from("teacher_availability")
      .select("*, teacher:teacher_id(name), branch:branch_id(name)")
      .not("date", "is", null);
    const { data: cs } = await supabase
      .from("courses")
      .select("*, teacher:teacher_id(name)")
      .eq("type", "group")
      .eq("active", true);
    const { data: tc } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("role", "teacher");
    const { data: br } = await supabase.from("branches").select("*").order("sort_order");
    const { data: co } = await supabase
      .from("consultations")
      .select("*")
      .not("scheduled_at", "is", null);
    const { data: bk } = await supabase
      .from("lesson_bookings")
      .select("*, teacher:teacher_id(name), student:student_id(name), branch:branch_id(name)");
    setSlots(av ?? []);
    setCourses(cs ?? []);
    setTeachers(tc ?? []);
    setBranches(br ?? []);
    setConsults(co ?? []);
    setBookings(bk ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const branchName = (id) => branches.find((b) => b.id === id)?.name?.replace("점", "") ?? "";

  const { year, month } = cursor;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateStr = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const filterTeacher = (tid) => pickTeacher === "all" || tid === pickTeacher;

  const slotsOnDate = (ds) =>
    slots.filter((s) => s.date === ds && filterTeacher(s.teacher_id));
  const coursesOnDate = (ds) => {
    const wd = new Date(ds).getDay();
    return courses.filter(
      (c) => c.weekday === wd && c.branch_id === branchId && filterTeacher(c.teacher_id)
    );
  };
  const bookingsOnDate = (ds) =>
    bookings.filter((b) => b.date === ds && filterTeacher(b.teacher_id));
  // 상담은 선생님 필터 영향 안 받음 (원장 전체 일정)
  const consultsOnDate = (ds) =>
    consults.filter((c) => {
      if (!c.scheduled_at) return false;
      const d = new Date(c.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return key === ds;
    });

  const consultTime = (ts) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const showConsult = (c) => {
    alert(
      `[방문상담]\n` +
      `이름: ${c.name || "-"}\n` +
      `연락처: ${c.phone || "-"}\n` +
      `일시: ${new Date(c.scheduled_at).toLocaleString("ko-KR")}\n` +
      `상태: ${STATUS_LABEL[c.status] || c.status}\n` +
      (c.needs ? `내용: ${c.needs}\n` : "") +
      (c.memo ? `메모: ${c.memo}` : "")
    );
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () =>
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const nextMonth = () =>
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      {/* 선생님 필터 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setPickTeacher("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${pickTeacher === "all" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          전체 선생님
        </button>
        {teachers.map((t) => (
          <button
            key={t.id}
            onClick={() => setPickTeacher(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${pickTeacher === t.id ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* 달력 */}
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">←</button>
        <h3 className="text-lg font-bold text-seum-navy">{year}년 {month + 1}월</h3>
        <button onClick={nextMonth} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">→</button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`py-2 text-center text-xs font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, idx) => {
          if (d === null) return <div key={`empty-${idx}`} className="min-h-[110px]" />;
          const ds = dateStr(d);
          const wd = new Date(year, month, d).getDay();
          const daySlots = slotsOnDate(ds);
          const dayCourses = coursesOnDate(ds);
          const dayConsults = consultsOnDate(ds);
          const dayBookings = bookingsOnDate(ds);
          return (
            <div key={d} className="min-h-[110px] rounded-lg border border-slate-200 bg-white p-1.5 align-top">
              <span className={`text-xs font-bold ${wd === 0 ? "text-red-400" : wd === 6 ? "text-blue-400" : "text-slate-600"}`}>{d}</span>
              <div className="mt-1 space-y-0.5">
                {daySlots.map((s) => (
                  <div key={s.id} className="truncate rounded bg-green-500/15 px-1 py-0.5 text-[9px] leading-tight text-green-700">
                    {s.start_time.slice(0, 5)}~{s.end_time.slice(0, 5)}
                    {pickTeacher === "all" && s.teacher?.name && ` ${s.teacher.name}`}
                  </div>
                ))}
                {dayCourses.map((c) => (
                  <div key={c.id} className="truncate rounded bg-seum-blue/15 px-1 py-0.5 text-[9px] leading-tight text-seum-blue">
                    [{branchName(c.branch_id)}] {c.start_time?.slice(0, 5)} {c.title}
                  </div>
                ))}
                {dayBookings.map((b) => (
                  <div key={b.id} className="truncate rounded bg-seum-blue/25 px-1 py-0.5 text-[9px] font-medium leading-tight text-seum-blue">
                    {b.start_time?.slice(0, 5)} {b.student?.name}
                    {pickTeacher === "all" && b.teacher?.name ? ` (${b.teacher.name})` : ""}
                  </div>
                ))}
                {dayConsults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => showConsult(c)}
                    className="block w-full truncate rounded bg-amber-500/20 px-1 py-0.5 text-left text-[9px] leading-tight text-amber-700 hover:bg-amber-500/30"
                  >
                    🗓 {consultTime(c.scheduled_at)} {c.name} 상담
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">초록 = 선생님 가능시간 / 파랑 = 수업 / 주황 = 방문상담 (클릭 시 상세)</p>
    </div>
  );
}