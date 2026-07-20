import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CATEGORY_LIST, getCategory } from "../../lib/interviewConfig";
import StudentPaymentSection from "./StudentPaymentSection";

const INTERVIEW_TITLES = ["1:1 공무원면접", "1:1 공기업면접", "1:1 사기업면접"];
const GONGMUWON = "1:1 공무원면접";
const EXAM_TYPES = ["국가직", "지방직", "서울시", "소방", "경찰", "교육행정", "군무원", "기타"];
const CAREER_LEVELS = ["신입", "경력"];

const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "active", label: "수강중" },
  { key: "waiting", label: "등록대기" },
  { key: "done", label: "완료" },
];

const bkDateFmt = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

export default function StudentsTab({ branchId }) {
  const [students, setStudents] = useState([]);
  const [enrollMap, setEnrollMap] = useState({});
  const [groupCourses, setGroupCourses] = useState([]);
  const [oneCourses, setOneCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [memoText, setMemoText] = useState("");

  const [enrollTab, setEnrollTab] = useState("group");
  const [pickCourse, setPickCourse] = useState("");
  const [sessions, setSessions] = useState(20);
  const [oneType, setOneType] = useState("");
  const [oneTeacher, setOneTeacher] = useState("");
  const [oneSessions, setOneSessions] = useState(10);
  const [examType, setExamType] = useState("");
  const [company, setCompany] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [careerLevel, setCareerLevel] = useState("");
  const [assigning, setAssigning] = useState(false);

  // 1:1 등록 시 첫 수업
  const [firstDate, setFirstDate] = useState("");
  const [firstTime, setFirstTime] = useState("14:00");
  const [firstEndTime, setFirstEndTime] = useState("15:00");

  const [jobCompany, setJobCompany] = useState("");
  const [jobPosition, setJobPosition] = useState("");
  const [jobStatus, setJobStatus] = useState("");

  const [enrollEdits, setEnrollEdits] = useState({});
  const [showAddEnroll, setShowAddEnroll] = useState(false);

  // 수강별 예약(첫 수업) 목록 + 추가 폼 상태
  const [bookingsMap, setBookingsMap] = useState({}); // enrollment_id -> [bookings]
  const [bookForm, setBookForm] = useState({}); // enrollment_id -> {date, time}

  // ===== 면접 카테고리 배정 모달 상태 (기존 질문생성 모달 대체) =====
  const [assignTarget, setAssignTarget] = useState(null); // { student }
  const [assignCategory, setAssignCategory] = useState("");
  const [assignSub, setAssignSub] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  // 학생별 현재 배정 요약 { [studentId]: { category_key, sub_key } }
  const [interviewAssignMap, setInterviewAssignMap] = useState({});

  const loadBase = async () => {
    setLoading(true);
    const { data: st } = await supabase
      .from("profiles").select("*").eq("role", "student")
      .order("created_at", { ascending: false });
    const { data: cs } = await supabase.from("courses").select("*").eq("active", true);
    const { data: tc } = await supabase.from("profiles").select("id, name").eq("role", "teacher");
    const { data: enr } = await supabase
      .from("enrollments")
      .select("*, courses(title, type, branch_id), teacher:teacher_id(name)");
    const { data: ia } = await supabase
      .from("interview_assignments")
      .select("student_id, category_key, sub_key");

    const map = {};
    (enr ?? []).forEach((e) => {
      (map[e.student_id] = map[e.student_id] || []).push(e);
    });
    const iaMap = {};
    (ia ?? []).forEach((a) => { iaMap[a.student_id] = { category_key: a.category_key, sub_key: a.sub_key }; });

    setStudents(st ?? []);
    setEnrollMap(map);
    setInterviewAssignMap(iaMap);
    setGroupCourses((cs ?? []).filter((c) => c.type === "group"));
    setOneCourses((cs ?? []).filter((c) => c.type === "oneonone"));
    setTeachers(tc ?? []);
    setLoading(false);
  };

  useEffect(() => { loadBase(); }, []);

  // 선택 학생의 수업 예약 불러오기
  const loadBookings = async (sid) => {
    const { data: bk } = await supabase
      .from("lesson_bookings")
      .select("*")
      .eq("student_id", sid)
      .order("date")
      .order("start_time");
    const map = {};
    (bk ?? []).forEach((b) => {
      const key = b.enrollment_id ?? "none";
      (map[key] = map[key] || []).push(b);
    });
    setBookingsMap(map);
  };

  const studentStatus = (sid) => {
    const list = enrollMap[sid] ?? [];
    if (list.length === 0) return "waiting";
    return list.some((e) => e.status === "active" && e.remaining_sessions > 0) ? "active" : "done";
  };

  const inBranch = (sid) => {
    const list = enrollMap[sid] ?? [];
    const st = students.find((s) => s.id === sid);
    if (st?.branch_id === branchId) return true;
    return list.some((e) => e.courses?.branch_id === branchId);
  };

  const filtered = students.filter((s) => {
    if (!inBranch(s.id)) return false;
    if (statusTab !== "all" && studentStatus(s.id) !== statusTab) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!((s.name || "").toLowerCase().includes(q) || (s.phone || "").includes(q) || (s.email || "").toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const enrollSummary = (sid) => {
    const list = enrollMap[sid] ?? [];
    if (list.length === 0) return "-";
    return list.map((e) => e.courses?.title?.replace("1:1 ", "") ?? "반").join(", ");
  };
  const remainSummary = (sid) => {
    const list = enrollMap[sid] ?? [];
    if (list.length === 0) return "-";
    return list.map((e) => `${e.remaining_sessions}/${e.total_sessions}`).join(", ");
  };

  const interviewEnroll = (sid) => {
    const list = enrollMap[sid] ?? [];
    return list.find((e) => INTERVIEW_TITLES.includes(e.courses?.title));
  };

  const openStudent = (student) => {
    setSelected(student);
    setEnrollTab("group");
    setPickCourse(""); setOneType(""); setOneTeacher("");
    setExamType(""); setCompany(""); setJobRole(""); setCareerLevel("");
    setFirstDate(""); setFirstTime("14:00");
    setJobCompany(student.job_company ?? "");
    setJobPosition(student.job_position ?? "");
    setJobStatus(student.job_status ?? "");
    const list = enrollMap[student.id] ?? [];
    const edits = {};
    list.forEach((e) => {
      edits[e.id] = {
        total: e.total_sessions ?? 0,
        remain: e.remaining_sessions ?? 0,
        teacher: e.teacher_id ?? "",
        examType: e.exam_type ?? "",
        company: e.company ?? "",
        jobRole: e.job_role ?? "",
        career: e.career_level ?? "",
      };
    });
    setEnrollEdits(edits);
    setBookForm({});
    setShowAddEnroll(false);
    loadMemo(student.id);
    loadBookings(student.id);
  };

  const loadMemo = async (sid) => {
    const { data: nt } = await supabase.from("student_notes").select("*")
      .eq("student_id", sid).order("created_at", { ascending: true });
    const merged = (nt ?? []).map((n) => n.content).filter(Boolean).join("\n");
    setMemoText(merged);
  };

  const closeModal = () => { setSelected(null); loadBase(); };

  const setEdit = (enrollId, key, val) =>
    setEnrollEdits((p) => ({ ...p, [enrollId]: { ...p[enrollId], [key]: val } }));

  const saveAll = async () => {
    setSaving(true);
    try {
      await supabase.from("profiles")
        .update({ job_company: jobCompany, job_position: jobPosition, job_status: jobStatus })
        .eq("id", selected.id);

      const { data: me } = await supabase.auth.getUser();
      await supabase.from("student_notes").delete().eq("student_id", selected.id);
      const body = memoText.trim();
      if (body) {
        await supabase.from("student_notes").insert({
          student_id: selected.id, author_id: me?.user?.id, content: body,
        });
      }

      const list = enrollMap[selected.id] ?? [];
      for (const e of list) {
        const ed = enrollEdits[e.id];
        if (!ed) continue;
        const title = e.courses?.title ?? "";
        const isItv = INTERVIEW_TITLES.includes(title);
        const isGm = title === GONGMUWON;
        const payload = {
          total_sessions: Number(ed.total),
          remaining_sessions: Number(ed.remain),
          teacher_id: ed.teacher || null,
        };
        if (e.courses?.type === "oneonone") {
          payload.exam_type = isGm ? (ed.examType || null) : null;
          payload.company = isItv && !isGm ? (ed.company || null) : null;
          payload.job_role = isItv ? (ed.jobRole || null) : null;
          payload.career_level = isItv ? (ed.career || null) : null;
        }
        await supabase.from("enrollments").update(payload).eq("id", e.id);
      }

      setSaving(false);
      alert("저장되었습니다.");
      closeModal();
    } catch (err) {
      setSaving(false);
      alert("저장 실패: " + err.message);
    }
  };

  const selectedEnroll = selected ? enrollMap[selected.id] ?? [] : [];

  const refreshKeepOpen = async () => {
    await loadBase();
    const { data: fresh } = await supabase.from("profiles").select("*").eq("id", selected.id).single();
    const { data: enr } = await supabase
      .from("enrollments")
      .select("*, courses(title, type, branch_id), teacher:teacher_id(name)")
      .eq("student_id", selected.id);
    setEnrollMap((p) => ({ ...p, [selected.id]: enr ?? [] }));
    const edits = {};
    (enr ?? []).forEach((e) => {
      edits[e.id] = {
        total: e.total_sessions ?? 0,
        remain: e.remaining_sessions ?? 0,
        teacher: e.teacher_id ?? "",
        examType: e.exam_type ?? "",
        company: e.company ?? "",
        jobRole: e.job_role ?? "",
        career: e.career_level ?? "",
      };
    });
    setEnrollEdits(edits);
    if (fresh) setSelected(fresh);
    await loadBookings(selected.id);
  };

  const assignGroup = async () => {
    if (!pickCourse) return alert("반을 선택하세요.");
    setAssigning(true);
    // 선택한 반의 정해진 회차를 자동 사용 (면접반: sessions_total, 없으면 기본 6)
    const course = groupCourses.find((c) => c.id === pickCourse);
    const totalSessions = course?.sessions_total ?? 6;
    const { error } = await supabase.from("enrollments").insert({
      student_id: selected.id, course_id: pickCourse,
      total_sessions: totalSessions, remaining_sessions: totalSessions, status: "active",
    });
    setAssigning(false);
    if (error) return alert("배정 실패: " + error.message);
    setPickCourse("");
    setShowAddEnroll(false);
    await refreshKeepOpen();
  };

  const selectedOneCourse = oneCourses.find((c) => c.id === oneType);
  const selTitle = selectedOneCourse?.title ?? "";
  const isInterview = INTERVIEW_TITLES.includes(selTitle);
  const isGongmuwon = selTitle === GONGMUWON;

  const assignOne = async () => {
    if (!oneType) return alert("1:1 종류를 선택하세요.");
    if (!oneTeacher) return alert("담임 선생님을 선택하세요.");
    setAssigning(true);
    const { data: newEnr, error } = await supabase.from("enrollments").insert({
      student_id: selected.id, course_id: oneType, teacher_id: oneTeacher,
      total_sessions: oneSessions, remaining_sessions: oneSessions, status: "active",
      exam_type: isGongmuwon ? examType : null,
      company: isInterview && !isGongmuwon ? company : null,
      job_role: isInterview ? jobRole : null,
      career_level: isInterview ? careerLevel : null,
    }).select().single();

    if (error) { setAssigning(false); return alert("1:1 등록 실패: " + error.message); }

    // 첫 수업 날짜가 있으면 lesson_bookings에 예약 생성 + 잔여 차감
    if (firstDate && newEnr) {
      const { error: bkErr } = await supabase.from("lesson_bookings").insert({
        teacher_id: oneTeacher,
        student_id: selected.id,
        enrollment_id: newEnr.id,
        date: firstDate,
        start_time: firstTime,
        end_time: firstEndTime || null,
        branch_id: branchId || null,
      });
      if (bkErr) { setAssigning(false); return alert("첫 수업 예약 실패: " + bkErr.message); }
      // 잔여 1 차감
      if (oneSessions > 0) {
        await supabase.from("enrollments")
          .update({ remaining_sessions: oneSessions - 1 })
          .eq("id", newEnr.id);
      }
    }

    setAssigning(false);
    setOneType(""); setOneTeacher(""); setExamType(""); setCompany("");
    setJobRole(""); setCareerLevel(""); setFirstDate(""); setFirstTime("14:00");
    setShowAddEnroll(false);
    await refreshKeepOpen();
  };

  const deleteEnroll = async (enrollId) => {
    if (!window.confirm("이 수강을 삭제할까요? (잘못 등록한 경우)")) return;
    const { error } = await supabase.from("enrollments").delete().eq("id", enrollId);
    if (error) return alert("삭제 실패: " + error.message);
    await refreshKeepOpen();
  };

  // 기존 수강에 수업 예약 추가
  const addBookingToEnroll = async (enroll) => {
    const form = bookForm[enroll.id] ?? {};
    if (!form.date) return alert("날짜를 선택하세요.");
    if (!enroll.teacher_id) return alert("담임 선생님을 먼저 지정하고 저장하세요.");
    const { error } = await supabase.from("lesson_bookings").insert({
      teacher_id: enroll.teacher_id,
      student_id: selected.id,
      enrollment_id: enroll.id,
      date: form.date,
      start_time: form.time || "14:00",
      end_time: form.endTime || null,
      branch_id: branchId || null,
    });
    if (error) return alert("수업 예약 실패: " + error.message);
    // 잔여 1 차감
    if (enroll.remaining_sessions > 0) {
      await supabase.from("enrollments")
        .update({ remaining_sessions: enroll.remaining_sessions - 1 })
        .eq("id", enroll.id);
    }
    setBookForm((p) => ({ ...p, [enroll.id]: { date: "", time: "14:00" } }));
    await refreshKeepOpen();
  };

  const removeBooking = async (id) => {
    if (!window.confirm("이 수업 예약을 삭제할까요?")) return;
    // 삭제 전 정보 조회 후 잔여 복구
    let target = null;
    for (const key in bookingsMap) {
      const found = (bookingsMap[key] ?? []).find((b) => b.id === id);
      if (found) { target = found; break; }
    }
    await supabase.from("lesson_bookings").delete().eq("id", id);
    if (target && target.enrollment_id) {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("remaining_sessions, total_sessions")
        .eq("id", target.enrollment_id)
        .single();
      if (enr && enr.remaining_sessions < enr.total_sessions) {
        await supabase.from("enrollments")
          .update({ remaining_sessions: enr.remaining_sessions + 1 })
          .eq("id", target.enrollment_id);
      }
    }
    await refreshKeepOpen();
  };

  // ===== 면접 카테고리 배정 모달 (기존 질문생성 대체) =====
  const openAssign = (student) => {
    const cur = interviewAssignMap[student.id];
    setAssignTarget({ student });
    if (cur) {
      setAssignCategory(cur.category_key);
      setAssignSub(cur.sub_key ?? "");
    } else {
      setAssignCategory("");
      setAssignSub("");
    }
  };

  const onPickCategory = (key) => {
    setAssignCategory(key);
    const cat = getCategory(key);
    // 공무원이면 첫 세부 자동, 아니면 비움
    setAssignSub(cat?.subs?.length ? cat.subs[0].key : "");
  };

  const saveAssign = async () => {
    if (!assignCategory) return alert("카테고리를 선택하세요.");
    const cat = getCategory(assignCategory);
    if (cat?.subs?.length && !assignSub) return alert("세부(인천/서울)를 선택하세요.");
    setAssignSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("interview_assignments")
      .upsert(
        {
          student_id: assignTarget.student.id,
          category_key: assignCategory,
          sub_key: cat?.subs?.length ? assignSub : null,
          updated_at: now,
        },
        { onConflict: "student_id" }
      );
    setAssignSaving(false);
    if (error) return alert("저장 실패: " + error.message);
    setInterviewAssignMap((p) => ({
      ...p,
      [assignTarget.student.id]: { category_key: assignCategory, sub_key: cat?.subs?.length ? assignSub : null },
    }));
    alert("면접 카테고리가 배정되었습니다. 학생 화면에 해당 질문이 표시됩니다.");
    setAssignTarget(null);
  };

  const clearAssign = async () => {
    if (!window.confirm("이 학생의 면접 카테고리 배정을 해제할까요?")) return;
    setAssignSaving(true);
    const { error } = await supabase.from("interview_assignments").delete().eq("student_id", assignTarget.student.id);
    setAssignSaving(false);
    if (error) return alert("해제 실패: " + error.message);
    setInterviewAssignMap((p) => {
      const next = { ...p };
      delete next[assignTarget.student.id];
      return next;
    });
    alert("배정이 해제되었습니다.");
    setAssignTarget(null);
  };

  const assignBadge = (sid) => {
    const a = interviewAssignMap[sid];
    if (!a) return null;
    const cat = getCategory(a.category_key);
    if (!cat) return null;
    const subLabel = cat.subs?.find((s) => s.key === a.sub_key)?.label;
    return subLabel ? `${cat.label}·${subLabel}` : cat.label;
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  const assignCat = assignCategory ? getCategory(assignCategory) : null;

  return (
    <div>
      {/* 상태 탭 */}
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setStatusTab(t.key)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${statusTab === t.key ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름·연락처·이메일 검색"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
        <span className="flex-shrink-0 text-sm text-slate-500">{filtered.length}명</span>
      </div>

      {/* 데스크탑: 표 (md 이상) */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">연락처</th>
              <th className="px-4 py-3 font-medium">수강</th>
              <th className="px-4 py-3 font-medium">잔여</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">해당하는 학생이 없습니다.</td></tr>
            ) : filtered.map((s) => {
              const stt = studentStatus(s.id);
              const sttLabel = stt === "active" ? "수강중" : stt === "done" ? "완료" : "등록대기";
              const sttColor = stt === "active" ? "bg-green-50 text-green-600" : stt === "done" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-600";
              const hasInterview = !!interviewEnroll(s.id);
              const badge = assignBadge(s.id);
              return (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="cursor-pointer px-4 py-3 font-medium text-seum-navy" onClick={() => openStudent(s)}>{s.name || "이름없음"}</td>
                  <td className="cursor-pointer px-4 py-3 text-slate-500" onClick={() => openStudent(s)}>{s.phone || "-"}</td>
                  <td className="cursor-pointer px-4 py-3 text-slate-600" onClick={() => openStudent(s)}>{enrollSummary(s.id)}</td>
                  <td className="cursor-pointer px-4 py-3 text-slate-600" onClick={() => openStudent(s)}>{remainSummary(s.id)}</td>
                  <td className="cursor-pointer px-4 py-3" onClick={() => openStudent(s)}><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sttColor}`}>{sttLabel}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => openStudent(s)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">수정</button>
                      <button
                        type="button"
                        onClick={() => openAssign(s)}
                        disabled={!hasInterview}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${hasInterview ? "bg-seum-blue text-white hover:bg-[#2a63c4]" : "cursor-not-allowed bg-slate-100 text-slate-300"}`}
                        title={hasInterview ? "면접 카테고리 배정" : "1:1 면접 수강생만 가능"}
                      >
                        면접설정
                      </button>
                      {badge && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-seum-blue">{badge}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드 (md 미만) */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">해당하는 학생이 없습니다.</p>
        ) : filtered.map((s) => {
          const stt = studentStatus(s.id);
          const sttLabel = stt === "active" ? "수강중" : stt === "done" ? "완료" : "등록대기";
          const sttColor = stt === "active" ? "bg-green-50 text-green-600" : stt === "done" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-600";
          const hasInterview = !!interviewEnroll(s.id);
          const badge = assignBadge(s.id);
          return (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between" onClick={() => openStudent(s)}>
                <div className="min-w-0">
                  <p className="font-bold text-seum-navy">{s.name || "이름없음"}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{s.phone || "연락처 없음"}</p>
                </div>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${sttColor}`}>{sttLabel}</span>
              </div>

              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm" onClick={() => openStudent(s)}>
                <div className="flex justify-between gap-3">
                  <span className="flex-shrink-0 text-slate-400">수강</span>
                  <span className="text-right text-slate-700">{enrollSummary(s.id)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="flex-shrink-0 text-slate-400">잔여</span>
                  <span className="text-right text-slate-700">{remainSummary(s.id)}</span>
                </div>
                {badge && (
                  <div className="flex justify-between gap-3">
                    <span className="flex-shrink-0 text-slate-400">면접</span>
                    <span className="text-right font-medium text-seum-blue">{badge}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => openStudent(s)} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">수정</button>
                <button
                  type="button"
                  onClick={() => openAssign(s)}
                  disabled={!hasInterview}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium ${hasInterview ? "bg-seum-blue text-white hover:bg-[#2a63c4]" : "cursor-not-allowed bg-slate-100 text-slate-300"}`}
                >
                  면접설정
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 상세 모달 — 항상 편집 가능 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={closeModal}>
          <div className="my-8 w-full max-w-2xl space-y-5 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">{selected.name}</h3>
              <div className="flex items-center gap-4">
                <button type="button" onClick={saveAll} disabled={saving} className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button type="button" onClick={closeModal} className="ml-1 text-lg text-slate-400 hover:text-slate-700">✕</button>
              </div>
            </div>
            <p className="text-sm text-slate-500">{selected.phone} · {selected.email}</p>

            {/* 직업 정보 */}
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="mb-2 text-sm font-bold text-slate-600">직업 정보</p>
              <div className="space-y-2">
                <input value={jobStatus} onChange={(e) => setJobStatus(e.target.value)} placeholder="신분" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                <input value={jobCompany} onChange={(e) => setJobCompany(e.target.value)} placeholder="현재 직장/소속" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                <input value={jobPosition} onChange={(e) => setJobPosition(e.target.value)} placeholder="현재 직무/직책" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
              </div>
            </div>

            {/* 메모장 */}
            <div>
              <h4 className="mb-2 font-bold text-seum-navy">메모장</h4>
              <textarea value={memoText} onChange={(e) => setMemoText(e.target.value)} rows={6}
                placeholder="학생 관련 메모를 자유롭게 작성하세요."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
            </div>

            {/* 결제 (결제창 발행 / 대기 / 완료) */}
            <div className="rounded-lg border border-slate-200 p-4">
              <StudentPaymentSection
                student={selected}
                branchId={branchId}
                courses={[...groupCourses, ...oneCourses]}
              />
            </div>

            {/* 수강 현황 — 항상 편집폼 */}
            <div>
              <h4 className="mb-2 font-bold text-seum-navy">수강 현황</h4>
              {selectedEnroll.length === 0 ? (
                <p className="mb-3 text-sm text-slate-400">배정된 반이 없습니다.</p>
              ) : (
                <div className="mb-3 space-y-3">
                  {selectedEnroll.map((e) => {
                    const title = e.courses?.title ?? "";
                    const isItv = INTERVIEW_TITLES.includes(title);
                    const isGm = title === GONGMUWON;
                    const isOne = e.courses?.type === "oneonone";
                    const ed = enrollEdits[e.id] ?? {};
                    const enrBookings = bookingsMap[e.id] ?? [];
                    const bf = bookForm[e.id] ?? { date: "", time: "14:00" };
                    return (
                      <div key={e.id} className="rounded-lg bg-slate-50 px-4 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">
                            {e.courses?.title}
                            <span className="ml-2 text-xs text-slate-400">{isOne ? "1:1" : "단체반"}</span>
                          </span>
                          <button type="button" onClick={() => deleteEnroll(e.id)} className="rounded px-1.5 text-sm text-red-400 hover:bg-red-50 hover:text-red-600" title="수강 삭제">✕</button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-14 text-xs text-slate-500">잔여/총</span>
                          <input type="number" value={ed.remain ?? 0} onChange={(ev) => setEdit(e.id, "remain", ev.target.value)} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                          <span className="text-sm text-slate-400">/</span>
                          <input type="number" value={ed.total ?? 0} onChange={(ev) => setEdit(e.id, "total", ev.target.value)} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                          <span className="text-sm text-slate-500">회</span>
                        </div>

                        {isOne && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="w-14 text-xs text-slate-500">담임</span>
                            <select value={ed.teacher ?? ""} onChange={(ev) => setEdit(e.id, "teacher", ev.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
                              <option value="">미지정</option>
                              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                        )}

                        {isGm && (
                          <div className="mt-2 flex gap-2">
                            <select value={ed.examType ?? ""} onChange={(ev) => setEdit(e.id, "examType", ev.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue">
                              <option value="">시험종류...</option>
                              {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input value={ed.jobRole ?? ""} onChange={(ev) => setEdit(e.id, "jobRole", ev.target.value)} placeholder="직렬" className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                          </div>
                        )}

                        {isItv && !isGm && (
                          <div className="mt-2 flex gap-2">
                            <input value={ed.company ?? ""} onChange={(ev) => setEdit(e.id, "company", ev.target.value)} placeholder="지원 회사명" className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                            <input value={ed.jobRole ?? ""} onChange={(ev) => setEdit(e.id, "jobRole", ev.target.value)} placeholder="지원 직무" className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                          </div>
                        )}

                        {isItv && (
                          <div className="mt-2 flex gap-2">
                            {CAREER_LEVELS.map((lv) => (
                              <button type="button" key={lv} onClick={() => setEdit(e.id, "career", lv)} className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${ed.career === lv ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>{lv}</button>
                            ))}
                          </div>
                        )}

                        {/* 1:1 수업 예약 (첫 수업 등) */}
                        {isOne && (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                            <p className="mb-1.5 text-xs font-bold text-seum-navy">수업 일정</p>
                            {enrBookings.length === 0 ? (
                              <p className="mb-2 text-xs text-slate-400">잡힌 수업이 없습니다.</p>
                            ) : (
                              <div className="mb-2 space-y-1">
                                {enrBookings.map((b) => (
                                  <div key={b.id} className="flex items-center justify-between rounded bg-blue-50 px-2 py-1 text-xs text-seum-blue">
                                    <span>{bkDateFmt(b.date)} {b.start_time?.slice(0, 5)}</span>
                                    <button type="button" onClick={() => removeBooking(b.id)} className="text-slate-400 hover:text-red-500">✕</button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <input type="date" value={bf.date} onChange={(ev) => setBookForm((p) => ({ ...p, [e.id]: { ...bf, date: ev.target.value } }))} className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-seum-blue" />
                              <input type="time" value={bf.time} onChange={(ev) => setBookForm((p) => ({ ...p, [e.id]: { ...bf, time: ev.target.value } }))} className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-seum-blue" />
                              <span className="text-xs text-slate-400">~</span>
                              <input type="time" value={bf.endTime ?? "15:00"} onChange={(ev) => setBookForm((p) => ({ ...p, [e.id]: { ...bf, endTime: ev.target.value } }))} className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-seum-blue" />
                              <button type="button" onClick={() => addBookingToEnroll(e)} className="rounded-lg bg-seum-blue px-3 py-1 text-xs font-bold text-white hover:bg-[#2a63c4]">수업 잡기</button>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400">※ 담임 지정 후 저장해야 예약할 수 있습니다.</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 수강 추가 — 버튼 누르면 펼침 */}
              {!showAddEnroll ? (
                <button type="button" onClick={() => setShowAddEnroll(true)}
                  className="w-full rounded-lg border border-dashed border-seum-blue py-2.5 text-sm font-medium text-seum-blue hover:bg-blue-50">
                  + 수강 추가
                </button>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">수강 추가</p>
                    <button type="button" onClick={() => setShowAddEnroll(false)} className="text-xs text-slate-400 hover:text-slate-600">닫기</button>
                  </div>
                  <div className="mb-3 flex gap-2">
                    <button type="button" onClick={() => setEnrollTab("group")} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${enrollTab === "group" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600"}`}>단체반</button>
                    <button type="button" onClick={() => setEnrollTab("oneonone")} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${enrollTab === "oneonone" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600"}`}>1:1</button>
                  </div>

                  {enrollTab === "group" && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select value={pickCourse} onChange={(e) => setPickCourse(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
                        <option value="">반 선택...</option>
                        {groupCourses.filter((c) => c.branch_id === branchId).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      {pickCourse && (
                        <span className="text-sm text-slate-500">
                          {(() => {
                            const c = groupCourses.find((x) => x.id === pickCourse);
                            const n = c?.sessions_total ?? 6;
                            return `총 ${n}회`;
                          })()}
                        </span>
                      )}
                      <button type="button" onClick={assignGroup} disabled={assigning} className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">배정</button>
                    </div>
                  )}

                  {enrollTab === "oneonone" && (
                    <div className="space-y-2">
                      <select value={oneType} onChange={(e) => setOneType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
                        <option value="">종류 선택...</option>
                        {oneCourses.map((c) => <option key={c.id} value={c.id}>{c.title.replace("1:1 ", "")}</option>)}
                      </select>
                      {isGongmuwon && (
                        <div className="flex gap-2">
                          <select value={examType} onChange={(e) => setExamType(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
                            <option value="">시험종류...</option>
                            {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="직렬" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                        </div>
                      )}
                      {isInterview && !isGongmuwon && (
                        <div className="flex gap-2">
                          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="지원 회사명" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                          <input value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="지원 직무" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                        </div>
                      )}
                      {isInterview && (
                        <div className="flex gap-2">
                          {CAREER_LEVELS.map((lv) => (
                            <button type="button" key={lv} onClick={() => setCareerLevel(lv)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${careerLevel === lv ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>{lv}</button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <select value={oneTeacher} onChange={(e) => setOneTeacher(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
                          <option value="">담임 선생님...</option>
                          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                          <input type="number" value={oneSessions} onChange={(e) => setOneSessions(Number(e.target.value))} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                          <span className="text-sm text-slate-500">회</span>
                        </div>
                      </div>

                      {/* 첫 수업 날짜·시간 (선택) */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="mb-1.5 text-xs font-medium text-slate-500">첫 수업 일정 (선택)</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                          <input type="time" value={firstTime} onChange={(e) => setFirstTime(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                          <span className="text-sm text-slate-400">~</span>
                          <input type="time" value={firstEndTime} onChange={(e) => setFirstEndTime(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">비워두면 선생님이 나중에 잡습니다.</p>
                      </div>

                      <button type="button" onClick={assignOne} disabled={assigning} className="w-full rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">1:1 등록</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 면접 카테고리 배정 팝업 (기존 질문생성 모달 대체) */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setAssignTarget(null)}>
          <div className="my-8 w-full max-w-md space-y-4 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">면접 카테고리 배정</h3>
              <button type="button" onClick={() => setAssignTarget(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-seum-navy">{assignTarget.student.name}</p>
              <p className="mt-0.5 text-xs">카테고리를 선택하면 학생 화면에 해당 질문이 자동으로 표시됩니다.</p>
            </div>

            {/* 카테고리 선택 */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-500">카테고리</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_LIST.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onPickCategory(c.key)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      assignCategory === c.key
                        ? "border-seum-blue bg-blue-50 text-seum-blue"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 공무원 세부 (인천/서울) */}
            {assignCat?.subs?.length ? (
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">세부 선택</label>
                <div className="flex gap-2">
                  {assignCat.subs.map((sub) => (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => setAssignSub(sub.key)}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        assignSub === sub.key
                          ? "border-seum-blue bg-blue-50 text-seum-blue"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 선택된 탭 미리보기 */}
            {assignCat && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="mb-1.5 text-xs font-medium text-slate-500">표시될 탭</p>
                <div className="flex flex-wrap gap-1.5">
                  {assignCat.tabs.map((t) => (
                    <span key={t.key} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{t.label}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              {interviewAssignMap[assignTarget.student.id] && (
                <button
                  type="button"
                  onClick={clearAssign}
                  disabled={assignSaving}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                >
                  배정 해제
                </button>
              )}
              <button
                type="button"
                onClick={saveAssign}
                disabled={assignSaving}
                className="flex-1 rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
              >
                {assignSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}