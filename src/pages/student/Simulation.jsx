// src/pages/student/Simulation.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import UnivQuestionPicker from './UnivQuestionPicker'
import {
  useMySimulations,
  createSimulation,
  addSimulationQuestion,
  submitSimulationAnswer,
  completeSimulation,
  deleteSimulation,
  uploadRecording,
  getQuestionTypeLabel,
  formatSimDuration,
} from '../../hook/useUnivSimulation'

const THEME = {
  accent: '#2563EB',
  accentDark: '#1E3A8A',
  accentBg: '#EFF6FF',
  accentBorder: '#93C5FD',
  accentBorderLight: '#BFDBFE',
  gradient: 'linear-gradient(135deg, #1E3A8A, #2563EB)',
}

const QUESTION_TYPES = [
  { id: 'insung', label: '인성 면접', desc: '대입 기본 인성 질문' },
  { id: 'gichul', label: '대입 기출문제', desc: '대학·학과·전형별 기출' },
  { id: 'saenggibu', label: '생기부 예상문제', desc: '준비 중', disabled: true },
]

const QUESTION_MODES = [
  { id: 'text', label: '텍스트 표시', desc: '질문을 화면에 보여줘요' },
  { id: 'voice', label: '음성만', desc: '질문을 음성으로만 들려줘요' },
  { id: 'both', label: '텍스트 + 음성', desc: '텍스트와 음성 동시에' },
]

const INTERVIEWERS = [
  { id: 1, name: '면접관 1', videoUrl: 'https://yrunxizfvssiwyieevgw.supabase.co/storage/v1/object/public/simulation-videos/interviewer_left.mp4' },
  { id: 2, name: '면접관 2', videoUrl: 'https://yrunxizfvssiwyieevgw.supabase.co/storage/v1/object/public/simulation-videos/interviewer_center.mp4' },
  { id: 3, name: '면접관 3', videoUrl: 'https://yrunxizfvssiwyieevgw.supabase.co/storage/v1/object/public/simulation-videos/interviewer_right.mp4' },
]

const TIMER_SEC = 80
const QUESTION_COUNT = 5
const COUNTDOWN_SEC = 10

const formatDateTime = (s) =>
  new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

const formatDateTimeFull = (s) =>
  new Date(s).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

const formatTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const pickRandom = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

