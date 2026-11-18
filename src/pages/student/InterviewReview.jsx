import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * 학생 — 면접 후기 (왼쪽 메뉴 "면접 후기")
 *
 * 실제 면접을 보고 나서 학교별로 하나씩 적는다.
 *   ① 학교·학과·전형·날짜
 *   ② 받은 질문 (한 줄씩, 꼬리질문 표시)
 *   ③ 면접 분위기·방식 (면접관 수, 시간, 블라인드, 압박 정도)
 *   ④ 내 답변·아쉬운 점
 *   결과는 쓰는 화면에서 받지 않고, 발표가 나면 목록에서 바로 고른다 (처음엔 대기)
 * 선생님·원장만 볼 수 있다 (다른 학생에게는 안 보임).
 * 테이블: interview_reviews
 */

const RESULTS = ["대기", "합격", "예비", "불합격"];
const PRESSURE = ["편안", "보통", "압박"];
const RESULT_CLS = {
  대기: "bg-slate-100 text-slate-500",
  합격: "bg-emerald-50 text-emerald-700",
  예비: "bg-amber-50 text-amber-700",
  불합격: "bg-red-50 text-red-600",
};

const emptyForm = () => ({
  id: null,
  univ: "",
  major: "",
  admission: "",
  interview_date: "",
  questions: [{ q: "", tail: false }],
  interviewer_count: "",
  student_count: "",
  duration_min: "",
  blind: null,
  pressure: "",
  atmosphere: "",
  my_answer: "",
  result: "대기",
});

const toNum = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

