// supabase/functions/online-room-feedback/index.ts
// 방 실습 녹음 1건(학생 1명 차례) → 텍스트 변환 → 피드백·숙제 초안
// 호출: supabase.functions.invoke("online-room-feedback", { body: { recording_id } })
// 권한: 호출한 강사의 로그인 토큰으로 DB에 접근 → RLS(방 강사만)가 그대로 적용됨
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const TRANSCRIBE_MODEL = Deno.env.get("TRANSCRIBE_MODEL") ?? "gpt-4o-transcribe";
const FEEDBACK_MODEL = Deno.env.get("FEEDBACK_MODEL") ?? "gpt-5-mini";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const TAGS = ["speed", "filler", "pause", "volume", "tone", "structure", "time"];

const SYSTEM_PROMPT = `너는 세움스피치 온라인 단체반의 코칭 기록 도우미다.
입력은 실습 방에서 학생 한 명의 차례를 녹음한 텍스트다. 순서는 보통
① 학생 발표(3~4분) → ② 강사 피드백(3분) → ③ 학생 다시 말하기(2~3분)이다.

할 일: 강사가 실제로 말한 피드백을 학생에게 보낼 기록으로 정리한다.
- 강사가 하지 않은 지적을 새로 만들지 않는다. 녹음에 없는 내용은 비워 둔다.
- 학생에게 직접 말하듯 존댓말 1~3문장, 구체적으로 (예: "결론을 첫 문장에 두셨어요").
- good_point: 강사가 칭찬한 점 하나
- fix_point: 강사가 고치라고 한 점 하나 (가장 중요한 것)
- improved: 다시 말하기에서 실제로 나아진 점. 다시 말하기가 없으면 빈 문자열
- tags: 피드백이 다룬 항목만 골라 배열로 (${TAGS.join(", ")})
- homework: fix_point를 연습할 녹음 숙제 하나
  { "title": "짧은 제목", "instructions": "무엇을 어떻게 녹음할지 1~2문장", "target_sec": 정수 또는 null }

반드시 아래 JSON만 출력한다.
{"good_point":"","fix_point":"","improved":"","tags":[],"homework":{"title":"","instructions":"","target_sec":null}}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { recording_id } = await req.json();
    if (!recording_id) return json({ error: "recording_id가 필요해요" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "로그인이 필요해요" }, 401);

    // 1. 녹음 기록 + 방/회차 정보 (RLS: 이 방 강사만 보임)
    const { data: rec, error: recErr } = await supabase
      .from("room_recordings")
      .select("id, storage_path, student_id, room_id, practice_rooms ( session_id, online_sessions ( week_no, title ) )")
      .eq("id", recording_id)
      .single();
    if (recErr || !rec) return json({ error: "녹음을 찾을 수 없거나 권한이 없어요" }, 404);
    const sessionId = rec.practice_rooms.session_id;

    // 이미 전달된 피드백은 건드리지 않음
    const { data: existing } = await supabase
      .from("practice_feedbacks")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("student_id", rec.student_id)
      .maybeSingle();
    if (existing?.status === "sent") return json({ error: "이미 학생에게 전달된 피드백이에요" }, 409);

    await supabase.from("room_recordings").update({ status: "transcribing" }).eq("id", rec.id);

    // 2. 오디오 내려받기 → 텍스트 변환
    const { data: audio, error: dlErr } = await supabase.storage.from("room-recordings").download(rec.storage_path);
    if (dlErr || !audio) throw new Error(`녹음 파일 다운로드 실패: ${dlErr?.message}`);

    const form = new FormData();
    form.append("file", new File([audio], "turn.webm", { type: "audio/webm" }));
    form.append("model", TRANSCRIBE_MODEL);
    form.append("language", "ko");
    const sttRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (!sttRes.ok) throw new Error(`텍스트 변환 실패: ${await sttRes.text()}`);
    const transcript: string = (await sttRes.json()).text ?? "";

    await supabase.from("room_recordings").update({ transcript }).eq("id", rec.id);

    if (transcript.trim().length < 20) {
      await supabase.from("room_recordings").update({ status: "failed" }).eq("id", rec.id);
      return json({ error: "녹음에 말소리가 거의 없어요. 스피커로 줌 소리가 나오는지 확인해주세요." }, 422);
    }

    // 3. 피드백·숙제 초안
    const { data: student } = await supabase.from("profiles").select("name").eq("id", rec.student_id).single();
    const week = rec.practice_rooms.online_sessions;
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: FEEDBACK_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `학생: ${student?.name ?? ""}\n수업: ${week?.week_no ?? ""}주차 ${week?.title ?? ""}\n\n[녹음 텍스트]\n${transcript}`,
          },
        ],
      }),
    });
    if (!aiRes.ok) throw new Error(`AI 정리 실패: ${await aiRes.text()}`);
    const draft = JSON.parse((await aiRes.json()).choices[0].message.content);

    const tags = (draft.tags ?? []).filter((t: string) => TAGS.includes(t));

    // 4. 피드백 초안 저장 (강사가 화면에서 고친 뒤 확정)
    const { data: feedback, error: fbErr } = await supabase
      .from("practice_feedbacks")
      .upsert(
        {
          session_id: sessionId,
          student_id: rec.student_id,
          coach_id: user.id,
          recording_id: rec.id,
          good_point: draft.good_point ?? "",
          fix_point: draft.fix_point ?? "",
          improved: draft.improved ?? "",
          tags,
          ai_draft: { ...draft, transcript_chars: transcript.length, model: FEEDBACK_MODEL },
          status: "draft",
        },
        { onConflict: "session_id,student_id" },
      )
      .select()
      .single();
    if (fbErr) throw new Error(`피드백 저장 실패: ${fbErr.message}`);

    await supabase.from("room_recordings").update({ status: "summarized" }).eq("id", rec.id);

    return json({ feedback, homework: draft.homework ?? null });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});