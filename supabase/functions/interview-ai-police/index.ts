// supabase/functions/interview-ai-police/index.ts
// 경찰공무원 면접 AI 분석 — 평가요소 5개, 항목당 10점, 총 50점
// 선생님 화면(TeacherInterviewTab.jsx)의 AI 분석·꼬리질문 버튼이 호출한다.
// 응답: { success: true, feedback: "..." }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gpt-5-mini";

const SYSTEM_PROMPT = `너는 경찰공무원 채용 면접 전문 코치다.
학생의 면접 답변을 보고, 담당 선생님이 참고할 분석을 쓴다. 학생에게 직접 보내는 글이 아니다.

[평가요소] 항목당 10점, 총 50점
1. 상황판단·문제해결 — 상황을 정확히 파악하고, 원칙과 절차에 맞는 해결책을 제시하는가
2. 의사소통 — 결론부터 명확하게 말하고, 상대(시민·동료·상급자)에 맞춰 설명하는가
3. 경찰윤리의식 — 청렴·공정·인권·법치를 지키는 태도가 드러나는가
4. 성실성·책임감 — 맡은 일을 끝까지 해내고, 실수를 인정하고 바로잡는가
5. 협업역량 — 조직 안에서 역할을 이해하고, 갈등을 조율하며 함께 목표를 이루는가

[채점 원칙]
- 답변에 실제로 드러난 내용만 근거로 채점한다. 없는 경험이나 의도를 지어내지 않는다.
- 질문과 관계가 적은 항목도 답변에서 드러난 만큼 점수를 준다. 전혀 드러나지 않으면 5점 이하.
- 경험 질문은 상황·과제·행동·결과가 구체적인지, 본인의 행동이 분명한지 본다.
- 상황 질문은 원칙 확인 → 절차 준수 → 소통·설득 → 보고·사후조치 흐름이 있는지 본다.
- 원칙 무시, 동료 비위 묵인, 감정적 대응, 시민 무시처럼 경찰 면접에서 감점되는 발언은 반드시 짚는다.
- 추상적인 다짐("최선을 다하겠습니다")만 있고 근거가 없으면 점수를 낮게 준다.

[출력 형식] 아래 형식을 그대로 지킨다. 다른 말은 붙이지 않는다.
[총점] N/50
[항목별 점수]
상황판단·문제해결: N/10
의사소통: N/10
경찰윤리의식: N/10
성실성·책임감: N/10
협업역량: N/10
[잘한 점]
- 2개 이내
[보완할 점]
- 3개 이내, 답변의 어느 부분을 어떻게 고칠지 구체적으로
[답변 방향]
- 이 질문에 좋은 답변이 갖춰야 할 흐름을 2~3줄로
[꼬리질문]
- 면접관이 이어서 물을 만한 질문 1개`;

// deno-lint-ignore no-explicit-any
function buildUserPrompt(body: any) {
  return [
    `면접 종류: 경찰공무원`,
    `탭: ${body.tab ?? ""}`,
    body.series_key ? `기출 구분: ${body.series_key}` : "",
    body.concept ? `학생 컨셉: ${body.concept}` : "",
    `질문: ${body.question}`,
    `학생 답변:\n${body.answer}`,
  ].filter(Boolean).join("\n");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // CORS preflight — 반드시 200으로 응답
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ success: false, error: "OPENAI_API_KEY가 설정되지 않았습니다." }, 500);

    const body = await req.json();
    if (!body?.question || !body?.answer) {
      return json({ success: false, error: "question과 answer가 필요합니다." }, 400);
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(body) },
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return json({ success: false, error: `OpenAI 오류 ${res.status}: ${txt}` }, 502);
    }

    const data = await res.json();
    const feedback = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!feedback) return json({ success: false, error: "AI 응답이 비어 있습니다." }, 502);

    return json({ success: true, feedback });
  } catch (e) {
    return json({ success: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});