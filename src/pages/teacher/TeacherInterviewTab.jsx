import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PtReview from "./PtReview";
import {
  getCategory,
  getSubLabel,
  getCategoryLabel,
  getTabLabel,
  getSeriesLabel,
} from "../../lib/interviewConfig";

// ============================================================
// 카테고리별 Edge Function 매핑
// 배포된 것만 여기에 등록. 없으면 fallback 함수 사용.
// ============================================================
const FN_MAP = {
  gov: "interview-ai-gov",             // 공무원
  public_corp: "interview-ai-public",  // 공기업
  // company: "interview-ai-company",     // 사기업 (미배포)
  // hospital: "interview-ai-hospital",   // 병원 (미배포)
  // univ: "interview-ai-univ",           // 대입 (미배포)
  // transfer: "interview-ai-transfer",   // 편입 (미배포)
  // highschool: "interview-ai-high",     // 고입 (미배포)
};
const FN_FALLBACK = "interview-ai-feedback";

function getFnName(categoryKey) {
  return FN_MAP[categoryKey] ?? FN_FALLBACK;
}

// Edge Function 에러의 실제 응답 본문을 뽑아냄
async function extractFnError(error) {
  let detail = error?.message || "unknown";
  try {
    const body = await error.context?.json();
    detail = body?.error || JSON.stringify(body);
  } catch (_) {
    try {
      const txt = await error.context?.text();
      if (txt) detail = txt;
    } catch (__) {}
  }
  return detail;
}

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const NO_SERIES = "__none"; // series_key 가 없는 문항용 키

// 지역(sub_key) 구분 없이 함께 쓰는 문항
// - 공무원(gov)은 지역별로 문항을 따로 만들지 않고 전 지역이 같은 문항을 쓴다.
// - 그 외 카테고리는 기출·PT·토론만 공통.
const SHARED_CATEGORIES = ["gov"];
const SHARED_TABS = ["gichul", "pt", "debate"];
const isSharedContent = (categoryKey, tabKey) =>
  SHARED_CATEGORIES.includes(categoryKey) || SHARED_TABS.includes(tabKey);

// 지역별로 같은 문항이 복사돼 들어간 경우가 있다(공직관·기본인성).
// sub_key 필터를 풀면 같은 질문이 지역 수만큼 중복으로 보이므로,
// 질문 내용 기준으로 한 벌만 남긴다. 이미 답변이 달린 사본을 우선한다.
const dedupeByQuestion = (rows) => {
  const score = (r) =>
    r?._answer?.student_answer?.trim() ? 2 : r?._answer ? 1 : 0;
  const byText = new Map();
  rows.forEach((r) => {
    const key = (r.question ?? "").trim();
    const prev = byText.get(key);
    if (!prev || score(r) > score(prev)) byText.set(key, r);
  });
  return Array.from(byText.values());
};

const SERIES_LABEL_FALLBACK = {
  hwangyeong: "환경직",
  environment: "환경직",
  ilbanhaengjeong: "일반행정직",
  general_admin: "일반행정직",
  haengjeong: "일반행정직",
  sahoe_bokji: "사회복지직",
  sahoebokji: "사회복지직",
  social_welfare: "사회복지직",
  semu: "세무직",
  tax: "세무직",
  gyoyukhaengjeong: "교육행정직",
  education_admin: "교육행정직",
  bogun: "보건직",
  health: "보건직",
  ganho: "간호직",
  nursing: "간호직",
  jeonsan: "전산직",
  computer: "전산직",
  tomok: "토목직",
  civil: "토목직",
  geonchuk: "건축직",
  architecture: "건축직",
  jeongi: "전기직",
  electrical: "전기직",
  gigye: "기계직",
  mechanical: "기계직",
  nongup: "농업직",
  agriculture: "농업직",
  sanrim: "산림자원직",
  forestry: "산림자원직",
  susan: "수산직",
  fisheries: "수산직",
  nokji: "녹지직",
  green: "녹지직",
  jijeok: "지적직",
  cadastral: "지적직",
  bangjaeanseon: "방재안전직",
  disaster_safety: "방재안전직",
  saseo: "사서직",
  librarian: "사서직",
  sokgi: "속기직",
  stenography: "속기직",
  tonggye: "통계직",
  statistics: "통계직",
  gyujeong: "교정직",
  corrections: "교정직",
  geomchal: "검찰직",
  prosecution: "검찰직",
  chulipguk: "출입국관리직",
  immigration: "출입국관리직",
  gwansae: "관세직",
  customs: "관세직",
  ujeong: "우정직",
  postal: "우정직",
};

