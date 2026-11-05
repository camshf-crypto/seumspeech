// supabase/functions/online-speech-analysis/index.ts
// 숙제 녹음 1건 → 텍스트 변환(단어별 시간 포함) → 말하는 방식 수치 + 내용 AI 분석
// 호출: supabase.functions.invoke("online-speech-analysis", { body: { submission_id } })
// 권한: 학생 본인 토큰으로 제출 건 확인 → 결과 저장만 service_role (학생은 분석 결과를 직접 못 씀)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const REVIEW_MODEL = Deno.env.get("FEEDBACK_MODEL") ?? "gpt-5-mini";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ── 기준값 (운영하면서 조정)
const LONG_PAUSE_SEC = 2.0; // 단어 사이 2초 넘게 비면 "긴 멈춤"
const TARGET_GRACE_SEC = 5; // 목표 시간 + 5초까지는 "시간 안에 끝냄"
// 문장 속 의미 있는 단어(그·저·이제·막)는 빼고, 거의 항상 군말인 것만 셈
const FILLERS = ["음", "으음", "흠", "어", "으", "에", "엄", "아", "그러니까", "그니까", "뭐랄까", "약간"];

// 받아쓰기 모델은 군말을 지우는 버릇이 있어서, 그대로 적으라고 힌트를 줌
const TRANSCRIBE_PROMPT = "음, 어, 그러니까, 약간… 이렇게 말한 그대로, 군말과 더듬은 말도 빼지 말고 적어주세요.";

const REVIEW_PROMPT = `너는 세움스피치 스피치 코치다. 학생의 숙제 녹음 텍스트를 보고 내용을 평가한다.
- 학생에게 직접 말하듯 존댓말, 짧고 구체적으로. 칭찬 하나 + 다음에 고칠 것 하나.
- 숙제와 지난 피드백(고칠 점)을 실제로 연습했는지도 본다.
- 녹음에 없는 내용은 지어내지 않는다.
반드시 아래 JSON만 출력한다.
{
 "summary": "학생에게 보여줄 1~2문장",
 "conclusion_first": true 또는 false,
 "structure": "구조에 대한 한 문장",
 "repetition": "반복된 말이 있으면 한 문장, 없으면 빈 문자열",
 "off_topic": "주제에서 벗어난 부분이 있으면 한 문장, 없으면 빈 문자열",
 "practiced_fix_point": true 또는 false 또는 null,
 "next_tip": "다음 연습 때 해볼 것 한 문장"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { submission_id } = await req.json();
    if (!submission_id) return json({ error: "submission_id가 필요해요" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "로그인이 필요해요" }, 401);

    // 1. 제출 건 확인 (RLS: 학생 본인 · 방 강사 · 원장만 보임)
    const { data: sub, error: subErr } = await asUser
      .from("homework_submissions")
      .select("id, student_id, storage_path, homework_id, online_homework ( title, instructions, target_sec, feedback_id )")
      .eq("id", submission_id)
      .single();
    if (subErr || !sub) return json({ error: "제출을 찾을 수 없거나 권한이 없어요" }, 404);
    const hw = sub.online_homework;

    // 2. 오디오 → 텍스트 (단어별 시작·끝 시간)
    const { data: audio, error: dlErr } = await admin.storage.from("homework-audio").download(sub.storage_path);
    if (dlErr || !audio) throw new Error(`녹음 파일 다운로드 실패: ${dlErr?.message}`);

    const form = new FormData();
    form.append("file", new File([audio], "homework.webm", { type: "audio/webm" }));
    form.append("model", "whisper-1"); // 단어별 시간은 whisper-1만 제공
    form.append("language", "ko");
    form.append("prompt", TRANSCRIBE_PROMPT);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    const sttRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (!sttRes.ok) throw new Error(`텍스트 변환 실패: ${await sttRes.text()}`);
    const stt = await sttRes.json();
    const transcript: string = stt.text ?? "";
    const words: { word: string; start: number; end: number }[] = stt.words ?? [];

    // 3. 말하는 방식 수치
    const clean = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, "");
    const speechStart = words[0]?.start ?? 0;
    const speechEnd = words.at(-1)?.end ?? stt.duration ?? 0;
    const speakingSec = Math.max(speechEnd - speechStart, 1);

    const syllables = (transcript.match(/[가-힣]/g) ?? []).length;
    const syllablesPerMin = Math.round((syllables / speakingSec) * 60);

    const fillerWords: Record<string, number> = {};
    for (const w of words) {
      const t = clean(w.word);
      if (FILLERS.includes(t)) fillerWords[t] = (fillerWords[t] ?? 0) + 1;
    }
    const fillerCount = Object.values(fillerWords).reduce((a, b) => a + b, 0);

    let longPauses = 0;
    for (let i = 1; i < words.length; i++) {
      if (words[i].start - words[i - 1].end > LONG_PAUSE_SEC) longPauses++;
    }

    const durationSec = Math.round(stt.duration ?? speechEnd);
    const withinTarget = hw?.target_sec ? durationSec <= hw.target_sec + TARGET_GRACE_SEC : null;

    // 4. 내용 분석 (숙제 + 지난 피드백의 고칠 점 기준)
    let review: Record<string, unknown> = {};
    if (transcript.trim().length >= 20) {
      let fixPoint = "";
      if (hw?.feedback_id) {
        const { data: fb } = await admin.from("practice_feedbacks").select("fix_point").eq("id", hw.feedback_id).single();
        fixPoint = fb?.fix_point ?? "";
      }
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: REVIEW_MODEL,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: REVIEW_PROMPT },
            {
              role: "user",
              content:
                `[숙제] ${hw?.title ?? ""}\n${hw?.instructions ?? ""}\n` +
                `[지난 피드백 · 고칠 점] ${fixPoint || "없음"}\n` +
                `[측정값] 말 속도 분당 ${syllablesPerMin}음절, 군말 ${fillerCount}회, 긴 멈춤 ${longPauses}회, ${durationSec}초` +
                (hw?.target_sec ? ` (목표 ${hw.target_sec}초)` : "") +
                `\n\n[녹음 텍스트]\n${transcript}`,
            },
          ],
        }),
      });
      if (aiRes.ok) {
        review = JSON.parse((await aiRes.json()).choices[0].message.content);
      } else {
        console.error("내용 분석 실패", await aiRes.text()); // 수치 분석은 그대로 저장
      }
    } else {
      review = { summary: "녹음에 말소리가 거의 없어요. 마이크 가까이에서 다시 녹음해 주세요." };
    }

    // 5. 저장 (제출 1건당 1건, 다시 분석하면 덮어씀)
    const row = {
      submission_id: sub.id,
      student_id: sub.student_id,
      syllables_per_min: syllablesPerMin,
      filler_count: fillerCount,
      filler_words: fillerWords,
      long_pause_count: longPauses,
      volume_db_avg: null, // 2단계: 목소리 크기
      pitch_variation: null, // 2단계: 억양 변화
      duration_sec: durationSec,
      within_target: withinTarget,
      transcript,
      content_review: review,
    };
    const { data: saved, error: saveErr } = await admin
      .from("speech_analyses")
      .upsert(row, { onConflict: "submission_id" })
      .select()
      .single();
    if (saveErr) throw new Error(`분석 저장 실패: ${saveErr.message}`);

    return json({ analysis: saved });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});