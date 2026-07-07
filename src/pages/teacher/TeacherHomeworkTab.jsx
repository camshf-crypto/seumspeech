import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const dateFmt = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const SUBMIT_TYPES = [
  { key: "text", label: "텍스트만" },
  { key: "file", label: "파일만 (녹음·영상·문서)" },
  { key: "both", label: "텍스트 + 파일" },
];

export default function TeacherHomeworkTab({ teacherId }) {
  const [groupHw, setGroupHw] = useState([]);
  const [oneHw, setOneHw] = useState([]);
  const [courseType, setCourseType] = useState("group");
  const [activeHw, setActiveHw] = useState(null);
  const [loading, setLoading] = useState(true);

  // 출제 폼
  const [showCreate, setShowCreate] = useState(false);
  const [target, setTarget] = useState("group"); // group | one
  const [myCourses, setMyCourses] = useState([]);
  const [oneStudents, setOneStudents] = useState([]);
  const [cCourse, setCCourse] = useState("");
  const [cEnroll, setCEnroll] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cSubmitType, setCSubmitType] = useState("both");
  const [cDue, setCDue] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("homeworks")
      .select(
        "*, courses(title, type, weekday, start_time, start_date, branch:branch_id(name)), student:student_id(name)"
      )
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    const list = data ?? [];

    const hwIds = list.map((h) => h.id);
    let subCounts = {};
    if (hwIds.length > 0) {
      const { data: subs } = await supabase
        .from("homework_submissions")
        .select("homework_id")
        .in("homework_id", hwIds);
      (subs ?? []).forEach((s) => {
        subCounts[s.homework_id] = (subCounts[s.homework_id] || 0) + 1;
      });
    }

    const enrich = list.map((h) => ({
      ...h,
      submitCount: subCounts[h.id] || 0,
      isOne: h.courses?.type === "oneonone" || !!h.student_id,
    }));

    setGroupHw(enrich.filter((h) => !h.isOne));
    setOneHw(enrich.filter((h) => h.isOne));
    setLoading(false);
  };

  // 단체반: 내가 담당 강사인 반 / 1:1: 내가 담임인 enrollment(학생별)
  const loadTargets = async () => {
    const { data: groupCs } = await supabase
      .from("courses")
      .select("id, title, type, weekday, start_time, start_date, branch:branch_id(name)")
      .eq("teacher_id", teacherId)
      .eq("active", true);
    setMyCourses((groupCs ?? []).filter((c) => c.type !== "oneonone"));

    const { data: enr } = await supabase
      .from("enrollments")
      .select("id, student_id, course_id, student:student_id(name), courses(title, type, start_date, branch:branch_id(name))")
      .eq("teacher_id", teacherId);
    const ones = (enr ?? []).filter((e) => e.courses?.type === "oneonone");
    setOneStudents(ones);
  };

  useEffect(() => {
    load();
    loadTargets();
  }, [teacherId]);

  const openCreate = () => {
    setTarget("group");
    setCCourse(""); setCEnroll(""); setCTitle(""); setCDesc(""); setCSubmitType("both"); setCDue("");
    setShowCreate(true);
  };

  const createHomework = async () => {
    if (!cTitle.trim()) return alert("숙제 제목을 입력하세요.");

    let payload = {
      teacher_id: teacherId,
      title: cTitle.trim(),
      description: cDesc.trim() || null,
      submit_type: cSubmitType,
      due_date: cDue || null,
    };

    if (target === "group") {
      if (!cCourse) return alert("반을 선택하세요.");
      payload.course_id = cCourse;
      payload.student_id = null;
    } else {
      if (!cEnroll) return alert("학생을 선택하세요.");
      const e = oneStudents.find((x) => x.id === cEnroll);
      if (!e) return alert("학생 정보를 찾을 수 없습니다.");
      payload.course_id = e.course_id;
      payload.student_id = e.student_id;
    }

    setCreating(true);
    const { error } = await supabase.from("homeworks").insert(payload);
    setCreating(false);
    if (error) return alert("출제 실패: " + error.message);
    setShowCreate(false);
    alert("숙제가 등록되어 학생에게 전달되었습니다.");
    await load();
  };

  const cards = courseType === "oneonone" ? oneHw : groupHw;

  if (activeHw) {
    return (
      <HomeworkDetail
        homework={activeHw}
        teacherId={teacherId}
        onBack={() => { setActiveHw(null); load(); }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-seum-navy">숙제 피드백</h2>
        <button type="button" onClick={openCreate}
          className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4]">
          + 숙제 내기
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setCourseType("group")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${courseType === "group" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          단체반 ({groupHw.length})
        </button>
        <button type="button" onClick={() => setCourseType("oneonone")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${courseType === "oneonone" ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          1:1 ({oneHw.length})
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          등록한 과제가 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((h) => (
            <button key={h.id} type="button" onClick={() => setActiveHw(h)}
              className="relative flex flex-col rounded-xl border border-slate-200 p-3 text-left transition hover:border-seum-blue hover:bg-slate-50">
              {h.submitCount > 0 ? (
                <span className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1 text-xs font-bold text-white">
                  {h.submitCount}
                </span>
              ) : null}

              <p className="truncate text-sm font-bold text-seum-navy">{h.title}</p>
              <p className="mt-1 truncate text-xs font-medium text-slate-600">
                {h.student?.name ? `${h.student.name} · ` : ""}{h.courses?.title ?? "-"}
              </p>

              {!h.isOne ? (
                <>
                  {h.courses?.branch?.name ? (
                    <span className="mt-1 inline-block w-fit rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-seum-blue">
                      {h.courses.branch.name}
                    </span>
                  ) : null}
                  <p className="mt-1 text-[11px] text-slate-400">
                    매주 {WEEKDAYS[h.courses?.weekday] ?? "-"} {h.courses?.start_time?.slice(0, 5) ?? ""}
                  </p>
                </>
              ) : (
                <span className="mt-1 inline-block w-fit rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  1:1{h.courses?.branch?.name ? ` · ${h.courses.branch.name}` : ""}
                </span>
              )}

              <p className="mt-2 text-[11px] text-slate-400">
                제출 {h.submitCount}건 · {dateFmt(h.created_at)}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* 숙제 출제 모달 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="my-8 w-full max-w-lg space-y-4 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">숙제 내기</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="text-lg text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {/* 대상 선택 */}
            <div className="flex gap-2">
              <button type="button" onClick={() => setTarget("group")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${target === "group" ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                단체반에 내기
              </button>
              <button type="button" onClick={() => setTarget("one")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${target === "one" ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                1:1 학생에게 내기
              </button>
            </div>

            {/* 단체반 선택 */}
            {target === "group" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">반 선택</label>
                <select value={cCourse} onChange={(e) => setCCourse(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
                  <option value="">반을 선택하세요...</option>
                  {myCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.branch?.name ?? "지점미정"}] {c.title} · 매주 {WEEKDAYS[c.weekday] ?? "-"} {c.start_time?.slice(0, 5) ?? ""}
                      {c.start_date ? ` · ${dateFmt(c.start_date)} 시작` : ""}
                    </option>
                  ))}
                </select>
                {myCourses.length === 0 ? <p className="mt-1 text-xs text-amber-600">담당으로 지정된 단체반이 없습니다.</p> : null}
              </div>
            )}

            {/* 1:1 학생 선택 */}
            {target === "one" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">학생 선택</label>
                <select value={cEnroll} onChange={(e) => setCEnroll(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
                  <option value="">학생을 선택하세요...</option>
                  {oneStudents.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.student?.name ?? "학생"} · {e.courses?.title?.replace("1:1 ", "") ?? ""}
                      {e.courses?.branch?.name ? ` · ${e.courses.branch.name}` : ""}
                      {e.courses?.start_date ? ` · ${dateFmt(e.courses.start_date)} 시작` : ""}
                    </option>
                  ))}
                </select>
                {oneStudents.length === 0 ? <p className="mt-1 text-xs text-amber-600">담임으로 배정된 1:1 학생이 없습니다.</p> : null}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">숙제 제목</label>
              <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="예: 발성 연습 녹음 제출" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">설명 (선택)</label>
              <textarea value={cDesc} onChange={(e) => setCDesc(e.target.value)} rows={3} placeholder="숙제 내용·요구사항을 적어주세요. (예: 복식호흡 5분 녹음해서 올려주세요)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">제출 방식</label>
              <div className="flex gap-2">
                {SUBMIT_TYPES.map((t) => (
                  <button key={t.key} type="button" onClick={() => setCSubmitType(t.key)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${cSubmitType === t.key ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">마감일 (선택)</label>
              <input type="date" value={cDue} onChange={(e) => setCDue(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
            </div>

            <button type="button" onClick={createHomework} disabled={creating}
              className="w-full rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
              {creating ? "등록 중..." : "숙제 내기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeworkDetail({ homework, teacherId, onBack }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [eTitle, setETitle] = useState(homework.title ?? "");
  const [eDesc, setEDesc] = useState(homework.description ?? "");
  const [eSubmitType, setESubmitType] = useState(homework.submit_type ?? "both");
  const [eDue, setEDue] = useState(homework.due_date ?? "");
  const [eSaving, setESaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const EDIT_TYPES = [
    { key: "text", label: "텍스트만" },
    { key: "file", label: "파일만" },
    { key: "both", label: "텍스트+파일" },
  ];

  const loadSubs = async () => {
    setLoading(true);
    const { data: submissions } = await supabase
      .from("homework_submissions")
      .select("*, student:student_id(name)")
      .eq("homework_id", homework.id)
      .order("submitted_at", { ascending: false });

    const subList = submissions ?? [];
    const subIds = subList.map((s) => s.id);
    let feedbacks = [];
    if (subIds.length > 0) {
      const { data: fbs } = await supabase
        .from("homework_feedback")
        .select("*")
        .in("submission_id", subIds);
      feedbacks = fbs ?? [];
    }
    setSubs(
      subList.map((s) => ({
        ...s,
        feedback: feedbacks.find((f) => f.submission_id === s.id) || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    loadSubs();
  }, [homework.id]);

  const saveEdit = async () => {
    if (!eTitle.trim()) return alert("제목을 입력하세요.");
    setESaving(true);
    const { error } = await supabase.from("homeworks").update({
      title: eTitle.trim(),
      description: eDesc.trim() || null,
      submit_type: eSubmitType,
      due_date: eDue || null,
    }).eq("id", homework.id);
    setESaving(false);
    if (error) return alert("수정 실패: " + error.message);
    alert("숙제가 수정되었습니다.");
    setShowEdit(false);
    onBack();
  };

  const deleteHw = async () => {
    if (!window.confirm("이 숙제를 삭제할까요? 학생 제출과 피드백도 함께 삭제됩니다. (다시 내려면 새로 출제하세요)")) return;
    setDeleting(true);
    const { error } = await supabase.from("homeworks").delete().eq("id", homework.id);
    setDeleting(false);
    if (error) return alert("삭제 실패: " + error.message);
    alert("숙제가 삭제되었습니다.");
    onBack();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
            ← 목록
          </button>
          <div>
            <p className="font-bold text-seum-navy">{homework.title}</p>
            <p className="text-xs text-slate-400">
              {homework.student?.name ? `${homework.student.name} · ` : ""}{homework.courses?.title}
              {homework.courses?.branch?.name ? ` · ${homework.courses.branch.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-1.5">
          <button type="button" onClick={() => setShowEdit((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            수정
          </button>
          <button type="button" onClick={deleteHw} disabled={deleting}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-60">
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>

      {/* 수정 폼 */}
      {showEdit && (
        <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="숙제 제목" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          <textarea value={eDesc} onChange={(e) => setEDesc(e.target.value)} rows={3} placeholder="설명" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          <div className="flex gap-2">
            {EDIT_TYPES.map((t) => (
              <button key={t.key} type="button" onClick={() => setESubmitType(t.key)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${eSubmitType === t.key ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <input type="date" value={eDue ?? ""} onChange={(e) => setEDue(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={saveEdit} disabled={eSaving} className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
              {eSaving ? "저장 중..." : "수정 저장"}
            </button>
            <button type="button" onClick={() => setShowEdit(false)} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">취소</button>
          </div>
        </div>
      )}

      {homework.description ? (
        <p className="mb-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {homework.description}
        </p>
      ) : null}

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : subs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          아직 제출한 학생이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => (
            <SubmissionCard key={s.id} sub={s} teacherId={teacherId} onSaved={loadSubs} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({ sub, teacherId, onSaved }) {
  const [fbText, setFbText] = useState(sub.feedback?.content ?? "");
  const [saving, setSaving] = useState(false);

  const openFile = (url) => window.open(url, "_blank", "noopener,noreferrer");

  const save = async () => {
    const body = fbText.trim();
    if (!body) return alert("피드백 내용을 입력하세요.");
    setSaving(true);

    let err;
    if (sub.feedback) {
      const { error } = await supabase
        .from("homework_feedback")
        .update({ content: body, teacher_id: teacherId })
        .eq("id", sub.feedback.id);
      err = error;
    } else {
      const { error } = await supabase
        .from("homework_feedback")
        .insert({ submission_id: sub.id, teacher_id: teacherId, content: body });
      err = error;
    }
    setSaving(false);
    if (err) return alert("저장 실패: " + err.message);
    onSaved();
  };

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="font-medium text-seum-navy">{sub.student?.name ?? "학생"}</p>
      {sub.content ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{sub.content}</p>
      ) : null}
      {sub.file_url ? (
        <button type="button" onClick={() => openFile(sub.file_url)}
          className="mt-1 block text-sm font-medium text-seum-blue hover:underline">
          제출 파일 열기
        </button>
      ) : null}
      <p className="mt-1 text-xs text-slate-400">
        제출일 {new Date(sub.submitted_at).toLocaleString("ko-KR")}
      </p>

      <div className="mt-2">
        <textarea value={fbText} onChange={(e) => setFbText(e.target.value)} rows={2}
          placeholder="피드백을 작성하세요"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
        <button type="button" onClick={save} disabled={saving}
          className="mt-1 rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
          {saving ? "저장 중..." : sub.feedback ? "피드백 수정" : "피드백 저장"}
        </button>
      </div>
    </div>
  );
}