import { useSiteImage } from "../../lib/useSiteImage";
import { ITV_GALLERY } from "../../interviewConfig";

function GalleryItem({ slot, caption }) {
  const img = useSiteImage(slot);
  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
      {img ? (
        <img src={img} alt={caption} className="h-full w-full object-cover transition group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
          사진
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
        <p className="text-sm font-semibold text-white">{caption}</p>
      </div>
    </div>
  );
}

export default function InterviewGallery() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="text-sm font-bold tracking-widest text-seum-blue">GALLERY</p>
          <h2 className="mt-2 text-2xl font-black text-seum-navy sm:text-3xl">교육 현장</h2>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {ITV_GALLERY.map((g, i) => (
            <GalleryItem key={i} slot={`interview_gallery${i + 1}`} caption={g.caption} />
          ))}
        </div>
      </div>
    </section>
  );
}