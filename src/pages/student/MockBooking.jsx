// src/pages/student/MockBooking.jsx
// 학생 — 모의면접 신청
//
// 정해진 시간표에서 빈자리를 골라 바로 예약한다. 학생당 1회.
//   2026-10-21부터 매주 수·목, 18:30 / 20:00, 타임당 5명
//   (바꿀 때는 아래 MOCK_SCHEDULE 과 SQL 의 mock_check() 숫자를 같이 고친다)
// 예약할 때 이번에 면접 보는 학교·학과(필수)·전형(선택)을 받는다.
// 면접 3일 전부터는 취소·변경할 수 없다 (21일 면접이면 17일까지만). SQL 정책과 숫자를 같이 맞춘다.
//
// 쓰는 곳
//   학생 왼쪽 메뉴 "모의면접 신청"   <MockBooking studentId={...} asPage />   (화면 전체)
//   면접 화면 버튼                 <MockBooking studentId={...} onClose={...} /> (팝업)

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export const MOCK_SCHEDULE = {
  start: "2026-10-21",
  weekdays: [3, 4],           // 0=일 … 3=수, 4=목
  times: ["18:30", "20:00"],
  cap: 5,
  lockDays: 3,                // 면접 며칠 전부터 취소·변경을 막을지
  weeksAhead: 4,              // 오늘부터 몇 주치를 보여줄지
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// 날짜는 한국 시간 기준 "YYYY-MM-DD" 문자열로 다룬다
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const label = (s) => {
  const d = parse(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
};

// 예약할 수 있는 날짜 목록 (내일부터, 시작일 이후)
function slotDates() {
  const { start, weekdays, weeksAhead } = MOCK_SCHEDULE;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const from = parse(start) > tomorrow ? parse(start) : tomorrow;
  const to = new Date(from);
  to.setDate(from.getDate() + weeksAhead * 7);

  const out = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    if (weekdays.includes(d.getDay())) out.push(ymd(d));
  }
  return out;
}

export default function MockBooking({ studentId, onClose, asPage: asPageProp = false }) {
  // 닫는 함수가 안 넘어오면(메뉴에서 열면) 팝업이 아니라 화면으로 띄운다 — 닫을 수 없는 팝업이 되지 않게
  const asPage = asPageProp || !onClose;
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(null);        // 내 예약
  const [picks, setPicks] = useState([]);        // 기출 탭에서 고른 지원 목록
  const [branchId, setBranchId] = useState(null);
  const [counts, setCounts] = useState({});      // { "2026-10-21|18:30": 3 }

  // 입력
  const [univ, setUniv] = useState("");
  const [major, setMajor] = useState("");
  const [admission, setAdmission] = useState("");
  const [note, setNote] = useState("");
  const [slot, setSlot] = useState(null);        // { date, time }
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const dates = useMemo(() => slotDates(), []);

  const load = async () => {
    setLoading(true);
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("mock_requests").select("*").eq("student_id", studentId).maybeSingle(),
      supabase.from("student_univ_picks").select("*").eq("student_id", studentId).order("created_at"),
      supabase.from("profiles").select("branch_id").eq("id", studentId).maybeSingle(),
      dates.length
        ? supabase.rpc("mock_slot_counts", { p_from: dates[0], p_to: dates[dates.length - 1] })
        : Promise.resolve({ data: [] }),
    ]);
    if (r1.error) console.error("내 예약 조회 실패:", r1.error);
    if (r4.error) console.error("자리 수 조회 실패:", r4.error);
    setMine(r1.data ?? null);
    setPicks(r2.data ?? []);
    setBranchId(r3.data?.branch_id ?? null);
    const c = {};
    (r4.data ?? []).forEach((x) => { c[`${x.slot_date}|${x.slot_time}`] = x.booked; });
    setCounts(c);
    setLoading(false);
  };

  useEffect(() => { if (studentId) load(); /* eslint-disable-next-line */ }, [studentId]);

  // 창이 열려 있는 동안 뒤 화면 스크롤 막기 (팝업일 때만)
  useEffect(() => {
    if (asPage) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [asPage]);

  const usePick = (p) => {
    setUniv(p.univ ?? "");
    setMajor(p.major ?? "");
    setAdmission(p.admission ?? "");
  };

  const left = (date, time) => MOCK_SCHEDULE.cap - (counts[`${date}|${time}`] ?? 0);

  const submit = async () => {
    setErr("");
    if (!univ.trim() || !major.trim()) return setErr("면접 보는 학교와 학과를 적어 주세요.");
    if (!slot) return setErr("날짜와 시간을 골라 주세요.");
    if (!window.confirm(
      `${label(slot.date)} ${slot.time}\n${univ.trim()} · ${major.trim()}\n\n이 시간으로 모의면접을 신청할까요?\n신청은 한 번만 할 수 있어요. (면접 3일 전부터는 취소·변경할 수 없어요)`
    )) return;

    setSaving(true);
    const { error } = await supabase.from("mock_requests").insert({
      student_id: studentId,
      branch_id: branchId,
      slot_date: slot.date,
      slot_time: slot.time,
      target_univ: univ.trim(),
      target_major: major.trim(),
      target_admission: admission.trim() || null,
      note: note.trim() || null,
    });
    setSaving(false);

    if (error) {
      const m = error.message || "";
      if (error.code === "23505") setErr("이미 신청했어요. 모의면접은 한 번만 신청할 수 있어요.");
      else if (/[가-힣]/.test(m)) setErr(m.replace(/^.*?:\s*/, "")); // DB가 보낸 한국어 안내 그대로
      else setErr("신청하지 못했어요. 잠시 후 다시 해 주세요.");
      load();
      return;
    }
    load();
  };

  const cancel = async () => {
    if (!window.confirm("모의면접 신청을 취소할까요?\n취소하면 다른 시간으로 다시 신청할 수 있어요.")) return;
    const { error } = await supabase.from("mock_requests").delete().eq("id", mine.id);
    if (error) return alert(`취소하지 못했어요. 면접 ${MOCK_SCHEDULE.lockDays}일 전부터는 취소·변경할 수 없어요.\n선생님께 말씀해 주세요.`);
    setSlot(null);
    load();
  };

  // 취소·변경 마감: 면접 lockDays 일 전 전날까지 (21일 면접, 3일 → 17일까지)
  const lockFrom = new Date();
  lockFrom.setDate(lockFrom.getDate() + MOCK_SCHEDULE.lockDays);
  const deadline = mine ? (() => {
    const d = new Date(`${mine.slot_date}T00:00:00`);
    d.setDate(d.getDate() - MOCK_SCHEDULE.lockDays - 1);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  })() : "";
  const canCancel = mine && mine.status === "booked" && mine.slot_date > ymd(lockFrom);

  // 안쪽 내용은 한 번만 만들고, 페이지/팝업 껍데기만 바꾼다
  // (껍데기를 함수 컴포넌트로 만들면 글자를 칠 때마다 입력칸이 새로 그려져 커서가 빠진다)
  const body = (
    <>
        {/* 머리 */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-seum-navy">📅 모의면접 신청</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              매주 수·목 {MOCK_SCHEDULE.times.join(" / ")} · 한 타임 {MOCK_SCHEDULE.cap}명 · 한 번만 신청 · 면접 {MOCK_SCHEDULE.lockDays}일 전부터 취소·변경 불가
            </p>
          </div>
          {!asPage && (
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
          )}
        </div>

        <div className={asPage ? "px-5 py-4" : "min-h-0 flex-1 overflow-y-auto px-5 py-4"}>
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>
          ) : mine ? (
            /* ── 이미 신청함 ── */
            <div>
              <div className={`border p-4 ${mine.status === "booked" ? "border-seum-blue bg-blue-50/50" : "border-slate-200 bg-slate-50"}`}>
                <p className="text-xs font-bold text-seum-blue">
                  {mine.status === "booked" ? "신청 완료" : mine.status === "done" ? "모의면접을 봤어요" : "참석하지 않음"}
                </p>
                <p className="mt-1 text-xl font-extrabold text-seum-navy">
                  {label(mine.slot_date)} {mine.slot_time}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {mine.target_univ} · {mine.target_major}
                  {mine.target_admission ? ` · ${mine.target_admission}` : ""}
                </p>
                {mine.note && <p className="mt-2 text-xs text-slate-500">메모: {mine.note}</p>}
              </div>

              {mine.status === "booked" && (
                <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                  <li>· 면접 10분 전까지 학원에 와 주세요.</li>
                  <li>· 핸드폰을 충전해 오세요. 면접 화면의 <b>🎙 현장 면접 대기</b>로 함께 녹음해요.</li>
                  <li>· 면접 보는 학교의 기출 질문이 나오니 미리 연습해 두세요.</li>
                </ul>
              )}

              {canCancel && (
                <>
                  <button type="button" onClick={cancel}
                    className="mt-5 w-full border border-slate-300 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                    신청 취소하고 다시 고르기
                  </button>
                  <p className="mt-2 text-center text-xs text-slate-400">
                    <b className="text-slate-600">{deadline}</b>까지만 취소·변경할 수 있어요. 면접 {MOCK_SCHEDULE.lockDays}일 전부터는 바꿀 수 없어요.
                  </p>
                </>
              )}
              {mine.status === "booked" && !canCancel && (
                <p className="mt-4 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  면접 {MOCK_SCHEDULE.lockDays}일 전부터는 취소·변경할 수 없어요. 못 오게 되면 선생님께 꼭 말씀해 주세요.
                </p>
              )}
            </div>
          ) : (
            /* ── 신청하기 ── */
            <div className="space-y-5">
              {/* 학교·학과 */}
              <div>
                <p className="mb-1.5 text-xs font-bold text-slate-500">① 이번에 면접 보는 학교 · 학과</p>
                {picks.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {picks.map((p) => {
                      const on = univ === p.univ && major === p.major;
                      return (
                        <button key={p.id} type="button" onClick={() => usePick(p)}
                          className={`px-2.5 py-1.5 text-xs font-medium transition ${
                            on ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}>
                          {p.univ} · {p.major}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input value={univ} onChange={(e) => setUniv(e.target.value)} placeholder="학교 (예: 경희대학교)"
                    className="border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                  <input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="학과 (예: 미디어학과)"
                    className="border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                </div>
                <input value={admission} onChange={(e) => setAdmission(e.target.value)} placeholder="전형 (선택, 예: 학생부종합)"
                  className="mt-2 w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
                {picks.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-400">내 지원 목록을 누르면 자동으로 채워져요.</p>
                )}
              </div>

              {/* 날짜·시간 */}
              <div>
                <p className="mb-1.5 text-xs font-bold text-slate-500">② 날짜와 시간</p>
                {dates.length === 0 ? (
                  <p className="border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
                    지금 신청할 수 있는 날짜가 없어요.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {dates.map((d) => (
                      <div key={d} className="flex items-center gap-2 border border-slate-200 px-3 py-2">
                        <span className="w-28 shrink-0 text-sm font-bold text-seum-navy">{label(d)}</span>
                        <div className="flex flex-1 gap-1.5">
                          {MOCK_SCHEDULE.times.map((t) => {
                            const n = left(d, t);
                            const full = n <= 0;
                            const on = slot?.date === d && slot?.time === t;
                            return (
                              <button key={t} type="button" disabled={full}
                                onClick={() => setSlot({ date: d, time: t })}
                                className={`flex-1 py-1.5 text-sm font-bold transition ${
                                  on ? "bg-seum-blue text-white"
                                  : full ? "cursor-not-allowed bg-slate-50 text-slate-300"
                                  : "bg-slate-100 text-slate-700 hover:bg-blue-50"
                                }`}>
                                {t}
                                <span className={`ml-1 text-[11px] font-medium ${on ? "text-blue-100" : full ? "" : n <= 2 ? "text-amber-600" : "text-slate-400"}`}>
                                  {full ? "마감" : `${n}자리`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 메모 */}
              <div>
                <p className="mb-1.5 text-xs font-bold text-slate-500">③ 선생님께 한마디 (선택)</p>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 학교 끝나고 바로 와서 조금 늦을 수 있어요"
                  className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
              </div>

              {err && <p className="bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
            </div>
          )}
        </div>

        {/* 아래 버튼 */}
        {!loading && !mine && (
          <div className="shrink-0 border-t border-slate-200 px-5 py-3">
            <button type="button" onClick={submit} disabled={saving}
              className="w-full bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
              {saving ? "신청하는 중..." : slot ? `${label(slot.date)} ${slot.time} 신청하기` : "신청하기"}
            </button>
          </div>
        )}
    </>
  );

  if (asPage) {
    return <div className="w-full max-w-2xl border border-slate-200 bg-white">{body}</div>;
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-3"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}>
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-lg flex-col bg-white">{body}</div>
    </div>
  );
}