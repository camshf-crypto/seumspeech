import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CATEGORY_LIST, getCategory } from "../../lib/interviewConfig";
import StudentPaymentSection from "./StudentPaymentSection";
import StudentMaterialsView from "../../components/StudentMaterialsView";

// created_at 은 UTC 로 저장되므로, 화면·필터 모두 브라우저(한국) 시간 기준으로 맞춘다
const ymd = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtJoin = (ts) => {
  const v = ymd(ts);
  return v ? v.replace(/-/g, ".") : "-";
};

const STATUS_TABS = [
  { key: "all", label: "수강 상태 전체" },
  { key: "active", label: "수강중" },
  { key: "waiting", label: "등록대기" },
  { key: "done", label: "완료" },
];

export default function StudentsTab() {
  const [students, setStudents] = useState([]);
  const [enrollMap, setEnrollMap] = useState({});
  const [paymentsMap, setPaymentsMap] = useState({}); // student_id -> [payments]
  const [loading, setLoading] = useState(true);

  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState("all");
  const [payFilter, setPayFilter] = useState("all");
  const [joinDate, setJoinDate] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");

  // 모달 3종 — 정보 / 수강 / 결제
  const [memoTarget, setMemoTarget] = useState(null);   // 상담 메모
  const [addTarget, setAddTarget] = useState(null);     // 추가 등록
  const [payTarget, setPayTarget] = useState(null);
  const [fileTarget, setFileTarget] = useState(null);

  const [saving, setSaving] = useState(false);
  const [memoText, setMemoText] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [jobPosition, setJobPosition] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [editBranch, setEditBranch] = useState("");
  const [editEnrolls, setEditEnrolls] = useState([]); // 수정 모달에서 고치는 수강 횟수

  // 추가 등록
  const [addEnrolls, setAddEnrolls] = useState([]);
  const [addEnrollId, setAddEnrollId] = useState("");
  const [addCount, setAddCount] = useState(6);
  const [addMethod, setAddMethod] = useState("현금");
  const [addPay, setAddPay] = useState(true);



  // 수강별 예약(첫 수업) 목록 + 추가 폼 상태

  // ===== 면접 카테고리 배정 모달 =====
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignCategory, setAssignCategory] = useState("");
  const [assignSub, setAssignSub] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [interviewAssignMap, setInterviewAssignMap] = useState({});

  const loadBase = async () => {
    setLoading(true);
    const { data: st } = await supabase
      .from("profiles").select("*").eq("role", "student")
      .order("created_at", { ascending: false });
    const { data: enr } = await supabase
      .from("enrollments")
      .select("*, courses(title, type, branch_id, price), teacher:teacher_id(name)");
    const { data: br } = await supabase.from("branches").select("id, name").order("sort_order");
    const { data: ia } = await supabase
      .from("interview_assignments")
      .select("student_id, category_key, sub_key");
    const { data: pay } = await supabase
      .from("payments")
      .select("student_id, enrollment_id, amount, refund_amount, status")
      .eq("status", "paid");

    const map = {};
    (enr ?? []).forEach((e) => {
      (map[e.student_id] = map[e.student_id] || []).push(e);
    });
    const iaMap = {};
    (ia ?? []).forEach((a) => { iaMap[a.student_id] = { category_key: a.category_key, sub_key: a.sub_key }; });

    const payMap = {};
    (pay ?? []).forEach((p) => {
      (payMap[p.student_id] = payMap[p.student_id] || []).push(p);
    });

    setBranches(br ?? []);
    setStudents(st ?? []);
    setEnrollMap(map);
    setPaymentsMap(payMap);
    setInterviewAssignMap(iaMap);
    setLoading(false);
  };

  useEffect(() => { loadBase(); }, []);

  const studentStatus = (sid) => {
    const list = enrollMap[sid] ?? [];
    if (list.length === 0) return "waiting";
    return list.some((e) => e.status === "active" && e.remaining_sessions > 0) ? "active" : "done";
  };

  const branchName = (id) => branches.find((b) => b.id === id)?.name ?? "-";

  const inBranch = (s) => {
    if (branchFilter === "all") return true;
    if (s.branch_id === branchFilter) return true;
    const list = enrollMap[s.id] ?? [];
    return list.some((e) => e.courses?.branch_id === branchFilter);
  };

  // 납부 상태 — 수업 가격 기준으로 몇 회분 냈는지 계산
  const payStatus = (sid) => {
    const list = enrollMap[sid] ?? [];
    if (list.length === 0) return null;
    const pays = paymentsMap[sid] ?? [];

    let total = 0;
    let paid = 0;
    let priceMissing = false;

    list.forEach((e) => {
      const isOne = e.courses?.type === "oneonone";
      const price = e.courses?.price ?? 0;
      const unit = isOne ? price : price;
      const count = isOne ? e.total_sessions ?? 0 : 1;
      total += count;
      if (!price) { priceMissing = true; return; }
      const sum = pays
        .filter((p) => p.enrollment_id === e.id)
        .reduce((acc, p) => acc + (p.amount ?? 0) - (p.refund_amount ?? 0), 0);
      paid += Math.round(sum / unit);
    });

    if (priceMissing) return null;
    const left = total - paid;
    return left <= 0 ? { label: "완납", done: true } : { label: `${left}회 미납`, done: false };
  };

  const filtered = students.filter((s) => {
    if (!inBranch(s)) return false;
    if (statusTab !== "all" && studentStatus(s.id) !== statusTab) return false;
    if (payFilter !== "all") {
      const p = payStatus(s.id);
      if (!p) return false;
      if (payFilter === "done" && !p.done) return false;
      if (payFilter === "unpaid" && p.done) return false;
    }
    if (joinDate && ymd(s.created_at) !== joinDate) return false;
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

  // ===== 정보 모달 =====
  const openMemo = (student) => {
    setMemoTarget(student);
    setJobCompany(student.job_company ?? "");
    setJobPosition(student.job_position ?? "");
    setJobStatus(student.job_status ?? "");
    setEditBranch(student.branch_id ?? "");
    // 수강 횟수 — 화면에서 고칠 수 있게 복사해둔다 (orig 는 바뀐 것만 저장하려고 남겨둠)
    setEditEnrolls(
      (enrollMap[student.id] ?? []).map((e) => ({
        id: e.id,
        title: e.courses?.title?.replace("1:1 ", "") ?? "수강",
        status: e.status,
        total: e.total_sessions ?? 0,
        remaining: e.remaining_sessions ?? 0,
        origTotal: e.total_sessions ?? 0,
        origRemaining: e.remaining_sessions ?? 0,
      }))
    );
    loadMemo(student.id);
  };

  const setEnrollField = (id, field, value) => {
    setEditEnrolls((list) =>
      list.map((e) => (e.id === id ? { ...e, [field]: Math.max(0, Number(value) || 0) } : e))
    );
  };

  // 재등록 — 기존 수강에 회차를 더한다
  const openAdd = async (student) => {
    setAddTarget(student);
    setAddCount(6);
    setAddMethod("현금");
    setAddPay(true);
    const { data } = await supabase
      .from("enrollments")
      .select("id, total_sessions, remaining_sessions, courses(title, type, price)")
      .eq("student_id", student.id)
      .eq("status", "active");
    const list = data ?? [];
    setAddEnrolls(list);
    setAddEnrollId(list.length === 1 ? list[0].id : "");
  };

  const saveAdd = async () => {
    if (!addEnrollId) return alert("어느 수강에 추가할지 선택하세요.");
    const e = addEnrolls.find((x) => x.id === addEnrollId);
    const n = Number(addCount);
    if (!n || n < 1) return alert("추가 횟수를 입력하세요.");

    setSaving(true);
    const { error } = await supabase
      .from("enrollments")
      .update({
        total_sessions: (e.total_sessions ?? 0) + n,
        remaining_sessions: (e.remaining_sessions ?? 0) + n,
      })
      .eq("id", e.id);
    if (error) { setSaving(false); return alert("추가 실패: " + error.message); }

    // 결제도 함께 기록 (1:1은 회당 단가 × 추가 횟수)
    if (addPay) {
      const unit = e.courses?.price ?? 0;
      const amount = e.courses?.type === "oneonone" ? unit * n : unit;
      if (amount > 0) {
        await supabase.from("payments").insert({
          student_id: addTarget.id,
          enrollment_id: e.id,
          amount,
          method: addMethod,
          status: "paid",
          paid_at: new Date().toISOString(),
        });
      }
    }

    setSaving(false);
    alert("재등록되었습니다.");
    setAddTarget(null);
    loadBase();
  };

  const loadMemo = async (sid) => {
    const { data: nt } = await supabase.from("student_notes").select("*")
      .eq("student_id", sid).order("created_at", { ascending: true });
    const merged = (nt ?? []).map((n) => n.content).filter(Boolean).join("\n");
    setMemoText(merged);
  };

  const saveMemo = async () => {
    // 잔여가 총 횟수보다 많으면 막는다
    const bad = editEnrolls.find((e) => e.remaining > e.total);
    if (bad) return alert(`${bad.title} — 잔여 횟수가 총 횟수보다 많습니다.`);

    setSaving(true);
    try {
      await supabase.from("profiles")
        .update({
          job_company: jobCompany,
          job_position: jobPosition,
          job_status: jobStatus,
          branch_id: editBranch || null,
        })
        .eq("id", memoTarget.id);

      // 수강 횟수 — 바뀐 것만 반영
      const changed = editEnrolls.filter(
        (e) => e.total !== e.origTotal || e.remaining !== e.origRemaining
      );
      for (const e of changed) {
        const { error } = await supabase
          .from("enrollments")
          .update({ total_sessions: e.total, remaining_sessions: e.remaining })
          .eq("id", e.id);
        if (error) throw error;
      }

      const { data: me } = await supabase.auth.getUser();
      await supabase.from("student_notes").delete().eq("student_id", memoTarget.id);
      const body = memoText.trim();
      if (body) {
        await supabase.from("student_notes").insert({
          student_id: memoTarget.id, author_id: me?.user?.id, content: body,
        });
      }
      setSaving(false);
      alert("저장되었습니다.");
      setMemoTarget(null);
      loadBase();
    } catch (err) {
      setSaving(false);
      alert("저장 실패: " + err.message);
    }
  };

  // ===== 면접 카테고리 배정 =====
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
    setAssignSub(cat?.subs?.length ? cat.subs[0].key : "");
  };

  const saveAssign = async () => {
    if (!assignCategory) return alert("카테고리를 선택하세요.");
    const cat = getCategory(assignCategory);
    if (cat?.subs?.length && !assignSub) return alert("세부 지역을 선택하세요.");
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

  // 목록에서 쓰는 버튼 묶음
  const RowButtons = ({ s, hasAssign, block }) => {
    const base = block ? "py-2 text-sm font-medium" : "whitespace-nowrap px-2 py-1 text-xs";
    const gray = `${base} border border-slate-300 text-slate-600 hover:bg-slate-50`;
    const blue = `${base} border border-seum-blue text-seum-blue hover:bg-blue-50`;
    return (
      <div className={block ? "grid grid-cols-3 gap-1.5" : "flex items-center gap-1"}>
        <button type="button" onClick={() => openMemo(s)} className={gray}>수정</button>
        <button type="button" onClick={() => openAdd(s)} className={blue}>재등록</button>
        <button type="button" onClick={() => setFileTarget(s)} className={gray}>자료함</button>
        <button type="button" onClick={() => setPayTarget(s)} className={blue}>결제</button>
        <button
          type="button"
          onClick={() => openAssign(s)}
          className={`${base} font-medium ${
            hasAssign ? "bg-seum-blue text-white hover:bg-[#2a63c4]" : "border border-seum-blue text-seum-blue hover:bg-blue-50"
          }`}
        >
          {hasAssign ? "면접수정" : "면접설정"}
        </button>
      </div>
    );
  };

  return (
    <div>
      {/* 필터 + 검색 한 줄 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
        >
          <option value="all">전체 지점</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={statusTab}
          onChange={(e) => setStatusTab(e.target.value)}
          className="border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
        >
          {STATUS_TABS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>

        <select
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value)}
          className={`border px-3 py-2 text-sm outline-none focus:border-seum-blue ${
            payFilter === "unpaid" ? "border-red-400 text-red-500" : "border-slate-300"
          }`}
        >
          <option value="all">결제 전체</option>
          <option value="done">완납</option>
          <option value="unpaid">미납</option>
        </select>

        {/* 가입일 */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={joinDate}
            onChange={(e) => setJoinDate(e.target.value)}
            title="가입일"
            className="border border-slate-300 px-2 py-2 text-sm text-slate-600 outline-none focus:border-seum-blue"
          />
          {joinDate && (
            <button
              type="button"
              onClick={() => setJoinDate("")}
              className="px-1 text-xs text-slate-400 hover:text-red-500"
              title="가입일 지우기"
            >
              ✕
            </button>
          )}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름·연락처·이메일 검색"
          className="min-w-[180px] flex-1 border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
        />
        <span className="flex-shrink-0 text-sm text-slate-500">{filtered.length}명</span>
      </div>

      {/* 데스크탑: 표 */}
      <div className="hidden overflow-x-auto border border-slate-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">지점</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="whitespace-nowrap px-2 py-3 font-medium">연락처</th>
              <th className="whitespace-nowrap px-2 py-3 font-medium">가입일</th>
              <th className="whitespace-nowrap px-2 py-3 font-medium">수강</th>
              <th className="whitespace-nowrap px-2 py-3 font-medium">잔여</th>
              <th className="whitespace-nowrap px-2 py-3 font-medium">결제</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">해당하는 학생이 없습니다.</td></tr>
            ) : filtered.map((s) => {
              const stt = studentStatus(s.id);
              const sttLabel = stt === "active" ? "수강중" : stt === "done" ? "완료" : "등록대기";
              const sttColor = stt === "active" ? "bg-green-50 text-green-600" : stt === "done" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-600";
              const badge = assignBadge(s.id);
              const pay = payStatus(s.id);
              return (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500">{branchName(s.branch_id)}</td>
                  <td className="cursor-pointer px-4 py-3 font-medium text-seum-navy" onClick={() => openMemo(s)}>{s.name || "이름없음"}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-slate-500">{s.phone || "-"}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-xs text-slate-500">{fmtJoin(s.created_at)}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-slate-600">{enrollSummary(s.id)}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-slate-600">{remainSummary(s.id)}</td>
                  <td className="whitespace-nowrap px-2 py-3">
                    {pay ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pay.done ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                        {pay.label}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${sttColor}`}>{sttLabel}</span>
                    {badge && <span className="ml-1 whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-seum-blue">{badge}</span>}
                  </td>
                  <td className="px-2 py-3">
                    <RowButtons s={s} hasAssign={!!interviewAssignMap[s.id]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드 */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="border border-dashed border-slate-300 py-10 text-center text-slate-400">해당하는 학생이 없습니다.</p>
        ) : filtered.map((s) => {
          const stt = studentStatus(s.id);
          const sttLabel = stt === "active" ? "수강중" : stt === "done" ? "완료" : "등록대기";
          const sttColor = stt === "active" ? "bg-green-50 text-green-600" : stt === "done" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-600";
          const badge = assignBadge(s.id);
          const pay = payStatus(s.id);
          return (
            <div key={s.id} className="border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-seum-navy">{s.name || "이름없음"}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{s.phone || "연락처 없음"}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{branchName(s.branch_id)} · 가입 {fmtJoin(s.created_at)}</p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sttColor}`}>{sttLabel}</span>
                  {pay && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pay.done ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                      {pay.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
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

              <div className="mt-3">
                <RowButtons s={s} hasAssign={!!interviewAssignMap[s.id]} block />
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 수정 (지점·수강 횟수·직업·메모) ===== */}
      {memoTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setMemoTarget(null)}>
          <div className="my-8 w-full max-w-lg space-y-5 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">{memoTarget.name}</h3>
              <div className="flex items-center gap-4">
                <button type="button" onClick={saveMemo} disabled={saving} className="bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button type="button" onClick={() => setMemoTarget(null)} className="ml-1 text-lg text-slate-400 hover:text-slate-700">✕</button>
              </div>
            </div>
            <p className="text-sm text-slate-500">{memoTarget.phone} · {memoTarget.email}</p>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-600">지점</p>
              <div className="flex gap-2">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setEditBranch(b.id)}
                    className={`flex-1 border py-2.5 text-sm font-bold transition ${
                      editBranch === b.id
                        ? "border-seum-navy bg-seum-navy text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 수강 횟수 */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-bold text-slate-600">수강 횟수</p>
                <p className="text-[11px] text-slate-400">총 횟수를 바꾸면 결제 기록과 맞는지 확인하세요</p>
              </div>
              {editEnrolls.length === 0 ? (
                <p className="border border-dashed border-slate-300 py-4 text-center text-sm text-slate-400">
                  등록된 수강이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {editEnrolls.map((e) => {
                    const changed = e.total !== e.origTotal || e.remaining !== e.origRemaining;
                    const invalid = e.remaining > e.total;
                    return (
                      <div
                        key={e.id}
                        className={`flex items-center justify-between gap-3 border px-3 py-2 ${
                          invalid ? "border-red-300 bg-red-50" : changed ? "border-seum-blue bg-blue-50" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-seum-navy">{e.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {e.status === "active" ? "수강중" : e.status}
                            {changed ? ` · ${e.origRemaining}/${e.origTotal}회에서 변경` : ""}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={e.remaining}
                            onChange={(ev) => setEnrollField(e.id, "remaining", ev.target.value)}
                            title="잔여 횟수"
                            className="w-16 border border-slate-300 px-2 py-1.5 text-center text-sm outline-none focus:border-seum-blue"
                          />
                          <span className="text-sm text-slate-400">/</span>
                          <input
                            type="number"
                            min={0}
                            value={e.total}
                            onChange={(ev) => setEnrollField(e.id, "total", ev.target.value)}
                            title="총 횟수"
                            className="w-16 border border-slate-300 px-2 py-1.5 text-center text-sm outline-none focus:border-seum-blue"
                          />
                          <span className="text-sm text-slate-500">회</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4">
              <p className="mb-2 text-sm font-bold text-slate-600">직업 정보</p>
              <div className="space-y-2">
                <input value={jobStatus} onChange={(e) => setJobStatus(e.target.value)} placeholder="신분" className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                <input value={jobCompany} onChange={(e) => setJobCompany(e.target.value)} placeholder="현재 직장/소속" className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                <input value={jobPosition} onChange={(e) => setJobPosition(e.target.value)} placeholder="현재 직무/직책" className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-600">메모장</p>
              <textarea value={memoText} onChange={(e) => setMemoText(e.target.value)} rows={8}
                placeholder="학생 관련 메모를 자유롭게 작성하세요."
                className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
            </div>
          </div>
        </div>
      )}

      {/* ===== 재등록 ===== */}
      {addTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setAddTarget(null)}>
          <div className="my-8 w-full max-w-md space-y-4 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">{addTarget.name} · 재등록</h3>
              <button type="button" onClick={() => setAddTarget(null)} className="text-lg text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {addEnrolls.length === 0 ? (
              <p className="bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
                진행 중인 수강이 없습니다. 스케줄 화면에서 먼저 수강을 등록해주세요.
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">어느 수강을 재등록할까요?</label>
                  <select
                    value={addEnrollId}
                    onChange={(e) => setAddEnrollId(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                  >
                    <option value="">선택...</option>
                    {addEnrolls.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.courses?.title} (현재 {e.remaining_sessions}/{e.total_sessions}회)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-500">재등록 횟수</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[3, 6, 10].map((n) => (
                      <button key={n} type="button" onClick={() => setAddCount(n)}
                        className={`border px-3 py-1.5 text-sm font-bold transition ${
                          addCount === n ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}>
                        {n}회
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <input type="number" min={1} value={addCount}
                        onChange={(e) => setAddCount(Math.max(1, Number(e.target.value)))}
                        className="w-16 border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue" />
                      <span className="text-sm text-slate-500">회</span>
                    </div>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 bg-slate-50 px-3 py-2">
                  <input type="checkbox" checked={addPay} onChange={(e) => setAddPay(e.target.checked)} className="h-4 w-4 accent-seum-blue" />
                  <span className="text-sm text-slate-700">결제도 함께 기록</span>
                </label>

                {addPay && (
                  <div className="flex gap-2">
                    {["현금", "계좌이체", "카드"].map((m) => (
                      <button key={m} type="button" onClick={() => setAddMethod(m)}
                        className={`flex-1 border py-2 text-sm font-medium transition ${
                          addMethod === m ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}>
                        {m}
                      </button>
                    ))}
                  </div>
                )}

                {(() => {
                  const e = addEnrolls.find((x) => x.id === addEnrollId);
                  if (!e) return null;
                  const after = (e.remaining_sessions ?? 0) + Number(addCount);
                  const afterTotal = (e.total_sessions ?? 0) + Number(addCount);
                  return (
                    <p className="bg-blue-50 px-3 py-2 text-center text-sm font-bold text-seum-blue">
                      {e.remaining_sessions}/{e.total_sessions}회 → {after}/{afterTotal}회
                    </p>
                  );
                })()}

                <button type="button" onClick={saveAdd} disabled={saving || !addEnrollId}
                  className="w-full bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                  {saving ? "저장 중..." : "재등록"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== 자료함 모달 ===== */}
      {fileTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setFileTarget(null)}>
          <div className="my-8 w-full max-w-xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">{fileTarget.name} · 자료함</h3>
              <button type="button" onClick={() => setFileTarget(null)} className="text-lg text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <StudentMaterialsView student={fileTarget} studentId={fileTarget.id} />
          </div>
        </div>
      )}

      {/* ===== 결제 모달 ===== */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setPayTarget(null)}>
          <div className="my-8 w-full max-w-xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">{payTarget.name} · 결제</h3>
              <button type="button" onClick={() => setPayTarget(null)} className="text-lg text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <StudentPaymentSection student={payTarget} />
          </div>
        </div>
      )}

      {/* ===== 면접 카테고리 배정 팝업 ===== */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setAssignTarget(null)}>
          <div className="my-8 w-full max-w-md space-y-4 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">면접 카테고리 배정</h3>
              <button type="button" onClick={() => setAssignTarget(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-seum-navy">{assignTarget.student.name}</p>
              <p className="mt-0.5 text-xs">카테고리를 선택하면 학생 화면에 해당 질문이 자동으로 표시됩니다.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-500">카테고리</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_LIST.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onPickCategory(c.key)}
                    className={`border px-3 py-2.5 text-sm font-medium transition ${
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

            {assignCat?.subs?.length ? (
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">세부 선택</label>
                <div className="flex gap-2">
                  {assignCat.subs.map((sub) => (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => setAssignSub(sub.key)}
                      className={`flex-1 border px-3 py-2.5 text-sm font-medium transition ${
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

            {assignCat && (
              <div className="border border-slate-200 bg-white p-3">
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
                  className="border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                >
                  배정 해제
                </button>
              )}
              <button
                type="button"
                onClick={saveAssign}
                disabled={assignSaving}
                className="flex-1 bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
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