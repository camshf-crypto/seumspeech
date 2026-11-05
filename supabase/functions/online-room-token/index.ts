// 온라인 수업 화상방 입장권(LiveKit 토큰) 발급
//
// 화면에서 { courseId, room } 을 보내면
//   - 로그인한 사람인지 확인
//   - 학생이면 그 온라인 수업에 수강 중(enrollments.status = 'active')인지 확인
//   - 선생님·원장은 바로 통과 (방 관리 권한 포함)
// 확인되면 LiveKit 방에 들어갈 토큰과 서버 주소를 돌려준다.
//
// 방 이름: online-{courseId}-main (전체 강의) / online-{courseId}-room1 … (실습방)
//
// 필요한 비밀값 (Supabase → Edge Functions → Secrets)
//   LIVEKIT_URL         wss://xxxx.livekit.cloud
//   LIVEKIT_API_KEY
//   LIVEKIT_API_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { courseId, room } = await req.json();
    if (!courseId) return json({ error: "수업 정보가 없습니다." }, 400);

    // 방 이름은 이 수업 것만 허용
    const roomName = String(room || "main");
    if (!/^(main|room\d{1,2})$/.test(roomName)) return json({ error: "잘못된 방입니다." }, 400);
    const fullRoom = `online-${courseId}-${roomName}`;

    // 1) 누가 요청했는지
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ error: "로그인이 필요합니다." }, 401);

    const { data: me } = await admin.from("profiles").select("id, name, role").eq("id", user.id).single();
    if (!me) return json({ error: "회원 정보를 찾을 수 없습니다." }, 403);
    const staff = me.role === "teacher" || me.role === "master";

    // 2) 학생은 수강 중인지
    if (!staff) {
      const { data: enr } = await admin
        .from("enrollments")
        .select("id")
        .eq("student_id", user.id)
        .eq("course_id", courseId)
        .eq("status", "active")
        .limit(1);
      if (!enr?.length) return json({ error: "이 온라인 수업을 수강 중이 아닙니다." }, 403);
    }

    // 3) 토큰 발급 (3시간)
    const at = new AccessToken(Deno.env.get("LIVEKIT_API_KEY")!, Deno.env.get("LIVEKIT_API_SECRET")!, {
      identity: user.id,
      // 강사·원장은 이름 뒤에 "강사"를 붙여 화면에서 구분
      name: staff ? `${me.name ?? ""} 강사`.trim() : me.name ?? "학생",
      metadata: JSON.stringify({ role: me.role }),
      ttl: "3h",
    });
    at.addGrant({
      room: fullRoom,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: staff, // 강사·원장: 음소거시키기·내보내기
    });

    return json({ token: await at.toJwt(), url: Deno.env.get("LIVEKIT_URL"), room: fullRoom, role: me.role });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});