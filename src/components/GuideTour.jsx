// src/components/GuideTour.jsx
// 메뉴를 처음 눌렀을 때 한 번만 뜨는 튜토리얼.
//
// 단계는 두 가지다.
//   1) 설명만  — 화면 가운데 카드로 보여준다
//   2) 버튼 짚기 — target 에 적은 요소만 밝게 남기고 그 옆에 말풍선을 띄운다
//
// 버튼을 짚으려면 그 버튼에 표시를 달아둔다.
//   <button data-guide="save">저장</button>   →   target: "save"
//
// 다 보면 profiles.seen_guides 에 기록해서 다시 뜨지 않는다. (기기를 바꿔도)

import { useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const PAD = 8;          // 비추는 영역 여백
const GAP = 12;          // 말풍선과 버튼 사이 간격
const BOX_W = 320;       // 말풍선 너비

// ============================================================
// 메뉴별 안내
//   head  제목
//   body  설명
//   target  (선택) 비출 요소의 data-guide 값
// ============================================================
export const GUIDES = {
  courses: {
    title: "수강 현황",
    steps: [
      {
        head: "지금 듣는 수업이 모두 보여요",
        body: "단체반인지 1:1인지, 담임 선생님이 누구인지 확인할 수 있어요.",
      },
      {
        head: "남은 횟수를 꼭 확인하세요",
        body: "오른쪽 큰 숫자가 남은 수업 횟수예요. 수업을 받을 때마다 하나씩 줄어듭니다.",
      },
      {
        head: "종료일이 지나면 제출이 막혀요",
        body: "수강 종료일이 지나도 지난 자료는 볼 수 있지만, 새로 제출하거나 보내는 것은 재등록 후에 할 수 있어요.",
      },
    ],
  },

  absence: {
    title: "결석 신청",
    steps: [
      {
        head: "빠질 수업을 미리 알려주세요",
        body: "날짜와 사유를 적어 보내면 선생님이 확인합니다.",
      },
      {
        head: "미리 낼수록 좋아요",
        body: "수업 직전에 내면 횟수가 차감될 수 있어요. 일정이 정해지면 바로 신청하세요.",
      },
    ],
  },

  materials: {
    title: "자료 제출함",
    steps: [
      {
        head: "선생님께 보낼 파일을 올리는 곳이에요",
        body: "생활기록부, 자기소개서처럼 수업에 필요한 자료를 여기에 올립니다.",
      },
      {
        head: "선생님이 준 자료도 여기 있어요",
        body: "받은 자료는 내려받아 볼 수 있어요.",
      },
    ],
  },

  homework: {
    title: "숙제",
    steps: [
      {
        head: "선생님이 낸 숙제가 쌓여요",
        body: "제목을 누르면 무엇을 해야 하는지 볼 수 있어요.",
      },
      {
        head: "제출해야 피드백을 받아요",
        body: "쓰다 만 내용은 자동으로 저장되지만, 제출 버튼을 눌러야 선생님께 전달됩니다.",
      },
    ],
  },


  // ── 면접 화면 안쪽 탭 (키: iv-탭이름) ─────────────────────
  "iv-insung": {
    title: "기본 인성",
    steps: [
      {
        head: "연습할 종류를 여기서 골라요",
        body: "기본 인성, 생기부 예상질문, 기출문제처럼 종류별로 나뉘어 있어요. 누를 때마다 그 탭 안내가 한 번씩 나옵니다.",
        target: "iv-tabs",
      },
      {
        head: "내 면접 컨셉부터 확인하세요",
        body: "선생님이 정해준 진로 방향이에요. 모든 답변이 이 방향으로 이어져야 점수가 납니다.",
        target: "iv-concept",
      },
      {
        head: "여기에 답변을 써요",
        body: "면접에서 말한다고 생각하고 쓰세요. 쓰는 동안 자동으로 임시 저장됩니다.",
        target: "iv-answer",
      },
      {
        head: "저장을 눌러야 선생님께 가요",
        body: "임시 저장만으로는 선생님이 볼 수 없어요. 다 쓰면 꼭 저장을 누르세요.",
        target: "iv-save",
      },
      {
        head: "피드백은 답변 아래에 와요",
        body: "선생님이 고쳐준 답변과 피드백이 답변 밑에 나타나요. 내 답변과 비교하며 다시 써보세요. 한 문항은 3차까지 고칠 수 있어요.",
      },
      {
        head: "종이로도 볼 수 있어요",
        body: "질문과 내 답변을 인쇄하거나 PDF로 저장해서 외워보세요.",
        target: "iv-print",
      },
    ],
  },

  "iv-saenggibu": {
    title: "생기부 예상질문",
    steps: [
      {
        head: "내 생기부로 만든 질문이에요",
        body: "선생님이 내 생활기록부를 보고 직접 만들어 보낸 질문입니다. 친구들과 질문이 달라요.",
      },
      {
        head: "실제로 한 일을 구체적으로",
        body: "면접관은 생기부에 적힌 활동을 정말 했는지 확인합니다. 언제, 무엇을, 어떻게 했는지 직접 겪은 사람만 아는 내용을 쓰세요.",
        target: "iv-answer",
      },
      {
        head: "저장하면 선생님께 가요",
        body: "다 쓰면 저장을 누르세요.",
        target: "iv-save",
      },
      {
        head: "꼬리질문이 올 수 있어요",
        body: "답변을 보고 선생님이 이어서 물을 질문을 보내면, 그 질문 바로 아래 초록 칸에 나타납니다. 거기에도 답하세요.",
      },
    ],
  },

  "iv-gichul": {
    title: "기출문제",
    steps: [
      {
        head: "지원할 학교를 먼저 고르세요",
        body: "학교, 학과, 전형을 골라 지원 목록에 넣으면 그 학교의 실제 기출문제가 나옵니다.",
        target: "iv-univ",
      },
      {
        head: "6개까지, 넣으면 뺄 수 없어요",
        body: "수시 6장에 맞춰 학교·학과 조합은 6개까지 넣을 수 있고, 한 번 넣으면 뺄 수 없어요. 신중하게 고르세요.",
        target: "iv-univ",
      },
      {
        head: "학교마다 보는 기준이 달라요",
        body: "같은 답변이라도 학교마다 평가하는 요소가 다릅니다. 선생님 피드백은 그 학교 기준으로 옵니다.",
      },
    ],
  },

  "iv-simulation": {
    title: "면접 시뮬레이션",
    steps: [
      {
        head: "말로 답하는 연습이에요",
        body: "화면에 면접관이 나오고, 질문을 보고 마이크로 답합니다. 녹음은 글로 옮겨져 선생님께 전달돼요.",
      },
      {
        head: "연습과 모의고사가 있어요",
        body: "연습은 내가 골라서 언제든 할 수 있고, 모의고사는 선생님이 내준 것만 볼 수 있어요. 모의고사 탭에 빨간 점이 있으면 응시할 게 있다는 뜻입니다.",
      },
      {
        head: "한 문항에 1분이에요",
        body: "질문이 나오면 [답변 시작]을 누르고 1분 안에 말하세요. 끝나면 [답변 종료]를 누릅니다.",
      },
    ],
  },

  "iv-jamun": {
    title: "제시문 면접",
    steps: [
      {
        head: "글을 읽고 생각을 말하는 면접이에요",
        body: "제시문을 먼저 읽고, 핵심을 요약한 뒤 내 생각과 근거를 말하는 순서로 답하세요.",
      },
    ],
  },

  "iv-major": {
    title: "전공특화문제",
    steps: [
      {
        head: "전공 지식을 묻는 질문이에요",
        body: "개념을 정확히 설명하는 것이 먼저입니다. 그다음 그 개념을 내 경험이나 관심 분야와 연결해 보세요.",
      },
    ],
  },


  // ════════════════════════════════════════════════════════
  // 선생님 — 왼쪽 메뉴 (키: t-메뉴이름)
  // ════════════════════════════════════════════════════════
  "t-schedule": {
    title: "내 스케줄",
    steps: [
      {
        head: "무엇을 넣을지 먼저 고르세요",
        body: "[내 가능시간]은 수업할 수 있는 시간, [수업 스케줄]은 실제로 잡힌 수업입니다. 여기서 고른 종류로 일정이 추가됩니다.",
        target: "t-sch-tabs",
      },
      {
        head: "날짜를 눌러 일정을 봐요",
        body: "보라색은 가능시간, 파란색은 수업이에요. 출석하면 초록, 결석은 빨강, 보류는 회색으로 바뀝니다.",
        target: "t-sch-cal",
      },
      {
        head: "+ 로 일정을 추가해요",
        body: "날짜를 누르면 그날 일정이 열리고, 오른쪽 위 + 버튼으로 가능시간이나 수업을 넣을 수 있어요. 수업을 잡으면 학생 잔여 횟수가 하나 줄어듭니다.",
      },
    ],
  },

  "t-attendance": {
    title: "출석 체크",
    steps: [
      {
        head: "수업이 끝나면 출석을 찍어주세요",
        body: "출석·결석·지각·보류 중에 고릅니다. 보류는 횟수를 차감하지 않아요.",
      },
    ],
  },

  "t-homework": {
    title: "숙제 피드백",
    steps: [
      {
        head: "학생이 낸 숙제가 모여요",
        body: "제출된 숙제를 열어 피드백을 남기면 학생 화면에 바로 보입니다.",
      },
    ],
  },

  "t-interview_group": {
    title: "단체반 수업",
    steps: [
      {
        head: "반을 먼저 고르세요",
        body: "내가 맡은 단체반이 보여요. 반을 고르면 그 반 학생 목록이 나옵니다.",
        target: "ti-class",
      },
      {
        head: "학생을 고르면 첨삭 화면이 열려요",
        body: "학생을 누르면 면접 컨셉과 탭이 나옵니다. 탭을 처음 누를 때마다 그 탭 사용법이 한 번씩 안내돼요.",
      },
    ],
  },

  "t-interview_one": {
    title: "1:1 수업",
    steps: [
      {
        head: "수업을 먼저 고르세요",
        body: "내가 담당하는 1:1 수업이 보여요. 수업을 고르면 담당 학생이 나옵니다.",
        target: "ti-class",
      },
      {
        head: "학생을 고르면 첨삭 화면이 열려요",
        body: "학생을 누르면 면접 컨셉과 탭이 나옵니다. 탭을 처음 누를 때마다 그 탭 사용법이 한 번씩 안내돼요.",
      },
    ],
  },

  "t-materials": {
    title: "학생 자료함",
    steps: [
      {
        head: "학생이 올린 자료를 봐요",
        body: "생활기록부, 자기소개서처럼 학생이 올린 파일을 내려받을 수 있어요. 생기부 예상질문을 만들 때 여기서 확인하세요.",
      },
    ],
  },

  "t-chat": {
    title: "학생 채팅",
    steps: [
      {
        head: "담당 학생과 바로 이야기해요",
        body: "학생이 보낸 메시지가 여기 모입니다.",
      },
    ],
  },

  "t-notifications": {
    title: "알림",
    steps: [
      {
        head: "새 소식이 여기 모여요",
        body: "학생 답변, 숙제 제출, 모의고사 응시가 끝나면 알려줍니다. 누르면 그 화면으로 이동해요.",
      },
    ],
  },

  "t-settlement": {
    title: "수업 정산",
    steps: [
      {
        head: "진행한 수업이 집계돼요",
        body: "출석 처리된 수업을 기준으로 정산됩니다. 출석 체크를 빠뜨리면 여기서도 빠져요.",
      },
    ],
  },

  "t-memos": {
    title: "받은 상담 메모",
    steps: [
      {
        head: "원장님이 남긴 학생 메모예요",
        body: "상담 내용이나 학생 특이사항을 수업 전에 확인하세요.",
      },
    ],
  },

  "t-mypage": {
    title: "마이페이지",
    steps: [
      {
        head: "내 정보를 관리해요",
        body: "이름, 연락처 같은 정보를 확인하고 바꿀 수 있어요.",
      },
    ],
  },

  // ════════════════════════════════════════════════════════
  // 선생님 — 면접 첨삭 화면 안쪽 탭 (키: ti-탭이름)
  // ════════════════════════════════════════════════════════
  "ti-insung": {
    title: "기본 인성 첨삭",
    steps: [
      {
        head: "학생 컨셉부터 정해주세요",
        body: "학생이 내세울 진로 방향이에요. 예: 수술실 간호사. 학생 화면에도 보이고, AI가 이 컨셉을 기준으로 답변을 봅니다.",
        target: "ti-concept",
      },
      {
        head: "탭마다 첨삭할 수 있어요",
        body: "숫자는 [피드백한 수 / 학생이 답한 수]예요. 주황이면 아직 피드백하지 않은 답변이 있다는 뜻입니다.",
        target: "ti-tabs",
      },
      {
        head: "질문을 누르면 펼쳐져요",
        body: "학생 답변, 첨삭 답변, AI 분석, 학생에게 보낼 피드백이 차례로 나옵니다. 1차·2차·3차 회차도 여기 표시돼요.",
        target: "ti-card",
      },
      {
        head: "AI 분석은 선생님만 봐요",
        body: "AI가 컨셉·활동·스피치 구조를 진단합니다. 학생에게는 절대 가지 않아요. 참고해서 피드백을 직접 쓰세요.",
        target: "ti-ai",
      },
      {
        head: "학생에게 갈 말은 여기에 써요",
        body: "이 칸에 쓴 피드백과, 위에서 고쳐준 첨삭 답변만 학생에게 전달됩니다.",
        target: "ti-feedback",
      },
      {
        head: "저장해야 학생에게 가요",
        body: "누르면 학생 화면에 바로 보입니다. 학생 원본 답변은 그대로 남아요.",
        target: "ti-send",
      },
    ],
  },

  "ti-saenggibu": {
    title: "생기부 예상질문",
    steps: [
      {
        head: "학생마다 질문을 직접 만들어요",
        body: "학생 생기부를 보고 질문을 넣습니다. 창체·세특·행특을 고르고 여러 줄을 한 번에 넣을 수 있어요.",
        target: "ti-add",
      },
      {
        head: "보내야 학생에게 보여요",
        body: "만든 질문은 [미전송]으로 쌓여 있다가, [저장 및 보내기]를 누르면 학생 화면에 나타납니다.",
        target: "ti-sendq",
      },
      {
        head: "답변을 보고 꼬리질문을 던지세요",
        body: "첨삭이 끝난 최종 답변을 기준으로 AI가 꼬리질문을 만들어 줍니다. 고쳐서 보내면 학생 화면의 그 질문 아래에 붙어요.",
        target: "ti-followup",
      },
    ],
  },

  "ti-gichul": {
    title: "기출문제",
    steps: [
      {
        head: "학생이 고른 지원 학교예요",
        body: "학생이 지원 목록에 넣은 학교·학과·전형이 버튼으로 나옵니다. 최대 6개예요. 누르면 그 학교 기출 전체가 보입니다.",
        target: "ti-picks",
      },
      {
        head: "AI는 그 학교 기준으로 봐요",
        body: "기출문제의 AI 분석은 학교마다 다른 평가요소와 배점을 기준으로 진단합니다.",
      },
    ],
  },

  "ti-mock": {
    title: "면접 모의고사",
    steps: [
      {
        head: "수업이 끝나면 모의고사를 내주세요",
        body: "범위(인성·생기부·기출)와 문항 수를 고르면, 학생이 이미 답해본 문항 중에서 뽑힙니다. 연습한 걸 말로 확인하는 자리예요.",
        target: "ti-mock-new",
      },
      {
        head: "학생은 집에서 말로 답해요",
        body: "학생 화면의 [면접 시뮬레이션 → 모의고사]에 나타납니다. 답변은 글로 옮겨져 여기로 옵니다.",
      },
      {
        head: "다음 수업 전에 결과를 보세요",
        body: "응시 완료된 모의고사를 펼치면 녹음, 글로 옮긴 답변, AI 진단이 나옵니다. [전체 AI 진단]으로 한 번에 돌릴 수 있어요.",
      },
    ],
  },

  aiwork: {
    title: "AI 직무역량",
    steps: [
      {
        head: "AI를 써서 일하는 법을 연습해요",
        body: "실제 업무 과제를 AI와 함께 풀어봅니다. 결과물뿐 아니라 AI를 어떻게 썼는지도 함께 봅니다.",
      },
      {
        head: "1단계부터 순서대로 해보세요",
        body: "단계마다 기술을 하나씩 익히고, 6단계에서 전부 합쳐 실전처럼 풉니다.",
        target: "aiwork-steps",
      },
      {
        head: "AI는 과제를 모릅니다",
        body: "상황을 직접 설명해야 알아들어요. 무엇을 도와달라고 할지 정확히 쓰는 것이 첫 연습입니다.",
        target: "aiwork-input",
      },
      {
        head: "대화를 마치면 진단을 받으세요",
        body: "주고받은 대화 전체를 보고 이 단계 기술을 얼마나 썼는지 알려줍니다.",
        target: "aiwork-finish",
      },
    ],
  },

  chat: {
    title: "선생님과 채팅",
    steps: [
      {
        head: "담임 선생님과 바로 이야기할 수 있어요",
        body: "수업 중에는 답이 늦을 수 있어요.",
      },
    ],
  },

  payments: {
    title: "결제내역",
    steps: [
      {
        head: "지금까지 결제한 내용이 보여요",
        body: "수업료와 결제일을 확인할 수 있습니다.",
      },
    ],
  },

  notifications: {
    title: "알림",
    steps: [
      {
        head: "새 소식이 여기 모여요",
        body: "숙제, 피드백, 공지가 도착하면 알려줍니다.",
      },
      {
        head: "누르면 그 화면으로 이동해요",
        body: "읽은 알림은 빨간 숫자에서 빠집니다.",
      },
    ],
  },
};

// ============================================================
export default function GuideTour({ userId, guideKey, seen, onDone }) {
  const guide = GUIDES[guideKey];
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);   // 비출 요소의 위치
  const [saving, setSaving] = useState(false);

  const steps = guide?.steps ?? [];
  const cur = steps[idx] ?? null;
  const skip = !guide || !userId || seen?.[guideKey];

  useEffect(() => { setIdx(0); }, [guideKey]);

  // 비출 요소를 찾아 위치를 잡는다. 화면이 바뀌면 다시 잡는다.
  //
  // [주의] 화면 안으로 끌어오는 스크롤은 단계마다 딱 한 번만 한다.
  // 예전에는 "화면에 다 들어올 때까지" 반복했는데, 화면보다 긴 요소(질문 카드 등)는
  // 영원히 다 들어오지 않아 스크롤을 계속 붙잡는 문제가 있었다.
  useLayoutEffect(() => {
    if (skip || !cur || !cur.target) { setRect(null); return; }

    const el = document.querySelector(`[data-guide="${cur.target}"]`);
    if (!el) { setRect(null); return; }

    // 한 번만 가운데로 끌어온다
    const r0 = el.getBoundingClientRect();
    if (r0.top < 60 || r0.top > window.innerHeight - 120) {
      el.scrollIntoView({ behavior: "auto", block: "start" });
      window.scrollBy(0, -80);   // 위쪽 머리글에 가리지 않게
    }

    const measure = () => {
      const r = el.getBoundingClientRect();
      // 화면보다 긴 요소는 보이는 부분만 비춘다
      const top = Math.max(r.top, 8);
      const bottom = Math.min(r.bottom, window.innerHeight - 8);
      if (bottom - top < 20) { setRect(null); return; }
      setRect({ top, left: r.left, width: r.width, height: bottom - top });
    };
    // 스크롤이 반영된 다음 프레임에 잰다 (바로 재면 옛 위치가 잡힌다)
    const raf = requestAnimationFrame(measure);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [skip, cur?.target, idx, guideKey]);

  if (skip || !cur) return null;

  const last = idx >= steps.length - 1;

  const close = async () => {
    setSaving(true);
    // 메뉴 안내와 탭 안내가 따로 기록을 들고 있으므로,
    // 저장 직전에 최신 기록을 다시 읽어 합친다. (서로 덮어쓰지 않게)
    const { data: fresh } = await supabase
      .from("profiles")
      .select("seen_guides")
      .eq("id", userId)
      .maybeSingle();
    const next = { ...(seen ?? {}), ...(fresh?.seen_guides ?? {}), [guideKey]: true };
    const { error } = await supabase
      .from("profiles")
      .update({ seen_guides: next })
      .eq("id", userId);
    setSaving(false);
    if (error) console.error("안내 기록 실패:", error);
    onDone?.(next);   // 저장에 실패해도 이번에는 닫는다
  };

  const next = () => (last ? close() : setIdx((i) => i + 1));

  // ── 말풍선 내용 ────────────────────────────────────
  const body = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold text-seum-blue">{guide.title}</p>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <span key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-5 bg-seum-blue" : "w-1.5 bg-slate-200"
              }`} />
          ))}
        </div>
      </div>

      <h3 className="text-base font-bold leading-snug text-seum-navy">{cur.head}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{cur.body}</p>

      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={close} disabled={saving}
          className="text-xs text-slate-400 hover:text-slate-600">
          건너뛰기
        </button>
        <div className="flex gap-2">
          {idx > 0 && (
            <button type="button" onClick={() => setIdx((i) => i - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
              이전
            </button>
          )}
          <button type="button" onClick={next} disabled={saving}
            className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
            {saving ? "..." : last ? "시작하기" : `다음 ${idx + 1}/${steps.length}`}
          </button>
        </div>
      </div>
    </>
  );

  // ── 1) 짚을 버튼이 없으면 가운데 카드 ────────────────
  if (!rect) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">{body}</div>
      </div>
    );
  }

  // ── 2) 그 버튼만 밝게 남기고 말풍선 ──────────────────
  // 큰 그림자로 주변을 덮어 구멍만 밝게 보이게 한다.
  const hole = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // 아래에 자리가 없으면 위로 붙인다
  const below = hole.top + hole.height + GAP;
  const above = hole.top - GAP - 200;
  const boxTop =
    below + 200 < window.innerHeight ? below          // 아래 자리가 있으면 아래
    : above > 12 ? above                              // 없으면 위
    : window.innerHeight - 220;                       // 둘 다 없으면 화면 아래쪽
  const boxLeft = Math.min(
    Math.max(12, hole.left + hole.width / 2 - BOX_W / 2),
    window.innerWidth - BOX_W - 12
  );

  return (
    <div className="fixed inset-0 z-[120]">
      {/* 구멍 — 여기만 밝다. 클릭은 통과시키지 않는다 */}
      <div
        className="pointer-events-auto absolute rounded-xl ring-2 ring-white/90"
        style={{
          ...hole,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
        }}
        onClick={next}
      />

      {/* 말풍선 */}
      <div
        className="absolute rounded-2xl bg-white p-5 shadow-xl"
        style={{ top: boxTop, left: boxLeft, width: BOX_W }}
      >
        {body}
      </div>
    </div>
  );
}