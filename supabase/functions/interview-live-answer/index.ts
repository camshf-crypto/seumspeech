// supabase/functions/interview-live-answer/index.ts
// 현장 모의면접 — 녹음 한 번이 끝나면 한 번 호출 (비커스 mock-live-answer 에서 옮김)
//
// 녹음 한 번 안에 "본 질문 → 대답 → (선생님이 바로 한) 꼬리질문 → 대답 …" 이 다 들어 있다.
//   1) 받아 적기 — OpenAI whisper. CLOVA CSR 과 달리 60초 제한이 없다 (파일 25MB까지)
//   2) 나누기   — 문장마다 면접관/학생 + 몇 번째 문답인지 AI가 정한다
//   3) 녹음 저장 — 선생님 노트북 녹음을 simulation-recordings 버킷에 올리고 주소를 돌려준다
// 피드백은 여기서 하지 않는다. 화면이 문답마다 interview-ai-mock 을 부른다.
//
// 요청: multipart/form-data
//   audio : 선생님 노트북 녹음 파일
//   meta  : JSON 문자열
//     studentId, recId          녹음 저장 경로용
//     questionText              화면에 띄운 질문 (말로 질문했으면 빈 값)
//     voiceQuestion             본 질문을 선생님이 말로 했나
//     continuation              앞 질문에 이어 꼬리질문만 녹음했나
//     studentAudioPath          학생 핸드폰 녹음 (simulation-recordings 안 경로)
//     studentDelaySec           학생 핸드폰이 늦게 녹음을 시작한 시간 (대략)
//     studentName, concept, univ, major
//
// 필요한 설정: OPENAI_API_KEY (이미 있음)
// supabase functions deploy interview-live-answer

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const BUCKET = "simulation-recordings";

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

type Who = "interviewer" | "student";
interface Seg { start: number; end: number; text: string; src: "T" | "S" }
interface Meta {
  studentId?: string;
  recId?: string;
  questionText?: string;
  voiceQuestion?: boolean;
  continuation?: boolean;
  studentAudioPath?: string;
  studentDelaySec?: number;
  studentName?: string;
  concept?: string;
  univ?: string;
  major?: string;
}

// ─────────────────────────────────────────────
// 1) 받아 적기
// ─────────────────────────────────────────────
async function transcribe(audio: File, hint: string) {
  const fd = new FormData();
  fd.append("file", audio, audio.name || "answer.webm");
  fd.append("model", "whisper-1");
  fd.append("language", "ko");
  fd.append("response_format", "verbose_json");
  // 군말까지 보려고 머뭇거림을 지우지 말고 들리는 대로 적게 유도 (whisper는 prompt 문체를 따라감)
  fd.append("prompt", `${hint ? `면접 질문: ${hint}\n` : ""}음… 어… 저는, 그… 아 네, 그러니까 음… 들리는 대로 받아 적기.`);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`받아 적기 실패: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const segments = (data.segments ?? [])
    .map((s: any) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text ?? "").trim() }))
    .filter((s: any) => s.text);
  return { segments, duration: Math.round(Number(data.duration ?? 0)), full: String(data.text ?? "").trim() };
}

// ─────────────────────────────────────────────
// 2) 나누기 — 문장마다 누가 말했나 + 몇 번째 문답인가
// ─────────────────────────────────────────────
function splitPrompt(meta: Meta, dual: boolean) {
  return `너는 학원 모의면접 녹음을 정리하는 사람이다. 면접관(선생님)과 학생 한 명이 번갈아 말했다.
${dual ? `이번엔 마이크가 두 개다. 문장마다 [면접관 마이크] 또는 [학생 마이크]와 시작 시각(초)이 붙어 있고 시간순으로 섞여 있다.
- [면접관 마이크] 문장은 거의 면접관, [학생 마이크] 문장은 거의 학생이다. 마이크를 먼저 믿고, 내용이 확실히 다를 때만 바꾼다.
- 같은 교실이라 상대 목소리가 작게 새어 들어간다. 몇 초 안에 거의 같은 말이 두 마이크에 다 있으면, 말한 사람 쪽 마이크 문장만 남기고 다른 쪽은 who를 "drop"으로 한다.` : `말하는 사람을 구분하는 장치는 없으니 내용으로 판단한다.`}

각 문장에 두 가지를 붙인다.
1) who: "interviewer" | "student"${dual ? ' | "drop"' : ""}
   - 면접관: 질문("~나요?", "~말해 볼래요?", "~설명해 주세요", "왜 그렇게 생각해요?"), 화면에 띄운 질문과 비슷한 문장, 맞장구·진행("네", "좋아요", "그렇군요", "그럼")
   - 학생: "저는 ~", 경험·이유·생각을 설명하는 문장, 머뭇거림이 섞인 긴 문장
