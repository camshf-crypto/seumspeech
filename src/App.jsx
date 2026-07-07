import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import InterviewHeader from "./components/interview/InterviewHeader";
import FloatingQuick from "./components/FloatingQuick";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Intro from "./pages/Intro";
import Home from "./pages/Home";
import InterviewHome from "./pages/Interview/InterviewHome";
import HighSchool from "./pages/Interview/HighSchool";
import University from "./pages/Interview/University";
import Transfer from "./pages/Interview/Transfer";
import Graduate from "./pages/Interview/Graduate";
import PublicOfficial from "./pages/Interview/PublicOfficial";
import LocalOfficial from "./pages/Interview/LocalOfficial";
import SeoulOfficial from "./pages/Interview/SeoulOfficial";
import Military from "./pages/Interview/Military";
import Company from "./pages/Interview/Company";
import CompanyNCS from "./pages/Interview/CompanyNCS";
import CompanyDebate from "./pages/Interview/CompanyDebate";
import Career from "./pages/Interview/Career";
import Executive from "./pages/Interview/Executive";
import InterviewAbout from "./pages/Interview/InterviewAbout";
import EnrollPage from "./components/EnrollPage";
import About from "./pages/About";
import Teachers from "./pages/Teachers";
import LocationPage from "./pages/Location";
import OneOnOne from "./pages/OneOnOne";
import Corp from "./pages/Corp";
import Reviews from "./pages/Reviews";
import Consult from "./pages/Consult";
import Notice from "./pages/Notice";
import KidsSpeech from "./pages/KidsSpeech";
import KidsLogic from "./pages/KidsLogic";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminLayout from "./pages/admin/AdminLayout";
import TeacherLayout from "./pages/teacher/TeacherLayout";
import StudentLayout from "./pages/student/StudentLayout";

export default function App() {
  const { pathname } = useLocation();
  const isIntro = pathname === "/";

  if (isIntro) {
    return (
      <div className="min-h-screen bg-white font-sans text-slate-900">
        <Routes>
          <Route path="/" element={<Intro />} />
        </Routes>
        <Footer />
      </div>
    );
  }

  // 로그인/회원가입 — 헤더·푸터 없이 전체화면
  if (pathname === "/login" || pathname === "/signup") {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    );
  }

  // 원장 어드민 — 원장만
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return (
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute allow={["master"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    );
  }

  // 선생님 강사실 — 선생님 + 원장 ('/teachers' 강사소개와 구분)
  if (pathname === "/teacher" || pathname.startsWith("/teacher/")) {
    return (
      <Routes>
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allow={["teacher", "master"]}>
              <TeacherLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    );
  }

  // 학생 내 강의실 — 학생만
  if (pathname === "/my" || pathname.startsWith("/my/")) {
    return (
      <Routes>
        <Route
          path="/my"
          element={
            <ProtectedRoute allow={["student"]}>
              <StudentLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    );
  }

  // 면접 사이트면 면접 전용 헤더, 아니면 스피치 헤더
  const isInterview = pathname.startsWith("/interview");

  // 메인 페이지(/home, /interview)는 Hero가 헤더 뒤까지 꽉 차야 하므로 위 여백 없음
  // 나머지 페이지(고입면접 포함)는 헤더에 안 가리도록 위 여백(136px) 줌
  const isMain =
    pathname === "/home" ||
    pathname === "/interview";

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {isInterview ? <InterviewHeader /> : <Header />}
      <FloatingQuick />
      <main className={isMain ? "" : "pt-[136px]"}>
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/interview" element={<InterviewHome />} />
          <Route path="/interview/high" element={<HighSchool />} />
          <Route path="/interview/exam" element={<University />} />
          <Route path="/interview/transfer" element={<Transfer />} />
          <Route path="/interview/grad" element={<Graduate />} />
          <Route path="/interview/public" element={<PublicOfficial />} />
          <Route path="/interview/public-local" element={<LocalOfficial />} />
          <Route path="/interview/public-seoul" element={<SeoulOfficial />} />
          <Route path="/interview/public-military" element={<Military />} />
          <Route path="/interview/company" element={<Company />} />
          <Route path="/interview/company-ncs" element={<CompanyNCS />} />
          <Route path="/interview/company-debate" element={<CompanyDebate />} />
          <Route path="/interview/career" element={<Career />} />
          <Route path="/interview/executive" element={<Executive />} />
          <Route path="/interview/about" element={<InterviewAbout />} />
          <Route path="/interview/teachers" element={<Teachers />} />
          <Route path="/interview/location" element={<LocationPage />} />
          <Route path="/enroll" element={<EnrollPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/location" element={<LocationPage />} />
          <Route path="/special/oneonone" element={<OneOnOne />} />
          <Route path="/corp" element={<Corp />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/consult" element={<Consult />} />
          <Route path="/notice" element={<Notice />} />
          <Route path="/kids/speech" element={<KidsSpeech />} />
          <Route path="/kids/logic" element={<KidsLogic />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}