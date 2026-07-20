import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CATEGORY_LIST, getCategory, getCategoryLabel, getSubLabel } from "../../lib/interviewConfig";

// 원장: 학생별 면접 카테고리 배정 (학생당 1개)
export default function AdminInterviewAssign({ students = [] }) {
  const [assignments, setAssignments] = useState({}); // { [studentId]: { category_key, sub_key } }
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("interview_assignments")
        .select("student_id, category_key, sub_key");
      const map = {};
      (data ?? []).forEach((a) => { map[a.student_id] = { category_key: a.category_key, sub_key: a.sub_key }; });
      setAssignments(map);
      setLoading(false);
    })();
  }, []);

  const setCategory = (studentId, categoryKey) => {
    setAssignments((prev) => {
      const cur = prev[studentId] || {};
      const cat = getCategory(categoryKey);
      // 카테고리 바꾸면 sub 초기화. 공무원이면 첫 세부 자동 선택
      const sub = cat?.subs?.length ? cat.subs[0].key : null;
      return { ...prev, [studentId]: { category_key: categoryKey, sub_key: sub } };
    });
  };

  const setSub = (studentId, subKey) => {
    setAssignments((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), sub_key: subKey },
    }));
  };

  const save = async (studentId) => {
    const a = assignments[studentId];
    if (!a?.category_key) return alert("카테고리를 선택하세요.");
    setSavingId(studentId);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("interview_assignments")
      .upsert(
        {
          student_id: studentId,
          category_key: a.category_key,
          sub_key: a.sub_key ?? null,
          updated_at: now,
        },
        { onConflict: "student_id" }
      );
    setSavingId(null);
    if (error) return alert("저장 실패: " + error.message);
    alert("배정이 저장되었습니다.");
  };

  const clear = async (studentId) => {
    if (!window.confirm("이 학생의 면접 카테고리 배정을 삭제할까요?")) return;
    setSavingId(studentId);
    const { error } = await supabase.from("interview_assignments").delete().eq("student_id", studentId);
    setSavingId(null);
    if (error) return alert("삭제 실패: " + error.message);
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    alert("배정이 삭제되었습니다.");
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      <h2 className="mb-1 font-bold text-seum-navy">면접 카테고리 배정</h2>
      <p className="mb-4 text-sm text-slate-400">학생마다 면접 카테고리를 하나씩 배정하세요. (공무원은 인천/서울 세부 선택)</p>

      {students.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">학생이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-400">
                <th className="py-2 pr-3 font-medium">학생</th>
                <th className="py-2 pr-3 font-medium">카테고리</th>
                <th className="py-2 pr-3 font-medium">세부 (공무원)</th>
                <th className="py-2 font-medium">저장</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const a = assignments[s.id] || {};
                const cat = a.category_key ? getCategory(a.category_key) : null;
                const hasSub = !!cat?.subs?.length;
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-3 pr-3 font-medium text-seum-navy">{s.name}</td>
                    <td className="py-3 pr-3">
                      <select
                        value={a.category_key || ""}
                        onChange={(e) => setCategory(s.id, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue"
                      >
                        <option value="">— 선택 —</option>
                        {CATEGORY_LIST.map((c) => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      {hasSub ? (
                        <select
                          value={a.sub_key || ""}
                          onChange={(e) => setSub(s.id, e.target.value)}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-seum-blue"
                        >
                          {cat.subs.map((sub) => (
                            <option key={sub.key} value={sub.key}>{sub.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => save(s.id)}
                          disabled={savingId === s.id}
                          className="rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50"
                        >
                          {savingId === s.id ? "저장 중..." : "저장"}
                        </button>
                        {assignments[s.id] && (
                          <button
                            type="button"
                            onClick={() => clear(s.id)}
                            disabled={savingId === s.id}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}