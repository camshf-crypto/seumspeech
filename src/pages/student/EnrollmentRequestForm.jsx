import { useState } from "react";
import { supabase } from "../../lib/supabase";

const GENDERS = ["남자", "여자"];
const ONE_DETAILS = ["취업면접", "입시면접", "CEO", "보이스", "프레젠테이션", "스피치"];
const GROUP_DETAILS = ["스피치", "보이스", "면접반"];
const VISIT_PATHS = ["블로그", "홈페이지", "지인소개", "간판", "유튜브", "영수증리뷰", "네이버지도"];

export default function EnrollmentRequestForm({ studentId, studentName, studentEmail, branches = [], onSubmitted }) {
  const [name, setName] = useState(studentName ?? "");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [email, setEmail] = useState(studentEmail ?? "");
  const [address, setAddress] = useState("");
  const [branchId, setBranchId] = useState("");
  const [lessonType, setLessonType] = useState("oneonone");
  const [lessonDetail, setLessonDetail] = useState("");
  const [visitPath, setVisitPath] = useState("");
  const [agree, setAgree] = useState(false);
  const [termsAgree, setTermsAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [saving, setSaving] = useState(false);

  const details = lessonType === "oneonone" ? ONE_DETAILS : GROUP_DETAILS;

  const submit = async () => {
    if (!name.trim()) return alert("성명을 입력하세요.");
    if (!phone.trim()) return alert("전화번호를 입력하세요.");
    if (!agree) return alert("개인정보 수집·이용에 동의해야 신청할 수 있습니다.");
    if (!termsAgree) return alert("이용약관 및 환불규정에 동의해야 신청할 수 있습니다.");

    setSaving(true);
    const { error } = await supabase.from("enrollment_requests").insert({
      student_id: studentId,
      name: name.trim(),
      gender: gender || null,
      phone: phone.trim(),
      birth: birth || null,
      email: email.trim() || null,
      address: address.trim() || null,
      branch_id: branchId || null,
      lesson_type: lessonType,
      lesson_detail: lessonDetail || null,
      visit_path: visitPath || null,
      privacy_agree: agree,
      status: "pending",
    });

    if (error) {
      setSaving(false);
      return alert("신청 실패: " + error.message);
    }

    await supabase.from("profiles")
      .update({ name: name.trim(), phone: phone.trim(), status: "pending", branch_id: branchId || null })
      .eq("id", studentId);

    setSaving(false);
    alert("가입 신청이 접수되었습니다. 원장 승인 후 이용할 수 있습니다.");
    if (onSubmitted) onSubmitted();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-seum-navy">세움스피치 회원 가입 신청서</h1>
        <p className="mt-1 text-sm text-slate-400">아래 항목을 작성하시면 원장 승인 후 이용하실 수 있습니다.</p>
      </div>

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">성명 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">성별</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button key={g} type="button" onClick={() => setGender(g)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${gender === g ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">전화번호 *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">생년월일</label>
            <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">이메일</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">주소 (동까지)</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="예: 강서구 마곡동" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue" />
          </div>
        </div>

        {/* 지점 */}
        {branches.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">희망 지점</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue">
              <option value="">지점 선택...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {/* 수강 형태 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">수강 형태</label>
          <div className="mb-2 flex gap-2">
            <button type="button" onClick={() => { setLessonType("oneonone"); setLessonDetail(""); }}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${lessonType === "oneonone" ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
              1:1 개인레슨
            </button>
            <button type="button" onClick={() => { setLessonType("group"); setLessonDetail(""); }}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${lessonType === "group" ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
              단체반
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {details.map((d) => (
              <button key={d} type="button" onClick={() => setLessonDetail(d)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${lessonDetail === d ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* 방문 경로 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">방문 경로</label>
          <div className="flex flex-wrap gap-2">
            {VISIT_PATHS.map((v) => (
              <button key={v} type="button" onClick={() => setVisitPath(v)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${visitPath === v ? "border-seum-blue bg-blue-50 text-seum-blue" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* 개인정보 동의 */}
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="mb-2 text-xs font-bold text-slate-600">개인정보 수집 및 이용 동의</p>
          <p className="text-xs leading-relaxed text-slate-500">
            세움스피치는 수강 목적의 회원 가입 신청 접수와 관련하여 필요한 개인정보(성명, 전화번호, 주소, 이메일 등)를 수집합니다.
            민감한 개인정보는 수집하거나 목적 외로 사용하지 않습니다.
          </p>
          <label className="mt-3 flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm font-medium text-slate-700">개인정보 수집 및 이용에 동의합니다. *</span>
          </label>
        </div>

        {/* 이용약관·환불규정 */}
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-600">세움스피치 이용약관 · 환불규정</p>
            <button type="button" onClick={() => setShowTerms((v) => !v)} className="text-xs font-medium text-seum-blue hover:underline">
              {showTerms ? "접기" : "전문 보기"}
            </button>
          </div>

          {showTerms && (
            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
              <p className="font-bold text-slate-700">제1조 (목적)</p>
              <p className="mb-2">세움스피치 "회사"가 제공하는 수강목적(이하 "서비스")의 가입 조건 및 이용에 관한 제반 사항과 기타 필요한 사항을 규정함을 목적으로 합니다.</p>

              <p className="font-bold text-slate-700">제2조 (이용약관의 효력 및 변경)</p>
              <p className="mb-2">이 약관은 세움스피치 홈페이지에 공시함으로써 효력이 발생합니다. 회사는 합리적인 사유가 발생할 경우 약관을 변경할 수 있으며, 변경된 약관은 적용일·개정 사유 등을 명시하여 최소 7일 전에 공시합니다.</p>

              <p className="font-bold text-slate-700">제3조 (약관 외 준칙)</p>
              <p className="mb-2">이 약관에 명시되지 않은 사항은 관계 법령에 규정이 있을 경우 그 규정에 따르며, 그렇지 않은 경우 일반적인 관례에 따릅니다.</p>

              <p className="font-bold text-slate-700">제4조 (환불규정)</p>
              <p className="mb-2">학원의 설립·운영 및 과외교습에 관한 법률 제18조 및 동법 시행령 별표4 기준에 따라 실시합니다.</p>

              <p className="font-bold text-slate-700">제5조 (시설이용 및 휴관)</p>
              <p className="mb-2">이용시간은 평일 10:00~21:00, 토요일 10:00~20:00입니다. (단 상황에 따라 조정될 수 있습니다.)</p>

              <p className="font-bold text-slate-700">제6조 (강의)</p>
              <p className="mb-2">수업 전날 밤 12시까지 불참을 통보하지 않으면 수업 횟수가 차감됩니다. 수업시간 내 녹음은 불가하며, 수업에 방해되는 행동 시 퇴실 조치될 수 있습니다.</p>

              <p className="font-bold text-slate-700">제7조 (저작권)</p>
              <p className="mb-2">수업 교재의 저작권은 세움스피치에 귀속됩니다. 수강생은 서비스를 통해 취득한 정보를 임의 가공·판매하는 등 상업적으로 사용할 수 없습니다.</p>

              <p className="font-bold text-slate-700">제8조 (손해배상)</p>
              <p>세움스피치는 무료로 제공되는 서비스와 관련하여 개인정보취급방침에서 정하는 내용에 해당되지 않는 사항에 대해서는 어떠한 손해도 책임지지 않습니다.</p>
            </div>
          )}

          <label className="mt-3 flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={termsAgree} onChange={(e) => setTermsAgree(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm font-medium text-slate-700">이용약관 및 환불규정에 동의합니다. *</span>
          </label>
        </div>

        <button type="button" onClick={submit} disabled={saving}
          className="w-full rounded-lg bg-seum-blue py-3 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
          {saving ? "신청 중..." : "가입 신청하기"}
        </button>
      </div>
    </div>
  );
}