import InterviewHero from "../../components/interview/InterviewHero";
import InterviewFields from "../../components/interview/InterviewFields";
import InterviewCourses from "../../components/interview/InterviewCourses";
import InterviewReviews from "../../components/interview/InterviewReviews";
import InterviewGallery from "../../components/interview/InterviewGallery";

export default function InterviewHome() {
  // 헤더가 화면에 고정돼 있어 그 높이만큼 아래로 밀어준다.
  // 모바일: 윗줄(80px)만 보임 → pt-20
  // PC(md~): 윗줄 80px + 아랫줄 메뉴 56px = 136px
  return (
    <div className="pt-20 md:pt-[136px]">
      <InterviewHero />
      <InterviewFields />
      <InterviewCourses />
      <InterviewReviews />
      <InterviewGallery />
    </div>
  );
}