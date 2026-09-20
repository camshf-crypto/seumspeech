// supabase/functions/stt-clova/index.ts
// 네이버 CLOVA Speech Recognition (CSR) — 단문 음성 인식
//
// 이 계정에 있는 상품은 CSR 이다. (장문용 CLOVA Speech 아님)
// CSR 은 한 번에 60초까지만 받는다. 답변 타이머도 60초에 맞춰져 있다.
//
// 필요한 설정 (네이버 클라우드 콘솔 > AI·NAVER API > Application > 인증 정보)
//   CLOVA_CSR_ID      X-NCP-APIGW-API-KEY-ID
//   CLOVA_CSR_SECRET  X-NCP-APIGW-API-KEY
//
// supabase secrets set CLOVA_CSR_ID="..."
// supabase secrets set CLOVA_CSR_SECRET="..."
// supabase functions deploy stt-clova

const CLOVA_ID = Deno.env.get("CLOVA_CSR_ID");
const CLOVA_SECRET = Deno.env.get("CLOVA_CSR_SECRET");

const CSR_URL = "https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=Kor";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLOVA_ID || !CLOVA_SECRET) {
      const missing = [
        !CLOVA_ID ? "CLOVA_CSR_ID" : null,
        !CLOVA_SECRET ? "CLOVA_CSR_SECRET" : null,
      ].filter(Boolean).join(", ");
      console.error("설정 누락:", missing);
      return json(
        { success: false, error: `CSR 설정이 없습니다. (${missing})` },
        500,
      );
    }

    const audio = await req.arrayBuffer();
    if (!audio || audio.byteLength === 0) {
      return json({ success: false, error: "오디오 데이터가 없습니다." }, 400);
    }

    // CSR 은 음성 바이트를 그대로 본문에 담아 보낸다.
    // Content-Type 은 application/octet-stream 고정.
    const res = await fetch(CSR_URL, {
      method: "POST",
      headers: {
        "X-NCP-APIGW-API-KEY-ID": CLOVA_ID,
        "X-NCP-APIGW-API-KEY": CLOVA_SECRET,
        "Content-Type": "application/octet-stream",
      },
      body: audio,
    });

    const raw = await res.text();
    let data: any = null;
    try { data = JSON.parse(raw); } catch (_) { /* 아래에서 원문을 쓴다 */ }

    if (!res.ok) {
      // 네이버가 돌려준 이유를 그대로 남긴다. 추측하지 않는다.
      console.error("CSR 오류", res.status, raw.slice(0, 500));
      const reason =
        data?.errorMessage ??
        data?.error?.message ??
        data?.message ??
        raw.slice(0, 200);
      return json(
        { success: false, error: `CSR ${res.status}: ${reason}` },
        500,
      );
    }

    const text = (data?.text ?? "").trim();
    if (!text) {
      console.error("CSR 응답에 텍스트 없음:", raw.slice(0, 300));
      return json({
        success: false,
        error: "음성에서 말을 찾지 못했습니다. (녹음이 너무 짧거나 소리가 작습니다)",
      }, 500);
    }

    return json({ success: true, text });
  } catch (e) {
    console.error("STT 예외:", e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});