import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

const CATEGORIES = [
  { key: "univ", label: "대입" },
  { key: "gov", label: "공무원" },
  { key: "public_corp", label: "공기업" },
  { key: "speech", label: "스피치·보이스" },
];

export default function ConsultManualTab() {
  const [category, setCategory] = useState("univ");
  const [manuals, setManuals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ section: "", title: "", content: "" });
  const [saving, setSaving] = useState(false);

  // 학교별 면접 정보
  const [univSearch, setUnivSearch] = useState("");
  const [univInfos, setUnivInfos] = useState([]);
  const [showUnivForm, setShowUnivForm] = useState(false);
  const [univForm, setUnivForm] = useState(blankUniv());
  const [univEditId, setUnivEditId] = useState(null);

  function blankUniv() {
    return {
      univ: "", major: "", admission: "", year: 2026,
      interview_type: "", duration: "", detail: "", prep_guide: "", note: "",
    };
  }

  const loadManuals = async (cat) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("consult_manuals")
      .select("*")
      .eq("category", cat)
      .eq("is_active", true)
      .order("seq");
    if (error) console.error(error);
    setManuals(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadManuals(category);
    setEditId(null);
  }, [category]);

  const startEdit = (m) => {
    setEditId(m.id);
    setForm({ section: m.section, title: m.title, content: m.content });
  };

  const startNew = () => {
    setEditId("new");
    setForm({ section: "", title: "", content: "" });
  };

  const save = async () => {
    if (!form.title.trim()) return alert("제목을 입력하세요.");
    setSaving(true);
    try {
      if (editId === "new") {
        const { error } = await supabase.from("consult_manuals").insert({
          category,
          section: form.section || "일반",
          title: form.title,
          content: form.content,
          seq: manuals.length,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consult_manuals")
          .update({
            section: form.section || "일반",
            title: form.title,
            content: form.content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editId);
        if (error) throw error;
      }
      setEditId(null);
      await loadManuals(category);
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    const { error } = await supabase.from("consult_manuals").delete().eq("id", id);
    if (error) return alert("삭제 실패: " + e.message);
    await loadManuals(category);
  };

  // ── 학교별 면접 정보 ──
  const searchUniv = async () => {
    if (!univSearch.trim()) {
      setUnivInfos([]);
      return;
    }
    const { data, error } = await supabase
      .from("univ_interview_info")
      .select("*")
      .ilike("univ", `%${univSearch.trim()}%`)
      .order("univ");
    if (error) console.error(error);
    setUnivInfos(data ?? []);
  };

  const saveUniv = async () => {
    if (!univForm.univ.trim()) return alert("학교명을 입력하세요.");
    setSaving(true);
    try {
      if (univEditId) {
        const { error } = await supabase
          .from("univ_interview_info")
          .update({ ...univForm, updated_at: new Date().toISOString() })
          .eq("id", univEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("univ_interview_info").insert(univForm);
        if (error) throw error;
      }
      setShowUnivForm(false);
      setUnivEditId(null);
      setUnivForm(blankUniv());
      setUnivSearch(univForm.univ);
      const { data } = await supabase
        .from("univ_interview_info")
        .select("*")
        .ilike("univ", `%${univForm.univ}%`)
        .order("univ");
      setUnivInfos(data ?? []);
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const editUniv = (u) => {
    setUnivEditId(u.id);
    setUnivForm({
      univ: u.univ ?? "", major: u.major ?? "", admission: u.admission ?? "",
      year: u.year ?? 2026, interview_type: u.interview_type ?? "",
      duration: u.duration ?? "", detail: u.detail ?? "",
      prep_guide: u.prep_guide ?? "", note: u.note ?? "",
    });
    setShowUnivForm(true);
  };

  const removeUniv = async (id) => {
    if (!confirm("삭제할까요?")) return;
    await supabase.from("univ_interview_info").delete().eq("id", id);
    await searchUniv();
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue";

  return (
    <div className="space-y-5">
      {/* 분야 탭 */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              category === c.key
                ? "bg-seum-blue text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 대입일 때만: 학교별 면접 정보 */}
      {category === "univ" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-seum-navy">학교별 면접 정보</h3>
            <button
              onClick={() => {
                setUnivEditId(null);
                setUnivForm(blankUniv());
                setShowUnivForm((v) => !v);
              }}
              className="rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white"
            >
              {showUnivForm ? "닫기" : "학교 추가"}
            </button>
          </div>

          <div className="mb-3 flex gap-2">
            <input
              value={univSearch}
              onChange={(e) => setUnivSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUniv()}
              placeholder="학교명 검색 (예: 서울대)"
              className={inputCls}
            />
            <button
              onClick={searchUniv}
              className="shrink-0 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              검색
            </button>
          </div>

          {showUnivForm && (
            <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <input value={univForm.univ} onChange={(e) => setUnivForm({ ...univForm, univ: e.target.value })} placeholder="학교명" className={inputCls} />
                <input value={univForm.major} onChange={(e) => setUnivForm({ ...univForm, major: e.target.value })} placeholder="학과 (비우면 공통)" className={inputCls} />
                <input value={univForm.admission} onChange={(e) => setUnivForm({ ...univForm, admission: e.target.value })} placeholder="전형 (예: 지역균형)" className={inputCls} />
                <input type="number" value={univForm.year} onChange={(e) => setUnivForm({ ...univForm, year: Number(e.target.value) })} placeholder="학년도" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={univForm.interview_type} onChange={(e) => setUnivForm({ ...univForm, interview_type: e.target.value })} placeholder="면접 유형 (생기부기반 / 제시문 / 인성)" className={inputCls} />
                <input value={univForm.duration} onChange={(e) => setUnivForm({ ...univForm, duration: e.target.value })} placeholder="시간 (예: 10분)" className={inputCls} />
              </div>
              <textarea value={univForm.detail} onChange={(e) => setUnivForm({ ...univForm, detail: e.target.value })} rows={3} placeholder="진행 방식" className={inputCls} />
              <textarea value={univForm.prep_guide} onChange={(e) => setUnivForm({ ...univForm, prep_guide: e.target.value })} rows={3} placeholder="우리 학원 준비 방법" className={inputCls} />
              <input value={univForm.note} onChange={(e) => setUnivForm({ ...univForm, note: e.target.value })} placeholder="특이사항" className={inputCls} />
              <button onClick={saveUniv} disabled={saving} className="h-10 w-full rounded-lg bg-seum-blue text-sm font-bold text-white disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          )}

          {univInfos.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              학교명을 검색하세요.
            </p>
          ) : (
            <div className="space-y-2">
              {univInfos.map((u) => (
                <div key={u.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold text-seum-navy">
                        {u.univ}
                        {u.major ? ` · ${u.major}` : ""}
                        {u.admission ? ` · ${u.admission}` : ""}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">{u.year}학년도</span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => editUniv(u)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">수정</button>
                      <button onClick={() => removeUniv(u.id)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">삭제</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {u.interview_type && <span>유형 : {u.interview_type}</span>}
                    {u.duration && <span>시간 : {u.duration}</span>}
                  </div>
                  {u.detail && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{u.detail}</p>}
                  {u.prep_guide && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="mb-1 text-[11px] font-bold text-slate-500">준비 방법</p>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{u.prep_guide}</p>
                    </div>
                  )}
                  {u.note && <p className="mt-2 text-xs text-slate-400">{u.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 매뉴얼 본문 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-seum-navy">상담 매뉴얼</h3>
          <button onClick={startNew} className="rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white">
            항목 추가
          </button>
        </div>

        {editId && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-2">
              <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="구분 (예: 과정안내)" className={inputCls} />
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="제목" className={inputCls} />
            </div>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} placeholder="내용" className={inputCls} />
            <div className="flex gap-2">
              <button onClick={() => setEditId(null)} className="h-10 flex-1 rounded-lg border border-slate-300 text-sm font-bold text-slate-500">취소</button>
              <button onClick={save} disabled={saving} className="h-10 flex-1 rounded-lg bg-seum-blue text-sm font-bold text-white disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : manuals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
            등록된 매뉴얼이 없습니다. 항목을 추가하세요.
          </p>
        ) : (
          <div className="space-y-3">
            {manuals.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                      {m.section}
                    </span>
                    <span className="text-sm font-bold text-seum-navy">{m.title}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => startEdit(m)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">수정</button>
                    <button onClick={() => remove(m.id)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">삭제</button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}