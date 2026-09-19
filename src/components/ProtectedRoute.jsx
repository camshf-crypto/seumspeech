import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { Navigate } from "react-router-dom";

// 첫 로그인 학생용 비밀번호 변경 화면
// 이 화면을 통과하지 않으면 다른 화면으로 갈 수 없다
function ChangePassword({ onDone }) {
  const { signOut } = useAuth();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (pw1.length < 6) return alert("비밀번호는 6자 이상으로 정해주세요.");
    if (pw1 !== pw2) return alert("두 비밀번호가 서로 다릅니다.");

    setSaving(true);

    const { error: pwErr } = await supabase.auth.updateUser({ password: pw1 });
    if (pwErr) {
      setSaving(false);
      return alert("변경 실패: " + pwErr.message);
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);

    setSaving(false);

    if (profErr) {
      return alert("저장 실패: " + profErr.message);
    }

    alert("비밀번호가 변경되었습니다.");
    await onDone();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-seum-navy">비밀번호를 변경해주세요</h1>
        <p className="mb-6 text-sm text-slate-500">
          처음 로그인하셨습니다. 안전한 이용을 위해 비밀번호를 새로 정해주세요.
        </p>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">새 비밀번호</label>
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            placeholder="6자 이상"
            className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-slate-600">새 비밀번호 확인</label>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="한 번 더 입력"
            className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-seum-blue"
          />
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || !pw1 || !pw2}
          className="w-full bg-seum-blue py-3 font-bold text-white hover:bg-[#2a63c4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "변경 중..." : "비밀번호 변경하기"}
        </button>

        <button
          type="button"
          onClick={signOut}
          className="mt-3 w-full py-2 text-sm text-slate-400 hover:text-slate-600"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

// allow: 허용할 역할 배열. 예) ['master'] 또는 ['teacher','master']
export default function ProtectedRoute({ allow, children }) {
  const { user, profile, role, loading, mustChangePassword, refreshProfile } = useAuth();

  // 세션 로딩 중
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        불러오는 중...
      </div>
    );
  }

  // 로그인 안 됨 → 로그인 페이지로
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 로그인은 됐는데 프로필(역할) 아직 안 불러옴 → 잠깐 대기
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        권한 확인 중...
      </div>
    );
  }

  // 초기 비밀번호를 아직 안 바꿨으면 여기서 막는다
  if (mustChangePassword) {
    return <ChangePassword onDone={refreshProfile} />;
  }

  // 역할 제한이 있는데 안 맞으면 → 홈으로
  if (allow && !allow.includes(role)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}