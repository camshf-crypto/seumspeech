// supabase/functions/summarize-inquiry/index.ts
// 홈페이지 1:1 문의 대화를 AI로 요약 (독립형 - _shared 의존 없음)
// ★ 개인정보(이름/연락처/이메일)는 OpenAI로 보내지 않음 - 대화 메시지만 전송

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// OpenAI 호출 (헬퍼 내장)
async function callOpenAI(systemPrompt: string, userPrompt: string) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI 오류: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`OpenAI 응답 파싱 실패: ${content.slice(0, 200)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inquiry_id } = await req.json();
    if (!inquiry_id) {
      return new Response(JSON.stringify({ error: "inquiry_id가 필요합니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 대화 메시지만 로드 (개인정보 테이블은 안 건드림)
    const { data: msgs, error: msgErr } = await supabase
      .from("chat_inquiry_messages")
      .select("sender, content, created_at")
      .eq("inquiry_id", inquiry_id)
      .order("created_at", { ascending: true });

    if (msgErr) throw new Error("메시지 로드 실패: " + msgErr.message);
    if (!msgs || msgs.length === 0) {
      return new Response(JSON.stringify({ error: "대화 내용이 없습니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 대화를 텍스트로 (visitor=문의자, staff=상담원)
    const transcript = msgs
      .map((m) => `${m.sender === "visitor" ? "문의자" : "상담원"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `너는 스피치·면접 교육 학원의 상담 내용을 정리하는 도우미다.
홈페이지 채팅 상담 대화를 읽고, 담당 선생님이 빠르게 파악할 수 있도록 요약한다.
반드시 아래 JSON 형식으로만 응답한다. 대화에 없는 내용은 추측하지 말고 "미확인"으로 둔다.
연락처·이메일 같은 개인정보가 대화에 있어도 요약에 포함하지 않는다.
{
  "core": "문의 핵심 한두 문장",
  "interest": "관심 분야 (예: 스피치/공무원면접/발표불안 등, 없으면 미확인)",
  "points": ["상담 시 참고할 포인트 1", "포인트 2"],
  "next_action": "추천하는 다음 액션 (예: 무료 체험 안내, 특정 반 추천 등)"
}`;

    const userPrompt = `다음은 홈페이지 상담 대화입니다:\n\n${transcript}`;

    const feedback = await callOpenAI(systemPrompt, userPrompt);

    const summaryText =
      `[문의 핵심]\n${feedback.core || "-"}\n\n` +
      `[관심 분야]\n${feedback.interest || "미확인"}\n\n` +
      `[상담 포인트]\n${(feedback.points ?? []).map((p: string) => `· ${p}`).join("\n") || "-"}\n\n` +
      `[추천 다음 액션]\n${feedback.next_action || "-"}`;

    await supabase
      .from("chat_inquiries")
      .update({ summary: summaryText })
      .eq("id", inquiry_id);

    return new Response(JSON.stringify({ summary: summaryText, raw: feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});