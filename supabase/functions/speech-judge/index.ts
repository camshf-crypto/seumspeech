// supabase/functions/speech-judge/index.ts
// 스피치 연습 판정
//
// 학생이 말한 내용(음성 → 글)이 완성 답변의 블록을 얼마나 살려냈는지 본다.
// 원문과 글자가 같은지가 아니라, 블록마다 핵심 뜻을 자기 말로 말했는지를 본다.
//
// 받는 값
//   question      질문
//   blocks        [{ label, text, keywords }]  완성 답변을 나눈 블록
//   hidden        [1, 2]  이번에 가렸던 블록 번호
//   level         1~5
//   transcript    학생이 말한 내용 (음성 인식 결과)
//   duration_sec  말한 시간
//
// 돌려주는 값
//   retention        내용 유지율 0~100 (서버가 계산 — AI 에게 숫자를 맡기지 않는다)
//   result           [{ label, status: ok|partial|miss, note }]
//   missions         다음에 고칠 것 1~2개
//   first_point_sec  첫 핵심 내용이 나오기까지 걸린 시간 (대략)
//
// supabase functions deploy speech-judge

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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

// 판정 점수
const SCORE: Record<string, number> = { ok: 1, partial: 0.5, miss: 0 };

// 단계별로 무엇을 더 중요하게 보는지
// 1~3단계는 가린 블록이 연습 대상이므로 두 배로 친다. (보이는 문장만 읽고 통과하지 않게)
// 4·5단계는 전부 가렸으므로 모든 블록이 같다.
const weightOf = (level: number, i: number, hidden: number[]) =>
  level <= 3 && hidden.includes(i) ? 2 : 1;

