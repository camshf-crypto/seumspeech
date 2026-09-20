import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PtReview from "./PtReview";
import TeacherMockPanel from "./TeacherMockPanel";
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
  univ: "interview-ai-univ",           // 대입 (컨셉·활동매칭·스피치구조)
  // company: "interview-ai-company",     // 사기업 (미배포)
  // hospital: "interview-ai-hospital",   // 병원 (미배포)
  // transfer: "interview-ai-transfer",   // 편입 (미배포)
  // highschool: "interview-ai-high",     // 고입 (미배포)
};
const FN_FALLBACK = "interview-ai-feedback";

// 한 문항당 연습 회차는 3차까지
const MAX_ROUND = 3;

// 생기부 영역 구분
const SOURCE_TYPES = [
  { key: "창체", label: "창체", cls: "bg-emerald-50 text-emerald-700" },
  { key: "세특", label: "세특", cls: "bg-blue-50 text-seum-blue" },
  { key: "행특", label: "행특", cls: "bg-purple-50 text-purple-700" },
];
const sourceStyle = (k) => SOURCE_TYPES.find((t) => t.key === k)?.cls ?? "bg-slate-100 text-slate-500";

// 학생마다 다른 질문을 선생님이 직접 만드는 탭
const PERSONAL_TAB = "saenggibu";


// 탭 자체가 성격이 다른 경우는 전용 함수를 쓴다
const TAB_FN_MAP = {
  saenggibu: "interview-ai-saenggibu",   // 생기부 — 사실 확인 + 꼬리질문
  gichul: "interview-ai-gichul",         // 기출 — 학교별 평가요소
};

