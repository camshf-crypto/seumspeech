// src/lib/aiworkConfig.js
//
// AI 과제 1~6단계 정의.
// 학생 과제 화면 · 선생님 채점 화면 · 리포트가 같이 쓴다.
// key는 aiwork_scores 테이블 컬럼 이름과 같아야 한다 — 바꾸지 말 것.

export const STAGES = [
  { stage: 1, key: "problem_definition", name: "문제 정의",   sub: "문제 쪼개기",  max: 20 },
  { stage: 2, key: "context_design",     name: "맥락 설계",   sub: "조건 정하기",  max: 20 },
  { stage: 3, key: "ai_exploration",     name: "AI 탐색",     sub: "되묻기",       max: 15 },
  { stage: 4, key: "verification",       name: "검증·수정",   sub: "틀린 곳 찾기", max: 20 },
  { stage: 5, key: "human_judgment",     name: "인간의 판단", sub: "내 판단",      max: 15 },
  { stage: 6, key: "deliverable",        name: "실전 과제",   sub: "종합 실전",    max: 10 },
];

export const stageOf = (n) => STAGES.find((s) => s.stage === n);

// 6단계 실전은 여섯 항목을 모두 채점, 1~5단계는 자기 항목 하나만.
export const scoreKeysFor = (stage) =>
  stage === 6 ? STAGES.map((s) => s.key) : [stageOf(stage).key];