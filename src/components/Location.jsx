import { IMAGES, LINKS, ADDRESS } from "../config";
import { Img } from "./common";

export default function Location() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-2">
        <Img
          src={IMAGES.gallery}
          alt={ADDRESS.name}
          label="배움터 갤러리"
          className="h-64 w-full rounded-xl object-cover"
        />
        <div className="relative flex flex-col justify-center rounded-xl bg-seum-navy p-8 text-white">
          <p className="mb-1 text-sm text-white/60">{ADDRESS.name}</p>
          <p className="mb-4 text-2xl font-extrabold">{LINKS.tel}</p>
          <p className="text-sm leading-relaxed text-white/80">
            {ADDRESS.line}
            <br />
            {ADDRESS.hours}
          </p>
          <a
            href="#"
            className="mt-6 inline-block w-fit rounded-md bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/20"
          >
            오시는 길 보기 →
          </a>
        </div>
      </div>
    </section>
  );
}
