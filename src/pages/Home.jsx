import Hero from "../components/Hero";
import YoutubeSlider from "../components/YoutubeSlider";
import Courses from "../components/Courses";
import Enroll from "../components/Enroll";
import Quote from "../components/Quote";
import Steps from "../components/Steps";
import Reviews from "../components/Reviews";
import Gallery from "../components/Gallery";
import Book from "../components/Book";
import Branches from "../components/Branches";

export default function Home() {
  return (
    <>
      <Hero />
      <YoutubeSlider />
      <Courses />
      <Enroll />
      <Quote />
      <Steps />
      <Reviews />
      <Gallery />
      <Book />
      <Branches />
    </>
  );
}