2) qa: 몇 번째 문답인지 (0부터)
   ${meta.continuation
      ? `- 이번 녹음은 앞 질문에 이어서 면접관이 바로 꼬리질문을 하는 장면부터 시작한다. 첫 면접관 질문이 qa 0 (= 꼬리질문)이다.`
      : `- qa 0 = 본 질문과 그 대답. 화면에 띄운 질문(또는 처음 면접관 말)이 본 질문이다. 면접관 목소리가 작아 본 질문이 안 잡혔으면 처음부터 학생 대답일 수 있다 — 그래도 qa 0.`}
   - 학생 대답 뒤에 면접관이 "새로 묻는 질문"을 하면 거기서 qa가 1 늘어난다 (꼬리질문). 그 뒤 학생 대답은 같은 qa.
   - 면접관의 맞장구·짧은 진행("네", "좋아요")은 새 질문이 아니다 — 지금 qa 그대로 둔다.
   - qa는 줄어들지 않는다.
3) questions: qa마다 면접관이 물은 질문을 한 문장으로 다듬어서 (뜻은 그대로, 받아 적기 오타만 고침)
   ${meta.continuation ? "" : `- qa 0이 화면에 띄운 질문 그대로면 그 문장을 그대로 쓴다.${meta.voiceQuestion ? " (이번 본 질문은 선생님이 말로 했다)" : ""}`}

