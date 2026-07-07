import { LOCATION } from "../config";
import { Img } from "../components/common";

export default function LocationPage() {
  const branches = LOCATION.branches;

  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">ACADEMY</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">오시는 길</h1>
      </div>

      <section className="py-16">
        <div className="mx-auto max-w-5xl space-y-20 px-6">
          {branches.map((L, idx) => (
            <div key={idx}>
              <h2 className="mb-6 text-2xl font-bold text-slate-800">{L.branchName}</h2>

              <div className="overflow-hidden rounded-2xl shadow-sm">
                <iframe
                  title={`${L.branchName} 지도`}
                  className="h-[400px] w-full border-0"
                  loading="lazy"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(L.mapQuery)}&output=embed`}
                />
              </div>

              <div className="mt-8 overflow-hidden rounded-2xl border border-slate-100">
                <div className="grid grid-cols-[120px_1fr] border-b border-slate-100">
                  <div className="bg-slate-50 px-5 py-4 text-sm font-bold text-slate-500">주소</div>
                  <div className="px-5 py-4 text-sm text-slate-700">{L.addr}</div>
                </div>
                <div className="grid grid-cols-[120px_1fr] border-b border-slate-100">
                  <div className="bg-slate-50 px-5 py-4 text-sm font-bold text-slate-500">대표번호</div>
                  <div className="px-5 py-4 text-sm text-slate-700">{L.tel}</div>
                </div>
                <div className="grid grid-cols-[120px_1fr]">
                  <div className="bg-slate-50 px-5 py-4 text-sm font-bold text-slate-500">찾아오시는 방법</div>
                  <div className="space-y-3 px-5 py-4">
                    {L.directions.map((d, i) => (
                      <div key={i} className="text-sm">
                        <span className="mr-2 inline-block rounded bg-seum-blue/10 px-2 py-0.5 text-xs font-bold text-seum-blue">
                          {d.type}
                        </span>
                        <span className="text-slate-700">{d.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                {L.rooms.map((r, i) => (
                  <div key={i}>
                    <Img src={r.src} alt={r.caption} label={`${r.caption} 사진`} className="h-64 w-full rounded-2xl object-cover" />
                    <p className="mt-3 text-center text-sm font-medium text-slate-600">{r.caption}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}