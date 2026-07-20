import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CATEGORY_LIST, getCategory } from "../../lib/interviewConfig";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CoursesTab({ branchId }) {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [startTime, setStartTime] = useState("19:00");
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(6);
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // 수정 중인 반 id (null이면 신규 개설)

  // 수업 종류
  const [courseKind, setCourseKind] = useState("speech"); // 'speech' | 'interview'

  // 스피치: 단일 요일
  const [weekday, setWeekday] = useState(1);

  // 면접: 다중 요일 + 주차 + 카테고리
  const [weekdays, setWeekdays] = useState([1, 3, 5]); // 기본 월수금
  const [weeks, setWeeks] = useState(4);
  const [itvCategory, setItvCategory] = useState("gov");
  const [itvSub, setItvSub] = useState("incheon");

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

  useEffect(() => { load(); }, []);

  const toggleWeekday = (i) => {
    setWeekdays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort()));
  };

  const onPickItvCategory = (key) => {
    setItvCategory(key);
    const cat = getCategory(key);
    setItvSub(cat?.subs?.length ? cat.subs[0].key : "");
  };

  const sessionsTotal = weekdays.length * (Number(weeks) || 0); // 면접 총 회차

  // DB에서 같은 종류 단체반의 가격을 가져와 자동 채움 (하드코딩 없음)
  const defaultPrice = (kind) => {
    const sameKind = courses.filter(
      (c) =>
        c.type === "group" &&
        c.active !== false &&
        (c.price ?? 0) > 0 &&
        (kind === "interview"
          ? c.course_kind === "interview"
          : c.course_kind !== "interview")
    );
    if (sameKind.length === 0) return 0; // 참조할 반 없으면 0 (직접 입력)
    // 가장 최근 개설된 반의 가격 사용
    return sameKind[0].price;
  };

  const [priceTouched, setPriceTouched] = useState(false);

  const onPickKind = (kind) => {
    setCourseKind(kind);
    if (!priceTouched) setPrice(defaultPrice(kind));
  };

  // 종류 바뀌거나 반 목록 로드되면 가격 자동 갱신
  useEffect(() => {
    if (priceTouched) return;
    if (editingId) return; // 수정 중엔 기존 가격 유지
    setPrice(defaultPrice(courseKind));
  }, [courseKind, courses, priceTouched, editingId]);

  const resetForm = () => {
    setTitle(""); setTeacherId(""); setStartTime("19:00"); setStartDate("");
    setDuration(60); setCapacity(6); setCourseKind("speech");
    setWeekday(1); setWeekdays([1, 3, 5]); setWeeks(4);
    setItvCategory("gov"); setItvSub("incheon");
    setPrice(0); setPriceTouched(false); setDescription("");
    setEditingId(null);
  };

  const openNew = () => {
    if (showForm && !editingId) { setShowForm(false); return; }
    resetForm();
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setTitle(c.title ?? "");
    setTeacherId(c.teacher_id ?? "");
    setStartTime((c.start_time ?? "19:00").slice(0, 5));
    setStartDate(c.start_date ?? "");
    setDuration(c.duration_min ?? 60);
    setCapacity(c.capacity ?? 6);
    setCourseKind(c.course_kind === "interview" ? "interview" : "speech");
    setWeekday(c.weekday ?? 1);
    setWeekdays(Array.isArray(c.weekdays) && c.weekdays.length > 0 ? c.weekdays : [1, 3, 5]);
    setWeeks(c.weeks ?? 4);
    setItvCategory(c.interview_category ?? "gov");
    setItvSub(c.interview_sub ?? "incheon");
    setPrice(c.price ?? 0);
    setPriceTouched(true);  // 기존 가격 유지 (자동 덮어쓰기 방지)
    setDescription(c.description ?? "");
    setShowForm(true);
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`"${c.title}" 반을 삭제할까요?\n\n※ 이미 배정된 학생의 수강 기록은 유지됩니다.`)) return;
    const { error } = await supabase.from("courses").update({ active: false }).eq("id", c.id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    load();
  };

  const handleCreate = async () => {
    if (!title) { alert("반 이름을 입력해주세요."); return; }
    if (!startDate) { alert("개강일을 입력해주세요."); return; }

    const isInterview = courseKind === "interview";
    if (isInterview) {
      if (weekdays.length === 0) { alert("면접반은 요일을 하나 이상 선택하세요."); return; }
      if (!weeks || Number(weeks) < 1) { alert("주차 수를 입력하세요."); return; }
      const cat = getCategory(itvCategory);
      if (cat?.subs?.length && !itvSub) { alert("세부(인천/서울)를 선택하세요."); return; }
    }

    setSaving(true);
    const cat = getCategory(itvCategory);
    const payload = {
      title,
      type: "group",
      branch_id: branchId,
      teacher_id: teacherId || null,
      start_time: startTime,
      start_date: startDate,
      open_month: startDate.slice(0, 7),
      duration_min: Number(duration) || 0,
      capacity: Number(capacity) || 0,
      active: true,
      course_kind: courseKind,
      price: Number(price) || 0,
      description: description || null,
    };

    if (isInterview) {
      payload.weekday = weekdays[0];
      payload.weekdays = weekdays;
      payload.weeks = Number(weeks) || 0;
      payload.sessions_total = sessionsTotal;
      payload.interview_category = itvCategory;
      payload.interview_sub = cat?.subs?.length ? itvSub : null;
    } else {
      payload.weekday = weekday;
      payload.weekdays = null;
      payload.interview_category = null;
      payload.interview_sub = null;
    }

    let error;
    if (editingId) {
      ({ error } = await supabase.from("courses").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("courses").insert(payload));
    }
    setSaving(false);
    if (error) { alert((editingId ? "수정" : "개설") + " 실패: " + error.message); return; }
    resetForm();
    setShowForm(false);
    load();
  };

  const teacherName = (id) => teachers.find((t) => t.id === id)?.name ?? "미배정";

  const availableTeachers = teachers.filter((t) =>
    (t.available_branches ?? []).includes(branchId)
  );

  const groupCourses = courses.filter(
    (c) => c.type === "group" && c.branch_id === branchId
  );

  const catLabel = (c) => {
    if (c.course_kind !== "interview" || !c.interview_category) return null;
    const cat = getCategory(c.interview_category);
    if (!cat) return null;
    const subLabel = cat.subs?.find((s) => s.key === c.interview_sub)?.label;
    return subLabel ? `${cat.label}·${subLabel}` : cat.label;
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-slate-500">단체반 {groupCourses.length}개</p>
        <button onClick={openNew}
          className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4]">
          {showForm ? "닫기" : "+ 단체반 개설"}
        </button>
      </div>

      {/* 개설 폼 */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          {editingId && (
            <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
              ✏️ 반 수정 중 — 이미 배정된 학생의 회차는 변경되지 않습니다.
            </div>
          )}
          {/* 수업 종류 선택 */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-600">수업 종류</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => onPickKind("speech")}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${courseKind === "speech" ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
                스피치 · 보이스 (주 1회)
              </button>
              <button type="button" onClick={() => onPickKind("interview")}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${courseKind === "interview" ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
                면접 (주 N회)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-600">반 이름</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={courseKind === "interview" ? "예) 인천시 공무원 1반" : "예) 성인 스피치 정규반"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">담당 선생님 (이 지점 출강 가능)</label>
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue">
                <option value="">미배정</option>
                {availableTeachers.length === 0 ? (
                  <option value="" disabled>이 지점 출강 가능한 선생님이 없습니다</option>
                ) : (
                  availableTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">개강일</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue" />
            </div>

            {/* 스피치: 단일 요일 / 면접: 다중 요일 */}
            {courseKind === "speech" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">요일</label>
                <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue">
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}요일</option>)}
                </select>
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  요일 선택 (여러 개) · 주 {weekdays.length}회
                </label>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map((d, i) => {
                    const on = weekdays.includes(i);
                    return (
                      <button key={i} type="button" onClick={() => toggleWeekday(i)}
                        className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${on ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">시작 시간</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue" />
            </div>

            {/* 면접: 주차 + 총 회차 */}
            {courseKind === "interview" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">주차 수 (몇 주)</label>
                  <input type="number" min={1} value={weeks} onChange={(e) => { const v = e.target.value; setWeeks(v === "" ? "" : Number(v)); }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue" />
                </div>
                <div className="flex items-end">
                  <div className="w-full rounded-lg border border-seum-blue bg-blue-50 px-3 py-2 text-sm">
                    <span className="text-slate-500">총 회차: </span>
                    <span className="font-bold text-seum-blue">
                      주 {weekdays.length}회 × {weeks}주 = {sessionsTotal}회
                    </span>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">정원</label>
              <input type="number" value={capacity} onChange={(e) => { const v = e.target.value; setCapacity(v === "" ? "" : Number(v)); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">수업 시간(분)</label>
              <input type="number" value={duration} onChange={(e) => { const v = e.target.value; setDuration(v === "" ? "" : Number(v)); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                수강료 (원) {!priceTouched && Number(price) > 0 && <span className="text-xs font-normal text-slate-400">· 기존 반 가격 자동 적용</span>}
              </label>
              <input type="number" value={price}
                onChange={(e) => { const v = e.target.value; setPrice(v === "" ? "" : Number(v)); setPriceTouched(true); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue" />
              <div className="mt-1 flex items-center justify-between">
                {Number(price) > 0 && <span className="text-xs font-bold text-seum-blue">{Number(price).toLocaleString()}원</span>}
                {priceTouched && (
                  <button type="button" onClick={() => { setPriceTouched(false); setPrice(defaultPrice(courseKind)); }}
                    className="text-[11px] text-slate-400 underline hover:text-slate-600">자동값으로</button>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-600">한줄 소개 (수강신청 페이지 표시)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="예) 체계적인 커리큘럼으로 스피치 자신감을 완성합니다."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-seum-blue" />
            </div>



            {/* 면접: 카테고리 배정 (반 개설과 동시에) */}
            {courseKind === "interview" && (
              <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-4">
                <label className="mb-2 block text-sm font-medium text-slate-600">면접 카테고리 (반 학생 전원 적용)</label>
                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CATEGORY_LIST.map((c) => (
                    <button key={c.key} type="button" onClick={() => onPickItvCategory(c.key)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${itvCategory === c.key ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
                {getCategory(itvCategory)?.subs?.length ? (
                  <div className="flex gap-2">
                    {getCategory(itvCategory).subs.map((s) => (
                      <button key={s.key} type="button" onClick={() => setItvSub(s.key)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${itvSub === s.key ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getCategory(itvCategory)?.tabs.map((t) => (
                    <span key={t.key} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{t.label}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleCreate} disabled={saving}
            className="mt-5 w-full rounded-lg bg-seum-navy py-3 font-bold text-white hover:bg-[#24386f] disabled:opacity-60">
            {saving ? (editingId ? "수정 중..." : "개설 중...") : (editingId ? "반 수정하기" : "반 개설하기")}
          </button>
        </div>
      )}

      {/* 목록 */}
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
              {groupCourses.map((c) => {
                const isItv = c.course_kind === "interview";
                const days = Array.isArray(c.weekdays) && c.weekdays.length > 0
                  ? c.weekdays.map((d) => WEEKDAYS[d]).join("·")
                  : WEEKDAYS[c.weekday];
                const cl = catLabel(c);
                return (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-bold text-seum-navy">{c.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isItv ? "bg-indigo-50 text-indigo-600" : "bg-blue-50 text-seum-blue"}`}>
                        {isItv ? "면접반" : "단체반"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">담당: {teacherName(c.teacher_id)}</p>
                    <p className="text-sm text-slate-500">
                      매주 {days}요일 {c.start_time?.slice(0, 5)} · 정원 {c.capacity}명
                    </p>
                    {c.price > 0 && (
                      <p className="text-sm font-bold text-seum-blue">{Number(c.price).toLocaleString()}원</p>
                    )}
                    {isItv && c.sessions_total && (
                      <p className="text-sm text-slate-500">
                        총 {c.sessions_total}회 (주 {c.weekdays?.length}회 × {c.weeks}주)
                      </p>
                    )}
                    {cl && (
                      <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-seum-blue">{cl}</span>
                    )}
                    {c.start_date && <p className="mt-1 text-xs text-slate-400">개강 {c.start_date}</p>}
                    <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                      <button type="button" onClick={() => openEdit(c)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
                        수정
                      </button>
                      <button type="button" onClick={() => handleDelete(c)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-50">
                        삭제
                      </button>
                    </div>
                  </div>
                );
              })}
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