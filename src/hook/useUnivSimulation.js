// src/hook/useUnivSimulation.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const BUCKET = 'simulation-recordings'

async function getStudentId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다')
  return user.id
}

// ─── 내 시뮬레이션 목록 ───
export function useMySimulations() {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const studentId = await getStudentId()
      const { data: rows, error } = await supabase
        .from('univ_simulations')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setData(rows ?? [])
    } catch (e) {
      console.error('시뮬레이션 목록 조회 실패:', e)
      setData([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  return { data, isLoading, refetch }
}

// ─── 시뮬레이션 생성 ───
export async function createSimulation(input) {
  const studentId = await getStudentId()
  const { data, error } = await supabase
    .from('univ_simulations')
    .insert({
      student_id: studentId,
      question_type: input.questionType,
      tail_question_enabled: input.tailQuestionEnabled,
      question_mode: input.questionMode,
      university: input.university ?? null,
      department: input.department ?? null,
      admission_type: input.admissionType ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── 질문 행 추가 ───
export async function addSimulationQuestion(input) {
  const studentId = await getStudentId()
  const { data, error } = await supabase
    .from('univ_simulation_questions')
    .insert({
      simulation_id: input.simulationId,
      student_id: studentId,
      order: input.order,
      question_text: input.questionText,
      is_tail: input.isTail ?? false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── 답변 정보 업데이트 ───
export async function submitSimulationAnswer(input) {
  const patch = {}
  if (input.recordingUrl) patch.recording_url = input.recordingUrl
  if (input.durationSec != null) patch.duration_sec = input.durationSec
  if (input.transcript) patch.transcript = input.transcript

  const { error } = await supabase
    .from('univ_simulation_questions')
    .update(patch)
    .eq('id', input.questionId)
  if (error) throw error
}

// ─── 시뮬레이션 완료 ───
export async function completeSimulation(input) {
  const { error } = await supabase
    .from('univ_simulations')
    .update({
      duration_sec: input.durationSec,
      question_count: input.questionCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.simulationId)
  if (error) throw error
}

// ─── 삭제 (녹음 파일까지) ───
export async function deleteSimulation(simulationId) {
  const studentId = await getStudentId()
  const prefix = `${studentId}/${simulationId}`
  const { data: files } = await supabase.storage.from(BUCKET).list(prefix)
  if (files?.length) {
    await supabase.storage
      .from(BUCKET)
      .remove(files.map((f) => `${prefix}/${f.name}`))
  }
  const { error } = await supabase
    .from('univ_simulations')
    .delete()
    .eq('id', simulationId)
  if (error) throw error
}

// ─── 녹음 업로드 ───
export async function uploadRecording(blob, simulationId, filename) {
  const studentId = await getStudentId()
  const path = `${studentId}/${simulationId}/${filename}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ─── 헬퍼 ───
export function getQuestionTypeLabel(type) {
  return {
    insung: '인성 면접',
    gichul: '대입 기출문제',
    saenggibu: '생기부 예상문제',
  }[type] || type
}

export function formatSimDuration(sec) {
  const m = Math.floor((sec || 0) / 60)
  const s = (sec || 0) % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}