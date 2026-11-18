import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * 면접 후기 보기 — 선생님·원장 메뉴 "면접 후기"
 *
 * 학생이 "면접 후기"에 적은 내용을 모아서 본다 (보기 전용).
 *   원장(all)  : 전체 학생
 *   선생님     : 담당 학생만 (1:1 = enrollments.teacher_id, 단체반 = courses.teacher_id)
 * 위에서 이름·학교 검색, 결과(대기/합격/예비/불합격)로 걸러 보고,
 * 카드를 누르면 받은 질문·분위기·아쉬운 점이 펼쳐진다.
 */

const RESULTS = ["전체", "대기", "합격", "예비", "불합격"];
const RESULT_CLS = {
  대기: "bg-slate-100 text-slate-500",
  합격: "bg-emerald-50 text-emerald-700",
  예비: "bg-amber-50 text-amber-700",
  불합격: "bg-red-50 text-red-600",
};

export default function ReviewsPanel({ teacherId, all = false }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("전체");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => {
      // 선생님이면 담당 학생 id 부터
      let ids = null;
      if (!all) {
        const [{ data: e1 }, { data: cs }] = await Promise.all([
          supabase.from("enrollments").select("student_id").eq("teacher_id", teacherId),
          supabase.from("courses").select("id").eq("teacher_id", teacherId),
        ]);
        let e2 = [];
        const courseIds = (cs ?? []).map((c) => c.id);
        if (courseIds.length) {
          const { data } = await supabase.from("enrollments").select("student_id").in("course_id", courseIds);
          e2 = data ?? [];
        }
        ids = [...new Set([...(e1 ?? []), ...e2].map((x) => x.student_id))];
        if (ids.length === 0) { setRows([]); return; }
      }

      let q = supabase
        .from("interview_reviews")
        .select("*, student:student_id(name, phone)")
        .order("interview_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (ids) q = q.in("student_id", ids);
      const { data, error } = await q;
      if (error) console.error("면접 후기 불러오기 실패:", error);
      setRows(data ?? []);
    })();
  }, [teacherId, all]);

  const filtered = useMemo(() => {
    const k = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (result !== "전체" && r.result !== result) return false;
      if (!k) return true;
      return [r.student?.name, r.univ, r.major, r.admission].some((v) => (v ?? "").toLowerCase().includes(k));
    });
  }, [rows, search, result]);

  const count = (x) => (rows ?? []).filter((r) => r.result === x).length;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-seum-navy">면접 후기</h2>
        <p className="mt-1 text-sm text-slate-500">
          {all ? "학생들이 실제 면접을 보고 적은 후기입니다." : "담당 학생들이 실제 면접을 보고 적은 후기입니다."} 카드를 누르면 자세히 보여요.
        </p>
      </div>

      {/* 결과 요약 */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {RESULTS.map((x) => (
          <button key={x} type="button" onClick={() => setResult(x)}
            className={`border px-3 py-2.5 text-left ${result === x ? "border-seum-blue bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <p className="text-xs text-slate-500">{x}</p>
            <p className="text-lg font-bold text-seum-navy">{x === "전체" ? rows?.length ?? 0 : count(x)}</p>
          </button>
        ))}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="학생 이름 · 대학 · 학과 검색"
        className="mb-4 w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-seum-blue" />

      {rows === null ? (
        <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : filtered.length === 0 ? (
        <p className="border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">해당하는 후기가 없어요.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const isOpen = open === r.id;
            const qs = r.questions ?? [];
            return (
              <div key={r.id} className="border border-slate-200 bg-white">
                <button type="button" onClick={() => setOpen(isOpen ? null : r.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-bold text-seum-navy">
                      {r.student?.name ?? "학생"} <span className="font-normal text-slate-400">·</span> {r.univ} {r.major}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[r.admission, r.interview_date, `질문 ${qs.length}개`, r.pressure && `분위기 ${r.pressure}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-bold ${RESULT_CLS[r.result] ?? ""}`}>{r.result}</span>
                    <span className="text-slate-300">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-sm">
                    <div>
                      <p className="mb-1.5 text-xs font-bold text-slate-500">받은 질문</p>
                      <ol className="space-y-1 text-slate-700">
                        {qs.map((x, i) => (
                          <li key={i} className={x.tail ? "pl-5 text-amber-700" : ""}>
                            {x.tail ? "↳ " : `${qs.slice(0, i + 1).filter((y) => !y.tail).length}. `}{x.q}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-bold text-slate-500">면접 분위기·방식</p>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {r.interviewer_count != null && <span className="bg-slate-100 px-2 py-1">면접관 {r.interviewer_count}명</span>}
                        {r.student_count != null && <span className="bg-slate-100 px-2 py-1">{r.student_count > 1 ? `학생 ${r.student_count}명 같이` : "개별 면접"}</span>}
                        {r.duration_min != null && <span className="bg-slate-100 px-2 py-1">{r.duration_min}분</span>}
                        {r.blind != null && <span className="bg-slate-100 px-2 py-1">{r.blind ? "블라인드" : "블라인드 아님"}</span>}
                        {r.pressure && <span className="bg-slate-100 px-2 py-1">{r.pressure}</span>}
                      </div>
                      {r.atmosphere && <p className="mt-2 whitespace-pre-wrap text-slate-700">{r.atmosphere}</p>}
                    </div>

                    {r.my_answer && (
                      <div>
                        <p className="mb-1.5 text-xs font-bold text-slate-500">내 답변·아쉬운 점</p>
                        <p className="whitespace-pre-wrap text-slate-700">{r.my_answer}</p>
                      </div>
                    )}

                    <p className="text-right text-[11px] text-slate-400">
                      {r.student?.phone ? `${r.student.phone} · ` : ""}작성 {new Date(r.created_at).toLocaleDateString("ko-KR")}
                      {r.updated_at && r.updated_at !== r.created_at ? ` · 수정 ${new Date(r.updated_at).toLocaleDateString("ko-KR")}` : ""}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}