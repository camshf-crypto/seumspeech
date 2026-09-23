// supabase/functions/interview-concept/index.ts
// 면접 컨셉 만들기 — "어느 회사의 어떤 직무" 5개
//
// 선생님은 회사를 넣지 않는다. 회사는 AI가 찾는다.
//   1) 활동 조합 → 세 학년 활동이 모두 쓰이는 제품·사업 찾기
//   2) 웹 검색 → 그 제품·사업을 실제로 하는 회사 찾기
//   3) 웹 검색 → 그 회사 채용 공고·채용 페이지에서 그 제품을 맡는 직무 찾기
//   진로에 회사가 적혀 있으면 1개는 거기서, 나머지는 활동만 보고 새로 찾은 회사
//   4) 공식 직업 목록(후보)에서 가장 가까운 직업 붙이기
// 찾은 회사는 company_profiles 에 쌓아둔다.
//
// 돌려주는 것:
//   { success, jobs: ["회사 · 직무", ...5개],
//     concepts: [{ kind, company, role, product, base, official, link, from, ref }], sources: [url] }
//   kind: "취업" / "창업"(진로에 CEO·창업·사업이 있을 때 1개, ref = 벤치마킹할 실제 회사)
//   from: "진로"(선생님이 적은 회사) / "활동"(AI가 활동 보고 찾은 회사)
//   jobs 는 지금 화면(이름 버튼)이 그대로 보여줄 수 있게 만든 것
//
// supabase functions deploy interview-concept

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5-mini";
// 생각을 얼마나 할지. 결과가 약하면 Supabase 비밀값 CONCEPT_EFFORT=medium 으로 올린다
const EFFORT = Deno.env.get("CONCEPT_EFFORT") || "low";
const LIMIT = 5;

// 창업(대표) 컨셉을 몇 개 넣을지
//   진로에 CEO·창업 같은 말이 있으면 2개, 창업이 흔한 학과면 1개, 아니면 AI 판단(0~1개)
//   (5개 중 창업이 2개를 넘지 않게)
const CEO_WORDS = /ceo|대표|창업|사업|스타트업|오너|사장|자영업/i;
const CEO_DEPTS = /경영|창업|앙트러프러너|경제|무역|통상|호텔|외식|조리|패션|광고|홍보|문화콘텐츠|소비자|부동산|금융|세무|회계|관광|디자인|미디어|게임/;
const startupCount = (majors: string, career: string) =>
  CEO_WORDS.test(career) ? 2 : CEO_DEPTS.test(majors) ? 1 : 0;

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

const norm = (s: string) => String(s ?? "").replace(/[\s·]/g, "");
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const arr = (v: any) => (Array.isArray(v) ? v : []);

// 진로·활동 글에서 직업 검색에 쓸 낱말 뽑기
const STOP = new Set([
  "학년", "활동", "분야", "관련", "대한", "통해", "위한", "프로젝트", "보고서",
  "발표", "탐구", "조사", "동아리", "참여", "진행", "작성", "토론", "캠페인",
  "수업", "과목", "내용", "주제", "적지", "않음", "없음", "실험", "연구",
  "만들어", "만들", "시스템", "이해", "이론", "근본적인",
]);
const keywordsOf = (text: string) => {
  const out: string[] = [];
  String(text ?? "")
    .replace(/[^가-힣A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/(을|를|이|가|은|는|의|에|에서|으로|로|과|와|하기|하는|했음|함)$/, ""))
    .filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+학년$/.test(w))
    .forEach((w) => {
      out.push(w);
      if (w.length >= 3 && /^[가-힣]+$/.test(w)) {
        const head = w.slice(0, 2);
        if (!STOP.has(head)) out.push(head);
      }
    });
  return [...new Set(out)].slice(0, 50);
};

