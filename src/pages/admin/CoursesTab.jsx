import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CoursesTab({ branchId }) {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("19:00");
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(6);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: courseData } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: teacherData } = await supabase
      .from("profiles")
      .select("id, name, available_branches")
      .eq("role", "teacher");
    setCourses(courseData ?? []);
    setTeachers(teacherData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!title) {
      alert("반 이름을 입력해주세요.");
      return;
    }
    if (!startDate) {
      alert("개강일을 입력해주세요.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("courses").insert({
      title,
      type: "group",
      branch_id: branchId,
      teacher_id: teacherId || null,
      weekday,
      start_time: startTime,
      start_date: startDate,
      open_month: startDate.slice(0, 7),
      duration_min: duration,
      capacity,
      active: true,
    });
    setSaving(false);
    if (error) {
      alert("개설 실패: " + error.message);
      return;
    }
    setTitle("");
    setStartDate("");
    setTeacherId("");
    setShowForm(false);
    load();
  };

  const teacherName = (id) =>
    teachers.find((t) => t.id === id)?.name ?? "미배정";

  // 이 지점 출강 가능한 선생님만
  const availableTeachers = teachers.filter((t) =>
    (t.available_branches ?? []).includes(branchId)
  );

  const groupCourses = courses.filter(
    (c) => c.type === "group" && c.branch_id === branchId
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-slate-500">단체반 {groupCourses.length}개</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4]"
        >
          {showForm ? "닫기" : "+ 단체반 개설"}
        </button>
      </div>

      {/* 개설 폼 */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-600">
                반 이름
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예) 성인 스피치 정규반"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                담당 선생님 (이 지점 출강 가능)
              </label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue"
              >
                <option value="">미배정</option>
                {availableTeachers.length === 0 ? (
                  <option value="" disabled>
                    이 지점 출강 가능한 선생님이 없습니다
                  </option>
                ) : (
                  availableTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                개강일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                요일
              </label>
              <select
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue"
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}요일
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                시작 시간
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                정원
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                수업 시간(분)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving}
            className="mt-5 w-full rounded-lg bg-seum-navy py-3 font-bold text-white hover:bg-[#24386f] disabled:opacity-60"
          >
            {saving ? "개설 중..." : "반 개설하기"}
          </button>
        </div>
      )}

      {/* 목록 (폼 닫혀있을 때만) */}
      {!showForm && (
        <>
          {loading ? (
            <p className="text-slate-400">불러오는 중...</p>
          ) : groupCourses.length === 0 ? (
            <p className="py-10 text-center text-slate-400">
              이 지점에 개설된 단체반이 없습니다. "+ 단체반 개설"로 추가하세요.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {groupCourses.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-bold text-seum-navy">{c.title}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-seum-blue">
                      단체반
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    담당: {teacherName(c.teacher_id)}
                  </p>
                  <p className="text-sm text-slate-500">
                    매주 {WEEKDAYS[c.weekday]}요일 {c.start_time?.slice(0, 5)} · 정원{" "}
                    {c.capacity}명
                  </p>
                  {c.start_date && (
                    <p className="mt-1 text-xs text-slate-400">개강 {c.start_date}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="mb-1 text-sm font-bold text-slate-600">1:1 수업 종류</p>
            <p className="text-xs text-slate-400">
              1:1은 반 개설 없이 학생관리에서 바로 등록합니다 (스피치/보이스/프레젠테이션/공무원·공기업·사기업면접).
            </p>
          </div>
        </>
      )}
    </div>
  );
}