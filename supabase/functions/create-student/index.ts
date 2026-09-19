// 가입 신청서 하나로 학생 계정까지 만드는 함수
// - 로그인 없이 호출됨 (공개)
// - 초기 비밀번호: seum + 전화번호 뒷 4자리 (예: seum5678)
// - 첫 로그인 시 비밀번호 변경 강제 (profiles.must_change_password = true)
// - 원장 승인 단계 없이 바로 활성화

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const form = await req.json();

    const name = (form.name ?? "").trim();
    const email = (form.email ?? "").trim().toLowerCase();
    const phone = (form.phone ?? "").trim();
    const branchId = form.branch_id ?? null;

    if (!name) return json({ error: "성명을 입력하세요." }, 400);
    if (!email) return json({ error: "이메일을 입력하세요." }, 400);
    if (!phone) return json({ error: "전화번호를 입력하세요." }, 400);
    if (!branchId) return json({ error: "희망 지점을 선택하세요." }, 400);
    if (!form.privacy_agree || !form.terms_agree)
      return json({ error: "약관에 동의해야 신청할 수 있습니다." }, 400);

    // 전화번호에서 숫자만 남기고 뒷 4자리를 뽑는다
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return json({ error: "전화번호를 정확히 입력하세요." }, 400);
    const initialPassword = "seum" + digits.slice(-4);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) 계정 생성 (이메일 확인 절차 없이 바로 사용 가능)
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authErr) {
      // 이미 가입된 이메일인 경우를 구분해서 알려준다
      const msg = String(authErr.message ?? "");
      if (msg.includes("already") || msg.includes("registered")) {
        return json({ error: "이미 등록된 이메일입니다. 학원으로 문의해주세요." }, 409);
      }
      return json({ error: "계정 생성 실패: " + msg }, 400);
    }

    const userId = created.user.id;

    // 2) profiles 등록
    //    트리거로 행이 미리 만들어져 있을 수 있어 upsert 로 처리
    const { error: profErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        name,
        phone,
        email,
        role: "student",
        status: "approved",        // 승인 대기 없이 바로 활성화 (학생 화면이 이 값을 확인함)
        branch_id: branchId,
        must_change_password: true, // 첫 로그인 시 변경 강제
      },
      { onConflict: "id" }
    );

    if (profErr) {
      // 계정만 남고 프로필이 없으면 반쪽짜리가 되므로 계정을 되돌린다
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "프로필 저장 실패: " + profErr.message }, 400);
    }

    // 3) 신청서 기록 (승인 완료 상태로 남김 — 상담 이력 조회용)
    const { error: reqErr } = await admin.from("enrollment_requests").insert({
      student_id: userId,
      name,
      gender: form.gender ?? null,
      phone,
      birth: form.birth ?? null,
      email,
      address: form.address ?? null,
      branch_id: branchId,
      lesson_type: form.lesson_type ?? null,
      lesson_detail: form.lesson_detail ?? null,
      visit_path: form.visit_path ?? null,
      privacy_agree: true,
      terms_agree: true,
      status: "approved",
      reviewed_at: new Date().toISOString(),
    });

    if (reqErr) {
      // 계정과 프로필은 이미 만들어졌으므로 되돌리지 않고 로그만 남긴다
      console.error("enrollment_requests insert 실패:", reqErr);
    }

    return json({
      ok: true,
      user_id: userId,
      email,
      initial_password: initialPassword, // 화면에서 안내용으로 보여줌
    });
  } catch (e) {
    console.error(e);
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});