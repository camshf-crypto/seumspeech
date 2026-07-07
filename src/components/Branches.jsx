import { BRANCHES } from "../config";
import { Img } from "./common";

export default function Branches() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-2 text-center text-sm text-slate-400">SEUM SPEECH BRANCH</p>
        <h2 className="mb-12 text-center text-2xl font-bold text-slate-800 md:text-3xl">
          전국 <span className="text-seum-blue">{BRANCHES.length}개 지점</span>에서 만나요
        </h2>

        <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
          {BRANCHES.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <Img src={b.img} alt={b.name} label={`${b.name} 사진`} className="h-48 w-full object-cover" />

              <iframe
                title={`${b.name} 지도`}
                className="h-44 w-full border-0"
                loading="lazy"
                src={`https://www.google.com/maps?q=${encodeURIComponent(b.mapQuery || b.addr || b.name)}&output=embed`}
              />

              <div className="p-5">
                <h3 className="mb-2 text-lg font-bold text-slate-800">{b.name}</h3>
                <p className="mb-1 flex items-start gap-2 text-sm text-slate-500">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-shrink-0 text-seum-blue" fill="none">
                    <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  {b.addr}
                </p>
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0 text-seum-blue" fill="none">
                    <path d="M6.5 4h3l1.5 4-2 1.5a12 12 0 005.5 5.5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 6.2 2 2 0 016.5 4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                  {b.tel}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}