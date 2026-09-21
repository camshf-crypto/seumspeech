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
  useLayoutEffect(() => {
    if (skip || !cur) { setRect(null); return; }
    if (!cur.target) { setRect(null); return; }

    let raf = 0;
    const find = () => {
      const el = document.querySelector(`[data-guide="${cur.target}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      // 화면 밖이면 보이는 곳으로 끌어온다
      if (r.top < 60 || r.bottom > window.innerHeight - 60) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        raf = requestAnimationFrame(find);
        return;
      }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    find();

    const onChange = () => find();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [skip, cur?.target, idx, guideKey]);

  if (skip || !cur) return null;

  const last = idx >= steps.length - 1;

  const close = async () => {
    setSaving(true);
    const next = { ...(seen ?? {}), [guideKey]: true };
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
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 sm:items-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-6">{body}</div>
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
  const putBelow = below + 200 < window.innerHeight;
  const boxTop = putBelow ? below : Math.max(12, hole.top - GAP - 200);
  const boxLeft = Math.min(
    Math.max(12, hole.left + hole.width / 2 - BOX_W / 2),
    window.innerWidth - BOX_W - 12
  );

  return (
    <div className="fixed inset-0 z-[120]">
      {/* 구멍 — 여기만 밝다. 클릭은 통과시키지 않는다 */}
      <div
        className="pointer-events-auto absolute rounded-xl ring-2 ring-white/90 transition-all"
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