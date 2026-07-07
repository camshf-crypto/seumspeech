import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // blocks: [{ category, source_text }]
    const { enrollment_id, blocks, title } = await req.json();
    if (!enrollment_id || !Array.isArray(blocks) || blocks.length === 0) {
      return new Response(JSON.stringify({ error: "enrollment_id와 카테고리 블록이 필요합니다." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: enr, error: enrErr } = await supabase
      .from("enrollments")
      .select("*, profiles:student_id(name), courses(title)")
      .eq("id", enrollment_id)
      .single();
    if (enrErr || !enr) {
      return new Response(JSON.stringify({ error: "수강 정보를 찾을 수 없습니다." }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const studentInfo = [
      `이름: ${enr.profiles?.name ?? "학생"}`,
      `면접유형: ${enr.courses?.title ?? ""}`,
      enr.company ? `지원기관/회사: ${enr.company}` : "",
      enr.exam_type ? `시험종류: ${enr.exam_type}` : "",
      enr.job_role ? `직무/직렬: ${enr.job_role}` : "",
      enr.career_level ? `구분: ${enr.career_level}` : "",
    ].filter(Boolean).join("\n");

    const blocksText = blocks.map((b: any, i: number) =>
      `[카테고리 ${i + 1}: ${b.category}]\n${b.source_text}`
    ).join("\n\n");

    const prompt = `너는 면접 코칭 학원 '세움스피치'의 면접 대비 자료를 만드는 전문가다. 아래 학생 정보와 카테고리별 기출/예상 면접 질문을 받아, 학생용·강사용 통합 자료 데이터를 만든다.

[학생 정보]
${studentInfo}

[카테고리별 질문]
${blocksText}

규칙:
1. 각 카테고리에 들어온 모든 질문을 빠짐없이 처리한다. 개수를 임의로 줄이거나 늘리지 않는다. 카테고리는 입력된 그대로 유지한다(새 카테고리를 만들지 마라).
2. 각 질문을 지원 기관/회사·직무에 맞게 자연스럽게 다듬는다.
3. 각 질문에 category(입력된 카테고리명 그대로), prep_point(준비 포인트 1~2문장), keywords(필수 키워드 4~6개 쉼표구분)를 부여한다.
4. 상단 공통 자료를 만든다. 직무기술서가 없으면 지원 기관/직무 특성으로 합리적으로 채운다:
   - prep_scope: 핵심 준비 범위 표. [{구분, 준비내용, 핵심목표}] 4~6개
   - answer_structure: 답변 기본 구조 표. [{질문유형, 추천답변구조}] 4~6개. 추천답변구조는 실제 답변 단계를 화살표로 연결해 작성한다(예: "결론 제시 → 근거 설명 → 경험 사례 → 마무리"). A·B·C나 1·2·3 같은 임시 표시는 절대 쓰지 말고, 질문 유형에 맞는 구체적인 단계명을 쓴다.
   - guide_standards: (강사용) 핵심 지도 기준. [{기준, 포인트}] 4~6개
   - correction_formulas: (강사용) 답변 교정 공식. [{유형, 공식}] 4~6개

반드시 아래 JSON 형식으로만 출력한다. 다른 말 금지.
{
  "overview": {
    "prep_scope": [{"구분":"...","준비내용":"...","핵심목표":"..."}],
    "answer_structure": [{"질문유형":"자기소개","추천답변구조":"핵심 강점 제시 → 근거 경험 → 직무 연결 → 포부"}],
    "guide_standards": [{"기준":"...","포인트":"..."}],
    "correction_formulas": [{"유형":"...","공식":"..."}]
  },
  "questions": [
    {"seq":1,"category":"...","question":"...","prep_point":"...","keywords":"..."}
  ]
}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI 호출 실패: " + errText }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    let parsed;
    try {
      parsed = JSON.parse(aiData.choices[0].message.content);
    } catch {
      return new Response(JSON.stringify({ error: "AI 응답 파싱 실패" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const questions = parsed.questions ?? [];
    const overview = parsed.overview ?? {};

    const { data: set, error: setErr } = await supabase
      .from("interview_question_sets")
      .insert({
        student_id: enr.student_id,
        enrollment_id: enr.id,
        teacher_id: enr.teacher_id,
        source_text: blocksText,
        title: title || "모의면접",
        teacher_overview: overview,
        status: "sent",
      })
      .select()
      .single();
    if (setErr) {
      return new Response(JSON.stringify({ error: "세트 저장 실패: " + setErr.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const rows = questions.map((q: any, i: number) => ({
      set_id: set.id,
      seq: q.seq ?? i + 1,
      category: q.category ?? "",
      question: q.question ?? "",
      prep_point: q.prep_point ?? "",
      keywords: q.keywords ?? "",
    }));
    const { error: qErr } = await supabase.from("interview_questions").insert(rows);
    if (qErr) {
      return new Response(JSON.stringify({ error: "질문 저장 실패: " + qErr.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, set_id: set.id, count: rows.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});