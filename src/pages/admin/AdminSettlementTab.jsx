import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

const won = (n) => `${Number(n || 0).toLocaleString("ko-KR")}원`;
const num = (v) => Number(v ?? 0) || 0;
const pad = (n) => String(n).padStart(2, "0");

// 해당 월의 KST 시작/끝 시각
const monthRange = (year, month) => {
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  return {
    start: `${year}-${pad(month)}-01T00:00:00+09:00`,
    end: `${ny}-${pad(nm)}-01T00:00:00+09:00`,
  };
};

const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function AdminSettlementTab() {
  const { profile } = useAuth();
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <LockScreen email={profile?.email} onUnlock={() => setUnlocked(true)} />;
  }
  return <SettlementContent />;
}

function LockScreen({ email, onUnlock }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const check = async () => {
    if (!pw.trim()) return;
    setChecking(true);
    setError("");
    // 현재 로그인된 원장 이메일 + 입력 비번으로 재인증
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });
    setChecking(false);
    if (error) {
      setError("비밀번호가 올바르지 않습니다.");
      setPw("");
    } else {
      onUnlock();
    }
  };

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <div className="mb-4 text-4xl">🔒</div>
      <h2 className="mb-1 font-bold text-seum-navy">정산 관리</h2>
      <p className="mb-5 text-sm text-slate-500">
        민감한 정보입니다. 원장님 비밀번호를 입력하세요.
      </p>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && check()}
        placeholder="비밀번호"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-seum-blue"
      />
      {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}
      <button
        onClick={check}
        disabled={checking}
        className="w-full rounded-lg bg-seum-blue py-2.5 font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
      >
        {checking ? "확인 중..." : "확인"}
      </button>
    </div>
  );
}

