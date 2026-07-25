// src/pages/student/MajorQuestions.jsx
import { useState, useEffect } from 'react'
import {
  fetchMajors,
  fetchDays,
  fetchQuestions,
  fetchMyProgress,
  saveProgress,
} from '../../hook/useMajorQuestions'

const CHOICE_KEYS = ['choice_1', 'choice_2', 'choice_3', 'choice_4']

export default function MajorQuestions({ locked = false }) {
  const [screen, setScreen] = useState('major')   // major | day | solve
  const [majors, setMajors] = useState([])
  const [search, setSearch] = useState('')
  const [loadingMajors, setLoadingMajors] = useState(true)

  const [selMajor, setSelMajor] = useState(null)  // { code, name }
  const [days, setDays] = useState([])
  const [progress, setProgress] = useState([])

  const [selDay, setSelDay] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loadingQ, setLoadingQ] = useState(false)

  const [qIdx, setQIdx] = useState(0)
  const [objAnswers, setObjAnswers] = useState({}) // { questionId: '1' }
  const [subjInput, setSubjInput] = useState('')
  const [subjSubmitted, setSubjSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const [retryMode, setRetryMode] = useState(false)
  const [retryIdx, setRetryIdx] = useState(0)
  const [retryAnswers, setRetryAnswers] = useState({})

  // 학과 목록
  useEffect(() => {
    ;(async () => {
      try {
        setMajors(await fetchMajors())
      } catch (e) {
        console.error('학과 조회 실패:', e)
      } finally {
        setLoadingMajors(false)
      }
    })()
  }, [])

  const openMajor = async (m) => {
    setSelMajor(m)
    setScreen('day')
    try {
      const [d, p] = await Promise.all([fetchDays(m.code), fetchMyProgress(m.code)])
      setDays(d)
      setProgress(p)
    } catch (e) {
      console.error(e)
    }
  }

  const openDay = async (day) => {
    setSelDay(day)
    setLoadingQ(true)
    setScreen('solve')
    setQIdx(0)
    setObjAnswers({})
    setSubjInput('')
    setSubjSubmitted(false)
    setRetryMode(false)
    setRetryIdx(0)
    setRetryAnswers({})
    try {
      const qs = await fetchQuestions(selMajor.code, day)
      setQuestions(qs)
      const prev = progress.find((p) => p.day === day)
      if (prev?.obj_answers) {
        const restored = {}
        prev.obj_answers.forEach((a) => { restored[a.question_id] = a.user_answer })
        setObjAnswers(restored)
      }
      if (prev?.subj_answer) {
        setSubjInput(prev.subj_answer)
        setSubjSubmitted(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingQ(false)
    }
  }

  const objQs = questions.filter((q) => q.q_type === 'choice')
  const subjQ = questions.find((q) => q.q_type === 'descript') || null

  const wrongQs = objQs.filter((q) => {
    const a = objAnswers[q.id]
    return a && a !== q.correct_answer
  })
  const score = objQs.filter((q) => objAnswers[q.id] === q.correct_answer).length

  const pickChoice = (qid, num) => {
    if (objAnswers[qid]) return
    setObjAnswers((p) => ({ ...p, [qid]: String(num) }))
  }

  const nextObj = async () => {
    if (qIdx < objQs.length - 1) {
      setQIdx((i) => i + 1)
      return
    }
    // 객관식 끝 → 저장 후 서술형
    setSaving(true)
    try {
      await saveProgress({
        majorCode: selMajor.code,
        grade: questions[0]?.grade ?? '2학년',
        day: selDay,
        objAnswers: objQs.map((q) => ({
          question_id: q.id,
          user_answer: objAnswers[q.id] ?? '',
          is_correct: objAnswers[q.id] === q.correct_answer,
        })),
      })
    } catch (e) {
      console.error('저장 실패:', e)
    } finally {
      setSaving(false)
    }
    setQIdx(objQs.length)
  }

  const submitSubj = async () => {
    if (!subjInput.trim()) return
    setSaving(true)
    try {
      await saveProgress({
        majorCode: selMajor.code,
        grade: questions[0]?.grade ?? '2학년',
        day: selDay,
        subjAnswer: subjInput,
        completed: true,
      })
      setSubjSubmitted(true)
      setProgress(await fetchMyProgress(selMajor.code))
    } catch (e) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = majors.filter((m) => m.name.includes(search))

  // ═══ 1. 학과 선택 ═══
  if (screen === 'major') {
    return (
      <div>
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="학과 이름을 검색하세요"
            className="h-10 w-full max-w-[360px] rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-seum-blue"
          />
        </div>
        {loadingMajors ? (
          <p className="py-10 text-center text-slate-400">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
            검색 결과가 없습니다.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-400">총 {filtered.length}개 학과</p>
            <div className="grid grid-cols-4 gap-2 max-lg:grid-cols-3 max-md:grid-cols-2">
              {filtered.map((m) => (
                <button
                  key={m.code}
                  onClick={() => openMajor(m)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-semibold text-seum-navy transition hover:border-seum-blue hover:bg-blue-50/40"
                >
                  {m.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ═══ 2. Day 선택 ═══
  if (screen === 'day') {
    const doneDays = new Set(progress.filter((p) => p.status === 'completed').map((p) => p.day))
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => { setScreen('major'); setSelMajor(null) }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
          >
            학과 선택
          </button>
          <div className="text-base font-bold text-seum-navy">{selMajor.name}</div>
          <div className="text-xs text-slate-400">
            완료 {doneDays.size} / {days.length}
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2 max-lg:grid-cols-5 max-md:grid-cols-3">
          {days.map((d) => {
            const done = doneDays.has(d)
            return (
              <button
                key={d}
                onClick={() => openDay(d)}
                className={`rounded-xl border px-3 py-4 text-center transition ${
                  done
                    ? 'border-seum-blue bg-white text-seum-blue'
                    : 'border-slate-200 bg-white text-seum-navy hover:border-seum-blue hover:bg-blue-50/40'
                }`}
              >
                <div className="text-sm font-bold">Day {d}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {done ? '완료' : '5문항'}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ═══ 3. 문제 풀기 ═══
  if (loadingQ) return <p className="py-10 text-center text-slate-400">불러오는 중...</p>

  // 틀린 문제 다시 풀기
  if (retryMode) {
    const q = wrongQs[retryIdx]
    if (!q) {
      return (
        <div className="py-16 text-center">
          <div className="mb-2 text-lg font-bold text-seum-navy">복습 완료</div>
          <button
            onClick={() => { setRetryMode(false); setRetryIdx(0); setRetryAnswers({}) }}
            className="rounded-lg bg-seum-blue px-5 py-2 text-sm font-bold text-white"
          >
            돌아가기
          </button>
        </div>
      )
    }
    const picked = retryAnswers[q.id]
    const answered = !!picked

    return (
      <div className="mx-auto max-w-[680px]">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => { setRetryMode(false); setRetryIdx(0); setRetryAnswers({}) }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
          >
            돌아가기
          </button>
          <div className="text-sm font-bold text-seum-navy">틀린 문제 다시 풀기</div>
          <div className="ml-auto text-xs text-slate-400">{retryIdx + 1} / {wrongQs.length}</div>
        </div>

        <QuestionCard
          q={q}
          picked={picked}
          answered={answered}
          onPick={(n) => setRetryAnswers((p) => ({ ...p, [q.id]: String(n) }))}
        />

        {answered && (
          <button
            onClick={() => {
              if (retryIdx < wrongQs.length - 1) setRetryIdx((i) => i + 1)
              else { setRetryMode(false); setRetryIdx(0); setRetryAnswers({}) }
            }}
            className="mt-3 h-11 w-full rounded-xl bg-seum-blue text-sm font-bold text-white"
          >
            {retryIdx < wrongQs.length - 1 ? '다음' : '복습 완료'}
          </button>
        )}
      </div>
    )
  }

  const isSubjStep = qIdx >= objQs.length
  const curQ = isSubjStep ? subjQ : objQs[qIdx]

  return (
    <div className="mx-auto max-w-[680px]">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => setScreen('day')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
        >
          Day 선택
        </button>
        <div className="text-sm font-bold text-seum-navy">
          {selMajor.name} · Day {selDay}
        </div>
        <div className="ml-auto text-xs text-slate-400">
          {isSubjStep ? '서술형' : `객관식 ${qIdx + 1} / ${objQs.length}`}
        </div>
      </div>

      {/* 진행 표시 */}
      <div className="mb-4 flex gap-1.5">
        {[...objQs, subjQ].filter(Boolean).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < qIdx ? 'bg-seum-blue' : i === qIdx ? 'bg-seum-blue' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {!isSubjStep ? (
        <>
          <QuestionCard
            q={curQ}
            picked={objAnswers[curQ.id]}
            answered={!!objAnswers[curQ.id]}
            onPick={(n) => pickChoice(curQ.id, n)}
          />
          {objAnswers[curQ.id] && (
            <button
              onClick={nextObj}
              disabled={saving}
              className="mt-3 h-11 w-full rounded-xl bg-seum-blue text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? '저장 중...' : qIdx < objQs.length - 1 ? '다음 문제' : '서술형 풀기'}
            </button>
          )}
        </>
      ) : subjQ ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            서술형
          </div>
          <p className="mb-4 text-[15px] font-semibold leading-relaxed text-seum-navy">
            {subjQ.question}
          </p>

          {subjSubmitted ? (
            <>
              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="mb-1.5 text-[11px] font-bold text-slate-500">내 답변</div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{subjInput}</p>
              </div>

              <div className="mb-3 rounded-lg border border-seum-blue bg-white px-4 py-3">
                <div className="mb-1.5 text-[11px] font-bold text-seum-blue">모범답안</div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-seum-navy">
                  {subjQ.correct_answer}
                </p>
              </div>

              {subjQ.explanation && (
                <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="mb-1.5 text-[11px] font-bold text-slate-500">해설</div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {subjQ.explanation}
                  </p>
                </div>
              )}

              <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-seum-navy">
                  객관식 {score} / {objQs.length}
                  {wrongQs.length > 0 && (
                    <span className="ml-2 font-medium text-slate-500">틀린 문제 {wrongQs.length}개</span>
                  )}
                </span>
                {wrongQs.length > 0 && (
                  <button
                    onClick={() => { setRetryMode(true); setRetryIdx(0); setRetryAnswers({}) }}
                    className="rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a63c4]"
                  >
                    다시 풀기
                  </button>
                )}
              </div>

              <button
                onClick={() => setScreen('day')}
                className="h-11 w-full rounded-xl border-2 border-seum-blue bg-white text-sm font-bold text-seum-blue"
              >
                Day 목록으로
              </button>
            </>
          ) : (
            <>
              <textarea
                value={subjInput}
                onChange={(e) => setSubjInput(e.target.value)}
                rows={6}
                disabled={locked}
                placeholder="답변을 작성해주세요."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-seum-blue disabled:bg-slate-50"
              />
              <button
                onClick={submitSubj}
                disabled={!subjInput.trim() || saving || locked}
                className="mt-3 h-11 w-full rounded-xl bg-seum-blue text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
              >
                {saving ? '제출 중...' : '제출하고 모범답안 보기'}
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="py-10 text-center text-slate-400">서술형 문제가 없습니다.</p>
      )}
    </div>
  )
}

// ── 객관식 문제 카드 ──
function QuestionCard({ q, picked, answered, onPick }) {
  const correct = picked === q.correct_answer
  return (
    <div
      className={`rounded-xl border bg-white p-5 ${
        answered && correct ? 'border-seum-blue' : 'border-slate-200'
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          객관식
        </span>
        {answered && (
          <span className={`text-[11px] font-bold ${correct ? 'text-seum-blue' : 'text-slate-500'}`}>
            {correct ? '정답' : '오답'}
          </span>
        )}
      </div>

      <p className="mb-4 text-[15px] font-semibold leading-relaxed text-seum-navy">{q.question}</p>

      <div className="flex flex-col gap-2">
        {CHOICE_KEYS.map((key, i) => {
          const text = q[key]
          if (!text) return null
          const num = String(i + 1)
          const isPicked = picked === num
          const isAnswer = q.correct_answer === num

          let cls = 'border-slate-200 bg-white text-slate-700 hover:border-seum-blue'
          let badge = 'bg-slate-200 text-slate-600'
          if (answered) {
            if (isAnswer) {
              cls = 'border-seum-blue bg-white text-seum-navy'
              badge = 'bg-seum-blue text-white'
            } else if (isPicked) {
              cls = 'border-slate-300 bg-slate-100 text-slate-500 line-through'
              badge = 'bg-slate-400 text-white'
            } else {
              cls = 'border-slate-200 bg-white text-slate-400'
              badge = 'bg-slate-200 text-slate-500'
            }
          } else if (isPicked) {
            cls = 'border-seum-blue bg-blue-50/40 text-seum-navy'
            badge = 'bg-seum-blue text-white'
          }

          return (
            <button
              key={key}
              onClick={() => !answered && onPick(i + 1)}
              disabled={answered}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${cls}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold ${badge}`}
              >
                {num}
              </span>
              <span className="flex-1 text-sm leading-relaxed">{text}</span>
            </button>
          )
        })}
      </div>

      {answered && q.explanation && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <span className="font-bold">해설</span>　{q.explanation}
        </div>
      )}
    </div>
  )
}