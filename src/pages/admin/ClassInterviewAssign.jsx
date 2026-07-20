import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CATEGORY_LIST, getCategory } from "../../lib/interviewConfig";

// 단체반에 면접 카테고리 배정 (반 전원 상속)
// 어드민/반 관리 화면에 붙여서 사용. branchId로 해당 지점 반만 표시.
export default function ClassInterviewAssign({ branchId }) {
  const [courses, setCourses] = useState([]);
  const [assignMap, setAssignMap] = useState({}); // { [courseId]: { category_key, sub_key } }
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState(null); // 배정 모달 대상 course
  const [category, setCategory] = useState("");
  const [sub, setSub] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let cq = supabase.from("courses").select("*").eq("active", true).eq("type", "group");
    if (branchId) cq = cq.eq("branch_id", branchId);
    const { data: cs } = await cq;
    const { data: ca } = await supabase
      .from("interview_class_assignments")
      .select("course_id, category_key, sub_key");
    const map = {};
    (ca ?? []).forEach((a) => { map[a.course_id] = { category_key: a.category_key, sub_key: a.sub_key }; });
    setCourses(cs ?? []);
    setAssignMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [branchId]);

  const openAssign = (course) => {
    const cur = assignMap[course.id];
    setTarget(course);
    if (cur) { setCategory(cur.category_key); setSub(cur.sub_key ?? ""); }
    else { setCategory(""); setSub(""); }
  };

  const onPickCategory = (key) => {
    setCategory(key);
    const cat = getCategory(key);
    setSub(cat?.subs?.length ? cat.subs[0].key : "");
  };

  const save = async () => {
    if (!category) return alert("카테고리를 선택하세요.");
    const cat = getCategory(category);
    if (cat?.subs?.length && !sub) return alert("세부(인천/서울)를 선택하세요.");
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("interview_class_assignments")
      .upsert(
        { course_id: target.id, category_key: category, sub_key: cat?.subs?.length ? sub : null, updated_at: now },
        { onConflict: "course_id" }
      );
    setSaving(false);
    if (error) return alert("저장 실패: " + error.message);
    setAssignMap((p) => ({ ...p, [target.id]: { category_key: category, sub_key: cat?.subs?.length ? sub : null } }));
    alert("반 배정 완료. 이 반 학생들 화면에 해당 질문이 표시됩니다. (개별 배정이 있는 학생은 개별 배정 우선)");
    setTarget(null);
  };

  const clear = async () => {
    if (!window.confirm("이 반의 면접 카테고리 배정을 해제할까요?")) return;
    setSaving(true);
    const { error } = await supabase.from("interview_class_assignments").delete().eq("course_id", target.id);
    setSaving(false);
    if (error) return alert("해제 실패: " + error.message);
    setAssignMap((p) => { const n = { ...p }; delete n[target.id]; return n; });
    alert("배정이 해제되었습니다.");
    setTarget(null);
  };

  const badge = (courseId) => {
    const a = assignMap[courseId];
    if (!a) return null;
    const cat = getCategory(a.category_key);
    if (!cat) return null;
    const subLabel = cat.subs?.find((s) => s.key === a.sub_key)?.label;
    return subLabel ? `${cat.label}·${subLabel}` : cat.label;
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  const cat = category ? getCategory(category) : null;

  return (
    <div>
      <h2 className="mb-1 font-bold text-seum-navy">단체반 면접 카테고리 배정</h2>
      <p className="mb-4 text-sm text-slate-400">단체반에 카테고리를 배정하면 그 반 학생 전원 화면에 질문이 표시됩니다. (개별 배정이 있는 학생은 개별 우선)</p>

      {courses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">단체반이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {courses.map((c) => {
            const b = badge(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="font-bold text-seum-navy">{c.title}</p>
                  {b ? (
                    <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-seum-blue">{b}</span>
                  ) : (
                    <span className="mt-1 inline-block text-xs text-slate-400">미배정</span>
                  )}
                </div>
                <button type="button" onClick={() => openAssign(c)}
                  className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4]">
                  면접설정
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 배정 모달 */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setTarget(null)}>
          <div className="my-8 w-full max-w-md space-y-4 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">반 면접 배정</h3>
              <button type="button" onClick={() => setTarget(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-seum-navy">{target.title}</p>
              <p className="mt-0.5 text-xs">이 반 학생 전원에게 적용됩니다.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-500">카테고리</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_LIST.map((c) => (
                  <button key={c.key} type="button" onClick={() => onPickCategory(c.key)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${category === c.key ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {cat?.subs?.length ? (
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">세부 선택</label>
                <div className="flex gap-2">
                  {cat.subs.map((s) => (
                    <button key={s.key} type="button" onClick={() => setSub(s.key)}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${sub === s.key ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {cat && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="mb-1.5 text-xs font-medium text-slate-500">표시될 탭</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.tabs.map((t) => (
                    <span key={t.key} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{t.label}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              {assignMap[target.id] && (
                <button type="button" onClick={clear} disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60">
                  배정 해제
                </button>
              )}
              <button type="button" onClick={save} disabled={saving}
                className="flex-1 rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}