function SettlementContent() {
  const now = new Date();
  const [view, setView] = useState("revenue"); // revenue | teacher | pay
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [branches, setBranches] = useState([]);
  const [tab, setTab] = useState("all"); // "all" | 지점 id(문자열) | "none"

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState({});
  const [savingId, setSavingId] = useState(null);

  const [payments, setPayments] = useState([]); // 지점 정보가 붙은 결제 목록
  const [payLoading, setPayLoading] = useState(true);
  const [payError, setPayError] = useState("");

  // ── 초기 로드 ────────────────────────────────
  const loadBranches = async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("id, name")
      .order("name");
    if (error) console.error("branches:", error);
    setBranches(data ?? []);
  };

  const loadTeachers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, name, branch_id, pay_oneonone, pay_group")
      .eq("role", "teacher")
      .order("name");
    setTeachers(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadBranches();
    loadTeachers();
  }, []);

  // ── 결제 → 지점 매출 ─────────────────────────
  const loadPayments = async () => {
    setPayLoading(true);
    setPayError("");
    const { start, end } = monthRange(year, month);

    const { data: rows, error } = await supabase
      .from("payments")
      .select("id, amount, refund_amount, status, method, paid_at, student_id")
      .eq("status", "paid")
      .gte("paid_at", start)
      .lt("paid_at", end)
      .order("paid_at", { ascending: false });

    if (error) {
      console.error("payments:", error);
      setPayments([]);
      setPayError(`결제 내역 조회 실패: ${error.message}`);
      setPayLoading(false);
      return;
    }

    const ids = [...new Set((rows ?? []).map((r) => r.student_id).filter(Boolean))];
    let studentMap = new Map();
    if (ids.length > 0) {
      const { data: studs, error: sErr } = await supabase
        .from("profiles")
        .select("id, name, branch_id")
        .in("id", ids);
      if (sErr) console.error("students:", sErr);
      studentMap = new Map((studs ?? []).map((s) => [String(s.id), s]));
    }

    setPayments(
      (rows ?? []).map((r) => {
        const s = studentMap.get(String(r.student_id));
        return {
          ...r,
          studentName: s?.name ?? "(알 수 없음)",
          branchKey: s?.branch_id ? String(s.branch_id) : "none",
          net: num(r.amount) - num(r.refund_amount),
        };
      })
    );
    setPayLoading(false);
  };

  useEffect(() => {
    loadPayments();
  }, [year, month]);

  // ── 선생님 정산 ──────────────────────────────
  const loadSettlements = async () => {
    const result = {};
    for (const t of teachers) {
      const { data } = await supabase.rpc("teacher_settlement", {
        p_teacher: t.id,
        p_year: year,
        p_month: month,
      });
      result[t.id] = (data ?? []).reduce((s, r) => s + (r.subtotal || 0), 0);
    }
    setSettlements(result);
  };

  useEffect(() => {
    if (teachers.length > 0) loadSettlements();
  }, [teachers, year, month]);

  // ── 파생값 ──────────────────────────────────
  const isAll = tab === "all";
  const activeBranch = branches.find((b) => String(b.id) === tab);
  const hasUnassigned = payments.some((p) => p.branchKey === "none");

  const shownPayments = isAll
    ? payments
    : payments.filter((p) => p.branchKey === tab);

  const sumNet = shownPayments.reduce((s, p) => s + p.net, 0);
  const sumRefund = shownPayments.reduce((s, p) => s + num(p.refund_amount), 0);

  const byBranch = [
    ...branches.map((b) => ({ key: String(b.id), name: b.name })),
    ...(hasUnassigned ? [{ key: "none", name: "지점 미지정" }] : []),
  ].map((b) => {
    const list = payments.filter((p) => p.branchKey === b.key);
    return {
      ...b,
      net: list.reduce((s, p) => s + p.net, 0),
      cnt: list.length,
    };
  });

  const teacherGroups = [
    ...branches.map((b) => ({
      key: String(b.id),
      name: b.name,
      list: teachers.filter((t) => String(t.branch_id ?? "") === String(b.id)),
    })),
    {
      key: "none",
      name: "지점 미지정",
      list: teachers.filter(
        (t) => !branches.some((b) => String(b.id) === String(t.branch_id ?? ""))
      ),
    },
  ].filter((g) => g.list.length > 0);

  // ── 액션 ────────────────────────────────────
  const updatePrice = (id, field, value) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const savePrice = async (t) => {
    setSavingId(t.id);
    const { error } = await supabase
      .from("profiles")
      .update({
        pay_oneonone: Number(t.pay_oneonone) || 0,
        pay_group: Number(t.pay_group) || 0,
      })
      .eq("id", t.id);
    setSavingId(null);
    if (error) return alert("저장 실패: " + error.message);
    alert(`${t.name} 선생님 수업료를 저장했습니다.`);
    loadSettlements();
  };

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  // ── 스타일 ──────────────────────────────────
  const viewClass = (active) =>
    `rounded-lg px-4 py-2 text-sm font-bold transition ${
      active
        ? "bg-seum-blue text-white"
        : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
    }`;

  const tabClass = (active) =>
    `whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-bold transition ${
      active
        ? "border-seum-blue text-seum-blue"
        : "border-transparent text-slate-400 hover:text-slate-600"
    }`;

  const MonthNav = () => (
    <div className="mb-5 flex items-center justify-center gap-4">
      <button
        onClick={prevMonth}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
      >
        ← 이전달
      </button>
      <p className="text-lg font-bold text-seum-navy">
        {year}년 {month}월
      </p>
      <button
        onClick={nextMonth}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
      >
        다음달 →
      </button>
    </div>
  );

  return (
    <div>
      <h2 className="mb-4 font-bold text-seum-navy">정산 관리</h2>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setView("revenue")}
          className={viewClass(view === "revenue")}
        >
          지점 매출
        </button>
        <button
          onClick={() => setView("teacher")}
          className={viewClass(view === "teacher")}
        >
          선생님 정산
        </button>
        <button
          onClick={() => setView("pay")}
          className={viewClass(view === "pay")}
        >
          선생님 수업료
        </button>
      </div>

      {/* ═══ 지점 매출 ═══ */}
      {view === "revenue" ? (
        <>
          <MonthNav />

          <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
            <button onClick={() => setTab("all")} className={tabClass(isAll)}>
              전체
            </button>
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => setTab(String(b.id))}
                className={tabClass(tab === String(b.id))}
              >
                {b.name}
              </button>
            ))}
            {hasUnassigned ? (
              <button
                onClick={() => setTab("none")}
                className={tabClass(tab === "none")}
              >
                지점 미지정
              </button>
            ) : null}
          </div>

          {payError ? (
            <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-500">
              {payError}
            </p>
          ) : null}

          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <p className="font-bold text-seum-navy">
                {isAll
                  ? "전체"
                  : tab === "none"
                  ? "지점 미지정"
                  : activeBranch?.name}{" "}
                · {month}월
              </p>
              {payLoading ? (
                <span className="text-xs text-slate-400">불러오는 중...</span>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">매출</p>
                <p className="mt-1 text-3xl font-bold text-seum-blue">
                  {won(sumNet)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">결제 건수</p>
                <p className="mt-1 text-3xl font-bold text-slate-600">
                  {shownPayments.length}건
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">환불</p>
                <p
                  className={`mt-1 text-3xl font-bold ${
                    sumRefund > 0 ? "text-red-500" : "text-slate-400"
                  }`}
                >
                  {won(sumRefund)}
                </p>
              </div>
            </div>
          </section>

          {/* 전체 탭에서 지점별 비교 */}
          {isAll && byBranch.length > 0 ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byBranch.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setTab(b.key)}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-seum-blue"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-bold text-slate-500">{b.name}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {b.cnt}건
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-seum-blue">
                    {won(b.net)}
                  </p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-seum-blue"
                      style={{
                        width: sumNet > 0 ? `${(b.net / sumNet) * 100}%` : "0%",
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {/* 결제 내역 */}
          <h3 className="mb-2 text-sm font-bold text-slate-500">결제 내역</h3>
          {payLoading ? (
            <p className="text-slate-400">불러오는 중...</p>
          ) : shownPayments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400">
              {year}년 {month}월에 완료된 결제가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400">
                    <th className="w-12 px-4 py-3 text-left font-normal">No.</th>
                    <th className="px-4 py-3 text-left font-normal">결제일</th>
                    <th className="px-4 py-3 text-left font-normal">학생</th>
                    {isAll ? (
                      <th className="px-4 py-3 text-left font-normal">지점</th>
                    ) : null}
                    <th className="px-4 py-3 text-left font-normal">수단</th>
                    <th className="px-4 py-3 text-right font-normal">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {shownPayments.map((p, i) => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {fmtDate(p.paid_at)}
                      </td>
                      <td className="px-4 py-3 font-bold text-seum-navy">
                        {p.studentName}
                      </td>
                      {isAll ? (
                        <td className="px-4 py-3 text-slate-500">
                          {branches.find((b) => String(b.id) === p.branchKey)
                            ?.name ?? "미지정"}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-slate-400">
                        {p.method ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-seum-navy">
                        {won(p.net)}
                        {num(p.refund_amount) > 0 ? (
                          <span className="ml-1 text-xs font-normal text-red-500">
                            (환불 {won(p.refund_amount)})
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            매출은 결제 완료(paid) 건에서 환불액을 뺀 금액입니다. 지점은 결제한
            학생 계정에 설정된 지점을 따릅니다.
          </p>
        </>
      ) : null}

      {/* ═══ 선생님 정산 ═══ */}
      {view === "teacher" ? (
        <>
          <MonthNav />
          {loading ? (
            <p className="text-slate-400">불러오는 중...</p>
          ) : teacherGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
              등록된 선생님이 없습니다.
            </p>
          ) : (
            <div className="space-y-6">
              {teacherGroups.map((g) => (
                <section key={g.key}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-sm font-bold text-slate-500">
                      {g.name}{" "}
                      <span className="font-normal text-slate-400">
                        {g.list.length}명
                      </span>
                    </h3>
                    <p className="text-sm text-slate-400">
                      합계{" "}
                      <span className="font-bold text-seum-navy">
                        {won(
                          g.list.reduce((s, t) => s + (settlements[t.id] ?? 0), 0)
                        )}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-3">
                    {g.list.map((t, i) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-seum-navy">
                              {t.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              1:1 {won(t.pay_oneonone)} · 단체반{" "}
                              {won(t.pay_group)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">
                            {month}월 정산액
                          </p>
                          <p className="text-xl font-bold text-seum-blue">
                            {won(settlements[t.id] ?? 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          <p className="mt-4 text-center text-xs text-slate-400">
            정산액은 출석 처리되어 차감된 수업 기준으로 자동 계산됩니다.
          </p>
        </>
      ) : null}

      {/* ═══ 선생님 수업료 ═══ */}
      {view === "pay" ? (
        <>
          <p className="mb-5 text-sm text-slate-500">
            1회 수업당 선생님께 지급할 금액입니다. 저장하면 이후 정산액 계산에
            바로 반영됩니다.
          </p>
          {loading ? (
            <p className="text-slate-400">불러오는 중...</p>
          ) : teacherGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
              등록된 선생님이 없습니다.
            </p>
          ) : (
            <div className="space-y-6">
              {teacherGroups.map((g) => (
                <section key={g.key}>
                  <h3 className="mb-2 text-sm font-bold text-slate-500">
                    {g.name}{" "}
                    <span className="font-normal text-slate-400">
                      {g.list.length}명
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {g.list.map((t, i) => (
                      <div
                        key={t.id}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                            {i + 1}
                          </span>
                          <p className="font-bold text-seum-navy">{t.name}</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">
                              1:1 1회 단가
                            </label>
                            <input
                              type="number"
                              value={t.pay_oneonone ?? 0}
                              onChange={(e) =>
                                updatePrice(t.id, "pay_oneonone", e.target.value)
                              }
                              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">
                              단체반 1회 단가
                            </label>
                            <input
                              type="number"
                              value={t.pay_group ?? 0}
                              onChange={(e) =>
                                updatePrice(t.id, "pay_group", e.target.value)
                              }
                              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                            />
                          </div>
                          <button
                            onClick={() => savePrice(t)}
                            disabled={savingId === t.id}
                            className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
                          >
                            {savingId === t.id ? "저장 중..." : "단가 저장"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}