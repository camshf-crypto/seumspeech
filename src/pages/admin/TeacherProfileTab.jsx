import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const empty = {
  name: "", role: "", field: "", subjects: "",
  career_main: "", career_summary: "", one_liner: "", is_principal: false,
};

export default function TeacherProfileTab() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 폼 안 사진
  const [formFile, setFormFile] = useState(null);
  const [formPreview, setFormPreview] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_teachers")
      .select("*")
      .order("is_principal", { ascending: false })
      .order("sort_order");
    setTeachers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setFormFile(null); setFormPreview(null); setEditing("new"); };
  const openEdit = (t) => {
    setForm({
      name: t.name || "", role: t.role || "", field: t.field || "",
      subjects: (t.subjects || []).join(", "),
      career_main: t.career_main || "", career_summary: t.career_summary || "",
      one_liner: t.one_liner || "", is_principal: !!t.is_principal,
    });
    setFormFile(null);
    setFormPreview(t.image_url || null);
    setEditing(t);
  };
  const close = () => { setEditing(null); setForm(empty); setFormFile(null); setFormPreview(null); };

  const pickFormFile = (file) => {
    if (!file) return;
    setFormFile(file);
    setFormPreview(URL.createObjectURL(file));
  };

  // 사진 업로드 헬퍼: 강사 id 받아서 업로드 + DB 업데이트
  const doUpload = async (teacherId, oldPath, file) => {
    if (oldPath) await supabase.storage.from("site-images").remove([oldPath]);
    const ext = file.name.split(".").pop();
    const path = `teachers/${teacherId}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("site-images").upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("site-images").getPublicUrl(path);
    await supabase.from("site_teachers").update({ image_url: pub.publicUrl, file_path: path }).eq("id", teacherId);
  };

  const save = async () => {
    if (!form.name.trim()) return alert("이름을 입력하세요.");
    setSaving(true);
    try {
      const subjectsArr = form.subjects
        .split(",").map((s) => s.trim()).filter(Boolean);
      const payload = {
        name: form.name, role: form.role, field: form.field,
        subjects: subjectsArr,
        career_main: form.career_main, career_summary: form.career_summary,
        one_liner: form.one_liner, is_principal: form.is_principal,
      };

      if (editing === "new") {
        // 1) 강사 생성
        const { data: created, error } = await supabase.from("site_teachers")
          .insert({ ...payload, sort_order: teachers.length })
          .select()
          .single();
        if (error) throw error;
        // 2) 사진 골랐으면 업로드
        if (formFile && created) {
          await doUpload(created.id, null, formFile);
        }
      } else {
        const { error } = await supabase.from("site_teachers")
          .update(payload).eq("id", editing.id);
        if (error) throw error;
        // 새 사진 골랐으면 교체
        if (formFile) {
          await doUpload(editing.id, editing.file_path, formFile);
        }
      }
      setSaving(false);
      close();
      load();
    } catch (e) {
      setSaving(false);
      alert("저장 실패: " + e.message);
    }
  };

  const del = async (t) => {
    if (!window.confirm(`${t.name} 강사를 삭제할까요?`)) return;
    if (t.file_path) await supabase.storage.from("site-images").remove([t.file_path]);
    await supabase.from("site_teachers").delete().eq("id", t.id);
    load();
  };

  // 목록에서 바로 사진 교체 (기존 기능 유지)
  const uploadPhoto = async (t, file) => {
    if (!file) return;
    setUploading(true);
    try {
      await doUpload(t.id, t.file_path, file);
      load();
    } catch (e) {
      alert("사진 업로드 실패: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue";

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">강사진을 추가·수정·삭제합니다. 강사소개 페이지에 반영됩니다.</p>
        <button onClick={openNew} className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4]">+ 강사 추가</button>
      </div>

      <div className="space-y-3">
        {teachers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">등록된 강사가 없습니다.</p>
        ) : teachers.map((t) => (
          <div key={t.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {t.image_url ? (
                <img src={t.image_url} alt={t.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-slate-300">사진없음</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-seum-navy">
                {t.name}
                {t.is_principal ? <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">대표원장</span> : null}
              </p>
              {t.field ? <p className="mt-0.5 truncate text-xs text-slate-500">{t.field}</p> : null}
              {t.subjects?.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.subjects.map((s, i) => (
                    <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-seum-blue">#{s}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-shrink-0 flex-col gap-1.5">
              <label className={`cursor-pointer rounded-md bg-slate-100 px-3 py-1.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-200 ${uploading ? "opacity-60" : ""}`}>
                {t.image_url ? "사진교체" : "사진추가"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => uploadPhoto(t, e.target.files?.[0])} />
              </label>
              <button onClick={() => openEdit(t)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">정보수정</button>
              <button onClick={() => del(t)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">삭제</button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={close}>
          <div className="my-8 w-full max-w-lg space-y-4 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-seum-navy">{editing === "new" ? "강사 추가" : "강사 정보 수정"}</h3>
              <button onClick={close} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-3">
              {/* 사진 업로드 */}
              <div>
                <label className="mb-1 block text-xs text-slate-500">프로필 사진</label>
                <div className="flex items-center gap-4">
                  <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {formPreview ? (
                      <img src={formPreview} alt="미리보기" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-300">사진없음</span>
                    )}
                  </div>
                  <label className="cursor-pointer rounded-lg border border-seum-blue px-4 py-2 text-sm font-medium text-seum-blue hover:bg-blue-50">
                    {formPreview ? "사진 변경" : "사진 선택"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => pickFormFile(e.target.files?.[0])} />
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-500">이름 *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="한지아 부원장" className={inputCls} />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs text-slate-500">직책</label>
                  <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="강사님" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">한줄 소개 (이름 아래)</label>
                <input value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} placeholder="보이스, 스피치, 입시면접, 취업면접" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">담당과목 태그 (쉼표로 구분)</label>
                <input value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="취업면접, 스피치, 보이스" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">주요이력 (여러 줄)</label>
                <textarea value={form.career_main} onChange={(e) => setForm({ ...form, career_main: e.target.value })} rows={4} placeholder="경희대학교 미디어커뮤니케이션대학원 석사&#10;NCSOFT 정규 아나운서&#10;..." className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">주요약력 (여러 줄)</label>
                <textarea value={form.career_summary} onChange={(e) => setForm({ ...form, career_summary: e.target.value })} rows={3} placeholder="직장인, 교수, 공무직 대상 스피치 코칭&#10;..." className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">한마디 (여러 줄)</label>
                <textarea value={form.one_liner} onChange={(e) => setForm({ ...form, one_liner: e.target.value })} rows={2} placeholder="나답게, 당신답게. 자신감있게&#10;..." className={inputCls} />
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.is_principal} onChange={(e) => setForm({ ...form, is_principal: e.target.checked })} className="h-4 w-4 accent-seum-blue" />
                <span className="text-sm text-slate-600">대표원장 (강사소개 상단에 크게 표시)</span>
              </label>
            </div>
            <button onClick={save} disabled={saving} className="w-full rounded-lg bg-seum-blue py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}