import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

const won = (n) => `${Number(n || 0).toLocaleString("ko-KR")}원`;

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
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [settlements, setSettlements] = useState({}); // teacherId -> total

  const loadTeachers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, name, pay_oneonone, pay_group")
      .eq("role", "teacher")
      .order("name");
    setTeachers(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  // 각 선생님 월 정산 합계 계산
  const loadSettlements = async () => {
    const result = {};
    for (const t of teachers) {
      const { data } = await supabase.rpc("teacher_settlement", {
        p_teacher: t.id,
        p_year: year,
        p_month: month,
      });
      const total = (data ?? []).reduce((s, r) => s + (r.subtotal || 0), 0);
      result[t.id] = total;
    }
    setSettlements(result);
  };

  useEffect(() => {
    if (teachers.length > 0) loadSettlements();
  }, [teachers, year, month]);

  const updatePrice = (id, field, value) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const savePrice = async (t) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        pay_oneonone: Number(t.pay_oneonone) || 0,
        pay_group: Number(t.pay_group) || 0,
      })
      .eq("id", t.id);
    if (error) return alert("저장 실패: " + error.message);
    alert("저장되었습니다.");
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

  return (
    <div>
      <h2 className="mb-4 font-bold text-seum-navy">정산 관리</h2>

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

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : teachers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          등록된 선생님이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {teachers.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-seum-navy">{t.name}</p>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{month}월 정산액</p>
                  <p className="text-xl font-bold text-seum-blue">
                    {won(settlements[t.id] ?? 0)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">1:1 1회 단가</label>
                  <input
                    type="number"
                    value={t.pay_oneonone ?? 0}
                    onChange={(e) => updatePrice(t.id, "pay_oneonone", e.target.value)}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">단체반 1회 단가</label>
                  <input
                    type="number"
                    value={t.pay_group ?? 0}
                    onChange={(e) => updatePrice(t.id, "pay_group", e.target.value)}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                  />
                </div>
                <button
                  onClick={() => savePrice(t)}
                  className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4]"
                >
                  단가 저장
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-slate-400">
        정산액은 출석 처리되어 차감된 수업 기준으로 자동 계산됩니다.
      </p>
    </div>
  );
}