export default function Simulation({ studentId, locked = false }) {
  const { data: simHistory = [], isLoading, refetch } = useMySimulations()

  const [step, setStep] = useState('list')
  const [questionType, setQuestionType] = useState('')
  const [tailQ, setTailQ] = useState(null)
  const [questionMode, setQuestionMode] = useState('')
  const [univPick, setUnivPick] = useState(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [questions, setQuestions] = useState([])
  const [curQIdx, setCurQIdx] = useState(0)
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC)
  const [timer, setTimer] = useState(TIMER_SEC)
  const [timerRunning, setTimerRunning] = useState(false)
  const [showQuestion, setShowQuestion] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [activeInterviewer, setActiveInterviewer] = useState(0)
  const [interviewStartTime, setInterviewStartTime] = useState(0)
  const [saving, setSaving] = useState(false)
  const [tailLoading, setTailLoading] = useState(false)
  const [isTailQuestion, setIsTailQuestion] = useState(false)

  const [currentSimId, setCurrentSimId] = useState(null)
  const [answers, setAnswers] = useState([])

  const [selSim, setSelSim] = useState(null)
  const [selSimQuestions, setSelSimQuestions] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [playingQId, setPlayingQId] = useState(null)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioStreamRef = useRef(null)
  const recordStartRef = useRef(0)
  const finishingRef = useRef(false)
  const recordedMimeRef = useRef('audio/webm')
  const tailIsLastRef = useRef(false)
  const audioRef = useRef(null)
  const timerRef = useRef(null)
  const interviewerRef = useRef(null)

  useEffect(() => {
    if (!selSim) {
      setSelSimQuestions([])
      return
    }
    ;(async () => {
      const { data } = await supabase
        .from('univ_simulation_questions')
        .select('*')
        .eq('simulation_id', selSim.id)
        .order('order', { ascending: true })
      setSelSimQuestions(data ?? [])
    })()
  }, [selSim])

  useEffect(() => {
    if (step !== 'countdown') return
    if (countdown <= 0) {
      setStep('interview')
      setTimerRunning(true)
      setInterviewStartTime(Date.now())
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [step, countdown])

  useEffect(() => {
    if (!timerRunning) return
    if (timer <= 0) {
      setTimerRunning(false)
      return
    }
    timerRef.current = setTimeout(() => setTimer((t) => t - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [timerRunning, timer])

  useEffect(() => {
    if (step !== 'interview') return
    interviewerRef.current = setInterval(() => setActiveInterviewer(Math.floor(Math.random() * 3)), 3000)
    return () => clearInterval(interviewerRef.current)
  }, [step])

  useEffect(() => () => audioStreamRef.current?.getTracks().forEach((t) => t.stop()), [])

  const startQuestionRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mimeType = candidates.find(
        (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t),
      ) || ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recordedMimeRef.current = recorder.mimeType || mimeType || 'audio/webm'
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      recordStartRef.current = Date.now()
      setIsRecording(true)
    } catch (e) {
      console.error(e)
      alert('마이크 권한이 필요해요. 브라우저 설정에서 허용해주세요.')
      setStep('list')
    }
  }

  const stopQuestionRecording = () =>
    new Promise((resolve) => {
      const rec = mediaRecorderRef.current
      if (!rec || rec.state === 'inactive') {
        resolve({ blob: null, durationSec: 0 })
        return
      }
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recordedMimeRef.current || 'audio/webm' })
        const durationSec = Math.floor((Date.now() - recordStartRef.current) / 1000)
        audioStreamRef.current?.getTracks().forEach((t) => t.stop())
        audioStreamRef.current = null
        resolve({ blob, durationSec })
      }
      rec.stop()
    })

  const sttOne = async (blob) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stt-clova`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      })
      const data = await res.json()
      return data?.success && data?.text ? data.text : ''
    } catch (e) {
      console.error('STT 실패:', e)
      return ''
    }
  }

  const makeTailQuestion = async (questionText, studentAnswer) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-tail-question', {
        body: { questionText, studentAnswer, level: 'univ' },
      })
      if (error) return ''
      return data?.tailQuestion || ''
    } catch (e) {
      console.error('꼬리질문 생성 실패:', e)
      return ''
    }
  }

  const finishCurrentAnswer = async () => {
    setIsRecording(false)
    const { blob, durationSec } = await stopQuestionRecording()
    const curQ = questions[curQIdx]
    const newAnswers = [...answers, { order: curQ.order, text: curQ.text, blob, durationSec }]
    setAnswers(newAnswers)

    if (tailQ === true && !isTailQuestion && blob) {
      setTimerRunning(false)
      setTailLoading(true)
      try {
        const transcript = await sttOne(blob)
        if (transcript) {
          const tailText = await makeTailQuestion(curQ.text, transcript)
          if (tailText) {
            tailIsLastRef.current = curQIdx >= questions.length - 1
            const next = [...questions]
            next.splice(curQIdx + 1, 0, { order: curQ.order + 0.5, text: tailText })
            setQuestions(next)
            setTailLoading(false)
            setIsTailQuestion(true)
            setCurQIdx((i) => i + 1)
            setTimer(TIMER_SEC)
            setTimerRunning(true)
            return
          }
        }
      } catch (e) {
        console.error('꼬리질문 처리 실패:', e)
      }
      setTailLoading(false)
    }

    if (isTailQuestion) {
      setIsTailQuestion(false)
      if (tailIsLastRef.current) {
        tailIsLastRef.current = false
        await finishInterview(newAnswers)
        return
      }
      setCurQIdx((i) => i + 1)
      setTimer(TIMER_SEC)
      setTimerRunning(true)
      return
    }

    if (curQIdx >= questions.length - 1) {
      await finishInterview(newAnswers)
      return
    }
    setCurQIdx((i) => i + 1)
    setTimer(TIMER_SEC)
    setTimerRunning(true)
  }

  const skipQuestion = async () => {
    if (isRecording) {
      await finishCurrentAnswer()
      return
    }
    const curQ = questions[curQIdx]
    const newAnswers = [...answers, { order: curQ.order, text: curQ.text, blob: null, durationSec: 0 }]
    setAnswers(newAnswers)
    if (curQIdx >= questions.length - 1) {
      await finishInterview(newAnswers)
      return
    }
    setCurQIdx((i) => i + 1)
    setTimer(TIMER_SEC)
    setTimerRunning(true)
  }

  const finishInterview = async (allAnswers) => {
    if (!currentSimId) {
      alert('시뮬레이션 ID가 없어요. 다시 시도해주세요.')
      setStep('list')
      return
    }
    if (finishingRef.current) return
    finishingRef.current = true

    setSaving(true)
    setTimerRunning(false)
    if (interviewerRef.current) clearInterval(interviewerRef.current)

    const elapsedSec = Math.floor((Date.now() - interviewStartTime) / 1000)

    try {
      let seq = 0
      for (const a of allAnswers) {
        seq += 1
        const qRow = await addSimulationQuestion({
          simulationId: currentSimId,
          order: seq,
          questionText: a.text,
          isTail: !Number.isInteger(a.order),
        })

        let recordingUrl
        if (a.blob) {
          try {
            recordingUrl = await uploadRecording(a.blob, currentSimId, `q${seq}-${Date.now()}.webm`)
          } catch (e) {
            console.error('녹음 업로드 실패:', e)
          }
        }

        if (recordingUrl || a.durationSec > 0) {
          await submitSimulationAnswer({
            questionId: qRow.id,
            recordingUrl,
            durationSec: a.durationSec,
          })
        }
      }

      await completeSimulation({
        simulationId: currentSimId,
        durationSec: elapsedSec,
        questionCount: allAnswers.length,
      })

      await refetch()
      setStep('result')
    } catch (e) {
      alert(`저장 실패: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const canStart = (() => {
    if (locked) return false
    if (!questionType || tailQ === null || !questionMode) return false
    if (questionType === 'gichul') return !!univPick?.univ && !!univPick?.major && !!univPick?.admission
    if (questionType === 'insung') return true
    return false
  })()

  const startSimulation = async () => {
    if (!canStart || creating) return
    setCreating(true)

    try {
      let sourcePool = []
      if (questionType === 'insung') {
        const { data, error } = await supabase
          .from('interview_questions_v2')
          .select('question')
          .eq('category_key', 'univ')
          .eq('tab_key', 'insung')
          .eq('is_active', true)
        if (error) console.error('인성 문항 조회 실패:', error)
        sourcePool = (data ?? []).map((q) => q.question).filter(Boolean)
      } else if (questionType === 'gichul') {
        const { data, error } = await supabase
          .from('univ_questions')
          .select('question')
          .eq('univ', univPick.univ)
          .eq('major', univPick.major)
          .eq('admission', univPick.admission)
          .eq('is_active', true)
        if (error) console.error('기출 문항 조회 실패:', error)
        sourcePool = (data ?? []).map((q) => q.question).filter(Boolean)
      }

      if (sourcePool.length === 0) {
        alert('해당 조건에 등록된 질문이 없어요. 다른 조건을 선택해주세요.')
        return
      }

      const picked = pickRandom(sourcePool, Math.min(QUESTION_COUNT, sourcePool.length))
      const numbered = picked.map((text, i) => ({ order: i + 1, text }))

      const newSim = await createSimulation({
        questionType,
        tailQuestionEnabled: tailQ === true,
        questionMode,
        university: questionType === 'gichul' ? univPick.univ : null,
        department: questionType === 'gichul' ? univPick.major : null,
        admissionType: questionType === 'gichul' ? univPick.admission : null,
      })
      setCurrentSimId(newSim.id)

      setQuestions(numbered)
      setCountdown(COUNTDOWN_SEC)
      setCurQIdx(0)
      setTimer(TIMER_SEC)
      setAnswers([])
      setShowQuestion(questionMode !== 'voice')
      setIsRecording(false)
      finishingRef.current = false
      setIsTailQuestion(false)
      setTailLoading(false)
      tailIsLastRef.current = false
      setStep('countdown')
    } catch (e) {
      alert(`시뮬레이션 시작 실패: ${e.message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteSim = async (id) => {
    setDeleting(true)
    try {
      await deleteSimulation(id)
      if (selSim?.id === id) setSelSim(null)
      setDeleteTarget(null)
      await refetch()
    } catch (e) {
      alert(`삭제 실패: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const resetSetup = () => {
    setQuestionType('')
    setTailQ(null)
    setQuestionMode('')
    setUnivPick(null)
    setCurrentSimId(null)
  }

  const toggleType = (id) => {
    setQuestionType(questionType === id ? '' : id)
    setUnivPick(null)
  }

  const playQuestionAudio = async (qId, audioUrl) => {
    if (!audioRef.current) return
    const audio = audioRef.current
    if (playingQId === qId) {
      audio.pause()
      setPlayingQId(null)
      return
    }
    try {
      audio.pause()
      audio.currentTime = 0
      audio.src = audioUrl
      audio.load()
      await audio.play()
      setPlayingQId(qId)
    } catch (err) {
      console.error('재생 실패:', err)
      setPlayingQId(null)
    }
  }

  const getSimTitle = (sim) => {
    if (sim.university && sim.department) {
      return `${sim.university} · ${sim.department}${sim.admission_type ? ` · ${sim.admission_type}` : ''}`
    }
    return getQuestionTypeLabel(sim.question_type)
  }

  // ═══ 목록 ═══
  if (step === 'list') {
    return (
      <div className="flex gap-4" style={{ height: 'calc(100vh - 300px)', minHeight: 460 }}>
        <div className="w-[320px] flex-shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="text-sm font-bold text-seum-navy">면접 시뮬레이션</div>
            <div className="text-xs text-slate-400 mt-0.5">
              총 <span className="font-bold" style={{ color: THEME.accent }}>{simHistory.length}개</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2.5">
            {isLoading ? (
              <div className="text-center py-10 text-slate-400 text-xs">불러오는 중...</div>
            ) : simHistory.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">시뮬레이션 기록이 없어요.</div>
            ) : (
              simHistory.map((s) => {
                const isSel = selSim?.id === s.id
                return (
                  <div
                    key={s.id}
                    onClick={() => { setSelSim(s); setPlayingQId(null) }}
                    className="border rounded-xl px-3.5 py-3 mb-1.5 cursor-pointer transition-all relative"
                    style={{
                      borderColor: isSel ? THEME.accent : '#E5E7EB',
                      background: isSel ? THEME.accentBg : '#fff',
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.id) }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-100 hover:bg-red-100 hover:text-red-500 text-slate-400 flex items-center justify-center text-[10px]"
                    >
                      ✕
                    </button>
                    <div className="text-[10px] text-slate-400 font-medium mb-1">{formatDateTime(s.created_at)}</div>
                    <div className="text-xs font-semibold text-seum-navy mb-1.5 pr-6">{getSimTitle(s)}</div>
                    <div className="flex gap-1 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ color: THEME.accentDark, background: THEME.accentBg, borderColor: THEME.accentBorderLight }}>
                        {getQuestionTypeLabel(s.question_type)}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ color: THEME.accentDark, background: THEME.accentBg, borderColor: THEME.accentBorderLight }}>
                        꼬리질문 {s.tail_question_enabled ? 'ON' : 'OFF'}
                      </span>
                      {s.teacher_feedback && (
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">피드백</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="p-3 border-t border-slate-200">
            <button
              onClick={() => { resetSetup(); setStep('setup') }}
              disabled={locked}
              className="w-full h-11 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: THEME.accent }}
            >
              모의면접 시작하기
            </button>
          </div>
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden min-w-0">
          {!selSim ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="text-sm font-semibold text-slate-500">시뮬레이션을 선택해주세요</div>
              <div className="text-xs">왼쪽에서 기록을 클릭하면 피드백을 볼 수 있어요</div>
            </div>
          ) : (
            <>
              <audio ref={audioRef} onEnded={() => setPlayingQId(null)} className="hidden" />
              <div className="px-4 py-3.5 border-b border-slate-200">
                <div className="text-sm font-extrabold text-seum-navy mb-1">{getSimTitle(selSim)}</div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {formatDateTimeFull(selSim.created_at)} · {formatSimDuration(selSim.duration_sec)} · {selSim.question_count}문제
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">선생님 피드백</div>
                  {selSim.teacher_feedback ? (
                    <div className="rounded-lg px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap border"
                      style={{ background: THEME.accentBg, color: THEME.accentDark, borderColor: THEME.accentBorderLight }}>
                      {selSim.teacher_feedback}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-xs text-slate-400 text-center">
                      선생님 피드백을 기다리는 중이에요.
                    </div>
                  )}
                </div>

                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  질문별 답변 ({selSimQuestions.length}개)
                </div>
                {selSimQuestions.map((q) => (
                  <div key={q.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
                    <div className="flex items-start gap-2 mb-2.5">
                      <span className="w-6 h-6 rounded-full text-white text-[11px] font-extrabold flex items-center justify-center flex-shrink-0"
                        style={{ background: THEME.accent }}>
                        Q{q.order}
                      </span>
                      <span className="text-sm font-semibold text-seum-navy leading-relaxed flex-1">
                        {q.is_tail && <span className="text-blue-500 mr-1">꼬리</span>}{q.question_text}
                      </span>
                      {q.recording_url ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0">답변완료</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full flex-shrink-0">미답변</span>
                      )}
                    </div>

                    {q.recording_url && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2 flex items-center gap-2.5">
                        <button
                          onClick={() => playQuestionAudio(q.id, q.recording_url)}
                          className="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs flex-shrink-0"
                          style={{ background: THEME.accent }}
                        >
                          {playingQId === q.id ? '❚❚' : '▶'}
                        </button>
                        <div className="flex-1 text-[11px] text-slate-500 font-medium">
                          {playingQId === q.id ? '재생 중...' : '재생하려면 클릭'}
                          <div className="text-[10px] text-slate-400">길이: {formatTime(q.duration_sec || 0)}</div>
                        </div>
                      </div>
                    )}

                    {q.transcript && (
                      <div className="rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap border"
                        style={{ background: THEME.accentBg, color: THEME.accentDark, borderColor: THEME.accentBorderLight }}>
                        <div className="text-[10px] font-bold mb-1">음성 텍스트</div>
                        {q.transcript}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {deleteTarget !== null && (
          <div onClick={() => setDeleteTarget(null)} className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-7 w-[380px] text-center">
              <div className="text-base font-bold text-seum-navy mb-2">시뮬레이션을 삭제하시겠어요?</div>
              <div className="text-sm text-slate-500 mb-6">삭제하면 녹음 파일과 피드백이 모두 사라져요.</div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 h-11 bg-white text-slate-500 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
                  취소
                </button>
                <button onClick={() => handleDeleteSim(deleteTarget)} disabled={deleting}
                  className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                  {deleting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══ 설정 ═══
  if (step === 'setup') {
    return (
      <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-7 w-[560px] max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-extrabold text-seum-navy">시뮬레이션 설정</div>
            <button onClick={() => setStep('list')}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
          </div>

          <div className="rounded-xl px-5 py-4 mb-5" style={{ background: THEME.gradient }}>
            <div className="text-[15px] font-extrabold text-white">원하는 문제 유형을 골라주세요</div>
            <div className="text-xs text-white/90 font-medium mt-0.5">하나만 선택해서 시작해요.</div>
          </div>

          <div className="mb-5">
            <div className="text-sm font-bold text-seum-navy mb-2.5">문제 유형 (1개 선택)</div>
            <div className="flex flex-col gap-2">
              {QUESTION_TYPES.map((t) => {
                const isSel = questionType === t.id
                return (
                  <div key={t.id}>
                    <button
                      onClick={() => !t.disabled && toggleType(t.id)}
                      disabled={t.disabled}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: isSel ? THEME.accent : '#E5E7EB', background: isSel ? THEME.accentBg : '#fff' }}
                    >
                      <div>
                        <div className="text-sm font-bold text-seum-navy">{t.label}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{t.desc}</div>
                      </div>
                      {isSel && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                          style={{ background: THEME.accent }}>✓</div>
                      )}
                    </button>

                    {isSel && t.id === 'gichul' && (
                      <div className="mt-1.5">
                        <UnivQuestionPicker value={univPick} onSelect={setUnivPick} />
                      </div>
                    )}

                    {isSel && t.id === 'insung' && (
                      <div className="rounded-lg px-3.5 py-2.5 mt-1.5 border text-[11px] font-medium"
                        style={{ background: `${THEME.accentBg}99`, borderColor: THEME.accentBorderLight, color: THEME.accentDark }}>
                        대입 기본 인성 문항 중 {QUESTION_COUNT}개가 무작위로 출제됩니다.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mb-5">
            <div className="text-sm font-bold text-seum-navy mb-2.5">꼬리질문</div>
            <div className="flex gap-2.5">
              {[{ val: true, label: 'ON' }, { val: false, label: 'OFF' }].map((o) => {
                const isSel = tailQ === o.val
                return (
                  <button key={String(o.val)} onClick={() => setTailQ(o.val)}
                    className="flex-1 h-11 rounded-xl text-sm border-2 transition-all"
                    style={{
                      borderColor: isSel ? THEME.accent : '#E5E7EB',
                      background: isSel ? THEME.accentBg : '#fff',
                      color: isSel ? THEME.accentDark : '#475569',
                      fontWeight: isSel ? 800 : 500,
                    }}>
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-6">
            <div className="text-sm font-bold text-seum-navy mb-2.5">질문 방식</div>
            <div className="flex flex-col gap-2">
              {QUESTION_MODES.map((m) => {
                const isSel = questionMode === m.id
                return (
                  <button key={m.id} onClick={() => setQuestionMode(m.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left"
                    style={{ borderColor: isSel ? THEME.accent : '#E5E7EB', background: isSel ? THEME.accentBg : '#fff' }}>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-seum-navy">{m.label}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{m.desc}</div>
                    </div>
                    {isSel && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                        style={{ background: THEME.accent }}>✓</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <button onClick={startSimulation} disabled={!canStart || creating}
            className="w-full h-12 rounded-xl text-sm font-bold transition-all"
            style={{
              background: canStart && !creating ? THEME.accent : '#F3F4F6',
              color: canStart && !creating ? '#fff' : '#94A3B8',
              cursor: canStart && !creating ? 'pointer' : 'not-allowed',
            }}>
            {creating ? '준비 중...' : '다음으로'}
          </button>
        </div>
      </div>
    )
  }

  // ═══ 카운트다운 ═══
  if (step === 'countdown') {
    const subtitle = questionType === 'gichul'
      ? `${univPick.univ} · ${univPick.major} · ${univPick.admission}`
      : '대입 인성 면접'
    return (
      <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-5"
        style={{ background: `linear-gradient(135deg, ${THEME.accentBg}, #fff)` }}>
        <div className="flex gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full border"
            style={{ background: THEME.accentBg, color: THEME.accentDark, borderColor: THEME.accentBorderLight }}>
            {getQuestionTypeLabel(questionType)}
          </span>
          <span className="text-xs font-bold bg-red-50 text-red-500 px-3 py-1 rounded-full border border-red-200">
            꼬리질문 {tailQ ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="text-xl font-extrabold text-seum-navy">{subtitle}</div>
        <div className="text-[15px] text-slate-500 text-center leading-relaxed font-medium">
          잠시 후 면접이 시작돼요.<br />깊게 숨 한번 쉬고, 천천히 호흡을 가다듬어볼까요?
        </div>
        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-[32px] font-extrabold"
          style={{ border: `3px solid ${THEME.accent}`, color: THEME.accentDark }}>
          {countdown}
        </div>
      </div>
    )
  }

  // ═══ 면접 ═══
  if (step === 'interview') {
    const curQ = questions[curQIdx]
    if (!curQ) return null
    const subtitle = questionType === 'gichul' ? `${univPick.univ} · ${univPick.major}` : '대입 인성'

    return (
      <div className="fixed inset-0 z-[300] bg-[#0a0a0a] flex flex-col overflow-hidden">
        {tailLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 gap-4">
            <div className="text-lg font-extrabold text-white">면접관이 꼬리질문을 준비 중이에요...</div>
            <div className="text-sm text-white/60 font-medium">잠시만 기다려주세요</div>
          </div>
        )}

        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3">
          <button onClick={async () => { if (isRecording) await stopQuestionRecording(); setStep('list') }}
            className="text-sm text-white/80 hover:text-white font-medium">← 처음으로</button>
          <div className="text-sm font-bold text-white">실전 면접 시뮬레이션</div>
          <div className="text-xs text-white/60 font-medium">고민하는 시간도 성장의 일부예요!</div>
        </div>

        <div className="absolute top-11 left-0 right-0 z-10 flex items-center gap-2 px-5 py-1.5">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: THEME.accentBg, color: THEME.accentDark }}>
            {getQuestionTypeLabel(questionType)}
          </span>
          <span className="text-[11px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            꼬리질문 {tailQ ? 'ON' : 'OFF'}
          </span>
          <span className="text-[11px] text-white/60 font-medium">{subtitle}</span>
          <span className="text-[11px] text-white/60 font-medium ml-auto">{curQIdx + 1} / {questions.length}</span>
          {isRecording && (
            <span className="text-[11px] font-bold bg-red-500/30 text-red-300 px-2 py-0.5 rounded-full flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />REC
            </span>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center pt-20 pb-[120px]">
          <div className="flex gap-1 w-full h-full">
            {INTERVIEWERS.map((iv, i) => {
              const isActive = activeInterviewer === i
              return (
                <div key={iv.id} className="flex-1 relative overflow-hidden rounded"
                  style={{
                    background: isActive ? '#0F1B33' : '#0a0a0a',
                    border: isActive ? `1px solid ${THEME.accent}80` : '1px solid transparent',
                  }}>
                  <video src={iv.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/60"
                      style={{ color: isActive ? THEME.accentBorder : 'rgba(255,255,255,0.6)' }}>
                      {iv.name}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-black/70 rounded-full px-4 py-1 flex items-center gap-2 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-bold text-white font-mono">{formatTime(timer)} / 01:20</span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black via-black/90 to-transparent px-6 pt-5 pb-6">
          <div className="text-[11px] text-amber-300/90 mb-1.5 font-medium">
            * {getQuestionTypeLabel(questionType)} 중 {QUESTION_COUNT}문제가 무작위로 출제됩니다.
          </div>
          <div className="flex items-center justify-between gap-5">
            <div className="flex-1 min-w-0">
              {showQuestion ? (
                <div className="text-xl font-extrabold text-white leading-snug">
                  <span style={{ color: THEME.accentBorder }}>
                    {isTailQuestion ? '꼬리질문. ' : `질문 ${Math.floor(curQ.order)}. `}
                  </span>
                  {curQ.text}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="text-xl font-extrabold text-white">
                    <span style={{ color: THEME.accentBorder }}>
                      {isTailQuestion ? '꼬리질문. ' : `질문 ${Math.floor(curQ.order)}. `}
                    </span>
                    <span className="bg-white/10 rounded-md px-2 py-0.5 text-white/50 text-sm font-medium">음성으로 확인하세요</span>
                  </div>
                  <button onClick={() => setShowQuestion(true)}
                    className="text-[11px] font-semibold rounded-md px-2 py-1 border"
                    style={{ color: THEME.accentBorder, background: `${THEME.accent}33`, borderColor: `${THEME.accent}80` }}>
                    텍스트 보기
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2.5 flex-shrink-0">
              {!isRecording ? (
                <>
                  <button onClick={startQuestionRecording} disabled={saving}
                    className="h-11 px-5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: THEME.accent }}>
                    답변 시작
                  </button>
                  <button onClick={skipQuestion} disabled={saving}
                    className="h-11 px-5 bg-white/10 text-white border border-white/30 rounded-lg text-sm font-semibold hover:bg-white/20 disabled:opacity-50">
                    {saving ? '저장 중...' : curQIdx >= questions.length - 1 ? '면접 종료' : '건너뛰기'}
                  </button>
                </>
              ) : (
                <button onClick={finishCurrentAnswer} disabled={saving}
                  className="h-11 px-5 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50">
                  {saving ? '저장 중...' : curQIdx >= questions.length - 1 ? '답변 종료 (면접 종료)' : '답변 종료 (다음 질문)'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══ 결과 ═══
  if (step === 'result') {
    const answeredCount = answers.filter((a) => a.blob).length
    return (
      <div>
        <div className="text-center py-6 mb-3">
          <div className="text-xl font-extrabold text-seum-navy mb-1">면접 시뮬레이션 완료!</div>
          <div className="text-sm text-slate-500 font-medium">총 {answers.length}개 질문에 답변했어요.</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
          <div className="text-sm font-bold text-seum-navy mb-2">이번 시뮬레이션 요약</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '답변한 질문', val: `${answeredCount}/${answers.length}개` },
              { label: '문제 유형', val: getQuestionTypeLabel(questionType) },
              { label: '꼬리질문', val: tailQ ? 'ON' : 'OFF' },
            ].map((s, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center">
                <div className="text-[10px] text-slate-400 font-medium mb-0.5">{s.label}</div>
                <div className="text-sm font-extrabold text-seum-navy">{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl px-4 py-3 mb-3 border"
          style={{ background: THEME.accentBg, borderColor: THEME.accentBorderLight }}>
          <div className="text-xs font-bold mb-0.5" style={{ color: THEME.accentDark }}>선생님 피드백 대기중</div>
          <div className="text-[11px] text-slate-500">선생님이 녹음 내용을 듣고 피드백을 남겨드릴 예정이에요.</div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { resetSetup(); setStep('setup') }}
            className="flex-1 h-11 text-white rounded-xl text-sm font-bold"
            style={{ background: THEME.accent }}>
            다시 시뮬레이션하기
          </button>
          <button onClick={() => setStep('list')}
            className="flex-1 h-11 bg-white rounded-xl text-sm font-bold"
            style={{ border: `2px solid ${THEME.accent}`, color: THEME.accentDark }}>
            목록으로
          </button>
        </div>
      </div>
    )
  }

  return null
}