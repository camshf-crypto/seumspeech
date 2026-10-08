// send-push-fcm — notifications 테이블에 새 행이 생기면 해당 사용자 폰(앱)으로 FCM 푸시 발송
// 호출: Database Webhook (notifications INSERT) → 이 함수
// ※ 기존 send-push(브라우저 웹 푸시)와는 별개 함수
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
  try {
    // 웹훅 비밀값이 맞지 않으면 거부 (아무나 호출해서 알림 못 보내게)
    if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      console.log("❌ 비밀값 불일치 — 웹훅 헤더 또는 PUSH_WEBHOOK_SECRET 확인");
      return new Response("unauthorized", { status: 401 });
    }

    const payload = await req.json();
    const n = payload.record;
    console.log("📩 알림 수신:", payload.type, "user_id:", n?.user_id);

    if (payload.type !== "INSERT" || !n?.user_id) {
      return Response.json({ skipped: true });
    }

    if (!sa.private_key || !sa.project_id) {
      console.log("❌ FCM_SERVICE_ACCOUNT 시크릿이 비었거나 형식이 잘못됨");
      return new Response("missing service account", { status: 500 });
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

    console.log("📱 이 사용자의 토큰 수:", rows?.length ?? 0);
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

        // FCM이 거부한 이유는 항상 로그로 남김
        console.error("FCM 발송 실패:", res.status, code ?? "", JSON.stringify(err));

        // 앱 삭제 등으로 확실히 죽은 토큰만 정리 (404만으로는 지우지 않음)
        if (code === "UNREGISTERED") {
          await supabase.from("push_tokens").delete().eq("token", token);
          console.log("🗑️ 죽은 토큰 삭제");
        }
        return false;
      }),
    );

    console.log("✅ 발송 결과:", JSON.stringify(results));
    return Response.json({
      sent: results.filter(Boolean).length,
      total: rows.length,
    });
  } catch (e) {
    console.error("💥 함수 에러:", e?.message ?? e);
    return new Response("error", { status: 500 });
  }
});