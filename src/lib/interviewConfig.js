// src/lib/interviewConfig.js
// 면접 카테고리 · 세부 · 탭 구조 단일 정의 (학생/선생님/원장 공유)

export const CATEGORIES = {
  gov: {
    key: "gov",
    label: "공무원",
    // 공무원만 세부(인천/서울) 선택 존재
    subs: [
      { key: "incheon", label: "인천시 공무원" },
      { key: "seoul", label: "서울시 공무원" },
    ],
    tabs: [
      { key: "gongjik", label: "공직관" },
      { key: "insung", label: "기본인성" },
      { key: "gichul", label: "기출문제" },
      { key: "pt", label: "PT면접" },
      { key: "debate", label: "토론" },
    ],
  },
  public_corp: {
    key: "public_corp",
    label: "공기업",
    subs: null,
    tabs: [
      { key: "insung", label: "인성" },
      { key: "gichul", label: "기출문제" },
      { key: "pt", label: "PT면접" },
      { key: "debate", label: "토론" },
    ],
  },
  company: {
    key: "company",
    label: "사기업",
    subs: null,
    tabs: [
      { key: "insung", label: "인성" },
      { key: "gichul", label: "기출문제" },
      { key: "pt", label: "PT면접" },
    ],
  },
  hospital: {
    key: "hospital",
    label: "병원",
    subs: null,
    tabs: [
      { key: "insung", label: "인성" },
      { key: "gichul", label: "기출문제" },
      { key: "major", label: "전공질문" },
      { key: "situation", label: "상황면접" },
    ],
  },
  univ: {
    key: "univ",
    label: "대입",
    subs: null,
    tabs: [
      { key: "insung", label: "인성" },
      { key: "gichul", label: "기출문제" },
      { key: "saenggibu", label: "생기부예상질문" },
      { key: "jamun", label: "제시문면접" },
      { key: "major", label: "전공특화문제" },
    ],
  },
  transfer: {
    key: "transfer",
    label: "편입",
    subs: null,
    tabs: [
      { key: "insung", label: "인성" },
      { key: "gichul", label: "기출문제" },
      { key: "major", label: "전공특화문제" },
    ],
  },
  highschool: {
    key: "highschool",
    label: "고입",
    subs: null,
    tabs: [
      { key: "insung", label: "인성" },
      { key: "gichul", label: "기출문제" },
      { key: "saenggibu", label: "생기부예상질문" },
      { key: "jaso", label: "자소서예상질문" },
      { key: "jamun", label: "제시문면접" },
    ],
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

// ============================================================
// 기출문제 직렬 (공무원 전용)
// interview_questions_v2.series_key 값과 1:1 매칭
// ============================================================
export const GOV_SERIES = {
  incheon: [
    { key: "haengjeong", label: "일반행정" },
    { key: "geonchuk", label: "건축" },
    { key: "tomok", label: "토목" },
    { key: "semu", label: "세무" },
    { key: "ganho", label: "간호" },
    { key: "bogeon", label: "보건" },
    { key: "unjeon", label: "운전" },
    { key: "sahoebokji", label: "사회복지" },
    { key: "hwagong", label: "화공" },
    { key: "jeonsan", label: "전산" },
  ],
  seoul: [],
};

// 직렬 목록 (기출문제 탭에서만 사용)
export function getSeries(categoryKey, subKey) {
  if (categoryKey !== "gov") return [];
  return GOV_SERIES[subKey] ?? [];
}

// 직렬 라벨
export function getSeriesLabel(categoryKey, subKey, seriesKey) {
  const list = getSeries(categoryKey, subKey);
  const s = list.find((x) => x.key === seriesKey);
  return s ? s.label : seriesKey;
}

// 해당 탭이 직렬 선택을 필요로 하는지
export function needsSeries(categoryKey, subKey, tabKey) {
  return tabKey === "gichul" && getSeries(categoryKey, subKey).length > 0;
}

// 카테고리 키로 정의 가져오기
export function getCategory(categoryKey) {
  return CATEGORIES[categoryKey] || null;
}

// 배정(category + sub) 기준으로 표시할 탭 목록
export function getTabs(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  return cat ? cat.tabs : [];
}

// 세부 라벨 (공무원 인천/서울)
export function getSubLabel(categoryKey, subKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat || !cat.subs) return null;
  const sub = cat.subs.find((s) => s.key === subKey);
  return sub ? sub.label : null;
}

// 카테고리 라벨
export function getCategoryLabel(categoryKey) {
  return CATEGORIES[categoryKey]?.label || categoryKey;
}

// 탭 라벨
export function getTabLabel(categoryKey, tabKey) {
  const cat = CATEGORIES[categoryKey];
  const tab = cat?.tabs.find((t) => t.key === tabKey);
  return tab ? tab.label : tabKey;
}

// ============================================================
// 면접 자료집 (카테고리·지자체별)
// Supabase Storage: student-files 버킷
// ============================================================
export const MATERIALS = {
  "gov:incheon": [
    {
      title: "2026 인천광역시 시정정책통계 현안",
      description: "인천시 공무원 면접 대비 필수 자료",
      path: "interview-materials/incheon-policy-2026.pdf",
    },
  ],
};

export function getMaterials(categoryKey, subKey) {
  const key = subKey ? `${categoryKey}:${subKey}` : categoryKey;
  return MATERIALS[key] ?? [];
}