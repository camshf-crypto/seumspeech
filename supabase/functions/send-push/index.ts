// send-push — notifications 테이블에 새 행이 생기면 해당 학생·선생님 폰으로 FCM 푸시 발송
// 호출: Database Webhook (notifications INSERT) → 이 함수
import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "npm:jose@5";

const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "{}");
const WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// 구글 발송 토큰 (1시간 유효) — 재사용해서 매번 새로 받지 않음
let cached = { token: "", exp: 0 };

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.exp - 60 > now) return cached.token;

  const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("구글 토큰 발급 실패: " + JSON.stringify(data));

  cached = { token: data.access_token, exp: now + data.expires_in };
  return cached.token;
}

Deno.serve(async (req) => {
  // 웹훅 비밀값이 맞지 않으면 거부 (아무나 호출해서 알림 못 보내게)
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const n = payload.record;
  if (payload.type !== "INSERT" || !n?.user_id) {
    return Response.json({ skipped: true });
  }

  // 받는 사람의 기기 토큰 (폰 여러 대면 전부)
  const { data: rows, error } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", n.user_id);

  if (error) {
    console.error("토큰 조회 실패:", error);
    return new Response("token query failed", { status: 500 });
  }
  if (!rows?.length) return Response.json({ sent: 0, reason: "no tokens" });

  const accessToken = await getAccessToken();
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  // data 값은 전부 문자열이어야 함
  const data = {
    url: n.link || "/",
    type: n.type ?? "",
    link_tab: n.link_tab ?? "",
    notification_id: n.id ?? "",
  };

  const results = await Promise.all(
    rows.map(async ({ token }) => {
      const res = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: n.title || "세움스피치",
              body: n.body || "",
            },
            data,
            android: {
              priority: "HIGH",
              notification: { channel_id: "default" },
            },
          },
        }),
      });

      if (res.ok) return true;

      const err = await res.json().catch(() => ({}));
      const code = err?.error?.details?.find((d: any) => d.errorCode)?.errorCode;

      // 앱 삭제 등으로 죽은 토큰은 정리
      if (res.status === 404 || code === "UNREGISTERED") {
        await supabase.from("push_tokens").delete().eq("token", token);
      } else {
        console.error("FCM 발송 실패:", res.status, JSON.stringify(err));
      }
      return false;
    }),
  );

  return Response.json({
    sent: results.filter(Boolean).length,
    total: rows.length,
  });
});