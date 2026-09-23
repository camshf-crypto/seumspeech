// supabase/functions/aiwork-feedback/index.ts
//
// 1~5단계 주관식 제출 직후, 학생이 AI와 나눈 대화를 과제 체크리스트에 비춰
// 항목별로 충족 여부를 판단해 aiwork_sessions.ai_feedback에 저장한다.
//
// 요청:  POST { session_id }
// 응답:  { items: [{ text, met, comment }], summary, next_tip }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODEL = 'gpt-4o-mini';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// 단계별로 보는 능력 — src/lib/aiworkConfig.js의 단계와 같은 순서
const STAGE_SKILL: Record<number, string> = {
  1: '문제 정의 — 해결책부터 묻지 않고, 현상·원인 후보·확인할 자료로 문제를 나눠 요청하는가',
  2: '맥락 설계 — 역할·배경·조건·출력 형식과 자기 자료를 요청에 담는가',
  3: 'AI 탐색 — 첫 답에서 멈추지 않고 되묻고, 반박시키고, 대안을 요구하는가',
  4: '검증·수정 — AI가 낸 수치·근거를 자료와 대조해 틀린 것을 걸러내는가',
  5: '인간의 판단 — AI 제안을 그대로 받지 않고 근거를 들어 고르고 버리는가',
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + ' …(생략)' : s);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { session_id } = await req.json();
    if (!session_id) return json({ error: 'bad_request' }, 400);

    const admin = createClient(url, serviceKey);

    const { data: session, error: sErr } = await admin
      .from('aiwork_sessions')
      .select('id, student_id, submitted_at, answer, ai_feedback, task:aiwork_tasks(*)')
      .eq('id', session_id)
      .single();

    if (sErr || !session) return json({ error: 'not_found' }, 404);
    if (session.student_id !== user.id) return json({ error: 'forbidden' }, 403);
    if (!session.submitted_at) return json({ error: 'not_submitted' }, 409);

    const task = session.task;
    if (task.kind !== 'written' || task.stage < 1 || task.stage > 5) {
      return json({ error: 'not_training_task' }, 400);
    }

    // 이미 받은 피드백이 있으면 다시 만들지 않는다 (비용 중복 방지)
    if (session.ai_feedback) return json(session.ai_feedback);

    const { data: msgs } = await admin
      .from('aiwork_messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('id', { ascending: true });

    const checklist: string[] = Array.isArray(task.checklist) ? task.checklist : [];
    const transcript = (msgs ?? [])
      .map((m, i) =>
        m.role === 'user'
          ? `[${i + 1}] 학생: ${m.content}`
          : `[${i + 1}] AI: ${clip(m.content, 800)}`
      )
      .join('\n\n');

    const system = [
      '당신은 AI 활용 수업의 피드백 도우미입니다.',
      '학생이 업무 과제를 수행하며 AI와 나눈 대화와 최종 답안을 함께 읽고, 체크리스트 항목마다 충족했는지 판단합니다.',
      '판단은 학생이 실제로 쓴 문장(대화의 학생 발화와 답안)에만 근거하세요. AI가 쓴 문장은 학생의 성과로 보지 마세요.',
      '근거가 된 학생 문장을 짧게 인용하세요.',
      '말투는 학생에게 직접 말하듯 부드럽고 구체적으로. 칭찬 한 가지, 고칠 점 한 가지를 분명히.',
      '반드시 아래 JSON 형식만 출력하세요.',
      '{"items":[{"text":"체크리스트 문장 그대로","met":true,"comment":"한두 문장"}],',
      ' "summary":"전체 한두 문장","next_tip":"다음 연습에서 바로 해볼 한 가지"}',
      'items는 체크리스트와 같은 순서, 같은 개수여야 합니다.',
    ].join('\n');

    const userMsg = [
      `## 이번 단계\n${STAGE_SKILL[task.stage]}`,
      `## 과제: ${task.title}`,
      task.background ? `### 배경 (사실 자료)\n${clip(task.background, 1500)}` : '',
      task.problem ? `### 문제\n${task.problem}` : '',
      Array.isArray(task.requirements) && task.requirements.length
        ? `### 과제 지시\n${task.requirements.map((r: string) => `- ${r}`).join('\n')}`
        : '',
      task.ai_guide
        ? `## 채점 참고 (선생님용 — 학생에게 그대로 옮기지 말고 판단에만 쓸 것)\n${task.ai_guide}`
        : '',
      `## 체크리스트\n${checklist.map((c, i) => `${i + 1}. ${c}`).join('\n') || '(없음 — 이번 단계 능력 기준으로 3개 항목을 스스로 정해 판단)'}`,
      `## 대화 기록\n${transcript || '(대화 없음)'}`,
      `## 학생 최종 답안\n${session.answer ? clip(session.answer, 3000) : '(답안 없음)'}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 900,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('openai error', data);
      return json({ error: 'ai_failed' }, 502);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    } catch {
      return json({ error: 'bad_ai_output' }, 502);
    }

    const feedback = {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      summary: parsed.summary ?? '',
      next_tip: parsed.next_tip ?? '',
      // 원가 추적용
      model: MODEL,
      tokens_in: data.usage?.prompt_tokens ?? null,
      tokens_out: data.usage?.completion_tokens ?? null,
    };

    const { error: uErr } = await admin
      .from('aiwork_sessions')
      .update({ ai_feedback: feedback })
      .eq('id', session_id);
    if (uErr) console.error('save feedback', uErr);

    return json(feedback);
  } catch (e) {
    console.error(e);
    return json({ error: 'server_error' }, 500);
  }
});