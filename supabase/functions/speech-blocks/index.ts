// supabase/functions/speech-blocks/index.ts
// 스피치 훈련 — 완성 답변을 스피치 구조 블록으로 나눈다.
//
// [방식]
// AI 에게 문장을 다시 쓰게 하지 않는다. (오타를 고치거나 말을 바꿔버리기 때문)
// 서버가 먼저 문장을 자르고 번호를 붙인 뒤,
// AI 는 "몇 번 문장이 어느 블록인지"와 "가릴 핵심어"만 고른다.
// 블록 문장은 서버가 원문 그대로 이어 붙인다. → 원문이 절대 바뀌지 않는다.
//
// 받는 값
//   question          질문
//   answer            나눌 답변 (학생이 완성한 답변)
//   speech_structure  그 질문의 스피치 구조 (없으면 기본 틀)
//   tab_key           saenggibu 면 생기부 기본 틀
//
// 돌려주는 값
//   blocks: [{ label, text, keywords }]
//
// supabase functions deploy speech-blocks

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

const DEFAULT_FRAMES: Record<string, string> = {
  saenggibu: "활동 동기 + 맡은 역할과 과정 + 어려움과 해결 + 배운 점 + 전공 연결",
  default: "결론 + 이유 + 경험 + 배운 점",
};

