import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

// 전화 상담 카드에 함께 뜨는 값
const TRUST = [
  { num: "약 400명", label: "작년 지도 학생" },
  { num: "약 25만 건", label: "기출·질문 데이터" },
  { num: "전 지점 직영", label: "계열별 담임제" },
];

const DEFAULT_FLOW = {
  univ: "기본 인성 → 생기부 예상질문 → 학교·학과 기출 → 모의면접",
  gov: "공직관 → 기본 인성 → 직렬 기출 → PT·토론 → 모의면접",
  public_corp: "인성 → 직무 → 기출 → 모의면접",
  speech: "진단 → 발성·전달 → 실전 스피치 → 촬영 피드백",
};

const DEFAULT_ASK = [
  "학종 몇 장 쓰셨어요?",
  "면접일이 언제인가요?",
  "수능최저나 논술 있나요?",
  "면접 준비해보신 적 있어요?",
];

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

  // 전화 상담 모드
  const [mode, setMode] = useState("card");   // card = 전화 중 | manage = 등록·수정
  const [picked, setPicked] = useState(null); // 카드로 펼친 학교
  const [checked, setChecked] = useState({}); // 물어볼 것 체크
  const [copied, setCopied] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openFaq, setOpenFaq] = useState(false);

  // 학과 → 직업군
  const [majorQ, setMajorQ] = useState("");
  const [majorHits, setMajorHits] = useState([]);
  const [majorPick, setMajorPick] = useState(null);
  const [majorErr, setMajorErr] = useState("");

  function blankUniv() {
    return {
      univ: "", major: "", admission: "", year: 2026,
      interview_type: "", duration: "", detail: "", prep_guide: "", note: "",
      // 상담 카드(전화 중 화면)에 뜨는 값
      summary_line: "", talk_script: "", expert_line: "",
      ask_points: [], prep_flow: "", course_label: "", course_price: null,
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
    let q = supabase
      .from("univ_interview_info")
      .select("*")
      .ilike("univ", `%${univSearch.trim()}%`);

    // 전화 상담 중에는 상담용으로 정리된 것만 보여준다.
    // (모집요강만 옮겨둔 줄은 summary_line 이 비어 있어 목록이 지저분해진다)
    if (mode === "card") q = q.not("summary_line", "is", null);

    const { data, error } = await q.order("univ");
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
      summary_line: u.summary_line ?? "", talk_script: u.talk_script ?? "",
      expert_line: u.expert_line ?? "", ask_points: u.ask_points ?? [],
      prep_flow: u.prep_flow ?? "", course_label: u.course_label ?? "",
      course_price: u.course_price ?? null,
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

  // 학과명·키워드로 직업군 찾기
  useEffect(() => {
    const q = majorQ.trim();
    if (q.length < 1) { setMajorHits([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      // 학과명 부분일치로만 찾는다.
      // (배열 컬럼 조건을 or 로 섞으면 문법이 까다로워 조용히 실패한다)
      const { data, error } = await supabase
        .from("major_career_map")
        .select("*")
        .ilike("major", `%${q}%`)
        .order("major")
        .limit(10);
      if (error) {
        console.error("major_career_map 조회 실패:", error);
        if (alive) setMajorErr(error.message);
        return;
      }
      if (alive) { setMajorErr(""); setMajorHits(data ?? []); }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [majorQ]);

  const pickCard = (u) => {
    setPicked(u);
    setChecked({});
    setOpenDetail(false);
    setOpenFaq(false);
    setMajorQ("");
    setMajorHits([]);
    setMajorPick(null);
  };

  const copyScript = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사에 실패했어요. 길게 눌러 직접 복사해주세요.");
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue";

  // ── 전화 상담 카드 ──────────────────────────
  const card = picked && (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setPicked(null)}
        className="text-xs font-medium text-slate-400 hover:text-slate-600"
      >
        ← 다시 검색
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-lg font-extrabold text-seum-navy">
          {picked.univ}
          {picked.major ? ` ${picked.major}` : ""}
          {picked.admission ? ` | ${picked.admission}` : ""}
        </p>
        <div className="mt-3 rounded-xl bg-seum-blue/5 px-4 py-3">
          <p className="mb-1 text-[11px] font-bold text-seum-blue">이 학교 면접은</p>
          <p className="text-[15px] font-bold leading-relaxed text-seum-navy">
            {picked.summary_line ||
              [picked.interview_type, picked.duration].filter(Boolean).join(" / ") ||
              "요약이 등록되지 않았습니다"}
          </p>
        </div>
      </div>

      {picked.talk_script ? (
        <div className="rounded-2xl border-l-4 border-seum-blue bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold text-seum-blue">이대로 말하세요</p>
            <button
              type="button"
              onClick={() => copyScript(picked.talk_script)}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              {copied ? "복사됨 ✓" : "복사"}
            </button>
          </div>
          <p className="text-[15px] leading-[1.9] text-slate-700">
            &ldquo;{picked.talk_script}&rdquo;
          </p>
        </div>
      ) : null}

      {/* 학과 → 직업군 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-2 text-[11px] font-bold text-slate-400">
          어느 학과 지원하세요?
        </p>
        <input
          value={majorQ}
          onChange={(e) => { setMajorQ(e.target.value); setMajorPick(null); }}
          placeholder="학과명 입력 (예: 홍보광고)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-seum-blue"
        />

        {!majorPick && majorHits.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {majorHits.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMajorPick(m)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                {m.major}
              </button>
            ))}
          </div>
        )}

        {majorErr ? (
          <p className="mt-2 text-xs text-red-500">불러오기 실패: {majorErr}</p>
        ) : null}

        {!majorPick && !majorErr && majorQ.trim() && majorHits.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">
            등록된 학과가 없습니다. 학생이 말한 학과를 그대로 받아 적어두세요.
          </p>
        )}

        {majorPick && (
          <div className="mt-3 rounded-xl bg-seum-blue/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-seum-navy">{majorPick.major}</p>
              <button
                type="button"
                onClick={() => { setMajorPick(null); setMajorQ(""); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                다시 찾기
              </button>
            </div>

            <p className="mb-1 text-[11px] font-bold text-seum-blue">주요 진로</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(majorPick.careers ?? []).map((c) => (
                <span key={c} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {c}
                </span>
              ))}
            </div>

            {majorPick.concept_tip ? (
              <>
                <p className="mb-1 text-[11px] font-bold text-seum-blue">컨셉 잡는 법</p>
                <p className="text-[14px] leading-relaxed text-slate-700">
                  {majorPick.concept_tip}
                </p>
              </>
            ) : null}

            <p className="mt-3 border-t border-white/60 pt-2 text-[13px] leading-relaxed text-slate-500">
              이렇게 말하세요 — &ldquo;{majorPick.major}는 보통
              {" " + (majorPick.careers ?? []).slice(0, 3).join(", ")} 쪽으로 많이 갑니다.
              저희는 학과 홈페이지까지 보고 그 직업군에 맞게 생기부 활동을 연결해서
              하나의 컨셉으로 답변을 구성해드려요.&rdquo;
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-2 text-[11px] font-bold text-slate-400">이 학생에게 물어볼 것</p>
        <div className="space-y-1">
          {(picked.ask_points?.length ? picked.ask_points : DEFAULT_ASK).map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setChecked((p) => ({ ...p, [i]: !p[i] }))}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                  checked[i]
                    ? "border-seum-blue bg-seum-blue text-white"
                    : "border-slate-300 text-transparent"
                }`}
              >
                ✓
              </span>
              <span
                className={`text-[15px] ${
                  checked[i] ? "text-slate-400 line-through" : "text-slate-700"
                }`}
              >
                {a}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-2 text-[11px] font-bold text-slate-400">
          세움스피치는 이렇게 준비합니다
        </p>
        <p className="text-[15px] font-bold text-seum-navy">
          {picked.prep_flow || DEFAULT_FLOW[category]}
        </p>
        {picked.expert_line ? (
          <p className="mt-3 border-l-2 border-slate-200 pl-3 text-[14px] leading-relaxed text-slate-600">
            &ldquo;{picked.expert_line}&rdquo;
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
          {TRUST.map((t) => (
            <div key={t.label} className="text-center">
              <p className="text-[15px] font-extrabold text-seum-blue">{t.num}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-seum-navy px-5 py-4 text-white">
        <span className="text-xs text-white/60">추천 과정</span>
        <span className="text-lg font-extrabold">
          {picked.course_label || "과정 미등록"}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpenDetail((v) => !v)}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          {openDetail ? "상세 닫기" : "상세보기"}
        </button>
        <button
          type="button"
          onClick={() => setOpenFaq((v) => !v)}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          {openFaq ? "반론 닫기" : "다른 학원과 뭐가 달라요?"}
        </button>
      </div>

      {openDetail && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5">
          {[
            ["면접 유형", picked.interview_type],
            ["시간", picked.duration],
            ["진행 방식", picked.detail],
            ["우리 학원 준비 방법", picked.prep_guide],
            ["특이사항", picked.note],
            ["학년도", picked.year],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <p className="text-[11px] font-bold text-slate-400">{k}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{v}</p>
              </div>
            ))}
        </div>
      )}

      {openFaq && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5">
          {manuals.length === 0 ? (
            <p className="text-sm text-slate-400">등록된 상담 매뉴얼이 없습니다.</p>
          ) : (
            manuals.map((m) => (
              <details key={m.id} className="border-b border-slate-50 pb-2 last:border-0">
                <summary className="cursor-pointer text-sm font-bold text-seum-navy">
                  {m.title}
                </summary>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {m.content}
                </p>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 전화 중 / 등록 모드 */}
      <div className="flex gap-2">
        {[
          { key: "card", label: "📞 전화 상담" },
          { key: "manage", label: "매뉴얼 관리" },
        ].map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => { setMode(m.key); setPicked(null); setUnivInfos([]); }}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              mode === m.key
                ? "bg-seum-navy text-white"
                : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

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

      {/* 전화 상담 모드 — 검색해서 카드 열기 */}
      {mode === "card" && (
        picked ? card : (
          <div>
            <div className="mb-3 flex gap-2">
              <input
                value={univSearch}
                onChange={(e) => setUnivSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUniv()}
                placeholder="학교명을 입력하고 Enter (예: 숙명)"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base outline-none focus:border-seum-blue"
                autoFocus
              />
              <button
                onClick={searchUniv}
                className="shrink-0 rounded-xl bg-seum-blue px-5 text-sm font-bold text-white"
              >
                검색
              </button>
            </div>

            {univInfos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
                전화 받으면 학교명부터 검색하세요.
                <span className="mt-1 block text-xs text-slate-300">
                  상담용으로 정리된 학교만 나옵니다
                </span>
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {univInfos.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => pickCard(u)}
                    className="flex w-full items-center gap-2 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                  >
                    <span className="font-bold text-seum-navy">{u.univ}</span>
                    {u.major ? <span className="text-sm text-slate-500">{u.major}</span> : null}
                    {u.admission ? (
                      <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                        {u.admission}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* 대입일 때만: 학교별 면접 정보 (등록·수정) */}
      {mode === "manage" && category === "univ" && (
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

              {/* ── 상담 카드에 뜨는 값 ─────────────────────── */}
              <div className="mt-3 rounded-lg border border-seum-blue/30 bg-white p-3">
                <p className="mb-2 text-xs font-bold text-seum-blue">
                  전화 상담 화면에 뜨는 내용
                </p>

                <label className="mb-1 block text-[11px] text-slate-500">
                  면접 한 줄 요약 — 상담원이 제일 먼저 보는 문장
                </label>
                <input
                  value={univForm.summary_line}
                  onChange={(e) => setUnivForm({ ...univForm, summary_line: e.target.value })}
                  placeholder="예: 학생부 기반 개별면접 / 약 12분 / 면접관 2명 / 제시문 없음"
                  className={`${inputCls} mb-2`}
                />

                <label className="mb-1 block text-[11px] text-slate-500">
                  상담 멘트 — 이대로 읽어도 되게 3~4문장으로
                </label>
                <textarea
                  value={univForm.talk_script}
                  onChange={(e) => setUnivForm({ ...univForm, talk_script: e.target.value })}
                  rows={4}
                  placeholder="예: 숙명여대는 제시문을 풀거나 전공지식을 시험하는 방식이 아니라 학생부를 기반으로 12분 정도 심층면접을 봐요. 그래서 생기부 활동을 얼마나 정확하게 이해하고 있고, 지원학과와 어떻게 연결해서 설명하느냐가 중요합니다."
                  className={`${inputCls} mb-2`}
                />

                <label className="mb-1 block text-[11px] text-slate-500">
                  전문성 한마디 — 학원 실력이 드러나는 문장
                </label>
                <textarea
                  value={univForm.expert_line}
                  onChange={(e) => setUnivForm({ ...univForm, expert_line: e.target.value })}
                  rows={3}
                  placeholder="예: 학생부 기반 면접은 어디서 질문이 들어올지 모르기 때문에 생기부 전체를 봐야 해요. 저희는 학생에 따라 30개 이상 예상질문을 준비합니다."
                  className={`${inputCls} mb-2`}
                />

                <label className="mb-1 block text-[11px] text-slate-500">
                  이 학생에게 물어볼 것 — 한 줄에 하나씩
                </label>
                <textarea
                  value={(univForm.ask_points ?? []).join("\n")}
                  onChange={(e) =>
                    setUnivForm({
                      ...univForm,
                      ask_points: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean),
                    })
                  }
                  rows={4}
                  placeholder={"학종 몇 장 쓰셨어요?\n면접일이 언제인가요?\n수능최저나 논술 있나요?\n면접 준비해보신 적 있어요?"}
                  className={`${inputCls} mb-2`}
                />

                <label className="mb-1 block text-[11px] text-slate-500">
                  세움 준비 흐름
                </label>
                <input
                  value={univForm.prep_flow}
                  onChange={(e) => setUnivForm({ ...univForm, prep_flow: e.target.value })}
                  placeholder="예: 기본 인성 → 생기부 예상질문 → 학교·학과 기출 → 모의면접"
                  className={`${inputCls} mb-2`}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-500">추천 과정</label>
                    <input
                      value={univForm.course_label}
                      onChange={(e) => setUnivForm({ ...univForm, course_label: e.target.value })}
                      placeholder="7회 / 90분 / 126만원"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-500">금액(숫자만)</label>
                    <input
                      type="number"
                      value={univForm.course_price ?? ""}
                      onChange={(e) =>
                        setUnivForm({
                          ...univForm,
                          course_price: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="1260000"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

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

      {/* 매뉴얼 본문 — 전화 중에는 카드 안의 FAQ 버튼으로만 본다 */}
      {mode === "manage" && (
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
      )}
    </div>
  );
}