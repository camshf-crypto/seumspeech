import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * 대입 기출문제 3단 선택 (학교 → 학과 → 전형)
 * 선택이 완료되면 onSelect({ univ, major, admission }) 호출.
 * 상위 선택이 바뀌면 하위 선택은 초기화된다.
 */
export default function UnivQuestionPicker({ value, onSelect }) {
  const [univs, setUnivs] = useState([]);
  const [majors, setMajors] = useState([]);
  const [admissions, setAdmissions] = useState([]);

  const [univ, setUniv] = useState(value?.univ ?? "");
  const [major, setMajor] = useState(value?.major ?? "");
  const [admission, setAdmission] = useState(value?.admission ?? "");

  const [loadingU, setLoadingU] = useState(true);
  const [loadingM, setLoadingM] = useState(false);
  const [loadingA, setLoadingA] = useState(false);

  // 학교 목록
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingU(true);
      const { data } = await supabase
        .from("univ_questions")
        .select("univ")
        .eq("is_active", true);
      if (!alive) return;
      const uniq = [...new Set((data ?? []).map((x) => x.univ))].sort((a, b) =>
        a.localeCompare(b, "ko")
      );
      setUnivs(uniq);
      setLoadingU(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 학과 목록
  useEffect(() => {
    if (!univ) {
      setMajors([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoadingM(true);
      const { data } = await supabase
        .from("univ_questions")
        .select("major")
        .eq("univ", univ)
        .eq("is_active", true);
      if (!alive) return;
      const uniq = [...new Set((data ?? []).map((x) => x.major))].sort((a, b) =>
        a.localeCompare(b, "ko")
      );
      setMajors(uniq);
      setLoadingM(false);
    })();
    return () => {
      alive = false;
    };
  }, [univ]);

  // 전형 목록
  useEffect(() => {
    if (!univ || !major) {
      setAdmissions([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoadingA(true);
      const { data } = await supabase
        .from("univ_questions")
        .select("admission")
        .eq("univ", univ)
        .eq("major", major)
        .eq("is_active", true);
      if (!alive) return;
      const uniq = [...new Set((data ?? []).map((x) => x.admission))].sort((a, b) =>
        a.localeCompare(b, "ko")
      );
      setAdmissions(uniq);
      setLoadingA(false);
    })();
    return () => {
      alive = false;
    };
  }, [univ, major]);

  const pickUniv = (v) => {
    setUniv(v);
    setMajor("");
    setAdmission("");
    onSelect?.(null);
  };

  const pickMajor = (v) => {
    setMajor(v);
    setAdmission("");
    onSelect?.(null);
  };

  const pickAdmission = (v) => {
    setAdmission(v);
    if (v) onSelect?.({ univ, major, admission: v });
    else onSelect?.(null);
  };

  const selectCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-seum-blue disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="no-print mb-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="mb-3 text-xs font-bold text-slate-500">기출문제 선택</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 학교 */}
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-400">학교</label>
          <select
            value={univ}
            onChange={(e) => pickUniv(e.target.value)}
            disabled={loadingU}
            className={selectCls}
          >
            <option value="">
              {loadingU ? "불러오는 중..." : "학교를 선택하세요"}
            </option>
            {univs.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {/* 학과 */}
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-400">학과</label>
          <select
            value={major}
            onChange={(e) => pickMajor(e.target.value)}
            disabled={!univ || loadingM}
            className={selectCls}
          >
            <option value="">
              {!univ ? "학교 먼저 선택" : loadingM ? "불러오는 중..." : "학과를 선택하세요"}
            </option>
            {majors.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* 전형 */}
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-400">전형</label>
          <select
            value={admission}
            onChange={(e) => pickAdmission(e.target.value)}
            disabled={!major || loadingA}
            className={selectCls}
          >
            <option value="">
              {!major ? "학과 먼저 선택" : loadingA ? "불러오는 중..." : "전형을 선택하세요"}
            </option>
            {admissions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {univ && major && admission && (
        <p className="mt-3 text-[11px] font-bold text-seum-blue">
          {univ} · {major} · {admission}
        </p>
      )}
    </div>
  );
}