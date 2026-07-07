import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function TeacherMyPageTab({ teacherId }) {
  const { profile } = useAuth();

  // 프로필 폼
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // 비밀번호
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // 담당 현황
  const [stats, setStats] = useState({ students: 0, groupCourses: 0, oneCourses: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setPhone(profile.phone ?? "");
    setEmail(profile.email ?? "");
  }, [profile]);

  useEffect(() => {
    const loadStats = async () => {
      setLoadingStats(true);

      // 담당 학생 수 (enrollments.teacher_id = 나, 중복 학생 제거)
      const { data: enr } = await supabase
        .from("enrollments")
        .select("student_id, courses(type)")
        .eq("teacher_id", teacherId);

      const list = enr ?? [];
      const uniqStudents = new Set(list.map((e) => e.student_id).filter(Boolean));

      // 담당 반 수 (courses.teacher_id = 나)
      const { data: cs } = await supabase
        .from("courses")
        .select("id, type")
        .eq("teacher_id", teacherId)
        .eq("active", true);

      const courses = cs ?? [];
      const groupCourses = courses.filter((c) => c.type !== "oneonone").length;
      const oneCourses = courses.filter((c) => c.type === "oneonone").length;

      setStats({
        students: uniqStudents.size,
        groupCourses,
        oneCourses,
      });
      setLoadingStats(false);
    };
    if (teacherId) loadStats();
  }, [teacherId]);

  const saveProfile = async () => {
    if (!name.trim()) return alert("이름을 입력하세요.");
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), phone: phone.trim() || null })
      .eq("id", teacherId);
    setSavingProfile(false);
    if (error) return alert("저장 실패: " + error.message);
    alert("내 정보가 저장되었습니다. (이름은 새로고침 후 반영됩니다)");
  };

  const changePassword = async () => {
    if (pw1.length < 6) return alert("비밀번호는 6자 이상으로 입력하세요.");
    if (pw1 !== pw2) return alert("두 비밀번호가 일치하지 않습니다.");
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setSavingPw(false);
    if (error) return alert("변경 실패: " + error.message);
    setPw1("");
    setPw2("");
    alert("비밀번호가 변경되었습니다.");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* 담당 현황 요약 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <h2 className="mb-4 font-bold text-seum-navy">담당 현황</h2>
        {loadingStats ? (
          <p className="text-slate-400">불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-seum-blue">{stats.students}</p>
              <p className="mt-1 text-xs text-slate-500">담당 학생</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-seum-navy">{stats.groupCourses}</p>
              <p className="mt-1 text-xs text-slate-500">단체반</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-seum-navy">{stats.oneCourses}</p>
              <p className="mt-1 text-xs text-slate-500">1:1 수업</p>
            </div>
          </div>
        )}
      </div>

      {/* 내 정보 수정 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <h2 className="mb-4 font-bold text-seum-navy">내 정보</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">연락처</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">이메일 (변경 불가)</label>
            <input
              value={email}
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="rounded-lg bg-seum-blue px-6 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
            >
              {savingProfile ? "저장 중..." : "정보 저장"}
            </button>
          </div>
        </div>
      </div>

      {/* 비밀번호 변경 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <h2 className="mb-4 font-bold text-seum-navy">비밀번호 변경</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">새 비밀번호</label>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="6자 이상"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">새 비밀번호 확인</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="한 번 더 입력"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={changePassword}
              disabled={savingPw}
              className="rounded-lg border border-seum-blue px-6 py-2 text-sm font-bold text-seum-blue hover:bg-blue-50 disabled:opacity-60"
            >
              {savingPw ? "변경 중..." : "비밀번호 변경"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}