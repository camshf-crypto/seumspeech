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
      terms_agree: termsAgree,
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* 성명 + 성별 */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              성명 <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="성명"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">성별</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition ${
                    gender === g
                      ? "border-seum-blue bg-seum-blue text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 전화번호 + 생년월일 */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">생년월일</label>
            <input
              type="date"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-600 outline-none focus:border-seum-blue"
            />
          </div>
        </div>

        {/* 이메일 + 주소 */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">이메일</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">주소 (동까지)</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 강서구 마곡동"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
            />
          </div>
        </div>

        {/* 희망 지점 */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">희망 지점</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-600 outline-none focus:border-seum-blue"
          >
            <option value="">지점 선택...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* 수강 형태 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-slate-600">수강 형태</label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setLessonType("oneonone"); setLessonDetail(""); }}
              className={`rounded-lg border py-3 text-sm font-bold transition ${
                lessonType === "oneonone"
                  ? "border-seum-blue bg-blue-50 text-seum-blue"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              1:1 개인레슨
            </button>
            <button
              type="button"
              onClick={() => { setLessonType("group"); setLessonDetail(""); }}
              className={`rounded-lg border py-3 text-sm font-bold transition ${
                lessonType === "group"
                  ? "border-seum-blue bg-blue-50 text-seum-blue"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              단체반
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {details.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setLessonDetail(d)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  lessonDetail === d
                    ? "border-seum-blue bg-seum-blue text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* 방문 경로 */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-600">방문 경로</label>
          <div className="flex flex-wrap gap-2">
            {VISIT_PATHS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisitPath(v)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  visitPath === v
                    ? "border-seum-blue bg-seum-blue text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* 개인정보 수집·이용 동의 */}
        <div className="mb-3 rounded-xl bg-slate-50 p-4">
          <p className="mb-1.5 text-sm font-bold text-slate-700">개인정보 수집 및 이용 동의</p>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            세움스피치는 수강 목적의 회원 가입 신청 접수와 관련하여 필요한 개인정보(성명, 전화번호, 주소, 이메일 등)를 수집합니다. 민감한 개인정보는 수집하거나 목적 외로 사용하지 않습니다.
          </p>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="h-4 w-4 accent-seum-blue"
            />
            <span className="text-sm text-slate-700">
              개인정보 수집 및 이용에 동의합니다. <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {/* 이용약관·환불규정 동의 */}
        <div className="mb-6 rounded-xl bg-slate-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">세움스피치 이용약관·환불규정</p>
            <button
              type="button"
              onClick={() => setShowTerms((v) => !v)}
              className="text-xs font-semibold text-seum-blue"
            >
              {showTerms ? "닫기" : "전문 보기"}
            </button>
          </div>
          {showTerms && (
            <p className="mb-3 whitespace-pre-line border-b border-slate-200 pb-3 text-xs leading-relaxed text-slate-500">
              1. 수강료는 등록 시 납부하며, 환불은 학원의 설립·운영 및 과외교습에 관한 법률 시행령에 따른 환불 규정을 따릅니다.
              2. 수강 시작 전 환불은 전액, 수강 시작 후에는 경과 기간에 따라 잔여 수강료를 환불합니다.
              3. 학습 자료 및 콘텐츠의 무단 복제·배포를 금합니다.
              4. 회원의 귀책 사유로 인한 불이익에 대해 학원은 책임지지 않습니다.
            </p>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={termsAgree}
              onChange={(e) => setTermsAgree(e.target.checked)}
              className="h-4 w-4 accent-seum-blue"
            />
            <span className="text-sm text-slate-700">
              이용약관 및 환불규정에 동의합니다. <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={saving || !agree || !termsAgree}
          className="w-full rounded-lg bg-seum-blue py-3.5 font-bold text-white hover:bg-[#2a63c4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "신청 중..." : "가입 신청하기"}
        </button>
      </div>
    </div>
  );
}