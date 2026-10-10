import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CATEGORY_LIST, getCategoryLabel } from "../lib/interviewConfig";

// 학생 자료 제출함
//
// 예전에는 공무원·공기업·사기업 수업 3개(수업 id를 직접 적어둠)만 불러와서
// 대입·경찰·고입·병원·편입 학생은 담당이 맞아도 목록에 안 보였다.
// 이제는 내 담당 수강 전체에서 자료를 올린 학생을 모두 보여주고,
// 면접 종류는 수업(courses.interview_category) → 학생 배정(interview_assignments) 순서로 정한다.

const CATEGORIES = ["전체", "이력서", "자기소개서", "생기부", "준비자료", "기타"];

// 면접 종류가 비어 있던 예전 수업 — 수업 id로 종류를 정한다
const LEGACY_COURSES = {
  "8e8666ac-0724-4c97-8ae7-e9af6f32c864": "gov",
  "6acedcd5-b975-4955-96ef-1f9f6abba5e8": "public_corp",
  "f295037a-b3ee-4178-9de7-a1b75d50a2c1": "company",
};

const typeLabel = (key) => (key && key !== "etc" ? getCategoryLabel(key) : "기타");

const fmt = (d) => (d ? new Date(d).toLocaleDateString("ko-KR") : "-");