const INSTRUCTIONS = `당신은 대입면접 코치입니다.
학생이 면접에서 내세울 "어느 회사의 어떤 직무" 5개를 찾습니다.
웹 검색을 써서 실제로 있는 회사와 실제 직무만 냅니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 순서 (반드시 이 순서로)
━━━━━━━━━━━━━━━━━━━━━━━━━━

1단계  제품·사업 찾기 (머릿속으로)
       세 학년 활동과 지원 학과가 "모두 한꺼번에 쓰이는" 제품이나 사업을 찾습니다.
       활동 하나에만 맞는 넓은 분야(반도체, 안전관리 같은)는 답이 아닙니다.
       구체적인 제품 수준까지 좁힙니다.

2단계  회사 찾기 (웹 검색)
       그 제품·사업을 실제로 하는 회사를 검색해서 찾습니다.
       한국에서 채용하는 회사(국내 기업, 외국계 한국 법인, 공공 연구기관)만.

3단계  직무 찾기 (웹 검색)
       그 회사의 채용 공고, 채용 홈페이지, 직무 소개에서
       그 제품을 맡는 직무 이름을 찾아 그대로 씁니다.
       찾지 못하면 그 회사가 쓰는 부서·사업 이름 + 연구원/개발자/엔지니어 로 적되,
       부서·사업 이름은 검색에서 확인한 것만 씁니다.

4단계  공식 직업 붙이기
       [후보 직업]에서 이 직무와 가장 가까운 직업을 한 글자도 바꾸지 않고 base 에 씁니다.
       맞는 게 없으면 한국직업사전에 있는 실제 직업 이름을 씁니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 예시 (흐름만 보세요. 회사·직무 이름은 매번 검색해서 확인)
━━━━━━━━━━━━━━━━━━━━━━━━━━

예1) 1학년 물리 · 우주선 소재 연구 / 2학년 전자전기 · 반도체 실험 / 3학년 전기 · 전기를 만들어 보내는 시스템
  1단계 → 인공위성. 우주 환경을 견디는 소재 + 우주용 반도체 부품 + 태양전지로 만든 전기를 나눠 보내는 전력계
  2단계 → 저궤도 위성을 만드는 회사 (예: 쎄트렉아이, 한화시스템)
  3단계 → 그 회사의 위성 전력계 개발 직무
  나쁜 답: 반도체공학기술자 (2학년 하나만 씀) / 우주선 전력 시스템 연구원 (회사도 없고, 업계는 "우주선"이라 하지 않음)

예2) 지원 생명과학·안전공학 / 진로 신소재 / 1학년 생명 이론 / 2학년 화학 / 3학년 산업안전
  1단계 → 산업용 호흡보호구(방진·방독 마스크). 필터 신소재 + 호흡기에 미치는 영향(생명) + 걸러낼 유해 화학물질(화학) + 산업현장 보호구 기준(안전)
  2단계 → 산업용 호흡보호구를 만드는 회사 (예: 3M)
  3단계 → 그 회사의 호흡보호구 제품개발·연구 직무
  나쁜 답: 산업현장 안전관리자 (3학년 하나만 씀, 회사 없음)

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 5개 구성
━━━━━━━━━━━━━━━━━━━━━━━━━━

[졸업 후 진로]는 참고 자료일 뿐, 답의 범위가 아닙니다.
진로에 적힌 것과 별개로, 활동만 보고 회사를 직접 찾아야 합니다.

  진로 몫   진로에 회사·분야가 적혀 있으면, 그 회사(또는 그 분야 회사) 중
            활동 흐름과 맞는 직무 최대 2개                       from: "진로"
            진로가 비었거나 활동과 전혀 안 맞으면 0개
  창업 몫   [창업 컨셉 개수]에 적힌 만큼                           kind: "창업"
  활동 몫   나머지 전부. 활동만 보고 찾은, 진로에 없는 회사        from: "활동"

순서
  앞쪽   세 학년 흐름을 가장 잘 꿰는 것 (진로 몫·창업 몫 포함)
  중간   같은 흐름의 다른 회사, 같은 제품의 다른 단계 직무(연구 → 설계 → 생산·품질 → 사업화)
  뒤쪽   흐름을 조금 넓힌 안전한 선택 (지원 학과 대표 진로 쪽)
5개는 모두 다른 회사로 합니다. 대기업만 채우지 말고 중견·강소기업, 공공기관, 연구소도 섞습니다.
[이미 나온 회사]가 있으면 그 회사는 다시 쓰지 않습니다.

★ 활동이 적힌 학년은 모든 결과에 빠짐없이 들어가야 합니다.
   예: 1학년 생명과학 · 2학년 화학 · 3학년 안전공학이면
       모든 직무가 생명·화학·안전이 다 쓰이는 일이어야 합니다.
   link 에 활동이 적힌 학년을 모두 적고, 한 학년이라도 이어지지 않으면 그 회사는 버리고 다시 찾습니다.
   지원 학과가 여러 개면(예: 생명과학, 안전공학) 두 학과가 다 살아나는 직무를 앞에 둡니다.

★ 학년마다 맡는 역할이 다릅니다. 마지막 학년이 가장 무겁습니다.
   마지막 학년(보통 3학년) = 도착점. 직무가 "매일 하는 핵심 일"이 여기서 나옵니다.
                             지원 학과와 가장 가까운 학년이기도 합니다.
   그 앞 학년들           = 기반. 그 핵심 일을 하는 데 필요한 지식·재료로 씁니다.
   예: 1학년 생명 · 2학년 화학 · 3학년 안전공학
       → 핵심 일은 "산업현장 작업자 보호"(3학년). 생명·화학은 무엇으로부터, 무엇으로 보호하는지.
       → 좋은 답: 호흡보호구 개발 (보호가 핵심, 인체·화학물질이 기반)
       → 나쁜 답: 소재화학연구원 (2학년이 핵심이 되고 3학년이 빠짐)

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 활동의 구체적인 대상을 넓히지 않기
━━━━━━━━━━━━━━━━━━━━━━━━━━

활동에 나온 구체적인 대상은 직무·제품 이름에 그대로 살립니다.
넓은 업계 이름으로 뭉개지 않습니다.
   예: "댄스 경연 동아리 리더" → 대상은 "댄서"
       좋은 답: 댄서 매니지먼트, 댄스 콘텐츠 기획
       나쁜 답: 공연기획, 문화행사기획자 (댄서가 사라짐)

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 창업 컨셉
━━━━━━━━━━━━━━━━━━━━━━━━━━

[창업 컨셉 개수]만큼 "창업" 컨셉을 냅니다.
경영·경제·무역 같은 학과는 졸업 후 직원이 아니라 "대표"가 되는 길도 진로입니다.
개수가 0이어도, 활동에 창업·동아리 대표·기획 경험이 뚜렷하면 1개 낼 수 있습니다.
   kind    : "창업"
   company : 학생이 세울 회사를 한 줄로 (예: 댄서 전문 엔터테인먼트사)
             활동의 구체적인 대상이 회사 이름에 들어가야 합니다 (댄서, 반려동물, 마스크 …)
   role    : 대표 (또는 공동창업자, CEO)
   ref     : 이 사업을 실제로 하고 있는 회사 1~2곳 (웹 검색으로 확인, 벤치마킹 대상)
   창업 2개면 서로 다른 사업 모델로 합니다 (예: 매니지먼트사 / 교육·플랫폼)
   예: 1학년 · 댄스 경연 동아리 리더 / 지원 경영학과 / 진로 CEO, 마케팅
       → {"kind":"창업","company":"댄서 전문 엔터테인먼트사","role":"대표",
          "ref":"검색으로 확인한 댄서 매니지먼트 회사", ...}
       → {"kind":"창업","company":"댄스 교육 플랫폼","role":"대표","ref":"...", ...}
나머지는 실제 회사의 직무입니다. (kind: "취업", ref 는 비움)

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 회사 이름 쓰는 법
━━━━━━━━━━━━━━━━━━━━━━━━━━

회사는 하나만, 정식 이름만 씁니다.
괄호 설명, "/"로 여러 회사 나열, "또는", "중소 ○○사" 같은 말은 쓰지 않습니다.
   나쁜 예: 롯데컬처웍스(롯데엔터테인먼트/롯데시네마), (주)스펙토리(또는 중소 문화기획사)
   좋은 예: 롯데컬처웍스

━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 출력
━━━━━━━━━━━━━━━━━━━━━━━━━━

JSON 하나만 출력합니다. 다른 문장은 쓰지 않습니다.
{"concepts":[
  {"kind":"취업 또는 창업",
   "company":"회사명 (창업이면 세울 회사)",
   "role":"직무 이름 (15자 안팎)",
   "product":"1단계에서 찾은 제품·사업",
   "base":"공식 직업",
   "from":"진로 또는 활동",
   "ref":"창업일 때만: 벤치마킹할 실제 회사",
   "link":"1학년 ○○ · 2학년 ○○ · 3학년 ○○ 이 이 직무의 어떤 일로 이어지는지 한 줄"}
]}`;

