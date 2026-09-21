// src/pages/student/SpeechTraining.jsx
// 스피치 훈련 탭
//
// 기본 인성·생기부·기출 탭에서 [답변 완성]을 누른 답변이 여기 연습 문제로 올라온다.
// 문항을 누르면 클로즈 스피치 연습(SpeechDrill)이 열린다.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import SpeechDrill from "./SpeechDrill";

const PASS = 70;

const GROUPS = [
  { key: "insung", label: "기본 인성" },
  { key: "saenggibu", label: "생기부 예상질문" },
  { key: "gichul", label: "기출문제" },
  { key: "etc", label: "그 밖의 질문" },
];

export default function SpeechTraining({ studentId, locked, onGoTab }) {
  const [items, setItems] = useState([]);     // [{ group, question, answer, drills }]
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);     // 연습 중인 항목

  const load = async () => {
    setLoading(true);

    // 1) 완성한 답변
    const { data: ans, error } = await supabase
      .from("interview_answers_v2")
      .select("*")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });
    if (error) console.error("완성 답변 조회 실패:", error);
    const answers = ans ?? [];
    const ids = answers.map((a) => a.question_id);

    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    // 2) 질문 — 세 군데에 나뉘어 있다
    const [iq, sq, uq] = await Promise.all([
      supabase.from("interview_questions_v2").select("id, question, tab_key, structure_name, speech_structure").in("id", ids),
      supabase.from("student_questions").select("id, question, source_type").in("id", ids),
      supabase.from("univ_questions").select("id, question, univ, major, type_code").in("id", ids),
    ]);

    // 기출은 유형 번호로 스피치 구조를 붙인다
    const codes = [...new Set((uq.data ?? []).map((q) => q.type_code).filter(Boolean))];
    const sMap = {};
    if (codes.length > 0) {
      const { data: st } = await supabase.from("interview_structures").select("*").in("id", codes);
      (st ?? []).forEach((x) => { sMap[x.id] = x; });
    }

    const qMap = {};
    (iq.data ?? []).forEach((q) => {
      qMap[q.id] = { ...q, group: q.tab_key === "insung" ? "insung" : "etc" };
    });
    (sq.data ?? []).forEach((q) => {
      qMap[q.id] = { ...q, tab_key: "saenggibu", group: "saenggibu" };
    });
    (uq.data ?? []).forEach((q) => {
      qMap[q.id] = {
        ...q,
        tab_key: "gichul",
        group: "gichul",
        structure_name: sMap[q.type_code]?.name ?? null,
        speech_structure: sMap[q.type_code]?.speech_structure ?? null,
      };
    });

    // 3) 연습 기록
    const { data: dr } = await supabase
      .from("speech_drills")
      .select("answer_id, level, retention, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    const dMap = {};
    (dr ?? []).forEach((d) => { (dMap[d.answer_id] = dMap[d.answer_id] || []).push(d); });

    setItems(
      answers
        .filter((a) => qMap[a.question_id])
        .map((a) => ({
          question: qMap[a.question_id],
          answer: a,
          drills: dMap[a.id] ?? [],
        }))
    );
    setLoading(false);
  };

  useEffect(() => { if (studentId) load(); /* eslint-disable-next-line */ }, [studentId]);

  // 통과한 가장 높은 단계
  const reached = (drills) => {
    let top = 0;
    for (let lv = 1; lv <= 5; lv++) {
      if (drills.some((d) => d.level === lv && (d.retention ?? 0) >= PASS)) top = lv;
      else break;
    }
    return top;
  };

  if (loading) return <p className="py-10 text-center text-slate-400">불러오는 중...</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
        <p className="text-base font-bold text-slate-500">아직 연습할 답변이 없어요</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          기본 인성·생기부·기출 탭에서 선생님 피드백을 받고 답변을 다 고쳤으면<br />
          <b className="text-green-600">✓ 답변 완성</b>을 누르세요. 그 답변이 여기 연습 문제로 올라와요.
        </p>
        {onGoTab && (
          <button type="button" onClick={() => onGoTab("insung")}
            className="mt-4 rounded-lg border border-seum-blue px-4 py-2 text-sm font-bold text-seum-blue hover:bg-blue-50">
            기본 인성으로 가기
          </button>
        )}
      </div>
    );
  }

  const totalDone = items.filter((it) => reached(it.drills) >= 5).length;

  return (
    <div>
      {/* 머리 */}
      <div className="mb-4 rounded-xl bg-seum-navy px-5 py-4 text-white">
        <p className="text-base font-bold">🎙 스피치 훈련</p>
        <p className="mt-1 text-sm text-white/70">
          완성한 답변을 보지 않고 내 말로 말할 수 있을 때까지. 가리는 부분을 늘려가며 5단계까지 연습해요.
        </p>
        <p className="mt-2 text-xs text-white/50">
          완성한 답변 {items.length}개 · 5단계까지 마친 답변 {totalDone}개
        </p>
      </div>

      {/* 묶음별 목록 */}
      {GROUPS.map((g) => {
        const list = items.filter((it) => it.question.group === g.key);
        if (list.length === 0) return null;
        return (
          <div key={g.key} className="mb-5">
            <p className="mb-2 text-xs font-bold text-slate-400">{g.label}</p>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {list.map((it, i) => {
                const top = reached(it.drills);
                const last = it.drills[0];
                return (
                  <div key={it.answer.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-seum-navy">{it.question.question}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {it.question.univ ? `${it.question.univ} · ${it.question.major} · ` : ""}
                        {last
                          ? <>
                              {top > 0 ? <b className="text-seum-blue">{top}단계 통과</b> : "1단계 연습 중"}
                              {last.retention != null && ` · 최근 ${last.retention}%`}
                              {` · ${it.drills.length}번 연습`}
                            </>
                          : "아직 연습하지 않았어요"}
                      </p>
                    </div>

                    {/* 단계 표시 */}
                    <div className="hidden shrink-0 gap-0.5 sm:flex">
                      {[1, 2, 3, 4, 5].map((lv) => (
                        <span key={lv}
                          className={`h-1.5 w-4 rounded-full ${lv <= top ? "bg-seum-blue" : "bg-slate-200"}`} />
                      ))}
                    </div>

                    <button type="button" onClick={() => setOpen(it)} disabled={locked}
                      className="shrink-0 rounded-lg bg-seum-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0d2647] disabled:opacity-40">
                      {last ? "이어서 연습" : "연습 시작"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {open && (
        <SpeechDrill
          studentId={studentId}
          question={open.question}
          answer={open.answer}
          tabKey={open.question.tab_key}
          onClose={() => { setOpen(null); load(); }}
        />
      )}
    </div>
  );
}