문장 내용은 고치지 말고 번호만 보고 붙인다. 반드시 아래 json 형식으로만 답한다.
{
  "labels": [{ "who": "interviewer", "qa": 0 }],
  "questions": [{ "qa": 0, "text": "" }]
}
labels 는 문장 번호 순서대로, 문장 수와 같은 길이로 쓴다.`;
}

async function callSplit(system: string, user: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`나누기 실패: ${res.status} ${await res.text()}`);
  const data = await res.json();
  try {
    return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return {};
  }
}

// 군말(음·어·아·그·저·뭐…)을 직접 셈 — AI 짐작보다 정확
const FILLERS: [string, RegExp][] = [
  ["음", /(^|[\s,.…])음+(?=[\s,.…?!]|$)/g],
  ["어", /(^|[\s,.…])어+(?=[\s,.…?!]|$)/g],
  ["아", /(^|[\s,.…])아+(?=[\s,.…?!]|$)/g],
  ["그", /(^|[\s,.…])그+(?=[\s,.…?!]|$)/g],
  ["저", /(^|[\s,.…])저(?=[\s,.…]|$)/g],
  ["뭐", /(^|[\s,.…])뭐(?=[\s,.…]|$)/g],
  ["약간", /약간/g],
  ["그러니까", /그러니까/g],
];
function countFillers(text: string) {
  let total = 0;
  for (const [, re] of FILLERS) total += (text.match(re) ?? []).length;
  return total;
}

// whisper 한 덩어리에 "자기소개해 주세요. 네, 저는 …"처럼 질문과 대답이 붙어 오는 일이 많다.
// 문장 끝(. ? ! 。)에서 나누고, 시간은 글자 수 비율로 나눠 준다.
function splitSentences(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    const parts = s.text.split(/(?<=[.?!。？！])\s+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length <= 1) { out.push(s); continue; }
    const total = parts.reduce((a, x) => a + x.length, 0) || 1;
    let t = s.start;
    for (const x of parts) {
      const d = ((s.end - s.start) * x.length) / total;
      out.push({ start: t, end: t + d, text: x, src: s.src });
      t += d;
    }
  }
  return out;
}

// 같은 사람이 이어 말한 문장은 한 덩어리로
function merge(lines: { who: Who; text: string }[]) {
  const out: { who: Who; text: string }[] = [];
  for (const l of lines) {
    const last = out[out.length - 1];
    if (last && last.who === l.who) last.text = `${last.text} ${l.text}`.trim();
    else out.push({ ...l });
  }
  return out;
}

// 말 속도 (분당 글자, 공백 제외) — 한국어 면접은 보통 250~350
function speedLabel(charsPerMin: number | null) {
  if (!charsPerMin) return null;
  if (charsPerMin < 230) return "느림";
  if (charsPerMin > 380) return "빠름";
  return "보통";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!OPENAI_KEY) return json({ success: false, error: "OPENAI_API_KEY가 설정되지 않았어요." }, 500);

    const form = await req.formData();
    const audio = form.get("audio");
    const meta: Meta = JSON.parse(String(form.get("meta") ?? "{}"));
    if (!(audio instanceof File)) return json({ success: false, error: "녹음 파일이 없어요." }, 400);
    if (audio.size < 2000) return json({ success: false, error: "녹음이 너무 짧아요. 다시 녹음해 주세요." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── 선생님 녹음 저장 (다시 듣기용) ──
    let recordingUrl: string | null = null;
    try {
      const ext = (audio.type || audio.name).includes("mp4") ? "mp4" : "webm";
      const path = `live/${meta.studentId ?? "unknown"}/${meta.recId ?? Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage.from(BUCKET)
        .upload(path, audio, { contentType: audio.type || `audio/${ext}`, upsert: true });
      if (upErr) throw upErr;
      recordingUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } catch (e) {
      console.error("[interview-live-answer] 녹음 저장 실패 — 받아 적기는 계속", e);
    }

    // ── 1) 받아 적기 ──
    const t = await transcribe(audio, meta.questionText ?? "");
    let durationSec = t.duration;
    let segs: Seg[] = (t.segments.length ? t.segments : (t.full ? [{ start: 0, end: t.duration, text: t.full }] : []))
      .map((x: any) => ({ ...x, src: "T" as const }));

    // 학생 핸드폰 녹음이 있으면 같이 받아 적고 시간순으로 합침
    let dual = false;
    let studentRecordingUrl: string | null = null;
    if (meta.studentAudioPath) {
      try {
        const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(meta.studentAudioPath);
        if (dlErr || !blob) throw dlErr ?? new Error("학생 녹음 없음");
        studentRecordingUrl = admin.storage.from(BUCKET).getPublicUrl(meta.studentAudioPath).data.publicUrl;
        if (blob.size >= 2000) {
          const ext = meta.studentAudioPath.split(".").pop() || "webm";   // 아이폰은 mp4
          const st = await transcribe(new File([blob], `student.${ext}`, { type: blob.type || `audio/${ext}` }), meta.questionText ?? "");
          const d = Number(meta.studentDelaySec ?? 0.3);
          const sSegs: Seg[] = (st.segments.length ? st.segments : (st.full ? [{ start: 0, end: st.duration, text: st.full }] : []))
            .map((x: any) => ({ start: x.start + d, end: x.end + d, text: x.text, src: "S" as const }));
          if (sSegs.length) {
            segs = [...segs, ...sSegs].sort((a, b) => a.start - b.start);
            dual = true;
            durationSec = Math.max(durationSec, Math.round(st.duration + d));
          }
        }
      } catch (e) {
        console.error("[interview-live-answer] 학생 녹음 실패 — 선생님 녹음만 사용", e);
      }
    }
    if (!segs.length) return json({ success: false, error: "목소리가 잡히지 않았어요. 마이크를 확인해 주세요." }, 400);
    segs = splitSentences(segs);

    // ── 2) 나누기 ──
    const numbered = segs.map((s, i) =>
      dual ? `${i + 1}. [${s.src === "T" ? "면접관 마이크" : "학생 마이크"} ${s.start.toFixed(1)}초] ${s.text}` : `${i + 1}. ${s.text}`
    ).join("\n");
    const header = `학생: ${meta.studentName ?? ""}${meta.univ ? ` · 지원: ${[meta.univ, meta.major].filter(Boolean).join(" ")}` : ""}
화면에 띄운 질문: ${meta.questionText || (meta.continuation ? "(앞 질문에 이어지는 꼬리질문)" : "(선생님이 말로 질문함)")}`;
    const sp = await callSplit(splitPrompt(meta, dual), `${header}\n\n받아 적은 문장:\n${numbered}`);

    // 라벨 정리: qa는 줄어들지 않게
    const labels: any[] = Array.isArray(sp?.labels) ? sp.labels : [];
    let qaNow = 0;
    const tagged = segs.map((s, i) => {
      const l = labels[i] ?? {};
      const fallback: Who = dual ? (s.src === "T" ? "interviewer" : "student") : (i === 0 ? "interviewer" : "student");
      const drop = dual && l.who === "drop";
      const who: Who = l.who === "interviewer" ? "interviewer" : l.who === "student" ? "student" : fallback;
      const qa = Math.max(qaNow, Number.isFinite(Number(l.qa)) ? Number(l.qa) : qaNow);
      qaNow = qa;
      return { ...s, who, qa, drop };
    }).filter((x) => !x.drop);

    const qaIds = [...new Set(tagged.map((x) => x.qa))].sort((a, b) => a - b);
    const qMap: Record<number, string> = {};
    (Array.isArray(sp?.questions) ? sp.questions : []).forEach((q: any) => {
      if (Number.isFinite(Number(q?.qa))) qMap[Number(q.qa)] = String(q.text ?? "").trim();
    });

    const pairs = qaIds.map((id, idx) => {
      const mine = tagged.filter((x) => x.qa === id);
      // 마이크가 하나면 AI가 전부 면접관으로 붙일 때가 있다.
      // 학생 말이 하나도 없으면 질문으로 끝나는 첫 문장까지만 면접관, 그 뒤는 학생으로 본다.
      if (mine.length > 1 && !mine.some((x) => x.who === "student")) {
        let cut = mine.findIndex((x) => /[?？]$|(세요|까요|나요|가요|니까|볼래요|주세요|해요)[.!]?$/.test(x.text));
        if (cut < 0) cut = 0;
        mine.forEach((x, k) => { x.who = k <= cut ? "interviewer" : "student"; });
      }
      const interviewerText = mine.filter((x) => x.who === "interviewer").map((x) => x.text).join(" ").trim();
      const answer = mine.filter((x) => x.who === "student").map((x) => x.text).join(" ").trim();
      const isMain = idx === 0 && !meta.continuation;
      const question = isMain && meta.questionText && !meta.voiceQuestion
        ? meta.questionText
        : (qMap[id] || interviewerText || (isMain ? meta.questionText : "") || "(질문이 잘 안 들렸어요)");
      const studentSec = mine.filter((x) => x.who === "student").reduce((a, x) => a + Math.max(0, x.end - x.start), 0);
      const chars = answer.replace(/\s/g, "").length;
      const charsPerMin = studentSec > 5 ? Math.round((chars / studentSec) * 60) : null;
      return {
        qa: idx,
        kind: isMain ? "main" : "followup",
        question,
        answer,
        lines: merge(mine.map((x) => ({ who: x.who, text: x.text }))),
        durationSec: Math.round(studentSec) || null,
        charsPerMin,
        speedLabel: speedLabel(charsPerMin),
        fillerCount: countFillers(answer),
      };
    });

    return json({ success: true, durationSec, recordingUrl, studentRecordingUrl, pairs });
  } catch (e) {
    console.error("[interview-live-answer]", e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});