// Responses API 결과에서 글과 출처 주소 꺼내기
function readResponse(data: any) {
  let text = "";
  const urls = new Set<string>();
  for (const item of data?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const c of item?.content ?? []) {
      if (c?.type !== "output_text") continue;
      text += c.text ?? "";
      for (const a of c.annotations ?? []) {
        if (a?.type === "url_citation" && a.url) urls.add(a.url);
      }
    }
  }
  return { text, urls: [...urls].slice(0, 10) };
}

function parseJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(cleaned.slice(s, e + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { majors, career, grades, impact, exclude } = await req.json();
    // 다시 뽑기: 앞에서 이미 보여준 회사는 빼고 새로 찾는다
    const excludeList: string[] = (Array.isArray(exclude) ? exclude : [])
      .map((x: any) => str(x, 40)).filter(Boolean).slice(0, 30);
    const startupN = startupCount(String(majors ?? ""), String(career ?? ""));

    const gradeList = Array.isArray(grades) ? grades : [];
    const hasAny = String(majors ?? "").trim() || gradeList.length > 0;
    if (!hasAny) {
      return json({ success: false, error: "지원 학과나 생기부 활동이 필요합니다." }, 400);
    }
    if (!OPENAI_API_KEY) {
      return json({ success: false, error: "OPENAI_API_KEY가 설정되지 않았습니다." }, 500);
    }

    const gradeText = gradeList
      .map((g: any) => {
        const f = str(g.field, 40);
        const a = str(g.acts, 300);
        return `${g.grade}학년${f ? ` · ${f} 분야` : ""}\n   ${a || "(활동 없음)"}`;
      })
      .join("\n");

    // ── 1) 공식 직업 후보 추리기 ─────────────────────
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const kw = keywordsOf([career, gradeText, impact].join(" "));
    const { data: cand, error: candErr } = await sb.rpc("concept_candidates", {
      p_majors: String(majors ?? ""),
      p_keywords: kw,
      p_limit: 60,
    });
    if (candErr) console.error("후보 조회 오류:", candErr); // 후보 없이도 진행
    const candNames: string[] = (cand ?? []).map((c: any) => String(c.job_name));
    const candMap = new Map(candNames.map((n) => [norm(n), n]));

    // ── 2) AI: 제품 → 회사 → 직무 (웹 검색) ───────────
    const input = [
      majors ? `[지원 학과]\n${majors}` : "[지원 학과]\n적지 않음",
      career ? `[졸업 후 진로]\n${career}` : "[졸업 후 진로]\n적지 않음",
      gradeText ? `[생기부 활동]\n${gradeText}` : "",
      impact ? `[임팩트 있는 활동]\n${impact}` : "",
      `[후보 직업]\n${candNames.length ? candNames.join(", ") : "(없음)"}`,
      `[창업 컨셉 개수]\n${startupN}개${startupN === 0 ? " (활동에 창업·리더 경험이 뚜렷하면 1개까지)" : ""}`,
      excludeList.length ? `[이미 나온 회사] (다시 쓰지 말 것)\n${excludeList.join(", ")}` : "",
      "순서대로 제품 → 회사 → 직무를 찾아 5개를 JSON으로 내세요.",
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input,
        tools: [{ type: "web_search" }],
        reasoning: { effort: EFFORT },
        max_output_tokens: 14000,
      }),
    });

    const data = await res.json();
    console.log("usage:", MODEL, EFFORT, JSON.stringify(data?.usage ?? {}));
    if (!res.ok) {
      console.error("OpenAI 오류:", JSON.stringify(data).slice(0, 500));
      return json({ success: false, error: data?.error?.message || "AI 호출 실패" }, 500);
    }

    const { text, urls } = readResponse(data);
    const p = parseJson(text);
    if (!p) {
      console.error("JSON 아님:", data?.status, data?.incomplete_details, text.slice(0, 300));
      return json({ success: false, error: "AI 답을 읽지 못했습니다. 다시 눌러주세요." }, 500);
    }

    // ── 3) 코드가 다시 확인 ─────────────────────────
    type Concept = {
      company: string; role: string; product: string;
      base: string; official: boolean; link: string; from: string;
      kind: string; ref: string;
    };
    // 회사 이름 정리: 괄호 설명 빼고, "/"로 여러 개면 첫 번째만, 뭉뚱그린 이름은 버림
    const cleanCompany = (v: string) => {
      if (/또는|중소|관련 ?회사|기업들/.test(v)) return ""; // 회사를 못 정하고 얼버무린 답
      return v.replace(/\([^)]*\)/g, "").split(/[\/,]/)[0].replace(/\s*등$/, "").trim();
    };
    const concepts: Concept[] = [];
    const seen = new Set<string>();

    for (const c of arr(p.concepts)) {
      if (concepts.length >= LIMIT) break;
      const kind = str(c?.kind) === "창업" ? "창업" : "취업";
      const company = kind === "창업" ? str(c?.company, 30) : cleanCompany(str(c?.company, 60));
      const role = str(c?.role, 30);
      const ref = kind === "창업" ? str(c?.ref, 60) : "";
      if (kind === "창업" && !ref) continue; // 창업은 실제 벤치마킹 회사가 있어야 통과
      if (!company || !role) continue; // 회사·직무 둘 다 있어야 통과
      const k = norm(company);
      if (seen.has(k)) continue; // 같은 회사는 한 번만
      if (excludeList.some((x) => norm(x) === k)) continue; // 다시 뽑기에서 이미 나온 회사
      seen.add(k);
      const baseIn = str(c?.base, 40);
      const hit = candMap.get(norm(baseIn));
      concepts.push({
        company,
        role,
        product: str(c?.product, 60),
        base: hit ?? baseIn,
        official: !!hit,
        link: str(c?.link, 200),
        // 진로 글에 회사 이름이 그대로 있으면 진로, 아니면 활동에서 찾은 회사
        from: kind === "창업" || norm(String(career ?? "")).includes(norm(company)) ? "진로" : "활동",
        kind,
        ref,
      });
    }

    if (concepts.length === 0) {
      return json({ success: false, error: "회사·직무를 찾지 못했습니다. 활동을 조금 더 구체적으로 적어주세요." }, 500);
    }

    // 활동이 적힌 학년이 link 에 다 들어간 것을 앞으로 (빠진 학년 수가 적은 순)
    const filled = gradeList
      .filter((g: any) => str(g.field) || str(g.acts))
      .map((g: any) => `${g.grade}학년`);
    // 마지막 학년이 빠지면 크게 감점 (마지막 학년 = 도착점)
    const last = filled[filled.length - 1];
    const missing = (c: Concept) =>
      filled.filter((g) => !c.link.includes(g)).length +
      (last && !c.link.includes(last) ? 10 : 0);
    concepts.sort((a, b) => missing(a) - missing(b));
    concepts.forEach((c) => {
      if (missing(c) > 0) console.log("학년 빠짐:", c.company, c.role, c.link);
    });

    // ── 4) 찾은 회사 쌓아두기 (이미 있으면 그대로) ──────
    try {
      const rows = concepts.filter((c) => c.kind !== "창업").map((c) => ({
        name: c.company,
        businesses: c.product ? [{ name: c.product, desc: "" }] : [],
        roles: [{ title: c.role, business: c.product, desc: "" }],
        sources: urls,
        model: MODEL,
      }));
      await sb.from("company_profiles").upsert(rows, { onConflict: "name", ignoreDuplicates: true });
    } catch (e) {
      console.error("회사 저장 오류:", e); // 저장 실패해도 결과는 돌려준다
    }

    return json({
      success: true,
      jobs: concepts.map((c) =>
        c.kind === "창업" ? `[창업] ${c.company} ${c.role}` : `${c.company} · ${c.role}`),
      concepts,
      sources: urls,
    });
  } catch (e) {
    console.error("interview-concept 예외:", e);
    return json({ success: false, error: String((e as any)?.message || e) }, 500);
  }
});