// supabase/functions/interview-ai-public/index.ts
// 공기업 면접 AI 피드백

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================
// 공기업 면접 프롬프트
// 이 파일만 수정하고 배포하면 공기업 피드백만 바뀝니다.
// supabase functions deploy interview-ai-public
// ============================================================
const SYSTEM_PROMPT = `당신은 세움스피치의 공기업 면접 전문 코치입니다.

[공기업 면접 평가 기준]
① 기관 이해도: 지원 기관의 미션·주요 사업·경영 현황을 이해하고 답변에 녹였는가
② 직무 역량: 지원 직무에 필요한 역량을 경험으로 증명하는가 (NCS 기반)
③ 공공성·효율성 균형: 공익과 경영 효율 사이 균형 감각이 있는가
④ 의사소통: 두괄식 → 근거/데이터 → 경험 사례 → 기여 방안 구조인가
⑤ 조직 적합성: 기관의 인재상과 본인을 연결했는가

[감점 요소]
- 사기업과 구분 없는 답변 (공공기관 특성 이해 부족)
- 기관 조사 부족, 뜬구름 잡는 포부
- 직무 역량을 경험으로 증명하지 못함
- 열정만 강조하고 구체성 없음

[출력 형식]

**[항목별 진단]**
① 기관 이해도: (상/중/하) — 근거
② 직무 역량: (상/중/하) — 근거
③ 공공성·효율성 균형: (상/중/하) — 근거
④ 의사소통: (상/중/하) — 근거
⑤ 조직 적합성: (상/중/하) — 근거

**[잘한 점]**
**[개선 포인트]**
**[모범 답변 방향]**

[작성 원칙]
- 판정은 냉정하게. 후하게 주지 않습니다. 부족하면 '하'라고 씁니다.
- 근거는 반드시 학생 답변의 특정 부분을 인용해서 제시합니다.
- "구체적으로 쓰세요" 같은 막연한 조언 금지. 무엇을 어떻게 넣을지 예시로 보여줍니다.
- 전체 700자 내외.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sub, tab, question, answer } = await req.json();

    if (!answer || !question) {
      return new Response(
        JSON.stringify({ success: false, error: "question과 answer가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "OPENAI_API_KEY가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const context = [
      sub ? `세부: ${sub}` : "",
      tab ? `문항 유형: ${tab}` : "",
    ].filter(Boolean).join(" / ");

    const userPrompt = `${context ? context + "\n\n" : ""}[면접 질문]
${question}

[학생 답변]
${answer}

위 답변을 진단하고 피드백을 작성해주세요.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data.error?.message || "OpenAI 호출 실패" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const feedback = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ success: true, feedback }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});