export default function StudentMaterialsView({ teacherId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [cat, setCat] = useState("전체");
  const [matLoading, setMatLoading] = useState(false);

  const load = async () => {
    setLoading(true);

    // 담당(enrollments.teacher_id = 나) 수강 전체. 원장(teacherId 없음)은 전체
    let query = supabase
      .from("enrollments")
      .select("*, profiles:student_id(name, phone), courses(title, interview_category)");

    if (teacherId) query = query.eq("teacher_id", teacherId);

    const { data: enr, error } = await query;
    if (error) console.error("담당 수강 조회 실패:", error);
    const enrList = (enr ?? []).filter((e) => e.student_id);

    if (enrList.length === 0) { setRows([]); setLoading(false); return; }

    const studentIds = [...new Set(enrList.map((e) => e.student_id))];

    // 담당 학생들의 자료 개수
    const { data: mats } = await supabase
      .from("student_materials")
      .select("student_id")
      .in("student_id", studentIds);

    const countMap = {};
    (mats ?? []).forEach((m) => { countMap[m.student_id] = (countMap[m.student_id] || 0) + 1; });

    // 학생별 면접 배정 (수업에 면접 종류가 없을 때 쓴다)
    const { data: asg } = await supabase
      .from("interview_assignments")
      .select("student_id, category_key")
      .in("student_id", studentIds);
    const asgMap = {};
    (asg ?? []).forEach((a) => { asgMap[a.student_id] = a.category_key; });

    const typeOf = (e) =>
      e.courses?.interview_category ||
      LEGACY_COURSES[e.course_id] ||
      asgMap[e.student_id] ||
      "etc";

    // 자료를 실제로 올린 학생만, 학생당 한 줄 (면접 종류가 정해진 수강을 우선)
    const byStudent = {};
    enrList.forEach((e) => {
      if (!countMap[e.student_id]) return;
      const row = { ...e, type: typeOf(e), matCount: countMap[e.student_id] };
      const prev = byStudent[e.student_id];
      if (!prev || (prev.type === "etc" && row.type !== "etc")) byStudent[e.student_id] = row;
    });

    setRows(
      Object.values(byStudent).sort((a, b) =>
        (a.profiles?.name ?? "").localeCompare(b.profiles?.name ?? "")
      )
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [teacherId]);

  const openStudent = async (row) => {
    setSelected(row);
    setCat("전체");
    setMatLoading(true);
    const { data } = await supabase
      .from("student_materials")
      .select("*")
      .eq("student_id", row.student_id)
      .order("created_at", { ascending: false });
    setMaterials(data ?? []);
    setMatLoading(false);
  };

  // 버튼은 면접 종류 목록 순서대로, 실제로 학생이 있는 종류만 보여준다
  const present = new Set(rows.map((r) => r.type));
  const typeFilters = [
    { key: "all", label: "전체" },
    ...CATEGORY_LIST.filter((c) => present.has(c.key)).map((c) => ({ key: c.key, label: c.label })),
    ...(present.has("etc") ? [{ key: "etc", label: "기타" }] : []),
  ];

  const visible = rows.filter((r) => {
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${r.profiles?.name || ""} ${r.company || ""} ${r.exam_type || ""} ${r.job_role || ""} ${r.courses?.title || ""} ${r.phone || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const filteredMats = cat === "전체" ? materials : materials.filter((m) => m.category === cat);

  return (
    <div>
      <h2 className="mb-1 font-bold text-seum-navy">학생 자료 제출함</h2>
      <p className="mb-4 text-sm text-slate-400">담당 학생이 올린 이력서·자기소개서·생기부·면접 준비자료를 확인하고 다운로드합니다.</p>

      {/* 필터 + 검색 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {typeFilters.map((t) => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${typeFilter === t.key ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {t.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름·회사·학교·직무 검색"
          className="ml-auto w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
        />
      </div>

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          해당하는 학생이 없습니다.
        </p>
      ) : (
        <>
          {/* 데스크탑: 표 (md 이상) */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">이름</th>
                  <th className="px-4 py-3 font-medium">면접유형</th>
                  <th className="px-4 py-3 font-medium">지원</th>
                  <th className="px-4 py-3 font-medium">직무</th>
                  <th className="px-4 py-3 font-medium">구분</th>
                  <th className="px-4 py-3 font-medium">수강기간</th>
                  <th className="px-4 py-3 font-medium">잔여</th>
                  <th className="px-4 py-3 font-medium">자료</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} onClick={() => openStudent(r)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-seum-navy">{r.profiles?.name ?? "이름없음"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-seum-blue">
                        {typeLabel(r.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.company || r.exam_type || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.job_role || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.career_level || "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmt(r.created_at)} ~ {fmt(r.expires_at)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.remaining_sessions}/{r.total_sessions}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{r.matCount}건</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">보기 →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일: 카드 (md 미만) */}
          <div className="space-y-3 md:hidden">
            {visible.map((r) => (
              <div key={r.id} onClick={() => openStudent(r)} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-seum-navy">{r.profiles?.name ?? "이름없음"}</p>
                    <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-seum-blue">
                      {typeLabel(r.type)}
                    </span>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">자료 {r.matCount}건</span>
                </div>

                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="flex-shrink-0 text-slate-400">지원</span>
                    <span className="text-right text-slate-700">
                      {(r.company || r.exam_type || "-")}{r.job_role ? ` · ${r.job_role}` : ""}{r.career_level ? ` · ${r.career_level}` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="flex-shrink-0 text-slate-400">수강기간</span>
                    <span className="text-right text-slate-700">{fmt(r.created_at)} ~ {fmt(r.expires_at)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="flex-shrink-0 text-slate-400">잔여</span>
                    <span className="text-right text-slate-700">{r.remaining_sessions}/{r.total_sessions}</span>
                  </div>
                </div>

                <p className="mt-3 text-right text-sm font-medium text-seum-blue">자료 보기 →</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 자료 상세 모달 */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-seum-navy">
                  {selected.profiles?.name}
                  <span className="ml-2 text-sm font-normal text-slate-400">{typeLabel(selected.type)}</span>
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {selected.company || selected.exam_type || ""}
                  {selected.job_role ? ` · ${selected.job_role}` : ""}
                  {selected.career_level ? ` · ${selected.career_level}` : ""}
                </p>
                <p className="text-xs text-slate-400">
                  수강 {fmt(selected.created_at)} ~ {fmt(selected.expires_at)} · 잔여 {selected.remaining_sessions}/{selected.total_sessions}회
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition ${cat === c ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {c}
                </button>
              ))}
            </div>

            {matLoading ? (
              <p className="text-slate-400">불러오는 중...</p>
            ) : filteredMats.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-slate-400">해당 자료가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {filteredMats.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                    <div className="min-w-0">
                      <span className="mr-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-seum-blue">{m.category}</span>
                      <span className="font-medium text-seum-navy">{m.title}</span>
                      <p className="mt-1 text-xs text-slate-400">{new Date(m.created_at).toLocaleString("ko-KR")}</p>
                    </div>
                    <button
                      onClick={() => window.open(m.file_url, "_blank", "noopener,noreferrer")}
                      className="flex-shrink-0 rounded-lg border border-seum-blue px-3 py-1.5 text-sm font-medium text-seum-blue hover:bg-blue-50"
                    >
                      열기
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}