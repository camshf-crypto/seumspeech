import { useSiteImages } from "../lib/useSiteImage";

// 어드민 콘텐츠 관리(스피치 사이트 → 교육현장 갤러리)의 슬롯과 연결
const ITEMS = [
  { slot: "gallery1", caption: "실전 발표 트레이닝" },
  { slot: "gallery2", caption: "1:1 맞춤 코칭" },
  { slot: "gallery3", caption: "모의 면접 현장" },
  { slot: "gallery4", caption: "소수정예 그룹 수업" },
];

function GalleryCard({ src, caption }) {
  return (
    <div className="group overflow-hidden rounded-2xl">
      {/* 칸 비율을 4:3으로 고정해 네 장의 크기를 통일한다 */}
      <div className="relative aspect-[4/3] bg-slate-100">
        {src ? (
          // object-cover: 칸을 꽉 채운다. 비율이 안 맞는 부분은 가운데 기준으로 잘림
          <img src={src} alt={caption} className="h-full w-full object-cover" />
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
  // 슬롯마다 따로 조회하지 않고 한 번에 읽는다
  const { img } = useSiteImages();

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-2 text-center text-sm text-slate-400">SEUM SPEECH CLASS</p>
        <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
          생생한 <span className="text-seum-blue">교육 현장</span>
        </h2>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {ITEMS.map((g) => (
            <GalleryCard key={g.slot} src={img(g.slot, "")} caption={g.caption} />
          ))}
        </div>
      </div>
    </section>
  );
}