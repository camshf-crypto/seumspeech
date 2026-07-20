import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { makeOrderNo } from "../../lib/payment";

// 원장: 학생에게 결제창(청구서) 발행
// 과정 선택 → 회차 입력 → 자동계산(단가×회차) → 금액 수정 가능 → 발행
// 발행하면 orders에 pending 생성 → 학생 페이지에 "결제하기"로 뜸
export default function IssueInvoice({ branchId }) {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [pending, setPending] = useState([]); // 발행됨(미결제) 목록
  const [loading, setLoading] = useState(true);

  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [sessions, setSessions] = useState(6);
  const [amount, setAmount] = useState(0);
  const [amountTouched, setAmountTouched] = useState(false); // 원장이 직접 수정했는지
  const [issuing, setIssuing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: st } = await supabase
      .from("profiles").select("id, name, phone").eq("role", "student").order("name");
    const { data: cs } = await supabase
      .from("courses").select("*").eq("active", true);
    let pq = supabase
      .from("orders")
      .select("*, student:student_id(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (branchId) pq = pq.eq("branch_id", branchId);
    const { data: pd } = await pq;

    setStudents(st ?? []);
    setCourses(cs ?? []);
    setPending(pd ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [branchId]);

  const selCourse = courses.find((c) => c.id === courseId);
  const isOneOnOne = selCourse?.type === "oneonone";
  const unitPrice = selCourse?.price ?? 0;

  // 과정/회차 바뀌면 금액 자동계산 (원장이 직접 수정했으면 유지)
  useEffect(() => {
    if (!selCourse) return;
    if (amountTouched) return;
    if (isOneOnOne) {
      setAmount(unitPrice * (Number(sessions) || 0)); // 1:1: 회당단가 × 회차
    } else {
      setAmount(unitPrice);                            // 단체반: 정찰가
      setSessions(selCourse.sessions_total ?? 6);
    }
  }, [courseId, sessions, selCourse, isOneOnOne, unitPrice, amountTouched]);

  // 과정 바꾸면 수정 플래그 초기화
  const onPickCourse = (id) => {
    setCourseId(id);
    setAmountTouched(false);
    const c = courses.find((x) => x.id === id);
    if (c && c.type !== "oneonone") setSessions(c.sessions_total ?? 6);
    else setSessions(6);
  };

  const issue = async () => {
    if (!studentId) return alert("학생을 선택하세요.");
    if (!courseId) return alert("과정을 선택하세요.");
    if (!sessions || sessions < 1) return alert("회차를 입력하세요.");
    if (!amount || amount < 1) return alert("금액을 확인하세요.");

    setIssuing(true);
    const { error } = await supabase.from("orders").insert({
      order_no: makeOrderNo(),
      student_id: studentId,
      course_id: courseId,
      branch_id: branchId ?? selCourse?.branch_id ?? null,
      course_title: selCourse?.title ?? "",
      amount: Number(amount),
      sessions: Number(sessions),
      status: "pending",
    });
    setIssuing(false);
    if (error) return alert("발행 실패: " + error.message);

    // 학생에게 알림 (실패해도 무시)
    try {
      const sName = students.find((s) => s.id === studentId)?.name ?? "학생";
      supabase.functions.invoke("send-push", {
        body: {
          title: "세움스피치 결제 안내",
          body: `${selCourse?.title} ${sessions}회 · ${Number(amount).toLocaleString()}원 결제가 요청되었습니다.`,
          url: "/student",
        },
      });
    } catch (e) { /* noop */ }

    alert("결제창이 열렸습니다. 학생 페이지에서 결제할 수 있습니다.");
    setStudentId(""); setCourseId(""); setSessions(6); setAmount(0); setAmountTouched(false);
    load();
  };

  const cancelInvoice = async (o) => {
    if (!window.confirm(`"${o.student?.name} · ${o.course_title}" 결제 요청을 취소할까요?`)) return;
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    if (error) return alert("취소 실패: " + error.message);
    load();
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <h3 className="mb-1 font-bold text-seum-navy">결제창 열기 (청구서 발행)</h3>
      <p className="mb-4 text-sm text-slate-400">상담 후 결정된 과정·회차로 결제창을 열면, 학생이 로그인해서 결제합니다.</p>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">학생</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
            <option value="">학생 선택...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.phone ? ` (${s.phone})` : ""}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">과정</label>
          <select value={courseId} onChange={(e) => onPickCourse(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
            <option value="">과정 선택...</option>
            <optgroup label="1:1">
              {courses.filter((c) => c.type === "oneonone").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title.replace("1:1 ", "")}{c.price ? ` (회당 ${Number(c.price).toLocaleString()}원)` : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="단체반">
              {courses.filter((c) => c.type === "group" && (!branchId || c.branch_id === branchId)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}{c.price ? ` (${Number(c.price).toLocaleString()}원)` : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            회차 {isOneOnOne && unitPrice > 0 && (
              <span className="text-seum-blue">· 회당 {Number(unitPrice).toLocaleString()}원</span>
            )}
          </label>
          <input type="number" min={1} value={sessions}
            onChange={(e) => { setSessions(Number(e.target.value)); setAmountTouched(false); }}
            disabled={!!selCourse && !isOneOnOne}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue disabled:bg-slate-100 disabled:text-slate-400" />
          {selCourse && !isOneOnOne && (
            <p className="mt-1 text-[11px] text-slate-400">단체반은 개설 시 정해진 회차를 사용합니다.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            결제 금액 {!amountTouched && selCourse && <span className="text-slate-400">(자동 계산)</span>}
          </label>
          <input type="number" value={amount}
            onChange={(e) => { setAmount(Number(e.target.value)); setAmountTouched(true); }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs font-bold text-seum-blue">{Number(amount || 0).toLocaleString()}원</span>
            {amountTouched && (
              <button type="button" onClick={() => setAmountTouched(false)}
                className="text-[11px] text-slate-400 underline hover:text-slate-600">자동계산으로 되돌리기</button>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <button onClick={issue} disabled={issuing}
            className="w-full rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
            {issuing ? "발행 중..." : "결제창 열기"}
          </button>
        </div>
      </div>

      {/* 발행됨 (결제 대기) */}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-500">
          결제 대기 {pending.length > 0 && <span className="text-amber-600">({pending.length}건)</span>}
        </p>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
            결제 대기 중인 건이 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {pending.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-seum-navy">
                    {o.student?.name ?? "학생"}
                    <span className="ml-2 font-normal text-slate-500">{o.course_title}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {o.sessions}회 · {Number(o.amount).toLocaleString()}원 · 결제 대기중
                  </p>
                </div>
                <button onClick={() => cancelInvoice(o)}
                  className="flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-50">
                  취소
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}