// ── 문장 자르기 ─────────────────────────────────────────
// 학생 답변은 마침표를 빼먹는 경우가 많다. ("열심히 했다 수술실 간호사가…")
// 그래서 마침표뿐 아니라 "~다 / ~요 / ~니다" 로 끝나고 띄어 쓴 곳도 문장 끝으로 본다.
function splitSentences(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?。])\s+|(?<=(?:다|요|죠|니다|습니다|합니다))\s+(?=[가-힣A-Za-z0-9"'(])/);
  // 너무 짧은 조각(인사 한 마디 등)은 앞 문장에 붙인다
  const out: string[] = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (out.length > 0 && p.length < 6) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  // 맨 앞의 짧은 인사("안녕하세요")는 다음 문장에 붙인다
  if (out.length > 1 && out[0].length < 6) {
    out[1] = out[0] + " " + out[1];
    out.shift();
  }
  return out;
}

// ── 절 단위로 한 번 더 자르기 ────────────────────────────
// 학생은 활동 두 개를 "~있었고, ~" 처럼 한 문장에 이어 말하는 경우가 많다.
// 그대로 두면 활동 두 개가 한 블록에 묶여 따로 가릴 수 없으므로,
// "~고," "~며," "~서," "~는데," 뒤에서 자른다. 양쪽이 모두 12자 이상일 때만.
function splitClauses(sent: string): string[] {
  const pieces = sent.split(/(?<=(?:고|며|서|는데),)\s+/);
  const out: string[] = [];
  for (const p of pieces) {
    if (out.length > 0 && (p.length < 12 || out[out.length - 1].length < 12)) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

// 답변을 조각으로 — 문장으로 자르고, 긴 문장은 절로 한 번 더
const toSegments = (text: string) => splitSentences(text).flatMap(splitClauses);

// ── 핵심어 고르기 (AI 가 못 고른 블록용) ─────────────────
// 조사를 떼고 긴 낱말을 고른다. 흔한 말은 뺀다.
const STOP = new Set([
  "저는", "제가", "그래서", "그리고", "하지만", "때문에", "생각합니다", "되었습니다",
  "하였습니다", "있습니다", "싶습니다", "합니다", "입니다", "감사합니다", "안녕하세요",
]);
function pickKeywords(text: string, n = 2): string[] {
  // 동사·연결어로 끝나는 어절은 빼고, 명사 뒤 조사는 떼어 핵심 말만 남긴다
  const VERB_END = /(다|요|죠|고|며|서|면|게|지|어|아|워|해|는데|니다|습니다)$/;
  const PARTICLE = /(으로|에서|에게|까지|부터|처럼|이라|을|를|이|가|은|는|에|의|로|와|과|도|만)$/;
  const words = text
    .replace(/[.,!?"'()·]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !STOP.has(w) && !VERB_END.test(w))
    .map((w) => {
      const stem = w.replace(PARTICLE, "");
      return stem.length >= 2 ? stem : w;
    })
    .filter((w) => w.length >= 2 && text.includes(w));
  const uniq = [...new Set(words)];
  uniq.sort((a, b) => b.length - a.length);
  return uniq.slice(0, n);
}

// ── 구조 이름 짧게 ──────────────────────────────────────
// "목표 달성을 위해 본인의 역량이나 전공과 관련된 활동을 펼친 경험 2개" → 너무 길다
function shortLabel(s: string): string {
  const t = s.replace(/\(.*?\)/g, "").trim();
  return t.length <= 10 ? t : t.slice(0, 10);
}

// ── AI 없이 나누기 (마지막 안전장치) ─────────────────────
function fallback(sents: string[], labels: string[]) {
  const n = Math.max(1, Math.min(labels.length, sents.length));
  const per = Math.ceil(sents.length / n);
  const blocks = [];
  for (let i = 0; i < n; i++) {
    const text = sents.slice(i * per, (i + 1) * per).join(" ");
    if (!text) continue;
    blocks.push({ label: shortLabel(labels[i] ?? `부분 ${i + 1}`), text, keywords: pickKeywords(text) });
  }
  return blocks;
}

const SYSTEM_PROMPT = `당신은 면접 답변을 스피치 구조에 맞춰 블록으로 나누는 도우미입니다.
나눈 블록은 스피치 연습에서 하나씩 가려가며 쓰입니다.
학생은 가려진 블록을 자기 말로 풀어 말해야 하므로, 블록 하나에는 말할 거리 하나만 들어가야 합니다.

[조각 목록]에는 답변을 문장·절 단위로 잘라 번호를 붙여 두었습니다.
각 조각이 어느 블록에 속하는지 정해주세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 반드시 지킬 것
━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 모든 조각 번호를 한 번씩, 빠짐없이, 순서대로 씁니다.
2. 한 블록은 이어진 조각들로만 이뤄집니다. (예: [1,2] 다음 [3])
3. ★ 서로 다른 활동·경험은 절대 한 블록에 묶지 않습니다.
   수업이나 프로젝트, 동아리, 봉사처럼 활동 이름이 바뀌면 블록을 나눕니다.
   구조에 "경험 2개"라고 되어 있으면 경험마다 블록을 따로 만들고 "경험 1", "경험 2"로 씁니다.
   학생이 경험을 3개 말했으면 "경험 3"까지 만듭니다.
4. 직업을 갖게 된 계기(왜 이 직업을 원하게 됐는지)는 경험과 따로 "계기" 블록으로 둡니다.
5. 인사("안녕하세요")는 첫 블록에, 끝인사("감사합니다")는 마지막 블록에 붙입니다.
6. 같은 말을 되풀이하는 마무리 문장(다시 직업 목표를 말하는 것)은 마지막 목표 블록에 붙입니다.
7. label 은 2~6글자로 짧게. 예: 직업 목표, 계기, 경험 1, 경험 2, 배운 점, 전공 연결, 입학 후 목표
8. keywords 는 그 블록에서 가장 중요한 말 1~3개. 반드시 그 블록 조각 안에 글자 그대로 있는 말만.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 예시
━━━━━━━━━━━━━━━━━━━━━━━━━━

[스피치 구조]
원하는 직업/꿈 + 목표 달성을 위해 본인의 역량이나 전공과 관련된 활동을 펼친 경험 2개 + 입학 후 성취하고 싶은 점, 목표

[조각 목록]
0. 안녕하세요 저는 간호사가 되고 싶어 지원하였습니다.
1. 고3 때 유튜브를 보며 심폐소생술을 배웠고,
2. 수술실 간호사가 되기 위해 체육활동을 열심히 했다
3. 고3때 생명과학 시간에 dna 프로젝트에서 dna형성과정과 이에 따른 우리 몸에 어떤 구조로 되어 있는지 기초를 배울수 있었고,
4. 진로와직업 수업때는 간호사분들의 3교대에 대한 힘든 점과 이를 극복하기 위한 방안을 조사하여 발표한 경험이 있습니다.
5. 저는 앞으로 수술실 간호사가 되어서 많은 환자들이 응급 상황이 발생 되었을 때 간호 술기를 하여 생명을 사리는 간호사되고 싶어 지원하게 되었씁니다
6. 입학 후 역량을 쌓아 좋은 간호사가 되겠습니다. 감사합니다

[출력]
{"blocks":[
 {"label":"직업 목표","sentences":[0],"keywords":["간호사"]},
 {"label":"계기","sentences":[1,2],"keywords":["심폐소생술","체육활동"]},
 {"label":"경험 1","sentences":[3],"keywords":["생명과학","dna 프로젝트"]},
 {"label":"경험 2","sentences":[4],"keywords":["진로와직업","3교대"]},
 {"label":"입학 후 목표","sentences":[5,6],"keywords":["수술실 간호사","역량"]}
]}

설명: 3번(생명과학 DNA 프로젝트)과 4번(진로와직업 발표)은 활동이 다르므로 한 문장에서 이어졌어도 블록을 나눴습니다.
1·2번은 간호사를 꿈꾸게 된 계기라 경험과 따로 뒀습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━

JSON 만 출력합니다. 설명은 쓰지 않습니다.
형식: {"blocks":[{"label":"...","sentences":[0],"keywords":["..."]}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { question, answer, speech_structure, tab_key } = await req.json();
    const text = String(answer ?? "").trim();
    if (!text) return json({ success: false, error: "답변이 비어 있습니다." }, 400);

    const frame =
      (speech_structure && String(speech_structure).trim()) ||
      DEFAULT_FRAMES[tab_key] ||
      DEFAULT_FRAMES.default;
    const labels = frame.split("+").map((x) => x.trim()).filter(Boolean);

    const sents = toSegments(text);
    if (sents.length === 0) return json({ success: false, error: "문장을 찾지 못했습니다." }, 400);

    // 문장이 하나뿐이면 나눌 게 없다
    if (sents.length === 1) {
      return json({
        success: true,
        blocks: [{ label: shortLabel(labels[0] ?? "답변"), text: sents[0], keywords: pickKeywords(sents[0], 3) }],
      });
    }

    if (!OPENAI_API_KEY) {
      return json({ success: true, blocks: fallback(sents, labels), fallback: true });
    }

    const numbered = sents.map((s, i) => `${i}. ${s}`).join("\n");

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
            content: `[질문]\n${question ?? ""}\n\n[스피치 구조]\n${frame}\n\n[조각 목록]\n${numbered}`,
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("OpenAI 오류:", JSON.stringify(data).slice(0, 300));
      return json({ success: true, blocks: fallback(sents, labels), fallback: true });
    }

    let raw: any[] = [];
    try {
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
      raw = Array.isArray(parsed.blocks) ? parsed.blocks : [];
    } catch (_) {
      raw = [];
    }

    // ── 검증: 모든 문장을 순서대로 한 번씩 썼는지 ──
    const used = raw.flatMap((b) => (Array.isArray(b.sentences) ? b.sentences.map(Number) : []));
    const valid =
      raw.length > 0 &&
      used.length === sents.length &&
      used.every((v, i) => v === i);

    if (!valid) {
      console.warn("문장 배정이 어긋남 — 문장 단위로 대신 나눔", JSON.stringify(used));
      return json({ success: true, blocks: fallback(sents, labels), fallback: true });
    }

    // 블록 문장은 서버가 원문으로 이어 붙인다
    const blocks = raw.map((b) => {
      const btext = b.sentences.map((i: number) => sents[i]).join(" ");
      let kws = (Array.isArray(b.keywords) ? b.keywords : [])
        .map((k: unknown) => String(k ?? "").trim())
        .filter((k: string) => k.length >= 2 && btext.includes(k))
        .slice(0, 3);
      if (kws.length === 0) kws = pickKeywords(btext);   // AI 가 못 고르면 긴 낱말로
      return {
        label: shortLabel(String(b.label ?? "").trim() || "부분"),
        text: btext,
        keywords: kws,
      };
    });

    return json({ success: true, blocks });
  } catch (e) {
    console.error("speech-blocks 예외:", e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});