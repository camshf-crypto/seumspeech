import { CORP, LINKS } from "../config";

export default function Corp() {
  const C = CORP;
  const tel = () => (window.location.href = `tel:${LINKS.tel}`);

  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">CORPORATE</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">기업 강의</h1>
      </div>

      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            기업교육 <span className="text-seum-blue">과정</span>
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {C.courses.map((c, i) => (
              <div key={i} className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-seum-blue hover:text-seum-blue">
                {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            기업교육 <span className="text-seum-blue">성과</span>
          </h2>
          <p className="mb-12 text-center text-slate-500">국내 유수의 기업·기관과 함께해온 세움스피치의 교육 경험입니다.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {C.clients.map((cl, i) => (
              <div key={i} className="flex h-24 items-center justify-center rounded-2xl bg-white shadow-sm">
                {cl.img ? (
                  <img src={cl.img} alt={cl.name} className="max-h-12 max-w-[70%] object-contain" />
                ) : (
                  <span className="text-lg font-bold text-slate-400">{cl.name}</span>
                )}
              </div>
            ))}
          </div>

          {/* 교육 현장 사진 (4개씩 2줄) */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(C.photos || []).map((p, i) => (
              <div key={i} className="group relative overflow-hidden rounded-2xl">
                <div className="aspect-[4/3]">
                  {p.src ? (
                    <img src={p.src} alt={p.caption || `교육 현장 ${i + 1}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
                      교육 사진 {i + 1}
                    </div>
                  )}
                </div>
                {p.caption && (
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
                    <span className="text-xs font-semibold text-white">{p.caption}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-14 text-center text-2xl font-bold text-slate-800 md:text-3xl">
            출강 <span className="text-seum-blue">프로세스</span>
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {C.process.map((p, i) => (
              <div key={i} className="relative rounded-2xl bg-slate-50 p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-seum-navy text-lg font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-800">{p.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{p.desc}</p>
                {i < C.process.length - 1 && (
                  <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-2xl text-slate-300 lg:block">›</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button onClick={tel} className="rounded-xl bg-seum-blue px-10 py-4 text-base font-bold text-white transition hover:bg-[#2a63c4]">
              출강 문의하기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}