const SYSTEM_PROMPT = `당신은 세움스피치의 면접 스피치 코치입니다.

학생은 이미 완성한 면접 답변을 가지고 있고,
그 답변을 보지 않고 말로 다시 말하는 연습을 했습니다.
[답변 블록]은 학생이 완성한 답변을 구조대로 나눈 것이고,
[학생이 말한 내용]은 학생의 말을 음성 인식으로 옮긴 것입니다.

블록마다 학생이 그 내용을 말로 살려냈는지 판정하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 판정 기준
━━━━━━━━━━━━━━━━━━━━━━━━━━

글자가 같은지 보지 않습니다. 뜻이 살아 있는지 봅니다.
학생이 자기 말로 바꿔 말한 것은 잘한 것입니다.

★ [학생이 말한 내용]에 실제로 들어 있는 것만 인정합니다.
   [답변 블록]에 적힌 내용을 보고 "말했을 것"이라고 짐작하지 않습니다.
   학생이 짧게 말했다면 말하지 않은 블록은 모두 miss 입니다.

ok       그 블록의 핵심 뜻과 중요한 사실(경험, 활동 이름, 목표 등)이 들어 있음
partial  말하긴 했지만 흐릿함. 핵심 사실이 빠졌거나 두루뭉술하게 넘어감
miss     그 블록의 내용이 없음

- [핵심어]는 그 블록에서 특히 중요한 말입니다. 같은 뜻을 다른 말로 했으면 인정합니다.
- 음성 인식 결과라 받아쓰기 오류가 있을 수 있습니다. 소리가 비슷한 틀린 글자는 맞은 것으로 봅니다.
- 순서가 바뀌었어도 내용이 있으면 판정은 ok 또는 partial 입니다. 순서 문제는 미션에서 짚습니다.
- 인사("안녕하세요", "감사합니다")가 빠진 것은 문제 삼지 않습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ note (블록별 한 줄)
━━━━━━━━━━━━━━━━━━━━━━━━━━

- ok      무엇을 잘 살렸는지 짧게. 예: "심폐소생술 경험을 분명히 말함"
- partial 무엇이 빠졌는지. 예: "체육활동을 한 이유가 빠짐"
- miss    예: "입학 후 목표를 말하지 않음"
- 20자 안팎으로 짧게 씁니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ missions (다음에 고칠 것)
━━━━━━━━━━━━━━━━━━━━━━━━━━

- 딱 1~2개만 씁니다. 가장 효과가 큰 것부터.
- 바로 따라 할 수 있게 구체적으로 씁니다.
  좋은 예: "첫 문장에서 '수술실 간호사가 되고 싶다'를 먼저 말하기"
  좋은 예: "마지막에 입학 후 하고 싶은 일을 한 문장 넣기"
  나쁜 예: "더 자신감 있게", "구체적으로 말하기"
- 학생 대신 답변 문장을 통째로 써주지 않습니다.
- 모든 블록이 ok 이면 전달력(결론 먼저, 문장 짧게 끊기, 군더더기 줄이기) 쪽 미션을 1개 줍니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ first_point
━━━━━━━━━━━━━━━━━━━━━━━━━━

학생이 말한 내용에서 질문에 대한 핵심 답(결론, 목표, 이유의 첫 등장)이 시작되는 부분을
[학생이 말한 내용] 안에서 글자 그대로 10자 안팎 잘라 적습니다.
찾을 수 없으면 빈 문자열.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 출력
━━━━━━━━━━━━━━━━━━━━━━━━━━

JSON 만 출력합니다.
result 에는 [답변 블록]의 모든 블록을 하나씩 씁니다. 각 항목의 i 는 블록 번호, label 은 블록 이름 그대로입니다.
note 는 반드시 그 블록(i)의 내용에 대해서만 씁니다. 다른 블록의 내용을 적지 않습니다.
{"result":[{"i":0,"label":"직업 목표","status":"ok","note":"..."},{"i":1,"label":"계기","status":"miss","note":"..."}],"missions":["..."],"first_point":"..."}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { question, blocks, hidden, level, transcript, duration_sec } = await req.json();

    const said = String(transcript ?? "").trim();
    const list: any[] = Array.isArray(blocks) ? blocks : [];
    const hid: number[] = Array.isArray(hidden) ? hidden.map(Number) : [];
    const lv = Number(level) || 1;

    if (list.length === 0) return json({ success: false, error: "블록이 없습니다." }, 400);
    if (!said) return json({ success: false, error: "말한 내용이 없습니다." }, 400);
    if (!OPENAI_API_KEY) return json({ success: false, error: "OPENAI_API_KEY가 설정되지 않았습니다." }, 500);

    const blockText = list
      .map((b, i) => {
        const tag = hid.includes(i) ? " (이번에 가렸던 블록)" : "";
        const kws = (b.keywords ?? []).length ? `\n   핵심어: ${(b.keywords ?? []).join(", ")}` : "";
        return `${i}. [${b.label}]${tag}\n   ${b.text}${kws}`;
      })
      .join("\n");

    const levelNote =
      lv === 1 ? "1단계: 블록 하나를 통째로 가렸습니다. 가렸던 블록을 특히 꼼꼼히 보세요."
      : lv === 2 ? "2단계: 블록 둘을 통째로 가렸습니다. 가렸던 블록을 특히 꼼꼼히 보세요."
      : lv === 3 ? "3단계: 첫 블록만 보여주고 나머지는 모두 가렸습니다."
      : lv === 4 ? "4단계: 문장은 다 가리고 블록 이름만 보여줬습니다."
      : "5단계: 질문만 보여줬습니다. 실전과 같습니다.";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `[질문]\n${question ?? ""}\n\n[연습 단계]\n${levelNote}\n\n` +
              `[답변 블록]\n${blockText}\n\n[학생이 말한 내용]\n${said}`,
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("OpenAI 오류:", JSON.stringify(data).slice(0, 300));
      return json({ success: false, error: data?.error?.message || "AI 호출 실패" }, 500);
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    } catch (_) {
      parsed = {};
    }

    // ── 블록 판정 — 순서가 아니라 블록 번호(i)로 맞춘다 ──
    // 번호가 없으면 이름(label)으로, 그것도 없으면 순서로 찾는다. 못 찾으면 miss.
    const raw: any[] = Array.isArray(parsed.result) ? parsed.result : [];
    const byIndex: Record<number, any> = {};
    const byLabel: Record<string, any> = {};
    raw.forEach((r) => {
      const n = Number(r?.i);
      if (Number.isInteger(n) && n >= 0 && n < list.length && !byIndex[n]) byIndex[n] = r;
      if (r?.label && !byLabel[String(r.label).trim()]) byLabel[String(r.label).trim()] = r;
    });
    const result = list.map((b, i) => {
      const r = byIndex[i] ?? byLabel[String(b.label).trim()] ?? (raw.length === list.length ? raw[i] : null) ?? {};
      const status = ["ok", "partial", "miss"].includes(r.status) ? r.status : "miss";
      return {
        label: b.label,
        status,
        note: String(r.note ?? "").trim() || (status === "miss" ? "말하지 않음" : ""),
        hidden: hid.includes(i),
      };
    });

    // ── 안전장치 — 말한 분량이 답변의 20%도 안 되면, 그 분량으로 채울 수 있는 블록 수까지만 인정한다 ──
    const answerLen = list.reduce((n, b) => n + String(b.text ?? "").length, 0);
    if (answerLen > 0 && said.length < answerLen * 0.2) {
      const canCover = Math.max(1, Math.round((said.length / answerLen) * list.length));
      let kept = 0;
      result.forEach((r) => {
        if (r.status === "miss") return;
        if (kept < canCover) { kept += 1; return; }
        r.status = "miss";
        r.note = "말한 분량이 짧아 확인되지 않음";
      });
    }

    // ── 유지율 — 서버가 계산한다 ──
    let got = 0;
    let total = 0;
    result.forEach((r, i) => {
      const w = weightOf(lv, i, hid);
      got += SCORE[r.status] * w;
      total += w;
    });
    const retention = total > 0 ? Math.round((got / total) * 100) : 0;

    // ── 미션 ──
    const missions = (Array.isArray(parsed.missions) ? parsed.missions : [])
      .map((m: unknown) => String(m ?? "").trim())
      .filter(Boolean)
      .slice(0, 2);

    // ── 첫 핵심까지 걸린 시간 — 글자 위치로 대략 계산 ──
    let first_point_sec: number | null = null;
    const fp = String(parsed.first_point ?? "").trim();
    const dur = Number(duration_sec) || 0;
    if (fp && dur > 0) {
      const pos = said.indexOf(fp);
      if (pos >= 0) first_point_sec = Math.round((pos / Math.max(1, said.length)) * dur);
    }

    return json({ success: true, retention, result, missions, first_point_sec });
  } catch (e) {
    console.error("speech-judge 예외:", e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});