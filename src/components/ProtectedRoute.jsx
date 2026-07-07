import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";

// allow: 허용할 역할 배열. 예) ['master'] 또는 ['teacher','master']
export default function ProtectedRoute({ allow, children }) {
  const { user, profile, role, loading } = useAuth();

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

  // 역할 제한이 있는데 안 맞으면 → 홈으로
  if (allow && !allow.includes(role)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}