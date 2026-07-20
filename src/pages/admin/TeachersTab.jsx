import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function TeachersTab({ branchId }) {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickStudent, setPickStudent] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: tc } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "teacher")
      .order("created_at", { ascending: false });
    const { data: st } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("role", "student");
    const { data: br } = await supabase
      .from("branches")
      .select("*")
      .order("sort_order");
    setTeachers(tc ?? []);
    setStudents(st ?? []);
    setBranches(br ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // 학생 → 선생님 지정
  const promote = async () => {
    if (!pickStudent) {
      alert("회원을 선택하세요.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ role: "teacher" })
      .eq("id", pickStudent);
    if (error) {
      alert("지정 실패: " + error.message);
      return;
    }
    setPickStudent("");
    load();
  };

  // 선생님 해제 → 학생으로
  const demote = async (id) => {
    if (!window.confirm("이 선생님을 회원(학생)으로 되돌릴까요?")) return;
    await supabase.from("profiles").update({ role: "student" }).eq("id", id);
    load();
  };

  // 출강 가능 지점 토글
  const toggleBranch = async (teacher, branch) => {
    const current = teacher.available_branches ?? [];
    const has = current.includes(branch.id);
    const updated = has
      ? current.filter((b) => b !== branch.id)
      : [...current, branch.id];
    const { error } = await supabase
      .from("profiles")
      .update({ available_branches: updated })
      .eq("id", teacher.id);
    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }
    setTeachers((prev) =>
      prev.map((t) =>
        t.id === teacher.id ? { ...t, available_branches: updated } : t
      )
    );
  };

  const branchName = (id) => branches.find((b) => b.id === id)?.name ?? "";

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      {/* 선생님 지정 */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h4 className="mb-1 font-bold text-seum-navy">선생님 지정</h4>
        <p className="mb-3 text-sm text-slate-500">
          가입한 회원을 선생님으로 지정합니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={pickStudent}
            onChange={(e) => setPickStudent(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
          >
            <option value="">회원 선택...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
          <button
            onClick={promote}
            className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4]"
          >
            선생님 지정
          </button>
        </div>
      </div>

      {/* 선생님 목록 */}
      <p className="mb-3 text-sm text-slate-500">현재 선생님 {teachers.length}명</p>
      {teachers.length === 0 ? (
        <p className="py-10 text-center text-slate-400">
          아직 지정된 선생님이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teachers.map((t) => {
            const avail = t.available_branches ?? [];
            return (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-seum-navy">{t.name}</p>
                    <p className="text-sm text-slate-500">{t.phone || "-"}</p>
                    <p className="truncate text-xs text-slate-400">{t.email}</p>
                  </div>
                  <button
                    onClick={() => demote(t.id)}
                    className="flex-shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                  >
                    해제
                  </button>
                </div>

                {/* 출강 가능 지점 */}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-medium text-slate-500">
                    출강 가능 지점
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {branches.map((b) => {
                      const on = avail.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() => toggleBranch(t, b)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            on
                              ? "bg-seum-navy text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {on ? "✓ " : ""}{b.name}
                        </button>
                      );
                    })}
                  </div>
                  {avail.length === 0 && (
                    <p className="mt-1 text-xs text-amber-500">
                      출강 지점을 선택해주세요.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}