export default function InterviewReview({ studentId }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null); // 쓰는 중이면 폼, 아니면 null
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("interview_reviews")
      .select("*")
      .eq("student_id", studentId)
      .order("interview_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) console.error("면접 후기 불러오기 실패:", error);
    setList(data ?? []);
  };
  useEffect(() => { load(); }, [studentId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setQ = (i, patch) =>
    setForm((f) => ({ ...f, questions: f.questions.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const addQ = (tail = false) => setForm((f) => ({ ...f, questions: [...f.questions, { q: "", tail }] }));
  const delQ = (i) => setForm((f) => ({ ...f, questions: f.questions.filter((_, j) => j !== i) }));

  const edit = (r) =>
    setForm({
      ...emptyForm(),
      ...r,
      admission: r.admission ?? "",
      interview_date: r.interview_date ?? "",
      questions: r.questions?.length ? r.questions : [{ q: "", tail: false }],
      interviewer_count: r.interviewer_count ?? "",
      student_count: r.student_count ?? "",
      duration_min: r.duration_min ?? "",
      pressure: r.pressure ?? "",
      atmosphere: r.atmosphere ?? "",
      my_answer: r.my_answer ?? "",
    });

  const save = async () => {
    if (!form.univ.trim() || !form.major.trim()) return alert("대학과 학과를 적어 주세요.");
    const questions = form.questions.map((x) => ({ q: x.q.trim(), tail: !!x.tail })).filter((x) => x.q);
    if (questions.length === 0) return alert("받은 질문을 하나 이상 적어 주세요.");

    const row = {
      student_id: studentId,
      univ: form.univ.trim(),
      major: form.major.trim(),
      admission: form.admission.trim() || null,
      interview_date: form.interview_date || null,
      questions,
      interviewer_count: toNum(form.interviewer_count),
      student_count: toNum(form.student_count),
      duration_min: toNum(form.duration_min),
      blind: form.blind,
      pressure: form.pressure || null,
      atmosphere: form.atmosphere.trim() || null,
      my_answer: form.my_answer.trim() || null,
      result: form.result,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    const q = form.id
      ? supabase.from("interview_reviews").update(row).eq("id", form.id)
      : supabase.from("interview_reviews").insert(row);
    const { error } = await q;
    setSaving(false);
    if (error) return alert("저장 실패: " + error.message);
    setForm(null);
    load();
  };

  const remove = async (r) => {
    if (!window.confirm(`${r.univ} ${r.major} 후기를 지울까요?`)) return;
    const { error } = await supabase.from("interview_reviews").delete().eq("id", r.id);
    if (error) return alert("삭제 실패: " + error.message);
    load();
  };

  // 결과만 빠르게 바꾸기 (발표 났을 때)
  const setResult = async (r, result) => {
    const { error } = await supabase
      .from("interview_reviews")
      .update({ result, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return alert("변경 실패: " + error.message);
    setList((p) => p.map((x) => (x.id === r.id ? { ...x, result } : x)));
  };

  const input = "w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue";
  const label = "mb-1 block text-xs font-bold text-slate-500";

  // ───────── 쓰기 / 고치기 ─────────
  if (form) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-seum-navy">{form.id ? "면접 후기 고치기" : "면접 후기 쓰기"}</h2>
          <button type="button" onClick={() => setForm(null)} className="text-sm text-slate-400 hover:text-slate-700">← 목록으로</button>
        </div>

        <div className="space-y-6 border border-slate-200 bg-white p-5">
          {/* ① 학교 */}
          <section>
            <p className="mb-3 text-sm font-bold text-seum-navy">① 어디 면접이었나요?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={label}>대학 *</label><input className={input} value={form.univ} onChange={(e) => set("univ", e.target.value)} placeholder="예: 인천대학교" /></div>
              <div><label className={label}>학과 *</label><input className={input} value={form.major} onChange={(e) => set("major", e.target.value)} placeholder="예: 사회복지학과" /></div>
              <div><label className={label}>전형</label><input className={input} value={form.admission} onChange={(e) => set("admission", e.target.value)} placeholder="예: 학생부종합" /></div>
              <div><label className={label}>면접 본 날</label><input type="date" className={input} value={form.interview_date} onChange={(e) => set("interview_date", e.target.value)} /></div>
            </div>
          </section>

          {/* ② 받은 질문 */}
          <section>
            <p className="mb-1 text-sm font-bold text-seum-navy">② 받은 질문 *</p>
            <p className="mb-3 text-xs text-slate-400">기억나는 대로 한 줄에 하나씩. 앞 질문에 이어서 나온 질문은 [꼬리질문]으로 추가하세요.</p>
            <div className="space-y-2">
              {form.questions.map((x, i) => (
                <div key={i} className={`flex items-center gap-2 ${x.tail ? "pl-6" : ""}`}>
                  <span className={`w-14 shrink-0 text-xs font-bold ${x.tail ? "text-amber-600" : "text-seum-blue"}`}>
                    {x.tail ? "↳ 꼬리" : `Q${form.questions.slice(0, i + 1).filter((y) => !y.tail).length}`}
                  </span>
                  <input className={input} value={x.q} onChange={(e) => setQ(i, { q: e.target.value })} placeholder={x.tail ? "이어서 받은 질문" : "받은 질문"} />
                  {form.questions.length > 1 && (
                    <button type="button" onClick={() => delQ(i)} className="shrink-0 px-2 text-slate-300 hover:text-red-500">✕</button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => addQ(false)} className="border border-seum-blue px-3 py-1.5 text-xs font-bold text-seum-blue hover:bg-blue-50">+ 질문</button>
              <button type="button" onClick={() => addQ(true)} className="border border-amber-400 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50">+ 꼬리질문</button>
            </div>
          </section>

          {/* ③ 분위기·방식 */}
          <section>
            <p className="mb-3 text-sm font-bold text-seum-navy">③ 면접 분위기·방식</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={label}>면접관 수</label><input type="number" min="0" className={input} value={form.interviewer_count} onChange={(e) => set("interviewer_count", e.target.value)} placeholder="명" /></div>
              <div><label className={label}>같이 들어간 학생 수</label><input type="number" min="0" className={input} value={form.student_count} onChange={(e) => set("student_count", e.target.value)} placeholder="혼자면 1" /></div>
              <div><label className={label}>면접 시간</label><input type="number" min="0" className={input} value={form.duration_min} onChange={(e) => set("duration_min", e.target.value)} placeholder="분" /></div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>블라인드 면접이었나요?</label>
                <div className="flex gap-2">
                  {[[true, "네"], [false, "아니요"]].map(([v, t]) => (
                    <button key={t} type="button" onClick={() => set("blind", form.blind === v ? null : v)}
                      className={`flex-1 border py-2 text-sm font-bold ${form.blind === v ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 text-slate-500"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label}>분위기</label>
                <div className="flex gap-2">
                  {PRESSURE.map((p) => (
                    <button key={p} type="button" onClick={() => set("pressure", form.pressure === p ? "" : p)}
                      className={`flex-1 border py-2 text-sm font-bold ${form.pressure === p ? "border-seum-blue bg-seum-blue text-white" : "border-slate-300 text-slate-500"}`}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className={label}>그 밖에 기억나는 것</label>
              <textarea rows={3} className={input} value={form.atmosphere} onChange={(e) => set("atmosphere", e.target.value)}
                placeholder="대기 시간, 면접관 반응, 들어가서 처음 한 말 등" />
            </div>
          </section>

          {/* ④ 내 답변 */}
          <section>
            <p className="mb-3 text-sm font-bold text-seum-navy">④ 내 답변·아쉬운 점</p>
            <textarea rows={5} className={input} value={form.my_answer} onChange={(e) => set("my_answer", e.target.value)}
              placeholder="어떻게 답했는지, 다시 한다면 바꾸고 싶은 점" />
          </section>

        </div>

        <button type="button" onClick={save} disabled={saving}
          className="mt-4 w-full bg-seum-blue py-3 font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    );
  }

  // ───────── 목록 ─────────
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-seum-navy">면접 후기</h2>
          <p className="mt-1 text-sm text-slate-500">면접을 보고 나면 학교별로 기억나는 질문과 분위기를 적어 주세요. 발표가 나면 카드 오른쪽 위에서 결과를 골라 주세요. 선생님만 볼 수 있어요.</p>
        </div>
        <button type="button" onClick={() => setForm(emptyForm())}
          className="shrink-0 bg-seum-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4]">+ 후기 쓰기</button>
      </div>

      {list === null ? (
        <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : list.length === 0 ? (
        <p className="border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">아직 쓴 후기가 없어요.</p>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-seum-navy">{r.univ} · {r.major}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[r.admission, r.interview_date, `질문 ${r.questions?.length ?? 0}개`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <select value={r.result} onChange={(e) => setResult(r, e.target.value)}
                  className={`shrink-0 border-0 px-2 py-1 text-xs font-bold ${RESULT_CLS[r.result] ?? ""}`}>
                  {RESULTS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-700">
                {(r.questions ?? []).slice(0, 4).map((x, i) => (
                  <li key={i} className={x.tail ? "pl-4 text-slate-500" : ""}>{x.tail ? "↳ " : "· "}{x.q}</li>
                ))}
                {(r.questions?.length ?? 0) > 4 && <li className="text-xs text-slate-400">… 외 {r.questions.length - 4}개</li>}
              </ul>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => edit(r)} className="border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">고치기</button>
                <button type="button" onClick={() => remove(r)} className="border border-slate-200 px-3 py-1 text-xs text-slate-400 hover:text-red-500">삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}