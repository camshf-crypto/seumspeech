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
      { key: "bucheon", label: "부천시 공무원" },
      { key: "anseong", label: "안성시 공무원" },
      { key: "ansan", label: "안산시 공무원" },
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
      { key: "insung", label: "기본 인성" },
      { key: "saenggibu", label: "생기부 예상질문" },
      { key: "gichul", label: "기출문제" },
      { key: "mock", label: "면접 모의고사" },
      { key: "simulation", label: "면접 시뮬레이션" },
      { key: "jamun", label: "제시문 면접" },
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
// 기출문제 계열 선택(series)
// interview_questions_v2.series_key 값과 1:1 매칭
//
// - 공무원: 직렬. 개수가 적어 상수로 관리 (버튼 UI)
// - 대입:   학교. 140개 이상이라 상수로 두지 않고 DB에서 조회 (드롭다운 UI)
//           → SERIES_SOURCE로 구분한다.
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
    { key: "hwangyeong", label: "환경" },
  ],
  seoul: [],
  // 부천·안성은 인천과 같은 직렬 구성으로 시작한다.
  // 기출문항이 쌓이면 각 시에 맞게 조정할 것.
  bucheon: [
    { key: "haengjeong", label: "일반행정" },
    { key: "geonchuk", label: "건축" },
    { key: "tomok", label: "토목" },
    { key: "semu", label: "세무" },
    { key: "ganho", label: "간호" },
    { key: "bogeon", label: "보건" },
    { key: "sahoebokji", label: "사회복지" },
    { key: "jeonsan", label: "전산" },
    { key: "hwangyeong", label: "환경" },
  ],
  // 안산시 — 직렬 구성은 기출이 쌓이면 조정할 것
  ansan: [
    { key: "haengjeong", label: "일반행정" },
    { key: "geonchuk", label: "건축" },
    { key: "tomok", label: "토목" },
    { key: "semu", label: "세무" },
    { key: "ganho", label: "간호" },
    { key: "bogeon", label: "보건" },
    { key: "sahoebokji", label: "사회복지" },
    { key: "jeonsan", label: "전산" },
    { key: "hwangyeong", label: "환경" },
  ],
  anseong: [
    { key: "haengjeong", label: "일반행정" },
    { key: "geonchuk", label: "건축" },
    { key: "tomok", label: "토목" },
    { key: "semu", label: "세무" },
    { key: "ganho", label: "간호" },
    { key: "bogeon", label: "보건" },
    { key: "sahoebokji", label: "사회복지" },
    { key: "jeonsan", label: "전산" },
    { key: "hwangyeong", label: "환경" },
  ],
};

// 카테고리별 series 정의
// mode: "static" = 아래 목록 사용(버튼) / "db" = DB 조회(드롭다운)
// tabs: series 선택이 필요한 탭 목록
export const SERIES_SOURCE = {
  gov: {
    mode: "static",
    tabs: ["gichul"],
    ui: "buttons",
    pickerLabel: "직렬 선택",
    emptyHint: "직렬을 선택하면 해당 직렬의 기출문제가 표시됩니다.",
  },
  univ: {
    mode: "db",
    tabs: ["gichul"],
    ui: "dropdown",
    pickerLabel: "학교 선택",
    emptyHint: "학교를 선택하면 해당 학교의 기출문제가 표시됩니다.",
  },
};

// 해당 카테고리·탭이 series 선택을 쓰는지
export function usesSeries(categoryKey, tabKey) {
  const src = SERIES_SOURCE[categoryKey];
  if (!src) return false;
  return src.tabs.includes(tabKey);
}

// series를 DB에서 가져와야 하는지 (대입 학교 등)
export function isSeriesFromDb(categoryKey, tabKey) {
  const src = SERIES_SOURCE[categoryKey];
  if (!src || !src.tabs.includes(tabKey)) return false;
  return src.mode === "db";
}

// series 선택 UI 형태 ("buttons" | "dropdown")
export function getSeriesUi(categoryKey, tabKey) {
  const src = SERIES_SOURCE[categoryKey];
  if (!src || !src.tabs.includes(tabKey)) return null;
  return src.ui;
}

// series 선택 영역 라벨
export function getSeriesPickerLabel(categoryKey, tabKey) {
  const src = SERIES_SOURCE[categoryKey];
  if (!src || !src.tabs.includes(tabKey)) return "";
  return src.pickerLabel;
}

// series 미선택 시 안내 문구
export function getSeriesEmptyHint(categoryKey, tabKey) {
  const src = SERIES_SOURCE[categoryKey];
  if (!src || !src.tabs.includes(tabKey)) return "이 탭에 등록된 질문이 아직 없습니다.";
  return src.emptyHint;
}

// 상수로 정의된 series 목록 (mode: "static"만 값이 있음)
// DB 조회형(대입 학교)은 빈 배열을 반환하며, 목록은 화면에서 조회한다.
export function getSeries(categoryKey, subKey) {
  if (categoryKey === "gov") return GOV_SERIES[subKey] ?? [];
  return [];
}

// series 라벨
// 대입처럼 DB 조회형은 dbList(조회 결과)를 넘기면 그 안에서 찾는다.
export function getSeriesLabel(categoryKey, subKey, seriesKey, dbList = null) {
  if (dbList && dbList.length) {
    const hit = dbList.find((x) => x.key === seriesKey);
    if (hit) return hit.label;
  }
  const list = getSeries(categoryKey, subKey);
  const s = list.find((x) => x.key === seriesKey);
  return s ? s.label : seriesKey;
}

// 해당 탭이 series 선택을 필요로 하는지 (하위 호환 유지)
export function needsSeries(categoryKey, subKey, tabKey) {
  if (!usesSeries(categoryKey, tabKey)) return false;
  if (isSeriesFromDb(categoryKey, tabKey)) return true;
  return getSeries(categoryKey, subKey).length > 0;
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