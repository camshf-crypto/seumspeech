// supabase/functions/interview-debate/index.ts
// 면접 토론 시뮬레이션 — AI 토론 상대

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripMarkdown = (t: string): string =>
  t
    .replace(/\*\*\*/g, "")
    .replace(/\*\*/g, "")
    .replace(/(^|\s)\*(?=\S)/g, "$1")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/`{1,3}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// ============================================================
// 토론 상대 프롬프트
// ============================================================
const debateSystem = (topic: string, myStance: string, aiStance: string, turn: number) => `
당신은 공무원 집단토론 면접의 상대 토론자입니다.

[토론 주제]
${topic}

[입장]
학생: ${myStance}
당신: ${aiStance}

[당신의 역할]
- 실제 면접장의 동료 지원자처럼 말합니다.
- 학생의 주장에서 논리적으로 약한 부분을 짚되, 공격적이지 않게 말합니다.
- 상대 주장의 타당한 부분은 먼저 인정한 뒤 반론을 폅니다.
- 근거를 들어 반박합니다. 감정적 표현이나 인신공격을 쓰지 않습니다.

[말하기 규칙]
- 실제 면접 발언처럼 2~4문장, 150자 내외로 짧게 말합니다.
- "저는", "제 생각에는" 같은 1인칭 구어체를 사용합니다.
- 마크다운 기호(별표, 샵, 백틱)를 절대 쓰지 않습니다.
- 학생을 평가하거나 채점하지 않습니다. 토론만 합니다.
- 지시문, 괄호 설명, 무대 지문을 넣지 않습니다. 발언 내용만 출력합니다.

[현재 상황]
${
  turn === 1
    ? "학생이 모두발언을 마쳤습니다. 당신의 입장을 밝히고 학생 주장에 대한 반론을 제시하세요."
    : turn === 2
    ? "학생이 반박했습니다. 학생 주장의 타당한 부분을 인정한 뒤 재반박하세요."
    : "학생이 최종 발언을 마쳤습니다. 합의점이나 절충안을 제시하며 토론을 마무리하세요."
}
`.trim();

// ============================================================
// 토론 종료 후 피드백 프롬프트 (인재상 4축)
// ============================================================
const FEEDBACK_SYSTEM = `당신은 세움스피치의 공무원 면접 전문 코치입니다.

학생이 참여한 토론 전체 기록을 보고, 학생의 발언만을 대상으로 피드백합니다.
AI 토론 상대의 발언은 평가하지 않습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 출력 표기 절대 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━

마크다운 문법을 절대 사용하지 마세요.
별표(*), 샵(#), 백틱을 출력에 포함하지 마세요.
제목은 대괄호만 사용합니다.

[답변 보완 예시], [모범 답변] 같은 항목은 절대 출력하지 마세요.
학생을 대신해 발언문을 작성하지 마세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 토론에서 평가할 것
━━━━━━━━━━━━━━━━━━━━━━━━━━

- 본인의 입장이 명확한가
- 입장을 뒷받침하는 근거가 있는가
- 상대 주장의 타당한 부분을 인정하는가
- 반박할 때 감정이 아닌 논리와 근거를 사용하는가
- 대립을 조율할 절충안을 제시하는가
- 개인 선호보다 공익 관점에서 판단하는가

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 공무원 인재상 4대 요소
━━━━━━━━━━━━━━━━━━━━━━━━━━

① 소통·공감 — 상대 입장을 이해하고 경청하는 태도
② 헌신·열정 — 적극적으로 토론에 임하는 자세
③ 창의·혁신 — 새로운 관점이나 절충안 제시
④ 윤리·책임 — 공익 관점, 근거 있는 주장

상: 구체적 근거와 함께 분명히 드러남
중: 드러나지만 근거나 구체성이 부족함
하: 거의 드러나지 않거나 반대되는 태도가 보임

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 출력 형식
━━━━━━━━━━━━━━━━━━━━━━━━━━

[토론 요약]
학생이 어떤 입장에서 어떤 근거로 주장했는지 두 문장 이내로 정리합니다.

[인재상별 진단]
아래 4줄을 반드시 이 순서와 형식으로 작성합니다.
등급은 반드시 소괄호 안에 표기합니다.

① 소통·공감: (상) — 근거 한 줄
② 헌신·열정: (중) — 근거 한 줄
③ 창의·혁신: (중) — 근거 한 줄
④ 윤리·책임: (상) — 근거 한 줄

[잘한 점]
학생이 실제로 잘한 부분을 2개 이내로 작성합니다.

[개선 포인트]
가장 먼저 고쳐야 할 내용부터 2~3개를 작성합니다.
어떤 내용을 어떤 순서로 보완해야 하는지 설명하되,
완성된 발언문을 대신 작성하지는 않습니다.

전체 피드백은 약 400~600자 내외로 작성합니다.`;

const callOpenAI = async (system: string, user: string, maxTokens: number) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.6,
      max_tokens: maxTokens,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "OpenAI 호출 실패");
  return stripMarkdown(data.choices?.[0]?.message?.content || "");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "OPENAI_API_KEY가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const mode = body.mode || "reply";   // "reply" | "feedback"
    const topic = body.topic || "";
    const myStance = body.my_stance || "찬성";
    const aiStance = myStance === "찬성" ? "반대" : "찬성";
    const history = body.history || [];  // [{ role: 'student'|'ai', text }]
    const turn = body.turn || 1;

    if (!topic) {
      return new Response(
        JSON.stringify({ success: false, error: "topic이 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const transcript = history
      .map((h: any) => `${h.role === "student" ? "학생" : "상대 토론자"}: ${h.text}`)
      .join("\n");

    // ── 토론 상대 발언 생성
    if (mode === "reply") {
      const text = await callOpenAI(
        debateSystem(topic, myStance, aiStance, turn),
        `[지금까지의 토론]\n${transcript}\n\n위 흐름에 이어 당신의 발언을 하세요. 발언 내용만 출력하세요.`,
        400,
      );
      return new Response(
        JSON.stringify({ success: true, text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 토론 종료 후 피드백 생성
    const feedback = await callOpenAI(
      FEEDBACK_SYSTEM,
      `[토론 주제]\n${topic}\n\n[학생 입장]\n${myStance}\n\n[토론 전체 기록]\n${transcript}\n\n학생의 발언만을 대상으로 피드백을 작성하세요.`,
      1200,
    );

    return new Response(
      JSON.stringify({ success: true, feedback }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});