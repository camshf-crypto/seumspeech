import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    // 1) 로그인
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setLoading(false);
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    // 2) 역할 조회
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    setLoading(false);

    if (profileError || !profile) {
      // 프로필이 없으면 기본 홈으로
      navigate("/home");
      return;
    }

    // 3) 역할별 자동이동
    switch (profile.role) {
      case "master":
        navigate("/admin");
        break;
      case "teacher":
        navigate("/teacher");
        break;
      case "student":
        navigate("/my");
        break;
      default:
        navigate("/home");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-seum-navy">
          로그인
        </h1>

        <label className="mb-1 block text-sm font-medium text-slate-600">
          이메일
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
          placeholder="example@email.com"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600">
          비밀번호
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
          placeholder="비밀번호"
        />

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-lg bg-seum-blue py-3 font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-500">
          아직 회원이 아니신가요?{" "}
          <Link to="/signup" className="font-semibold text-seum-blue">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}