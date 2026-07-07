import { BOOK } from "../config";

export default function Book() {
  const go = () => BOOK.link && BOOK.link !== "#" && (window.location.href = BOOK.link);

  return (
    <section className="bg-seum-navy py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid items-center gap-10 md:grid-cols-2">
          {/* 책 표지 */}
          <div className="flex justify-center">
            <div className="w-56 overflow-hidden rounded-lg shadow-2xl md:w-64">
              {BOOK.cover ? (
                <img src={BOOK.cover} alt={BOOK.title} className="block h-auto w-full" />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
                  책 표지
                </div>
              )}
            </div>
          </div>

          {/* 책 소개 */}
          <div className="text-center md:text-left">
            <span className="mb-4 inline-block rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold text-seum-navy">
              {BOOK.badge}
            </span>
            <h2 className="mb-3 text-3xl font-extrabold text-white md:text-4xl">{BOOK.title}</h2>
            <p className="mb-5 text-lg font-medium text-sky-200">{BOOK.subtitle}</p>
            <p className="mb-8 leading-relaxed text-white/70">{BOOK.desc}</p>
            <button
              onClick={go}
              className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-seum-navy transition hover:bg-slate-100"
            >
              책 보러가기 →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}