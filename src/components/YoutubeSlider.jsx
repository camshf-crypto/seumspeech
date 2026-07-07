import { useState } from "react";
import { YOUTUBE } from "../config";

export default function YoutubeSlider() {
  const [start, setStart] = useState(0);
  const [playing, setPlaying] = useState(null);
  const perView = 3;
  const maxStart = Math.max(0, YOUTUBE.length - perView);

  const prev = () => setStart((s) => Math.max(0, s - 1));
  const next = () => setStart((s) => Math.min(maxStart, s + 1));

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-2 text-center text-sm text-slate-400">SEUM SPEECH TV</p>
        <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
          영상으로 만나는 <span className="text-seum-blue">세움스피치학원</span>
        </h2>

        <div className="relative">
          <button
            onClick={prev}
            disabled={start === 0}
            aria-label="이전"
            className="absolute -left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${start * (100 / perView)}%)` }}
            >
              {YOUTUBE.map((v, i) => (
                <div key={i} className="w-full flex-shrink-0 px-3 sm:w-1/2 md:w-1/3">
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
                    {playing === i && v.id ? (
                      <iframe
                        className="h-full w-full"
                        src={`https://www.youtube.com/embed/${v.id}?autoplay=1`}
                        title={v.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <button onClick={() => v.id && setPlaying(i)} className="group block h-full w-full">
                        {v.id ? (
                          <img
                            src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`}
                            alt={v.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-200 text-xs text-slate-400">
                            유튜브 영상
                          </div>
                        )}
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 transition group-hover:bg-red-600">
                            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 text-white" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        </span>
                      </button>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-700">{v.title}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={next}
            disabled={start >= maxStart}
            aria-label="다음"
            className="absolute -right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}