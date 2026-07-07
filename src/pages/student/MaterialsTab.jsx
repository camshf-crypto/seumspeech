import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const CATEGORIES = ["이력서", "자기소개서", "준비자료", "기타"];

export default function MaterialsTab({ studentId, locked = false }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("이력서");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("student_materials")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    setMaterials(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [studentId]);

  const upload = async () => {
    if (locked) return alert("수강이 종료되어 자료를 올릴 수 없습니다. 재등록 후 이용해주세요.");
    if (!file) return alert("파일을 선택하세요.");
    if (!title.trim()) return alert("제목을 입력하세요.");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${studentId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("student-files").upload(path, file);
    if (upErr) {
      setUploading(false);
      return alert("업로드 실패: " + upErr.message);
    }
    const { data: urlData } = supabase.storage.from("student-files").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("student_materials").insert({
      student_id: studentId,
      title: title.trim(),
      category,
      file_path: path,
      file_url: urlData.publicUrl,
    });
    setUploading(false);
    if (dbErr) return alert("저장 실패: " + dbErr.message);
    setTitle("");
    setFile(null);
    const input = document.getElementById("file-input");
    if (input) input.value = "";
    load();
  };

  const remove = async (m) => {
    if (!window.confirm("이 자료를 삭제할까요?")) return;
    await supabase.storage.from("student-files").remove([m.file_path]);
    await supabase.from("student_materials").delete().eq("id", m.id);
    load();
  };

  return (
    <div>
      <h2 className="mb-3 font-bold text-seum-navy">자료 제출함</h2>
      <p className="mb-4 text-sm text-slate-500">
        이력서, 자기소개서, 면접 준비자료를 올려두면 선생님이 보고 코칭해드립니다.
      </p>

      {locked ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          수강이 종료되어 새 자료를 올릴 수 없습니다. 기존 자료는 계속 확인하실 수 있으며, 재등록 후 다시 업로드할 수 있습니다.
        </div>
      ) : (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="자료 제목 (예: 삼성 자소서 v2)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
            />
          </div>
          <div className="flex gap-2">
            <input
              id="file-input"
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="flex-1 text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:text-slate-600"
            />
            <button
              type="button"
              onClick={upload}
              disabled={uploading}
              className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
            >
              {uploading ? "올리는 중..." : "업로드"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : materials.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          아직 올린 자료가 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <span className="mr-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-seum-blue">{m.category}</span>
                <span className="font-medium text-seum-navy">{m.title}</span>
                <p className="mt-1 text-xs text-slate-400">{new Date(m.created_at).toLocaleString("ko-KR")}</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => window.open(m.file_url, "_blank", "noopener,noreferrer")} className="text-sm font-medium text-seum-blue hover:underline">열기</button>
                <button type="button" onClick={() => remove(m)} className="text-sm text-slate-400 hover:text-red-500">삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}