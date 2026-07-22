import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const allAgreed = agreePrivacy && agreeTerms;

  const handleSignup = async () => {
    setError("");
    if (!name || !email || !password) {
      setError("이름, 이메일, 비밀번호를 모두 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (!allAgreed) {
      setError("개인정보 수집·이용 및 이용약관에 동의해주세요.");
      return;
    }
    setLoading(true);

    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (signErr) {
      setLoading(false);
      setError("에러: " + signErr.message);
      console.log("회원가입 에러 상세:", signErr);
      return;
    }

    if (data.user) {
      await supabase
        .from("profiles")
        .update({ name, phone })
        .eq("id", data.user.id);
    }

    setLoading(false);
    alert("회원가입이 완료되었습니다. 로그인해주세요.");
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-seum-navy">
          회원가입
        </h1>

        <label className="mb-1 block text-sm font-medium text-slate-600">이름</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
          placeholder="홍길동"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600">전화번호</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
          placeholder="010-1234-5678"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600">이메일</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
          placeholder="example@email.com"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignup()}
          className="mb-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
          placeholder="6자 이상"
        />

        {/* 개인정보 수집·이용 동의 */}
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-seum-blue"
              />
              <span className="text-sm text-slate-700">
                개인정보 수집·이용에 동의합니다.{" "}
                <span className="text-red-500">*</span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowPrivacy((v) => !v)}
              className="shrink-0 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              {showPrivacy ? "닫기" : "전문 보기"}
            </button>
          </div>
          {showPrivacy && (
            <p className="mt-2 whitespace-pre-line border-t border-slate-200 pt-2 text-xs leading-relaxed text-slate-500">
              세움스피치는 회원 가입 및 서비스 제공을 위해 아래와 같이 개인정보를 수집·이용합니다.

              1. 수집 항목: 성명, 전화번호, 이메일
              2. 수집·이용 목적: 회원 식별, 수강 관리, 공지 및 안내
              3. 보유 기간: 회원 탈퇴 시까지 (관련 법령에 따라 필요한 경우 해당 기간까지 보관)

              귀하는 동의를 거부할 권리가 있으며, 동의를 거부할 경우 회원가입이 제한됩니다.
            </p>
          )}
        </div>

        {/* 이용약관 동의 */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-seum-blue"
              />
              <span className="text-sm text-slate-700">
                이용약관에 동의합니다. <span className="text-red-500">*</span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowTerms((v) => !v)}
              className="shrink-0 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              {showTerms ? "닫기" : "전문 보기"}
            </button>
          </div>
          {showTerms && (
            <p className="mt-2 whitespace-pre-line border-t border-slate-200 pt-2 text-xs leading-relaxed text-slate-500">
              세움스피치 이용약관

              1. 회원은 정확한 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.
              2. 서비스 내 학습 자료 및 콘텐츠의 무단 복제·배포를 금합니다.
              3. 수강 및 환불에 관한 사항은 별도의 환불 규정을 따릅니다.
              4. 회원의 귀책 사유로 인한 불이익에 대해 회사는 책임지지 않습니다.
            </p>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSignup}
          disabled={loading || !allAgreed}
          className="w-full rounded-lg bg-seum-blue py-3 font-bold text-white hover:bg-[#2a63c4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "가입 중..." : "회원가입"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-500">
          이미 회원이신가요?{" "}
          <Link to="/login" className="font-semibold text-seum-blue">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}