function hasHangul(value) {
  return /[가-힣]/.test(String(value ?? ""));
}

function resolveSeriesLabel(categoryKey, subKey, key, dbLabel) {
  if (key === NO_SERIES) return "직렬 미지정";

  const cleanDbLabel = String(dbLabel ?? "").trim();
  if (hasHangul(cleanDbLabel)) return cleanDbLabel;

  try {
    const configuredLabel = getSeriesLabel(categoryKey, subKey, key);
    if (hasHangul(configuredLabel)) return configuredLabel;
  } catch (_) {}

  return SERIES_LABEL_FALLBACK[key] ?? (cleanDbLabel || key);
}

// ============================================================
// 선생님 단체반 모드
// 반 선택 → 학생 선택 → 탭 → 그 학생의 질문/답변/피드백
//
// [기출문제 탭]
// 학생이 자기 직렬을 골라 답변하므로, 그 학생이 답변한 문항의 series_key 로
// 직렬을 역추적해서 자동 선택한다. 그 직렬의 문항 전체(답변/미답변 모두)를 보여준다.
// 아직 답변이 하나도 없으면 직렬을 알 수 없으므로 직렬을 직접 고르게 한다.
//
// [주의] interview_answers_v2 조회 시 question_id 를 .in(...) 으로 넘기지 말 것.
// UUID가 전부 URL에 들어가 길이 한계를 넘고 서버가 400 으로 거절한다.
// student_id 로만 가져와 JS에서 거른다.
// ============================================================
export default function TeacherClassInterview({ courseType = "group" }) {
  // courseType: "group"(단체반) | "oneonone"(1:1)
  const MODE_LABEL = courseType === "group" ? "단체반" : "1:1 수업";

  const [myId, setMyId] = useState(null);     // 로그인한 선생님 id
  const [classes, setClasses] = useState([]); // [{course, assignment}]
  const [classesLoading, setClassesLoading] = useState(true);

  const [selClass, setSelClass] = useState(null);     // { course, assignment }
  const [students, setStudents] = useState([]);       // 반 학생 [{id, name}]
  const [selStudent, setSelStudent] = useState(null); // { id, name }
  const [activeTab, setActiveTab] = useState(null);

  const [rows, setRows] = useState([]);   // 이 탭 전체 [{ ...question, _answer }]
  const [loading, setLoading] = useState(false);

  // 기출 탭
  const [gichulView, setGichulView] = useState(null);      // 보고 있는 series_key (null = 미선택)
  const [studentSeries, setStudentSeries] = useState([]);  // 이 학생이 답변한 직렬
  const [showAllSeries, setShowAllSeries] = useState(false);

  const [draftEdits, setDraftEdits] = useState({}); // { [answerId]: text }
  const [savingId, setSavingId] = useState(null);
  const [aiLoadingId, setAiLoadingId] = useState(null);

  // 탭별 답변 현황 (학생 선택 시 계산)
  const [tabStats, setTabStats] = useState({}); // { [tabKey]: { answered, feedbacked } }

  // 일괄 AI 진행 상태
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // 1) 면접 단체반 로드
  useEffect(() => {
    (async () => {
      setClassesLoading(true);
      setSelClass(null);
      const { data: me } = await supabase.auth.getUser();
      const myId = me?.user?.id;
      setMyId(myId ?? null);

      const { data: cs, error } = await supabase
        .from("courses")
        .select("id, title, type, teacher_id, course_kind, interview_category, interview_sub")
        .eq("type", courseType)
        .eq("course_kind", "interview")
        .eq("active", true);
      if (error) console.error("courses 조회 실패:", error);

      let list = (cs ?? [])
        .filter((c) => c.interview_category)
        .map((c) => ({
          course: c,
          assignment: { category_key: c.interview_category, sub_key: c.interview_sub },
        }));

      if (myId) {
        if (courseType === "group") {
          // 단체반: 수업 자체에 담당 선생님이 지정돼 있다.
          const mine = list.filter(
            (c) => c.course.teacher_id === myId || c.course.teacher_id == null
          );
          if (mine.length > 0) list = mine;
        } else {
          // 1:1: 수업(1:1 공무원면접 등)은 전 선생님 공용이고,
          // 담당은 enrollments.teacher_id 로 정해진다.
          // 내가 담당하는 수강이 있는 수업만 남긴다.
          const { data: myEnr, error: enrErr } = await supabase
            .from("enrollments")
            .select("course_id")
            .eq("teacher_id", myId);
          if (enrErr) console.error("내 담당 수강 조회 실패:", enrErr);
          const myCourseIds = new Set((myEnr ?? []).map((e) => e.course_id));
          list = list.filter((c) => myCourseIds.has(c.course.id));
        }
      }

      list.sort((a, b) => (a.course.title || "").localeCompare(b.course.title || ""));

      setClasses(list);
      setClassesLoading(false);
    })();
  }, [courseType]);

  // 2) 반 선택 → 학생 목록
  useEffect(() => {
    if (!selClass) {
      setStudents([]); setSelStudent(null); setActiveTab(null);
      setRows([]); setTabStats({});
      return;
    }
    (async () => {
      setSelStudent(null);
      setRows([]);
      const cat = getCategory(selClass.assignment.category_key);
      setActiveTab(cat?.tabs?.[0]?.key ?? null);

      let enrQ = supabase
        .from("enrollments")
        .select("student_id, teacher_id, profiles:student_id(id, name)")
        .eq("course_id", selClass.course.id);
      // 1:1 은 내가 담당하는 학생만 보여준다.
      if (courseType !== "group" && myId) enrQ = enrQ.eq("teacher_id", myId);
      const { data: enr, error } = await enrQ;
      if (error) console.error("enrollments 조회 실패:", error);
      const map = {};
      (enr ?? []).forEach((e) => {
        const p = e.profiles;
        if (p && !map[p.id]) map[p.id] = { id: p.id, name: p.name };
      });
      setStudents(Object.values(map));
    })();
  }, [selClass, courseType, myId]);

  // 3) 학생 선택 → 탭별 현황 집계
  useEffect(() => {
    if (!selClass || !selStudent) {
      setTabStats({});
      return;
    }

    let alive = true;

    (async () => {
      const { category_key, sub_key } = selClass.assignment;

      // 먼저 해당 카테고리의 활성 질문을 모두 가져온다.
      // 기출문제는 sub_key가 반 배정값과 다르거나 NULL이어도
      // 직렬(series_key)을 기준으로 사용하므로 sub_key로 제한하지 않는다.
      const { data: allQuestions, error: qErr } = await supabase
        .from("interview_questions_v2")
        .select("id, tab_key, sub_key")
        .eq("category_key", category_key)
        .eq("is_active", true);

      if (!alive) return;

      if (qErr) {
        console.error("interview_questions_v2 현황 조회 실패:", qErr);
        setTabStats({});
        return;
      }

      const questions = (allQuestions ?? []).filter((question) => {
        if (isSharedContent(category_key, question.tab_key)) return true;

        return sub_key
          ? question.sub_key === sub_key
          : question.sub_key == null;
      });

      const tabOf = {};
      questions.forEach((question) => {
        tabOf[question.id] = question.tab_key;
      });

      if (Object.keys(tabOf).length === 0) {
        setTabStats({});
        return;
      }

      // question_id 목록을 .in(...)으로 보내지 않는다.
      // 문항이 많으면 URL 길이 초과로 Supabase가 400을 반환할 수 있다.
      const { data: ans, error: aErr } = await supabase
        .from("interview_answers_v2")
        .select("question_id, student_answer, teacher_feedback")
        .eq("student_id", selStudent.id);

      if (!alive) return;

      if (aErr) {
        console.error("interview_answers_v2 현황 조회 실패:", aErr);
        setTabStats({});
        return;
      }

      const stats = {};

      (ans ?? []).forEach((answer) => {
        const tabKey = tabOf[answer.question_id];
        if (!tabKey) return;

        stats[tabKey] = stats[tabKey] || {
          answered: 0,
          feedbacked: 0,
        };

        if (answer.student_answer?.trim()) {
          stats[tabKey].answered += 1;
        }

        if (answer.teacher_feedback?.trim()) {
          stats[tabKey].feedbacked += 1;
        }
      });

      setTabStats(stats);
    })();

    return () => {
      alive = false;
    };
  }, [selClass, selStudent]);

  // 4) 탭 로드 — 선택 학생 기준
  const loadTab = async () => {
    if (!selClass || !selStudent || !activeTab) {
      setRows([]);
      setDraftEdits({});
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { category_key, sub_key } = selClass.assignment;

      let q = supabase
        .from("interview_questions_v2")
        .select("*")
        .eq("category_key", category_key)
        .eq("tab_key", activeTab)
        .eq("is_active", true)
        .order("seq", { ascending: true });

      // 기출문제는 sub_key가 반 배정값과 다르거나 NULL이어도
      // 직렬(series_key)을 기준으로 선택하므로 sub_key로 제한하지 않는다.
      // 기출·PT·토론은 지역(sub_key) 구분 없이 전 지역 공통으로 쓴다.
      if (!isSharedContent(category_key, activeTab)) {
        q = sub_key
          ? q.eq("sub_key", sub_key)
          : q.is("sub_key", null);
      }

      const { data: qs, error: qErr } = await q;

      if (qErr) {
        throw qErr;
      }

      const questionList = qs ?? [];
      const idSet = new Set(questionList.map((question) => question.id));
      const ansMap = {};
      const edits = {};

      if (idSet.size > 0) {
        // question_id를 .in(...)으로 보내지 않는다.
        // 문항이 많으면 URL 길이 초과로 Supabase가 400을 반환할 수 있다.
        const { data: ans, error: aErr } = await supabase
          .from("interview_answers_v2")
          .select("*")
          .eq("student_id", selStudent.id);

        if (aErr) {
          throw aErr;
        }

        (ans ?? []).forEach((answer) => {
          if (!idSet.has(answer.question_id)) return;

          ansMap[answer.question_id] = answer;
          edits[answer.id] =
            answer.teacher_feedback ??
            answer.ai_draft ??
            "";
        });
      }

      let merged = questionList.map((question) => ({
        ...question,
        _answer: ansMap[question.id] ?? null,
      }));

      // 지역별 사본이 합쳐지는 탭은 같은 질문을 한 번만 보여준다.
      if (isSharedContent(category_key, activeTab)) merged = dedupeByQuestion(merged);

      // 기출: 학생이 답변한 문항의 직렬을 역추적해 자동 선택
      if (activeTab === "gichul") {
        const detected = Array.from(
          new Set(
            merged
              .filter((row) => row._answer?.student_answer?.trim())
              .map((row) => row.series_key ?? NO_SERIES)
          )
        );

        setStudentSeries(detected);
        setGichulView(detected[0] ?? null);
        setShowAllSeries(false);
      } else {
        setStudentSeries([]);
        setGichulView(null);
        setShowAllSeries(false);
      }

      setRows(merged);
      setDraftEdits(edits);
    } catch (error) {
      console.error("면접 질문/답변 조회 실패:", error);
      setRows([]);
      setDraftEdits({});
      setStudentSeries([]);
      setGichulView(null);
      setShowAllSeries(false);

      alert(
        `질문을 불러오지 못했습니다.\n\n${
          error?.message ?? "알 수 없는 오류"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTab(); /* eslint-disable-next-line */ },
    [selClass, selStudent, activeTab]);

  // ── 화면에 보일 목록 계산 ─────────────────────────────
  const isGichul = activeTab === "gichul";
  const isPt = activeTab === "pt";

  // 직렬 키를 화면용 한글 명칭으로 변환한다.
  // 우선순위: DB 한글 라벨 → interviewConfig 한글 라벨 → 자체 한글 매핑.
  const seriesLabelMap = rows.reduce((acc, row) => {
    const key = row.series_key ?? NO_SERIES;

    if (!acc[key]) {
      acc[key] = resolveSeriesLabel(
        selClass?.assignment?.category_key,
        selClass?.assignment?.sub_key,
        key,
        row.series_label
      );
    }

    return acc;
  }, {});

  // 이 탭 전체 직렬 목록 (문항 수 많은 순)
  const allSeries = isGichul
    ? Object.entries(
        rows.reduce((acc, row) => {
          const key = row.series_key ?? NO_SERIES;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])
    : [];

  // 학생 직렬이 파악되면 그것만, 아니면 전체를 버튼으로
  const seriesButtons =
    showAllSeries || studentSeries.length === 0
      ? allSeries
      : allSeries.filter(([k]) => studentSeries.includes(k));

  const visibleRows = !isGichul
    ? rows
    : gichulView === null
    ? []
    : rows.filter((r) => (r.series_key ?? NO_SERIES) === gichulView);

  const answeredInView = visibleRows.filter((r) => r._answer?.student_answer?.trim()).length;

  // AI 초안 1건
  const genOne = async (qRow, answerRow) => {
    if (!answerRow?.student_answer) return null;
    const { category_key, sub_key } = selClass.assignment;
    const fnName = getFnName(category_key);
    const { data, error } = await supabase.functions.invoke(fnName, {
      body: {
        category: getCategoryLabel(category_key),
        category_key: category_key,
        sub: getSubLabel(category_key, sub_key),
        sub_key: sub_key,
        tab: getTabLabel(category_key, activeTab),
        tab_key: activeTab,
        series_key: qRow.series_key ?? null,
        question: qRow.question,
        answer: answerRow.student_answer,
      },
    });

    if (error) {
      const detail = await extractFnError(error);
      console.error(`Edge Function 에러 [${fnName}]:`, detail);
      throw new Error(`[${fnName}] ${detail}`);
    }
    if (!data?.success) {
      throw new Error(`[${fnName}] ${data?.error || "AI 실패"}`);
    }

    const draft = data.feedback || data.text || "";
    await supabase
      .from("interview_answers_v2")
      .update({ ai_draft: draft, updated_at: new Date().toISOString() })
      .eq("id", answerRow.id);
    return draft;
  };

  const genSingle = async (qRow) => {
    const a = qRow._answer;
    if (!a?.student_answer) return alert("학생 답변이 없습니다.");
    setAiLoadingId(a.id);
    try {
      const draft = await genOne(qRow, a);
      setRows((prev) =>
        prev.map((r) => (r.id === qRow.id ? { ...r, _answer: { ...r._answer, ai_draft: draft } } : r))
      );
      setDraftEdits((prev) => ({ ...prev, [a.id]: draft }));
    } catch (e) {
      alert("AI 오류:\n\n" + e.message);
    } finally {
      setAiLoadingId(null);
    }
  };

  // 지금 보이는 목록 중 미확정 답변 전부
  const genAllForStudent = async () => {
    const targets = visibleRows.filter(
      (r) => r._answer?.student_answer?.trim() && !r._answer.teacher_feedback
    );
    if (targets.length === 0) return alert("AI 초안을 생성할 답변이 없습니다. (이미 확정된 것은 제외)");
    if (!window.confirm(
      `${selStudent.name} 학생의 ${getTabLabel(selClass.assignment.category_key, activeTab)} ${targets.length}건에 AI 초안을 생성합니다.\n` +
      `1건당 10~20초 걸리며, 이 화면을 닫으면 중단됩니다. 계속할까요?`
    )) return;

    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length });

    let firstError = null;
    let failCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const qRow = targets[i];
      const a = qRow._answer;
      try {
        const draft = await genOne(qRow, a);
        setRows((prev) =>
          prev.map((r) => (r.id === qRow.id ? { ...r, _answer: { ...r._answer, ai_draft: draft } } : r))
        );
        setDraftEdits((prev) => ({ ...prev, [a.id]: draft }));
      } catch (e) {
        console.error("AI 실패:", e.message);
        failCount++;
        if (!firstError) firstError = e.message;
      }
      setBulkProgress({ done: i + 1, total: targets.length });
    }

    setBulkRunning(false);
    if (failCount > 0) {
      alert(`${targets.length}건 중 ${failCount}건 실패했습니다.\n\n첫 에러:\n${firstError}`);
    } else {
      alert("AI 초안 생성 완료! 각 답변을 검토하고 확정하세요.");
    }
  };

  // 피드백 확정 1건
  const confirmOne = async (qRow) => {
    const a = qRow._answer;
    if (!a) return;
    const text = (draftEdits[a.id] ?? "").trim();
    if (!text) return alert("피드백 내용을 입력하세요.");
    setSavingId(a.id);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("interview_answers_v2")
      .update({ teacher_feedback: text, feedback_at: now, updated_at: now })
      .eq("id", a.id)
      .select()
      .maybeSingle();
    setSavingId(null);
    if (error) return alert("저장 실패: " + error.message);

    const wasNew = !a.teacher_feedback;
    setRows((prev) =>
      prev.map((r) => (r.id === qRow.id ? { ...r, _answer: { ...r._answer, ...data } } : r))
    );
    if (wasNew) {
      setTabStats((prev) => {
        const cur = prev[activeTab] || { answered: 0, feedbacked: 0 };
        return { ...prev, [activeTab]: { ...cur, feedbacked: cur.feedbacked + 1 } };
      });
    }
  };

  const cat = selClass ? getCategory(selClass.assignment.category_key) : null;
  const tabs = cat?.tabs ?? [];
  const pendingCount = visibleRows.filter(
    (r) => r._answer?.student_answer?.trim() && !r._answer.teacher_feedback
  ).length;

  if (classesLoading) return <p className="text-slate-400">{MODE_LABEL} 불러오는 중...</p>;

  return (
    <div>
      {/* 반 선택 */}
      <div className="mb-5">
        <p className="mb-2 text-sm font-medium text-slate-500">{MODE_LABEL} 선택</p>
        {classes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
            면접 카테고리가 배정된 {MODE_LABEL}이(가) 없습니다. (어드민 &gt; 면접설정에서 배정)
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => {
              const on = selClass?.course.id === c.course.id;
              const badge = getCategoryLabel(c.assignment.category_key) +
                (getSubLabel(c.assignment.category_key, c.assignment.sub_key) ? `·${getSubLabel(c.assignment.category_key, c.assignment.sub_key)}` : "");
              return (
                <button key={c.course.id} type="button" onClick={() => setSelClass(c)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${on ? "border-seum-blue bg-seum-blue text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {c.course.title}
                  <span className={`ml-2 text-xs ${on ? "text-blue-100" : "text-slate-400"}`}>{badge}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!selClass ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          {MODE_LABEL}을(를) 선택해주세요.
        </p>
      ) : (
        <>
          {/* 학생 선택 */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">학생 선택</p>
              <span className="text-xs text-slate-400">
                {getCategoryLabel(selClass.assignment.category_key)}
                {getSubLabel(selClass.assignment.category_key, selClass.assignment.sub_key) &&
                  ` · ${getSubLabel(selClass.assignment.category_key, selClass.assignment.sub_key)}`}
                {` · 학생 ${students.length}명`}
              </span>
            </div>
            {students.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
                이 수업에 등록된 학생이 없습니다.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {students.map((s) => {
                  const on = selStudent?.id === s.id;
                  return (
                    <button key={s.id} type="button" onClick={() => setSelStudent(s)}
                      className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${on ? "border-seum-navy bg-seum-navy text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!selStudent ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
              학생을 선택하면 답변과 피드백이 표시됩니다.
            </p>
          ) : (
            <>
              {/* 탭 */}
              <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                {tabs.map((t) => {
                  const on = activeTab === t.key;
                  const st = tabStats[t.key];
                  return (
                    <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${on ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {t.label}
                      {st?.answered > 0 && (
                        <span className={`rounded-full px-1.5 text-[10px] font-black ${
                          on
                            ? "bg-white/25 text-white"
                            : st.feedbacked >= st.answered
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {st.feedbacked}/{st.answered}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 기출 탭 — 직렬 */}
              {isGichul && !loading && rows.length > 0 && (
                <div className="mb-4 rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-500">
                      {studentSeries.length > 0
                        ? `${selStudent.name} 학생이 답변한 직렬`
                        : "이 학생은 아직 기출에 답변하지 않았습니다 · 직렬을 선택하세요"}
                    </p>
                    {studentSeries.length > 0 && (
                      <button type="button" onClick={() => setShowAllSeries((v) => !v)}
                        className="shrink-0 text-xs font-medium text-seum-blue hover:underline">
                        {showAllSeries ? "학생 직렬만" : "전체 직렬 보기"}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {seriesButtons.map(([key, cnt]) => (
                      <button key={key} type="button" onClick={() => setGichulView(key)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          gichulView === key
                            ? "bg-seum-blue text-white"
                            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                        }`}>
                        {seriesLabelMap[key] ?? key} ({cnt})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isPt ? (
                <PtReview
                  studentId={selStudent.id}
                  studentName={selStudent.name}
                  categoryKey={selClass.assignment.category_key}
                  subKey={selClass.assignment.sub_key}
                />
              ) : (
              <>
              {/* 학생 · 탭 헤더 + 일괄 AI */}
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold text-seum-navy">
                  {selStudent.name}
                  <span className="ml-2 text-xs font-medium text-slate-400">
                    {getTabLabel(selClass.assignment.category_key, activeTab)}
                    {visibleRows.length > 0 && ` · ${visibleRows.length}문항 중 답변 ${answeredInView}건`}
                    {pendingCount > 0 && ` · 미확정 ${pendingCount}건`}
                  </span>
                </div>
                <button type="button" onClick={genAllForStudent} disabled={bulkRunning || loading || pendingCount === 0}
                  className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
                  {bulkRunning ? `생성 중... (${bulkProgress.done}/${bulkProgress.total})` : "✨ 이 탭 전체 AI 초안"}
                </button>
              </div>

              {/* 진행 바 */}
              {bulkRunning && (
                <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-seum-blue transition-all"
                    style={{ width: `${bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }} />
                </div>
              )}

              {loading ? (
                <p className="py-10 text-center text-slate-400">불러오는 중...</p>
              ) : visibleRows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
                  {isGichul
                    ? rows.length > 0
                      ? "위에서 직렬을 선택하세요."
                      : "이 탭에 등록된 기출문제가 없습니다."
                    : "이 탭에 등록된 질문이 없습니다."}
                </p>
              ) : (
                <div className="space-y-4">
                  {visibleRows.map((qRow, i) => {
                    const a = qRow._answer;
                    const hasAnswer = !!a?.student_answer?.trim();

                    // 현재 편집중인 텍스트가 확정된 피드백과 같은지
                    const confirmed =
                      !!a?.teacher_feedback &&
                      (draftEdits[a.id] ?? "").trim() === a.teacher_feedback.trim();

                    return (
                      <div
                        key={qRow.id}
                        className={`rounded-xl border bg-white p-4 transition ${
                          confirmed ? "border-slate-300" : "border-slate-200"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="font-medium text-seum-navy">
                            <span className="mr-1 text-slate-400">{i + 1}.</span>
                            {qRow.question}
                          </p>
                          <span className="shrink-0 pt-0.5">
                            {confirmed ? (
                              <span className="text-xs text-green-600">
                                ✓ 전달됨 {a.feedback_at && <span className="text-slate-400">{fmtTime(a.feedback_at)}</span>}
                              </span>
                            ) : a?.teacher_feedback ? (
                              <span className="text-xs text-amber-600">수정됨 — 재전달 필요</span>
                            ) : a?.ai_draft ? (
                              <span className="text-xs text-amber-600">초안 대기</span>
                            ) : hasAnswer ? (
                              <span className="text-xs text-slate-400">미피드백</span>
                            ) : (
                              <span className="text-xs text-slate-300">미답변</span>
                            )}
                          </span>
                        </div>

                        {hasAnswer ? (
                          <>
                            <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2.5">
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">학생 답변</p>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{a.student_answer}</p>
                            </div>

                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-seum-blue">피드백</span>
                              <button type="button" onClick={() => genSingle(qRow)} disabled={aiLoadingId === a.id || bulkRunning}
                                className="rounded-md border border-seum-blue px-2.5 py-0.5 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-50">
                                {aiLoadingId === a.id ? "생성 중..." : a.ai_draft ? "🔄 다시" : "✨ AI"}
                              </button>
                            </div>
                            <textarea value={draftEdits[a.id] ?? ""} onChange={(e) => setDraftEdits((p) => ({ ...p, [a.id]: e.target.value }))}
                              rows={5}
                              placeholder="AI 초안 생성 또는 직접 작성"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => confirmOne(qRow)}
                                disabled={savingId === a.id || confirmed}
                                className={`rounded-lg px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-100 ${
                                  confirmed
                                    ? "cursor-default bg-slate-700"
                                    : "bg-seum-blue hover:bg-[#2a63c4]"
                                }`}
                              >
                                {savingId === a.id
                                  ? "저장 중..."
                                  : confirmed
                                  ? "✓ 전달 완료"
                                  : a.teacher_feedback
                                  ? "수정 내용 재전달"
                                  : "피드백 확정"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">아직 답변하지 않았습니다.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}