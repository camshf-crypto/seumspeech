import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    // 1) 회원가입 (auth)
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

    // 2) profiles에 이름/전화 채우기
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
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
          placeholder="6자 이상"
        />

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full rounded-lg bg-seum-blue py-3 font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
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