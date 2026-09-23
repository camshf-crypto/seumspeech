// supabase/functions/aiwork-chat/index.ts
//
// 학생이 과제 화면 채팅창에서 보낸 메시지를 받아 AI 답변을 돌려주고,
// 대화 원본과 토큰 사용량을 aiwork_messages에 기록한다.
//
// 요청:  POST { session_id, message }
// 응답:  { reply, turns_used, turns_left }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODEL = 'gpt-4o-mini';
const MAX_INPUT_CHARS = 4000;

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

// 시스템 프롬프트 = 고정 지시문 + 과제 자료.
// 과제마다 내용이 같아서 매 턴 똑같은 앞부분이 된다 → OpenAI가 자동으로 캐시한다.
// 이 앞부분에 턴마다 바뀌는 값(시간, 남은 횟수 등)을 넣으면 캐시가 깨지니 넣지 말 것.
function buildSystemPrompt(task: any, lang: string) {
  const reqs = Array.isArray(task.requirements) ? task.requirements : [];
  const files = Array.isArray(task.attachments) ? task.attachments : [];

  const materials = files
    .filter((f: any) => f?.text)
    .map((f: any) => `### ${f.name}\n${f.text}`)
    .join('\n\n');

  const langLine =
    lang === 'en' ? 'Respond in English.' : '한국어로 답하세요.';

  // 객관식은 AI가 문항을 모른다 — 학생이 필요한 걸 스스로 골라 전달해야 과정이 기록된다.
  // (실제 ChatGPT도 시험 문제를 모르는 것과 같은 조건)
  if (task.kind === 'mcq') {
    return [
      '당신은 업무용 AI 어시스턴트입니다. 사용자의 요청에 평소처럼 성실히 답하세요.',
      '제공되지 않은 수치나 사실을 지어내지 말고, 추정이면 추정이라고 밝히세요.',
      langLine,
    ].join('\n');
  }

  return [
    '당신은 회사에서 쓰는 업무용 AI 어시스턴트입니다.',
    '사용자는 아래 업무 과제를 수행 중인 직원입니다. 사용자의 요청에 평소처럼 성실히 답하세요.',
    '사용자의 실력을 평가하거나, 채점 기준을 알려주거나, 좋은 요청 방법을 코칭하지 마세요.',
    '제공된 자료에 없는 수치나 사실을 지어내지 말고, 추정이면 추정이라고 밝히세요.',
    langLine,
    '',
    `## 과제: ${task.title}`,
    task.background ? `### 배경\n${task.background}` : '',
    task.problem ? `### 문제\n${task.problem}` : '',
    reqs.length ? `### 요구사항\n${reqs.map((r: string) => `- ${r}`).join('\n')}` : '',
    materials ? `## 첨부 자료\n${materials}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    // 1) 누가 보냈는지 확인
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    // 2) 입력 확인
    const { session_id, message } = await req.json();
    const text = typeof message === 'string' ? message.trim() : '';
    if (!session_id || !text) return json({ error: 'bad_request' }, 400);
    if (text.length > MAX_INPUT_CHARS) return json({ error: 'too_long' }, 400);

    // 기록은 service role로만 쓴다 (학생이 토큰 수를 조작하지 못하게)
    const admin = createClient(url, serviceKey);

    // 3) 본인 응시인지, 아직 제출 전인지 확인
    const { data: session, error: sErr } = await admin
      .from('aiwork_sessions')
      .select('id, student_id, submitted_at, lang, task:aiwork_tasks(*)')
      .eq('id', session_id)
      .single();

    if (sErr || !session) return json({ error: 'not_found' }, 404);
    if (session.student_id !== user.id) return json({ error: 'forbidden' }, 403);
    if (session.submitted_at) return json({ error: 'already_submitted' }, 409);

    // 4) 지난 대화 불러오기 + 턴 상한 확인
    const { data: history } = await admin
      .from('aiwork_messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('id', { ascending: true });

    const past = history ?? [];
    const turnsUsed = past.filter((m) => m.role === 'user').length;
    const limit = session.task.turn_limit ?? 20;
    if (turnsUsed >= limit) {
      return json({ error: 'turn_limit', turns_used: turnsUsed, turns_left: 0 }, 429);
    }

    // 5) AI 호출 — 순서: 고정 시스템 프롬프트 → 지난 대화 → 이번 메시지
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(session.task, session.lang) },
          ...past,
          { role: 'user', content: text },
        ],
        max_tokens: 1200,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('openai error', data);
      return json({ error: 'ai_failed' }, 502);
    }

    const reply: string = data.choices?.[0]?.message?.content ?? '';
    const usage = data.usage ?? {};

    // 6) 원본 기록 — 사용자 메시지와 AI 답변을 한 번에. 토큰은 답변 줄에 붙인다.
    const { error: iErr } = await admin.from('aiwork_messages').insert([
      { session_id, role: 'user', content: text },
      {
        session_id,
        role: 'assistant',
        content: reply,
        model: MODEL,
        tokens_in: usage.prompt_tokens ?? null,
        tokens_out: usage.completion_tokens ?? null,
        tokens_cached: usage.prompt_tokens_details?.cached_tokens ?? 0,
      },
    ]);
    if (iErr) console.error('insert error', iErr);

    return json({
      reply,
      turns_used: turnsUsed + 1,
      turns_left: limit - turnsUsed - 1,
    });
  } catch (e) {
    console.error(e);
    return json({ error: 'server_error' }, 500);
  }
});