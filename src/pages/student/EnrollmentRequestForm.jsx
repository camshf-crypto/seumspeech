import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const GENDERS = ["남자", "여자"];
const VISIT_PATHS = ["블로그", "홈페이지", "지인소개", "간판", "유튜브", "영수증리뷰", "네이버지도"];

// 1:1 항목은 실제 수업(courses) 이름과 똑같이 맞춰야 원장 화면에서 자동 연결된다
// hint 는 학생이 잘못 고르지 않도록 붙이는 짧은 설명
const ONE_DETAILS = [
  { name: "대입면접", hint: "대학 수시·정시" },
  { name: "고입면접", hint: "특목고·자사고" },
  { name: "편입면접", hint: "대학 편입" },
  { name: "공무원면접", hint: "국가직·지방직" },
  { name: "공기업면접", hint: "공기업·공공기관" },
  { name: "사기업면접", hint: "일반 기업 취업" },
  { name: "병원면접", hint: "간호사·의료직" },
  { name: "스피치", hint: "발표·말하기" },
  { name: "보이스", hint: "발성·발음" },
  { name: "프레젠테이션", hint: "PT·자료 발표" },
];
const GROUP_DETAILS = [
  { name: "스피치", hint: "발표·말하기" },
  { name: "보이스", hint: "발성·발음" },
  { name: "면접반", hint: "면접 대비" },
];

// 생년월일: 숫자만 받아 1987-06-20 형태로 자동 변환
function formatBirth(v) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return d.slice(0, 4) + "-" + d.slice(4);
  return d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6);
}

