import { useEffect, useState } from "react";
import { LOCATION } from "../config";
import { supabase } from "../lib/supabase";

// 콘텐츠 관리(site_images)에서 올린 지점 사진을 순서대로 쓴다.
// 첫 번째 지점 → room1, 두 번째 지점 → room2
const ROOM_SLOTS = ["room1", "room2"];

export default function LocationPage() {
  const branches = LOCATION.branches;
  const [slotImages, setSlotImages] = useState({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("site_images")
        .select("slot, image_url")
        .in("slot", ROOM_SLOTS);
      if (error) {
        console.error("site_images(room) 조회 실패:", error);
        return;
      }
      const map = {};
      (data ?? []).forEach((r) => { map[r.slot] = r.image_url; });
      setSlotImages(map);
    })();
  }, []);

  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">ACADEMY</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">오시는 길</h1>
      </div>

      <section className="py-16">
        <div className="mx-auto max-w-5xl space-y-20 px-6">
          {branches.map((L, idx) => {
            // 이 지점에 배정된 콘텐츠 관리 사진
            const uploaded = slotImages[ROOM_SLOTS[idx]] ?? null;

            return (
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
                  {L.rooms.map((r, i) => {
                    // config 에 사진이 있으면 그걸, 없으면 콘텐츠 관리에서 올린 사진을
                    // (지점당 한 장이므로 첫 번째 칸에만 채운다)
                    const src = r.src || (i === 0 ? uploaded : null);

                    return (
                      <div key={i}>
                        <div className="flex h-64 w-full items-center justify-center overflow-hidden rounded-2xl bg-white">
                          {src ? (
                            <img src={src} alt={r.caption} className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-sm text-slate-300">{r.caption} 사진</span>
                          )}
                        </div>
                        <p className="mt-3 text-center text-sm font-medium text-slate-600">{r.caption}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}