function getFnName(categoryKey, tabKey) {
  return TAB_FN_MAP[tabKey] ?? FN_MAP[categoryKey] ?? FN_FALLBACK;
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

// AI 초안에서 [꼬리질문] 한 줄만 뽑아낸다
const pickFollowUp = (draft) => {
  if (!draft) return "";
  const m = draft.match(/\[\s*꼬리질문\s*\]([\s\S]*?)(?=\n\[|$)/);
  if (!m) return "";
  return m[1]
    .split("\n")
    .map((x) => x.replace(/^[·\-\d.\s]+/, "").trim())
    .filter(Boolean)[0] ?? "";
};

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
// 선생님 단체반 / 1:1 모드
// 반 선택 → 학생 선택 → 컨셉 → 탭 → 그 학생의 질문/답변/피드백
//
// [면접 컨셉]
// 선생님이 학생마다 적는 구체적인 진로 방향 (예: 소아암병동 간호사).
// interview_assignments.concept 에 저장되고 학생 화면에도 보인다.
// 대입 AI 피드백이 이 컨셉을 기준으로 답변을 본다.
//
// [기출문제 탭]
// 학생이 자기 직렬을 골라 답변하므로, 그 학생이 답변한 문항의 series_key 로
// 직렬을 역추적해서 자동 선택한다.
//
// [주의] interview_answers_v2 조회 시 question_id 를 .in(...) 으로 넘기지 말 것.
// UUID가 전부 URL에 들어가 길이 한계를 넘고 서버가 400 으로 거절한다.
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

  // 면접 컨셉
  const [concept, setConcept] = useState("");        // 입력창 값
  const [savedConcept, setSavedConcept] = useState(""); // DB에 저장된 값
  const [conceptSaving, setConceptSaving] = useState(false);

  // 기출 탭
  const [gichulView, setGichulView] = useState(null);      // 보고 있는 series_key (null = 미선택)
  const [studentSeries, setStudentSeries] = useState([]);  // 이 학생이 답변한 직렬
  const [showAllSeries, setShowAllSeries] = useState(false);

  const [draftEdits, setDraftEdits] = useState({}); // { [answerId]: text }
  const [answerEdits, setAnswerEdits] = useState({}); // { [answerId]: 학생 답변 수정본 }
  const [openMap, setOpenMap] = useState({}); // { [questionId]: true|false } — 직접 누른 것만 기록
  const [aiOpen, setAiOpen] = useState({});   // { [answerId]: true } — AI 분석 박스 펼침
  const [univProfiles, setUnivProfiles] = useState({}); // { [univ]: 평가요소 }
  const [univPicks, setUnivPicks] = useState([]);       // 학생이 고른 지원 6개
  const [univPick, setUnivPick] = useState(null);       // 지금 보고 있는 지원
  const [roundsMap, setRoundsMap] = useState({}); // { [questionId]: [회차...] 오름차순 }
  const [pastOpen, setPastOpen] = useState({});   // { [questionId]: true } — 지난 회차 펼침

  // 생기부 질문 — 한 줄 입력으로 계속 추가
  const [newQType, setNewQType] = useState("세특");
  // 수정은 팝업
  const [qModal, setQModal] = useState(null);     // null | { mode: "new"|"edit", row }
  const [qText, setQText] = useState("");   // 수정용
  const [qType, setQType] = useState("세특"); // 수정용
  const [qList, setQList] = useState([]);     // 추가용 [{type, text}]
  const [qSaving, setQSaving] = useState(false);
  const [sendingQ, setSendingQ] = useState(false);
  const [followEdits, setFollowEdits] = useState({});  // { [questionId]: 꼬리질문 }
  const [followSaving, setFollowSaving] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [aiLoadingId, setAiLoadingId] = useState(null);

  // 탭별 답변 현황 (학생 선택 시 계산)
  const [tabStats, setTabStats] = useState({}); // { [tabKey]: { answered, feedbacked } }

  // 일괄 AI 진행 상태
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // 1) 면접 수업 로드
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
          // 1:1: 수업은 전 선생님 공용이고, 담당은 enrollments.teacher_id 로 정해진다.
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

  // 3) 학생 선택 → 컨셉 로드
  useEffect(() => {
    if (!selStudent) {
      setConcept("");
      setSavedConcept("");
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("interview_assignments")
        .select("concept")
        .eq("student_id", selStudent.id)
        .maybeSingle();
      if (!alive) return;
      const c = data?.concept ?? "";
      setConcept(c);
      setSavedConcept(c);
    })();
    return () => { alive = false; };
  }, [selStudent]);

  // 학생이 고른 지원 목록 (대입 기출용)
  useEffect(() => {
    if (!selStudent || selClass?.assignment?.category_key !== "univ") {
      setUnivPicks([]);
      setUnivPick(null);
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("student_univ_picks")
        .select("*")
        .eq("student_id", selStudent.id)
        .order("created_at");
      if (!alive) return;
      if (error) console.error("지원 목록 조회 실패:", error);
      const list = data ?? [];
      setUnivPicks(list);
      setUnivPick(list[0] ?? null);
    })();
    return () => { alive = false; };
  }, [selStudent, selClass]);

  // 컨셉 저장 — 학생 화면에도 바로 보인다
  const saveConcept = async () => {
    if (!selStudent || !selClass) return;
    setConceptSaving(true);
    const { category_key, sub_key } = selClass.assignment;
    const { error } = await supabase
      .from("interview_assignments")
      .upsert(
        {
          student_id: selStudent.id,
          category_key,
          sub_key: sub_key ?? null,
          concept: concept.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id" }
      );
    setConceptSaving(false);
    if (error) return alert("컨셉 저장 실패: " + error.message);
    setSavedConcept(concept.trim());
  };

  // 4) 학생 선택 → 탭별 현황 집계
  useEffect(() => {
    if (!selClass || !selStudent) {
      setTabStats({});
      return;
    }

    let alive = true;

    (async () => {
      const { category_key, sub_key } = selClass.assignment;

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

        stats[tabKey] = stats[tabKey] || { answered: 0, feedbacked: 0 };

        if (answer.student_answer?.trim()) stats[tabKey].answered += 1;
        if (answer.teacher_feedback?.trim()) stats[tabKey].feedbacked += 1;
      });

      setTabStats(stats);
    })();

    return () => { alive = false; };
  }, [selClass, selStudent]);

  // 5) 탭 로드 — 선택 학생 기준
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

      let qs, qErr;

      // 대입 기출은 univ_questions 에 있다.
      // 학생이 고른 지원(학교·학과·전형) 기준으로 문항 전체를 보여준다.
      if (category_key === "univ" && activeTab === "gichul") {
        if (!univPick) {
          setRows([]);
          setDraftEdits({});
          setRoundsMap({});
          setLoading(false);
          return;
        }

        const { data: uq, error: qErr2 } = await supabase
          .from("univ_questions")
          .select("*")
          .eq("univ", univPick.univ)
          .eq("major", univPick.major)
          .eq("admission", univPick.admission)
          .eq("is_active", true)
          .order("seq", { ascending: true });
        if (qErr2) throw qErr2;

        const list = uq ?? [];
        const idSet2 = new Set(list.map((q) => q.id));

        const { data: ans, error: aErr } = await supabase
          .from("interview_answers_v2")
          .select("*")
          .eq("student_id", selStudent.id);
        if (aErr) throw aErr;

        const aMap = {};
        const edits2 = {};
        (ans ?? []).forEach((a) => {
          if (!idSet2.has(a.question_id)) return;
          aMap[a.question_id] = a;
          edits2[a.id] = a.teacher_feedback ?? "";
        });

        // 구조 붙이기
        const codes = Array.from(new Set(list.map((q) => q.type_code).filter(Boolean)));
        const sMap = {};
        if (codes.length > 0) {
          const { data: st } = await supabase
            .from("interview_structures").select("*").in("id", codes);
          (st ?? []).forEach((x) => { sMap[x.id] = x; });
        }

        // 학교 평가요소
        const { data: pf } = await supabase
          .from("univ_profiles").select("*").eq("univ", univPick.univ);
        setUnivProfiles(pf && pf[0] ? { [univPick.univ]: pf[0] } : {});

        // 회차
        const rMap = {};
        const { data: rds } = await supabase
          .from("interview_rounds")
          .select("*")
          .eq("student_id", selStudent.id)
          .order("round", { ascending: true });
        (rds ?? []).forEach((r) => {
          if (!idSet2.has(r.question_id)) return;
          (rMap[r.question_id] = rMap[r.question_id] || []).push(r);
        });
        setRoundsMap(rMap);

        setRows(list.map((q) => ({
          ...q,
          structure_name: sMap[q.type_code]?.name ?? null,
          speech_structure: sMap[q.type_code]?.speech_structure ?? null,
          _answer: aMap[q.id] ?? null,
        })));
        setDraftEdits(edits2);
        setStudentSeries([]);
        setGichulView(null);
        setShowAllSeries(false);
        setLoading(false);
        return;
      }

      if (activeTab === PERSONAL_TAB) {
        // 생기부는 학생마다 질문이 다르다. 선생님이 만든 것만 보여준다.
        const res = await supabase
          .from("student_questions")
          .select("*")
          .eq("student_id", selStudent.id)
          .eq("tab_key", PERSONAL_TAB)
          .eq("is_active", true)
          .order("seq", { ascending: true });
        qs = res.data; qErr = res.error;
      } else {
        let q = supabase
          .from("interview_questions_v2")
          .select("*")
          .eq("category_key", category_key)
          .eq("tab_key", activeTab)
          .eq("is_active", true)
          .order("seq", { ascending: true });

        if (!isSharedContent(category_key, activeTab)) {
          q = sub_key ? q.eq("sub_key", sub_key) : q.is("sub_key", null);
        }
        const res = await q;
        qs = res.data; qErr = res.error;
      }

      if (qErr) throw qErr;

      const questionList = qs ?? [];
      const idSet = new Set(questionList.map((question) => question.id));
      const ansMap = {};
      const edits = {};

      if (idSet.size > 0) {
        const { data: ans, error: aErr } = await supabase
          .from("interview_answers_v2")
          .select("*")
          .eq("student_id", selStudent.id);

        if (aErr) throw aErr;

        (ans ?? []).forEach((answer) => {
          if (!idSet.has(answer.question_id)) return;
          ansMap[answer.question_id] = answer;
          edits[answer.id] = answer.teacher_feedback ?? "";   // AI 초안은 넣지 않는다
        });
      }

      // 회차 기록 — 학생 전체를 가져와 이 탭 문항만 추린다
      const rMap = {};
      if (idSet.size > 0) {
        const { data: rds } = await supabase
          .from("interview_rounds")
          .select("*")
          .eq("student_id", selStudent.id)
          .order("round", { ascending: true });
        (rds ?? []).forEach((r) => {
          if (!idSet.has(r.question_id)) return;
          (rMap[r.question_id] = rMap[r.question_id] || []).push(r);
        });
      }
      setRoundsMap(rMap);

      let merged = questionList.map((question) => ({
        ...question,
        _answer: ansMap[question.id] ?? null,
      }));

      if (activeTab !== PERSONAL_TAB && isSharedContent(category_key, activeTab))
        merged = dedupeByQuestion(merged);

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

      alert(`질문을 불러오지 못했습니다.\n\n${error?.message ?? "알 수 없는 오류"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTab(); /* eslint-disable-next-line */ },
    [selClass, selStudent, activeTab, univPick]);

  // ── 화면에 보일 목록 계산 ─────────────────────────────
  const isGichul = activeTab === "gichul" && selClass?.assignment?.category_key !== "univ";
  const isUnivGichul = activeTab === "gichul" && selClass?.assignment?.category_key === "univ";
  const isPt = activeTab === "pt";
  const isPersonal = activeTab === PERSONAL_TAB;
  const isMock = activeTab === "mock";
  const unsentCount = isPersonal ? rows.filter((r) => !r.sent_at).length : 0;
  const isUniv = selClass?.assignment?.category_key === "univ";

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

  const allSeries = isGichul
    ? Object.entries(
        rows.reduce((acc, row) => {
          const key = row.series_key ?? NO_SERIES;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])
    : [];

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
    const fnName = getFnName(category_key, activeTab);
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
        // 대입 피드백용 — 저장된 컨셉과 이 질문의 스피치 구조
        concept: savedConcept || null,
        speech_structure: qRow.speech_structure ?? null,
        structure_name: qRow.structure_name ?? null,
        // 기출 피드백용 — 지원 학교·학과·전형과 그 학교의 평가요소
        univ: qRow.univ ?? null,
        major: qRow.major ?? null,
        admission: qRow.admission ?? null,
        profile: qRow.univ ? (univProfiles[qRow.univ] ?? null) : null,
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
      setAiOpen((p) => ({ ...p, [a.id]: true }));   // 생성되면 펼쳐서 보여준다
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

  // 기본은 "답변이 있고 아직 확정 안 된 문항"만 펼친다.
  // 선생님이 직접 누르면 그 선택을 따른다.
  const isOpen = (qRow, a, hasAnswer) => {
    if (openMap[qRow.id] !== undefined) return openMap[qRow.id];
    if (hasAnswer) return !a?.teacher_feedback;
    return activeTab === PERSONAL_TAB;   // 생기부는 답변 전에도 펼쳐 둔다
  };
  const toggleOpen = (qid, cur) => {
    setOpenMap((p) => ({ ...p, [qid]: !cur }));
  };

  // ── 생기부 질문 ──────────────────────────────────────
  const openNewQuestion = () => {
    setQModal({ mode: "new", row: null });
    setQList([{ type: newQType, text: "" }]);
  };

  const addQRow = () => {
    setQList((p) => [...p, { type: p[p.length - 1]?.type ?? "세특", text: "" }]);
  };
  const setQRow = (idx, patch) => {
    setQList((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeQRow = (idx) => {
    setQList((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== idx)));
  };

  const openEditQuestion = (row) => {
    setQModal({ mode: "edit", row });
    setQText(row.question ?? "");
    setQType(row.source_type ?? "세특");
  };

  // 추가는 여러 줄을 한 번에, 수정은 한 건만
  const saveQuestion = async () => {
    setQSaving(true);

    if (qModal.mode === "edit") {
      const text = qText.trim();
      if (!text) { setQSaving(false); return alert("질문을 입력하세요."); }
      const { error } = await supabase
        .from("student_questions")
        .update({ question: text, source_type: qType, updated_at: new Date().toISOString() })
        .eq("id", qModal.row.id);
      setQSaving(false);
      if (error) return alert("저장 실패: " + error.message);
      setQModal(null);
      loadTab();
      return;
    }

    const targets = qList.filter((r) => r.text.trim());
    if (targets.length === 0) { setQSaving(false); return alert("질문을 입력하세요."); }

    const baseSeq = rows.length > 0 ? Math.max(...rows.map((r) => r.seq ?? 0)) : 0;
    const payload = targets.map((r, i) => ({
      student_id: selStudent.id,
      tab_key: PERSONAL_TAB,
      seq: baseSeq + i + 1,
      question: r.text.trim(),
      source_type: r.type,
      created_by: myId,
    }));

    const { error } = await supabase.from("student_questions").insert(payload);
    setQSaving(false);
    if (error) return alert("저장 실패: " + error.message);

    setNewQType(targets[targets.length - 1].type);
    setQModal(null);
    loadTab();
  };

  // 아직 학생에게 안 보낸 질문을 한 번에 보낸다
  const sendQuestions = async () => {
    const targets = rows.filter((r) => !r.sent_at);
    if (targets.length === 0) return;
    if (!window.confirm(`${targets.length}개 질문을 ${selStudent.name} 학생에게 보낼까요?`)) return;

    setSendingQ(true);
    const { error } = await supabase
      .from("student_questions")
      .update({ sent_at: new Date().toISOString() })
      .in("id", targets.map((r) => r.id));
    setSendingQ(false);
    if (error) return alert("보내기 실패: " + error.message);
    loadTab();
  };

  // AI로 꼬리질문만 새로 뽑는다 (최종 답변 기준)
  const genFollowUp = async (qRow) => {
    const a = qRow._answer;
    const answerText = (a?.teacher_answer ?? a?.student_answer ?? "").trim();
    if (!answerText) return alert("학생 답변이 없습니다.");

    setFollowSaving(qRow.id + ":gen");
    try {
      const { category_key, sub_key } = selClass.assignment;
      const fnName = getFnName(category_key, activeTab);
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: {
          category: getCategoryLabel(category_key),
          category_key,
          sub: getSubLabel(category_key, sub_key),
          sub_key,
          tab: getTabLabel(category_key, activeTab),
          tab_key: activeTab,
          question: qRow.question,
          answer: answerText,
          concept: savedConcept || null,
        },
      });
      if (error) throw new Error(await extractFnError(error));
      if (!data?.success) throw new Error(data?.error || "AI 실패");

      const q = pickFollowUp(data.feedback || "");
      if (!q) throw new Error("꼬리질문을 찾지 못했습니다. 다시 시도해주세요.");
      setFollowEdits((p) => ({ ...p, [qRow.id]: q }));
    } catch (e) {
      alert("꼬리질문 생성 실패:\n\n" + e.message);
    } finally {
      setFollowSaving(null);
    }
  };

  // 꼬리질문을 새 질문으로 만들어 학생에게 바로 보낸다
  const sendFollowUp = async (qRow) => {
    const text = (followEdits[qRow.id] ?? "").trim();
    if (!text) return alert("꼬리질문을 입력하세요.");

    setFollowSaving(qRow.id);
    const nextSeq = rows.length > 0 ? Math.max(...rows.map((r) => r.seq ?? 0)) + 1 : 1;
    const { error } = await supabase.from("student_questions").insert({
      student_id: selStudent.id,
      tab_key: PERSONAL_TAB,
      seq: nextSeq,
      question: text,
      source_type: qRow.source_type ?? null,
      parent_id: qRow.id,
      created_by: myId,
      sent_at: new Date().toISOString(),   // 꼬리질문은 바로 보낸다
    });
    setFollowSaving(null);
    if (error) return alert("꼬리질문 보내기 실패: " + error.message);

    setFollowEdits((p) => {
      const next = { ...p };
      delete next[qRow.id];
      return next;
    });
    loadTab();
  };

  const removeQuestion = async (row) => {
    if (!window.confirm("이 질문을 지울까요? 학생 화면에서도 사라집니다.")) return;
    const { error } = await supabase
      .from("student_questions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return alert("삭제 실패: " + error.message);
    loadTab();
  };

  // 저장 — 고친 답변과 피드백을 함께 학생에게 보낸다
  // AI 초안(ai_draft)은 여기에 포함되지 않는다. 학생은 절대 볼 수 없다.
  const sendToStudent = async (qRow) => {
    let a = qRow._answer;

    // 학생이 아직 답변하지 않았으면 빈 답변 행을 먼저 만든다
    if (!a) {
      const { data: created, error: cErr } = await supabase
        .from("interview_answers_v2")
        .insert({ question_id: qRow.id, student_id: selStudent.id })
        .select()
        .maybeSingle();
      if (cErr) return alert("저장 실패: " + cErr.message);
      a = created;
      setRows((prev) =>
        prev.map((r) => (r.id === qRow.id ? { ...r, _answer: created } : r))
      );
    }

    const fb = (draftEdits[qRow._answer?.id ?? qRow.id] ?? draftEdits[a.id] ?? "").trim();
    const base = (a.teacher_answer ?? a.student_answer ?? "").trim();
    const ans = (answerEdits[qRow._answer?.id ?? qRow.id] ?? answerEdits[a.id] ?? base).trim();
    const ansChanged = ans !== base;

    if (!fb && !ansChanged) return alert("피드백을 작성하거나 답변을 고쳐주세요.");

    setSavingId(a.id);
    const now = new Date().toISOString();

    // 학생이 쓴 student_answer 는 그대로 두고, 첨삭본만 teacher_answer 에 넣는다
    const payload = { updated_at: now };
    if (ansChanged) payload.teacher_answer = ans;
    if (fb) {
      payload.teacher_feedback = fb;
      payload.feedback_at = now;
    }

    const { data, error } = await supabase
      .from("interview_answers_v2")
      .update(payload)
      .eq("id", a.id)
      .select()
      .maybeSingle();
    if (error) { setSavingId(null); return alert("저장 실패: " + error.message); }

    // 회차에도 기록한다 (학생 화면의 지난 기록이 이걸 본다)
    try {
      const rounds = roundsMap[qRow.id] ?? [];
      const last = rounds[rounds.length - 1] ?? null;
      const rPayload = {};
      if (ansChanged) rPayload.teacher_answer = ans;
      if (fb) { rPayload.teacher_feedback = fb; rPayload.feedback_at = now; }
      if (a.ai_draft) rPayload.ai_draft = a.ai_draft;

      if (last) {
        const { data: rd } = await supabase
          .from("interview_rounds")
          .update(rPayload)
          .eq("id", last.id)
          .select()
          .maybeSingle();
        if (rd) {
          setRoundsMap((prev) => ({
            ...prev,
            [qRow.id]: (prev[qRow.id] ?? []).map((x) => (x.id === rd.id ? rd : x)),
          }));
        }
      } else {
        const { data: rd } = await supabase
          .from("interview_rounds")
          .insert({
            question_id: qRow.id,
            student_id: selStudent.id,
            round: 1,
            student_answer: a.student_answer,
            answered_at: a.answered_at,
            ...rPayload,
          })
          .select()
          .maybeSingle();
        if (rd) setRoundsMap((prev) => ({ ...prev, [qRow.id]: [rd] }));
      }
    } catch (e) {
      console.error("회차 기록 실패:", e.message);
    }

    setSavingId(null);

    const wasNew = !a.teacher_feedback && !!fb;
    setRows((prev) =>
      prev.map((r) => (r.id === qRow.id ? { ...r, _answer: { ...r._answer, ...data } } : r))
    );
    setAnswerEdits((p) => {
      const next = { ...p };
      delete next[a.id];
      return next;
    });
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

  const conceptDirty = concept.trim() !== (savedConcept ?? "").trim();

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
              {/* 면접 컨셉 */}
              <div className="mb-5 border-t border-slate-200 pt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">면접 컨셉</p>
                  {savedConcept ? (
                    <span className="text-[11px] text-slate-400">학생 화면에도 표시됩니다</span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-600">아직 정해지지 않았습니다</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="예: 소아암병동 간호사 / 자율주행 제어 엔지니어"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                  />
                  <button
                    type="button"
                    onClick={saveConcept}
                    disabled={conceptSaving || !conceptDirty}
                    className="shrink-0 rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50"
                  >
                    {conceptSaving ? "저장 중..." : conceptDirty ? "저장" : "✓ 저장됨"}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {isUniv
                    ? "학생이 내세울 구체적인 진로 방향을 적으세요. AI가 이 컨셉을 기준으로 답변과 활동이 맞는지 봅니다."
                    : "학생이 내세울 구체적인 진로 방향을 적으세요. 현재 AI 피드백은 대입 면접에서만 컨셉을 사용합니다."}
                </p>
              </div>

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

              {/* 대입 기출 — 학생이 고른 지원 목록 */}
              {isUnivGichul && (
                <div className="mb-4 rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-500">
                      {univPicks.length > 0
                        ? `${selStudent.name} 학생이 고른 지원 학교`
                        : "이 학생은 아직 지원 학교를 고르지 않았습니다"}
                    </p>
                    <span className="shrink-0 text-xs font-bold text-slate-400">
                      {univPicks.length} / 6
                    </span>
                  </div>

                  {univPicks.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white py-4 text-center text-xs text-slate-400">
                      학생이 기출문제 탭에서 학교·학과·전형을 고르면 여기에 표시됩니다.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {univPicks.map((p) => {
                        const on =
                          univPick?.univ === p.univ &&
                          univPick?.major === p.major &&
                          univPick?.admission === p.admission;
                        return (
                          <button key={p.id} type="button" onClick={() => setUnivPick(p)}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                              on
                                ? "bg-seum-blue text-white"
                                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                            }`}>
                            {p.univ} · {p.major}
                            <span className={`ml-1.5 ${on ? "text-blue-100" : "text-slate-400"}`}>
                              {p.admission}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

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

              {isMock ? (
                <TeacherMockPanel
                  student={selStudent}
                  teacherId={myId}
                  concept={savedConcept}
                />
              ) : isPt ? (
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
                <div className="flex items-center gap-2">
                  {isPersonal && unsentCount > 0 && (
                    <button type="button" onClick={sendQuestions} disabled={sendingQ}
                      className="rounded-lg bg-seum-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#0d2647] disabled:opacity-50">
                      {sendingQ ? "보내는 중..." : `저장 및 보내기 (${unsentCount})`}
                    </button>
                  )}
                  {isPersonal && (
                    <button type="button" onClick={openNewQuestion}
                      className="rounded-lg border border-seum-navy px-4 py-2 text-sm font-bold text-seum-navy hover:bg-slate-50">
                      + 질문 추가
                    </button>
                  )}
                  <button type="button" onClick={genAllForStudent} disabled={bulkRunning || loading || pendingCount === 0}
                    className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
                    {bulkRunning ? `생성 중... (${bulkProgress.done}/${bulkProgress.total})` : "✨ 이 탭 전체 AI 초안"}
                  </button>
                </div>
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
                    : isUnivGichul
                    ? univPicks.length === 0
                      ? `${selStudent.name} 학생이 아직 지원 학교를 고르지 않았습니다.`
                      : "위에서 지원 학교를 선택하세요."

                    : isPersonal
                    ? `${selStudent.name} 학생의 생기부 질문이 아직 없습니다. 위 [+ 질문 추가]로 만들어주세요.`
                    : "이 탭에 등록된 질문이 없습니다."}
                </p>
              ) : (
                <div className="space-y-4">
                  {visibleRows.map((qRow, i) => {
                    const a = qRow._answer;
                    const hasAnswer = !!a?.student_answer?.trim();
                    const open = isOpen(qRow, a, hasAnswer);

                    const confirmed =
                      !!a?.teacher_feedback &&
                      (draftEdits[a?.id] ?? "").trim() === a.teacher_feedback.trim();

                    const rounds = roundsMap[qRow.id] ?? [];
                    const curRound = rounds.length > 0 ? rounds[rounds.length - 1].round : (hasAnswer ? 1 : 0);
                    const pastRounds = rounds.slice(0, -1);

                    // 답변 행이 아직 없으면 질문 id 를 키로 쓴다 (저장할 때 행이 생긴다)
                    const aKey = a?.id ?? qRow.id;
                    const hasFollowUp = rows.some((r) => r.parent_id === qRow.id);
                    const ansBase = a?.teacher_answer ?? a?.student_answer ?? "";
                    const ansText = answerEdits[aKey] ?? ansBase;
                    const ansDirty = ansText.trim() !== ansBase.trim();

                    return (
                      <div
                        key={qRow.id}
                        className={`rounded-xl border bg-white transition ${
                          confirmed ? "border-slate-300" : "border-slate-200"
                        }`}
                      >
                        {/* 머리 — 누르면 접었다 펼친다 */}
                        <button
                          type="button"
                          onClick={() => toggleOpen(qRow.id, open)}
                          className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-slate-50"
                        >
                          <p className="font-medium text-seum-navy">
                            <span className="mr-1 text-slate-400">{i + 1}.</span>
                            {qRow.source_type && (
                              <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-[10px] font-bold ${sourceStyle(qRow.source_type)}`}>
                                {qRow.source_type}
                              </span>
                            )}
                            {isPersonal && qRow.parent_id && (
                              <span className="mr-1.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 align-middle text-[10px] font-bold text-emerald-700">
                                꼬리질문
                              </span>
                            )}
                            {isPersonal && !qRow.sent_at && (
                              <span className="mr-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-bold text-amber-700">
                                미전송
                              </span>
                            )}
                            {qRow.question}
                          </p>
                          <span className="flex shrink-0 items-center gap-2 pt-0.5">
                            {curRound > 0 && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                curRound >= MAX_ROUND ? "bg-slate-200 text-slate-600" : "bg-blue-50 text-seum-blue"
                              }`}>
                                {curRound}차
                              </span>
                            )}
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
                            <svg
                              className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </button>

                        {/* 생기부 질문은 선생님이 고치고 지울 수 있다 */}
                        {isPersonal && (
                          <div className="flex justify-end gap-1.5 border-t border-slate-100 px-4 py-2">
                            <button type="button" onClick={() => openEditQuestion(qRow)}
                              className="rounded-md border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              질문 수정
                            </button>
                            <button type="button" onClick={() => removeQuestion(qRow)}
                              className="rounded-md border border-red-200 px-2.5 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50">
                              삭제
                            </button>
                          </div>
                        )}

                        {open && (
                          <div className="border-t border-slate-100 p-4">
                            {/* 이 질문의 스피치 구조 */}
                            {!isPersonal && qRow.speech_structure && (
                              <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                                <p className="text-[11px] font-bold text-seum-blue">
                                  스피치 구조{qRow.structure_name ? ` · ${qRow.structure_name}` : ""}
                                </p>
                                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                                  {qRow.speech_structure}
                                </p>
                              </div>
                            )}

                            {/* 학생이 쓴 원본 — 건드리지 않는다 */}
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              학생 답변
                            </p>
                            {hasAnswer ? (
                              <p className="mb-4 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
                                {a.student_answer}
                              </p>
                            ) : (
                              <p className="mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-400">
                                아직 답변하지 않았습니다.
                              </p>
                            )}

                            {/* 첨삭 답변 */}
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                              첨삭 답변
                              {a?.teacher_answer && (
                                <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                                  학생에게 전달됨
                                </span>
                              )}
                            </p>
                            <textarea
                              value={ansText}
                              onChange={(e) =>
                                setAnswerEdits((p) => ({ ...p, [aKey]: e.target.value }))
                              }
                              rows={6}
                              placeholder="답변을 고쳐 쓰면 학생 화면에 첨삭본으로 보입니다."
                              className={`mb-4 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus:border-seum-blue ${
                                ansDirty ? "border-amber-400 bg-amber-50/40" : "border-slate-200 bg-white"
                              }`}
                            />

                            {/* AI 분석 — 선생님만 본다 */}
                            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50">
                              <div className="flex items-center justify-between px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => setAiOpen((p) => ({ ...p, [aKey]: !p[aKey] }))}
                                  disabled={!a?.ai_draft}
                                  className="flex items-center gap-1.5 text-left disabled:cursor-default"
                                >
                                  <span className="text-[11px] font-black tracking-wide text-slate-500">AI 분석</span>
                                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                    선생님만 봄
                                  </span>
                                  {a?.ai_draft && (
                                    <svg
                                      className={`h-3.5 w-3.5 text-slate-400 transition-transform ${aiOpen[aKey] ? "rotate-180" : ""}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  )}
                                </button>
                                <button type="button" onClick={() => genSingle(qRow)}
                                  disabled={!hasAnswer || aiLoadingId === a?.id || bulkRunning}
                                  className="shrink-0 rounded-md border border-seum-blue px-2.5 py-0.5 text-xs font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-40">
                                  {aiLoadingId === a?.id ? "분석 중..." : a?.ai_draft ? "🔄 다시" : "✨ AI 분석"}
                                </button>
                              </div>

                              {a?.ai_draft ? (
                                aiOpen[aKey] && (
                                  <p className="whitespace-pre-wrap border-t border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
                                    {a.ai_draft}
                                  </p>
                                )
                              ) : (
                                <p className="border-t border-slate-200 px-3 py-2.5 text-xs text-slate-400">
                                  {hasAnswer
                                    ? "아직 분석하지 않았습니다. 컨셉·활동 매칭·스피치 구조를 확인하려면 AI 분석을 누르세요."
                                    : "학생이 답변하면 AI 분석을 쓸 수 있습니다."}
                                </p>
                              )}
                            </div>

                            {/* 꼬리질문 — 생기부만. 최종 답변을 보고 만든다 */}
                            {isPersonal && hasAnswer && (
                              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-[11px] font-black tracking-wide text-emerald-700">
                                    꼬리질문
                                    {hasFollowUp && (
                                      <span className="ml-1.5 font-normal text-slate-400">이미 보냈습니다</span>
                                    )}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => genFollowUp(qRow)}
                                    disabled={followSaving === qRow.id + ":gen"}
                                    className="rounded-md border border-emerald-600 px-2.5 py-0.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                  >
                                    {followSaving === qRow.id + ":gen" ? "생성 중..." : "✨ 꼬리질문 생성"}
                                  </button>
                                </div>

                                <div className="flex gap-2">
                                  <input
                                    value={followEdits[qRow.id] ?? ""}
                                    onChange={(e) =>
                                      setFollowEdits((p) => ({ ...p, [qRow.id]: e.target.value }))
                                    }
                                    placeholder="생성 버튼을 누르면 채워집니다. 직접 써도 됩니다."
                                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => sendFollowUp(qRow)}
                                    disabled={followSaving === qRow.id || !(followEdits[qRow.id] ?? "").trim()}
                                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                                  >
                                    {followSaving === qRow.id ? "보내는 중..." : "보내기"}
                                  </button>
                                </div>
                                <p className="mt-1.5 text-[11px] text-slate-500">
                                  첨삭이 끝난 최종 답변을 기준으로 만듭니다. 보내면 학생 화면의 이 질문 아래에 붙습니다.
                                </p>
                              </div>
                            )}

                            {/* 학생에게 보낼 피드백 */}
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-seum-blue">
                              학생에게 보낼 피드백
                            </p>
                            <textarea value={draftEdits[aKey] ?? ""} onChange={(e) => setDraftEdits((p) => ({ ...p, [aKey]: e.target.value }))}
                              rows={6}
                              placeholder="AI 분석을 참고해 학생에게 전할 말을 직접 작성하세요."
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-seum-blue" />

                            <div className="mt-2 flex items-center justify-between gap-3">
                              <span className="text-[11px] text-slate-400">
                                {ansDirty
                                  ? "첨삭 답변과 피드백이 함께 전달됩니다. 학생이 쓴 원본은 그대로 남습니다."
                                  : "저장하면 학생 화면에 바로 보입니다."}
                              </span>
                              <button
                                type="button"
                                onClick={() => sendToStudent(qRow)}
                                disabled={savingId === aKey || (confirmed && !ansDirty)}
                                className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-100 ${
                                  confirmed && !ansDirty
                                    ? "cursor-default bg-slate-700"
                                    : "bg-seum-blue hover:bg-[#2a63c4]"
                                }`}
                              >
                                {savingId === aKey
                                  ? "저장 중..."
                                  : confirmed && !ansDirty
                                  ? "✓ 전달 완료"
                                  : "저장 · 학생에게 전달"}
                              </button>
                            </div>

                            {/* 지난 회차 */}
                            {pastRounds.length > 0 && (
                              <div className="mt-4 border-t border-slate-100 pt-3">
                                <button
                                  type="button"
                                  onClick={() => setPastOpen((p) => ({ ...p, [qRow.id]: !p[qRow.id] }))}
                                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"
                                >
                                  지난 기록 {pastRounds.length}건
                                  <svg
                                    className={`h-3.5 w-3.5 transition-transform ${pastOpen[qRow.id] ? "rotate-180" : ""}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>

                                {pastOpen[qRow.id] && (
                                  <div className="mt-2 space-y-2">
                                    {[...pastRounds].reverse().map((r) => (
                                      <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                                        <p className="text-[11px] font-black text-slate-500">
                                          {r.round}차
                                          {r.answered_at && (
                                            <span className="ml-1.5 font-normal text-slate-400">{fmtTime(r.answered_at)}</span>
                                          )}
                                        </p>
                                        {r.student_answer && (
                                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                                            {r.student_answer}
                                          </p>
                                        )}
                                        {r.teacher_feedback && (
                                          <p className="mt-2 whitespace-pre-wrap border-t border-slate-200 pt-2 text-xs leading-relaxed text-seum-blue">
                                            {r.teacher_feedback}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
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

      {/* ===== 생기부 질문 추가 · 수정 팝업 ===== */}
      {qModal && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setQModal(null)}>
          <div className="my-8 w-full max-w-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4">
              <h3 className="text-lg font-bold text-seum-navy">
                {qModal.mode === "edit" ? "질문 수정" : "생기부 예상질문 추가"}
              </h3>
              <button type="button" onClick={() => setQModal(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {qModal.mode === "edit" ? (
              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 flex gap-1.5">
                  {SOURCE_TYPES.map((t) => (
                    <button key={t.key} type="button" onClick={() => setQType(t.key)}
                      className={`flex-1 rounded-md py-2 text-sm font-bold transition ${
                        qType === t.key ? "bg-seum-navy text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                />
              </div>
            ) : (
              <div className="border-t border-slate-200 pt-4">
                <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                  {qList.map((r, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="w-6 shrink-0 pt-2.5 text-xs font-bold text-slate-400">{idx + 1}.</span>
                      <div className="flex shrink-0 gap-1">
                        {SOURCE_TYPES.map((t) => (
                          <button key={t.key} type="button" onClick={() => setQRow(idx, { type: t.key })}
                            className={`rounded-md px-2.5 py-2 text-xs font-bold transition ${
                              r.type === t.key ? "bg-seum-navy text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <input
                        value={r.text}
                        onChange={(e) => setQRow(idx, { text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && idx === qList.length - 1 && r.text.trim()) addQRow();
                        }}
                        placeholder="질문을 입력하세요"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
                      />
                      <button type="button" onClick={() => removeQRow(idx)}
                        disabled={qList.length <= 1}
                        className="shrink-0 px-1 py-2 text-sm text-slate-300 hover:text-red-500 disabled:opacity-30">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={addQRow}
                  className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50">
                  + 줄 추가
                </button>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  마지막 줄에서 Enter를 눌러도 줄이 늘어납니다. 비워둔 줄은 저장되지 않습니다.
                </p>
              </div>
            )}

            <div className="mt-4 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={saveQuestion}
                disabled={qSaving}
                className="w-full bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
              >
                {qSaving
                  ? "저장 중..."
                  : qModal.mode === "edit"
                  ? "수정 저장"
                  : `${qList.filter((r) => r.text.trim()).length}개 저장`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}