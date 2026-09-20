import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * 대입 기출문제 선택
 *
 * 수시 6장에 맞춰 한 학생이 고를 수 있는 학교+학과 조합은 6개까지다.
 * 한 번 추가하면 지울 수 없다. (student_univ_picks)
 * 추가한 조합 중 하나를 누르면 그 기출문제를 푼다.
 *
 * [주의] univ_questions 를 직접 조회하면 안 된다.
 * 문항이 6만 건이라 Supabase 가 앞의 1,000행만 돌려주고,
 * 그 안에 있는 학교만 목록에 뜬다.
 * 중복을 없앤 뷰(univ_list / univ_major_list / univ_admission_list)를 쓴다.
 */
const MAX_PICKS = 6;

export default function UnivQuestionPicker({ studentId, value, onSelect }) {
  const [picks, setPicks] = useState([]);
  const [loadingPicks, setLoadingPicks] = useState(true);

  const [univs, setUnivs] = useState([]);
  const [majors, setMajors] = useState([]);
  const [admissions, setAdmissions] = useState([]);

  const [univ, setUniv] = useState("");
  const [major, setMajor] = useState("");
  const [admission, setAdmission] = useState("");

  const [loadingU, setLoadingU] = useState(true);
  const [loadingM, setLoadingM] = useState(false);
  const [loadingA, setLoadingA] = useState(false);
  const [adding, setAdding] = useState(false);

  const full = picks.length >= MAX_PICKS;

  // 내가 고른 조합
  const loadPicks = async () => {
    if (!studentId) return;
    setLoadingPicks(true);
    const { data, error } = await supabase
      .from("student_univ_picks")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at");
    if (error) console.error("지원 목록 조회 실패:", error);
    setPicks(data ?? []);
    setLoadingPicks(false);
  };

  useEffect(() => { loadPicks(); /* eslint-disable-next-line */ }, [studentId]);

  // 학교 목록
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingU(true);
      const { data, error } = await supabase
        .from("univ_list")
        .select("univ")
        .order("univ");
      if (!alive) return;
      if (error) console.error("학교 목록 조회 실패:", error);
      setUnivs((data ?? []).map((x) => x.univ).filter(Boolean));
      setLoadingU(false);
    })();
    return () => { alive = false; };
  }, []);

  // 학과 목록
  useEffect(() => {
    if (!univ) { setMajors([]); return; }
    let alive = true;
    (async () => {
      setLoadingM(true);
      const { data, error } = await supabase
        .from("univ_major_list")
        .select("major")
        .eq("univ", univ);
      if (!alive) return;
      if (error) console.error("학과 목록 조회 실패:", error);
      const uniq = [...new Set((data ?? []).map((x) => x.major).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "ko"));
      setMajors(uniq);
      setLoadingM(false);
    })();
    return () => { alive = false; };
  }, [univ]);

  // 전형 목록
  useEffect(() => {
    if (!univ || !major) { setAdmissions([]); return; }
    let alive = true;
    (async () => {
      setLoadingA(true);
      const { data, error } = await supabase
        .from("univ_admission_list")
        .select("admission")
        .eq("univ", univ)
        .eq("major", major);
      if (!alive) return;
      if (error) console.error("전형 목록 조회 실패:", error);
      const uniq = [...new Set((data ?? []).map((x) => x.admission).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "ko"));
      setAdmissions(uniq);
      setLoadingA(false);
    })();
    return () => { alive = false; };
  }, [univ, major]);

  // 같은 학교+학과가 이미 있는지 (전형만 다른 경우도 한 장으로 본다)
  const already = picks.some((p) => p.univ === univ && p.major === major);

  const addPick = async () => {
    if (!univ || !major || !admission) return;
    if (full) return alert(`지원은 ${MAX_PICKS}개까지만 고를 수 있습니다.`);
    if (already) return alert("이미 고른 학교·학과입니다.");

    const ok = window.confirm(
      `${univ} · ${major} · ${admission}\n\n` +
      `이 조합을 지원 목록에 넣습니다.\n한 번 넣으면 뺄 수 없습니다. 계속할까요?`
    );
    if (!ok) return;

    setAdding(true);
    const { data, error } = await supabase
      .from("student_univ_picks")
      .insert({ student_id: studentId, univ, major, admission })
      .select()
      .maybeSingle();
    setAdding(false);
    if (error) return alert("추가 실패: " + error.message);

    setPicks((p) => [...p, data]);
    setUniv(""); setMajor(""); setAdmission("");
    onSelect?.({ univ: data.univ, major: data.major, admission: data.admission });
  };

  const isSel = (p) =>
    value?.univ === p.univ && value?.major === p.major && value?.admission === p.admission;

  const selectCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-seum-blue disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="no-print mb-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">내 지원 학교</p>
        <span className={`text-xs font-bold ${full ? "text-red-500" : "text-seum-blue"}`}>
          {picks.length} / {MAX_PICKS}
        </span>
      </div>

      {/* 고른 조합 */}
      {loadingPicks ? (
        <p className="py-3 text-center text-sm text-slate-400">불러오는 중...</p>
      ) : picks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white py-4 text-center text-sm text-slate-400">
          아직 고른 학교가 없습니다. 아래에서 추가하세요.
        </p>
      ) : (
        <div className="space-y-1.5">
          {picks.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect?.({ univ: p.univ, major: p.major, admission: p.admission })}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                isSel(p)
                  ? "border-seum-blue bg-blue-50 font-bold text-seum-blue"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="w-4 shrink-0 text-xs text-slate-400">{i + 1}.</span>
              <span className="min-w-0 truncate">
                {p.univ} · {p.major}
                <span className="ml-1.5 text-xs font-normal text-slate-400">{p.admission}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 추가 */}
      {full ? (
        <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2.5 text-center text-xs font-bold text-slate-500">
          지원 {MAX_PICKS}개를 모두 골랐습니다. 위에서 학교를 선택해 기출문제를 푸세요.
        </p>
      ) : (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-bold text-slate-500">지원 학교 추가</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* 학교 */}
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-400">학교</label>
              <select
                value={univ}
                onChange={(e) => { setUniv(e.target.value); setMajor(""); setAdmission(""); }}
                disabled={loadingU}
                className={selectCls}
              >
                <option value="">
                  {loadingU ? "불러오는 중..." : `학교를 선택하세요 (${univs.length})`}
                </option>
                {univs.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* 학과 */}
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-400">학과</label>
              <select
                value={major}
                onChange={(e) => { setMajor(e.target.value); setAdmission(""); }}
                disabled={!univ || loadingM}
                className={selectCls}
              >
                <option value="">
                  {!univ ? "학교 먼저 선택" : loadingM ? "불러오는 중..." : `학과를 선택하세요 (${majors.length})`}
                </option>
                {majors.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* 전형 */}
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-400">전형</label>
              <select
                value={admission}
                onChange={(e) => setAdmission(e.target.value)}
                disabled={!major || loadingA}
                className={selectCls}
              >
                <option value="">
                  {!major ? "학과 먼저 선택" : loadingA ? "불러오는 중..." : `전형을 선택하세요 (${admissions.length})`}
                </option>
                {admissions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              {already
                ? "이미 고른 학교·학과입니다."
                : "한 번 추가하면 뺄 수 없습니다. 신중하게 고르세요."}
            </p>
            <button
              type="button"
              onClick={addPick}
              disabled={!univ || !major || !admission || adding || already}
              className="shrink-0 rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-40"
            >
              {adding ? "추가 중..." : "지원 목록에 추가"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}