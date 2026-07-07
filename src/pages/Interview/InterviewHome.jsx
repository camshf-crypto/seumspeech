import InterviewHero from "../../components/interview/InterviewHero";
import InterviewFields from "../../components/interview/InterviewFields";
import InterviewCourses from "../../components/interview/InterviewCourses";
import InterviewReviews from "../../components/interview/InterviewReviews";
import InterviewGallery from "../../components/interview/InterviewGallery";

export default function InterviewHome() {
  return (
    <div className="pt-[136px]">
      <InterviewHero />
      <InterviewFields />
      <InterviewCourses />
      <InterviewReviews />
      <InterviewGallery />
    </div>
  );
}