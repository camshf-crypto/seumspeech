import { useSiteImage } from "../lib/useSiteImage";

// 어드민 콘텐츠 관리(스피치 사이트 → 교육현장 갤러리)의 슬롯과 연결
const ITEMS = [
  { slot: "gallery1", caption: "실전 발표 트레이닝" },
  { slot: "gallery2", caption: "1:1 맞춤 코칭" },
  { slot: "gallery3", caption: "모의 면접 현장" },
  { slot: "gallery4", caption: "소수정예 그룹 수업" },
];

function GalleryCard({ slot, caption }) {
  const img = useSiteImage(slot);
  return (
    <div className="group overflow-hidden rounded-2xl">
      <div className="relative aspect-square bg-slate-100">
        {img ? (
          <img
            src={img}
            alt={caption}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
            교육 현장 사진
          </div>
        )}
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
          <span className="text-sm font-semibold text-white">{caption}</span>
        </div>
      </div>
    </div>
  );
}

export default function Gallery() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-2 text-center text-sm text-slate-400">SEUM SPEECH CLASS</p>
        <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
          생생한 <span className="text-seum-blue">교육 현장</span>
        </h2>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {ITEMS.map((g) => (
            <GalleryCard key={g.slot} slot={g.slot} caption={g.caption} />
          ))}
        </div>
      </div>
    </section>
  );
}