export default function EnrollmentRequestForm({ onSubmitted }) {
  const [branches, setBranches] = useState([]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [branchId, setBranchId] = useState("");
  const [lessonType, setLessonType] = useState("oneonone");
  const [lessonDetail, setLessonDetail] = useState("");
  const [visitPath, setVisitPath] = useState("");
  const [agree, setAgree] = useState(false);
  const [termsAgree, setTermsAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // 완료 후 로그인 정보 안내

  const details = lessonType === "oneonone" ? ONE_DETAILS : GROUP_DETAILS;

  // 로그인 없이 쓰는 화면이므로 지점 목록을 직접 불러온다
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");
      if (error) {
        console.error("지점 조회 실패:", error);
        return;
      }
      setBranches(data ?? []);
    })();
  }, []);

  const submit = async () => {
    if (!name.trim()) return alert("성명을 입력하세요.");
    if (!phone.trim()) return alert("전화번호를 입력하세요.");
    // 이메일이 곧 로그인 아이디이므로 필수로 받는다
    if (!email.trim()) return alert("이메일을 입력하세요. 로그인 아이디로 사용됩니다.");
    if (!gender) return alert("성별을 선택하세요.");
    if (birth.length !== 10) return alert("생년월일을 8자리로 입력하세요. (예: 19870620)");
    if (!address.trim()) return alert("주소를 입력하세요.");
    if (!branchId) return alert("희망 지점을 선택하세요.");
    if (!lessonDetail) return alert("수강 과목을 선택하세요.");
    if (!agree) return alert("개인정보 수집·이용에 동의해야 신청할 수 있습니다.");
    if (!termsAgree) return alert("이용약관 및 환불규정에 동의해야 신청할 수 있습니다.");

    setSaving(true);

    // 계정 생성은 service_role 키가 필요해 Edge Function에서 처리한다
    const { data, error } = await supabase.functions.invoke("create-student", {
      body: {
        name: name.trim(),
        gender,
        phone: phone.trim(),
        birth: birth || null,
        email: email.trim(),
        address: address.trim() || null,
        branch_id: branchId,
        lesson_type: lessonType,
        lesson_detail: lessonDetail,
        visit_path: visitPath || null,
        privacy_agree: true,
        terms_agree: true,
      },
    });

    setSaving(false);

    if (error) {
      // invoke 는 400/409 응답이면 본문을 넘겨주지 않으므로 직접 읽는다
      let msg = error.message;
      try {
        const body = await error.context.json();
        if (body?.error) msg = body.error;
      } catch (_) {
        // 본문을 읽지 못하면 원래 메시지를 그대로 쓴다
      }
      return alert(msg);
    }

    if (data?.error) return alert(data.error);

    setDone({ email: data.email, password: data.initial_password });
    if (onSubmitted) onSubmitted();
  };

  // 완료 화면 — 학생이 이 자리에서 로그인 정보를 확인하고 가야 한다
  if (done) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-seum-navy">등록이 완료되었습니다</h1>
          <p className="mb-6 text-sm text-slate-500">
            아래 정보로 바로 로그인하실 수 있습니다. 꼭 기억해 주세요.
          </p>

          <div className="mb-6 space-y-3 bg-slate-50 p-6 text-left">
            <div>
              <p className="text-xs text-slate-400">아이디 (이메일)</p>
              <p className="text-lg font-bold text-seum-navy">{done.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">초기 비밀번호</p>
              <p className="text-lg font-bold text-seum-navy">{done.password}</p>
              <p className="mt-1 text-xs text-slate-500">
                seum + 전화번호 뒤 4자리입니다.
              </p>
            </div>
          </div>

          <p className="mb-6 bg-amber-50 p-3 text-sm text-amber-700">
            처음 로그인하시면 비밀번호를 바꾸는 화면이 나옵니다.
          </p>

          <button
            type="button"
            onClick={() => (window.location.href = "/login")}
            className="w-full bg-seum-blue py-3.5 font-bold text-white hover:bg-[#2a63c4]"
          >
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-seum-navy">세움스피치 회원 등록</h1>
        <p className="mt-1 text-sm text-slate-400">
          아래 항목을 작성하시면 바로 이용하실 수 있습니다.
        </p>
      </div>

      <div className="border border-slate-200 bg-white p-6 shadow-sm">
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
              className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              성별 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`flex-1 border py-2.5 text-sm font-medium transition ${
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
              className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
            />
            <p className="mt-1 text-xs text-slate-400">
              뒤 4자리가 초기 비밀번호에 사용됩니다.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              생년월일 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={birth}
              onChange={(e) => setBirth(formatBirth(e.target.value))}
              placeholder="19870620"
              maxLength={10}
              className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
            />
            <p className="mt-1 text-xs text-slate-400">숫자 8자리만 입력하면 됩니다.</p>
          </div>
        </div>

        {/* 이메일 + 주소 */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
            />
            <p className="mt-1 text-xs text-slate-400">로그인 아이디로 사용됩니다.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              주소 (동까지) <span className="text-red-500">*</span>
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 강서구 마곡동"
              className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
            />
          </div>
        </div>

        {/* 희망 지점 (필수) */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">
            희망 지점 <span className="text-red-500">*</span>
          </label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={`w-full border px-3 py-2.5 outline-none focus:border-seum-blue ${
              branchId ? "border-slate-300 text-slate-700" : "border-red-300 text-slate-400"
            }`}
          >
            <option value="">지점 선택...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {!branchId && (
            <p className="mt-1 text-xs text-red-500">다니실 지점을 선택해주세요.</p>
          )}
        </div>

        {/* 수강 과목 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-slate-600">
            수강 과목 <span className="text-red-500">*</span>
          </label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setLessonType("oneonone"); setLessonDetail(""); }}
              className={`border py-3 text-sm font-bold transition ${
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
              className={`border py-3 text-sm font-bold transition ${
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
                key={d.name}
                type="button"
                onClick={() => setLessonDetail(d.name)}
                className={`border px-3 py-2 text-left transition ${
                  lessonDetail === d.name
                    ? "border-seum-blue bg-seum-blue text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-medium">{d.name}</span>
                <span className={`block text-[11px] ${lessonDetail === d.name ? "text-white/70" : "text-slate-400"}`}>
                  {d.hint}
                </span>
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
                className={`border px-3 py-1.5 text-sm font-medium transition ${
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
        <div className="mb-3 bg-slate-50 p-4">
          <p className="mb-1.5 text-sm font-bold text-slate-700">개인정보 수집 및 이용 동의</p>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            세움스피치는 수강 목적의 회원 등록과 관련하여 필요한 개인정보(성명, 전화번호, 주소, 이메일 등)를 수집합니다. 민감한 개인정보는 수집하거나 목적 외로 사용하지 않습니다.
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
        <div className="mb-6 bg-slate-50 p-4">
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
          disabled={saving || !gender || birth.length !== 10 || !address.trim() || !branchId || !lessonDetail || !agree || !termsAgree}
          className="w-full bg-seum-blue py-3.5 font-bold text-white hover:bg-[#2a63c4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "등록 중..." : "등록하기"}
        </button>
      </div>
    </div>
  );
}