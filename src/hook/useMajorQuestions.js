// src/hook/useMajorQuestions.js
import { supabase } from '../lib/supabase'

async function getStudentId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다')
  return user.id
}

// 학과 목록
export async function fetchMajors() {
  const { data, error } = await supabase
    .from('major_seeds')
    .select('code, name')
    .eq('is_active', true)
    .order('code')
  if (error) throw error
  return data ?? []
}

// 특정 학과의 day 목록 (문항 수 포함)
export async function fetchDays(majorCode) {
  const { data, error } = await supabase
    .from('major_questions')
    .select('day')
    .eq('major_code', majorCode)
    .eq('is_active', true)
  if (error) throw error
  const set = [...new Set((data ?? []).map((r) => r.day))].sort((a, b) => a - b)
  return set
}

// 특정 day의 문제 5개
export async function fetchQuestions(majorCode, day) {
  const { data, error } = await supabase
    .from('major_questions')
    .select('*')
    .eq('major_code', majorCode)
    .eq('day', day)
    .eq('is_active', true)
    .order('seq')
  if (error) throw error
  return data ?? []
}

// 내 진행 상황 (학과 전체)
export async function fetchMyProgress(majorCode) {
  const studentId = await getStudentId()
  const { data, error } = await supabase
    .from('major_progress')
    .select('*')
    .eq('student_id', studentId)
    .eq('major_code', majorCode)
  if (error) throw error
  return data ?? []
}

// 진행 저장 (day 단위 upsert)
export async function saveProgress({ majorCode, grade, day, objAnswers, subjAnswer, completed }) {
  const studentId = await getStudentId()
  const payload = {
    student_id: studentId,
    major_code: majorCode,
    grade,
    day,
    updated_at: new Date().toISOString(),
  }
  if (objAnswers !== undefined) payload.obj_answers = objAnswers
  if (subjAnswer !== undefined) payload.subj_answer = subjAnswer
  if (completed) {
    payload.status = 'completed'
    payload.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('major_progress')
    .upsert(payload, { onConflict: 'student_id,major_code,grade,day' })
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}