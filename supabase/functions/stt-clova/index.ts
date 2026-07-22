// supabase/functions/stt-clova/index.ts
// 네이버 CLOVA Speech Recognition (CSR) — 단문 음성 인식

const CLOVA_ID = Deno.env.get("CLOVA_CSR_ID");
const CLOVA_SECRET = Deno.env.get("CLOVA_CSR_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLOVA_ID || !CLOVA_SECRET) {
      return new Response(
        JSON.stringify({ success: false, error: "CLOVA 키가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 오디오 바이너리를 그대로 받음
    const audio = await req.arrayBuffer();
    if (!audio || audio.byteLength === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "오디오 데이터가 없습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(
      "https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=Kor",
      {
        method: "POST",
        headers: {
          "X-NCP-APIGW-API-KEY-ID": CLOVA_ID,
          "X-NCP-APIGW-API-KEY": CLOVA_SECRET,
          "Content-Type": "application/octet-stream",
        },
        body: audio,
      },
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data?.errorMessage || "CLOVA 호출 실패" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, text: data.text ?? "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});