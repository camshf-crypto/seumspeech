// supabase/functions/stt-clova/index.ts
// 네이버 CLOVA Speech (장문 인식) — webm/mp4 등 지원

const INVOKE_URL = Deno.env.get("CLOVA_SPEECH_INVOKE_URL"); // 예: https://clovaspeech-gw.ncloud.com/external/v1/xxxx/xxxxx
const SECRET = Deno.env.get("CLOVA_SPEECH_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!INVOKE_URL || !SECRET) {
      return new Response(
        JSON.stringify({ success: false, error: "CLOVA Speech 설정이 없습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const audio = await req.arrayBuffer();
    if (!audio || audio.byteLength === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "오디오 데이터가 없습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // multipart/form-data 구성
    const form = new FormData();
    const params = { language: "ko-KR", completion: "sync", format: "JSON" };
    form.append("params", JSON.stringify(params));
    form.append("media", new Blob([audio]), "audio.webm");

    const res = await fetch(`${INVOKE_URL}/recognizer/upload`, {
      method: "POST",
      headers: { "X-CLOVASPEECH-API-KEY": SECRET },
      body: form,
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data?.message || JSON.stringify(data) }),
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