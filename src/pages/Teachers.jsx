import { useEffect, useState } from "react";
import { TEACHERS } from "../config";
import { supabase } from "../lib/supabase";

export default function Teachers() {
  const principal = TEACHERS.principal; // 글은 config 그대로
  const [principalImg, setPrincipalImg] = useState("");
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      // 대표원장 사진 (콘텐츠관리 슬롯)
      const { data: img } = await supabase
        .from("site_images")
        .select("image_url")
        .eq("slot", "principalImg2")
        .maybeSingle();
      setPrincipalImg(img?.image_url ?? "");

      // 강사진 (대표원장 제외)
      const { data: tc } = await supabase
        .from("site_teachers")
        .select("*")
        .eq("is_principal", false)
        .order("sort_order");
      setOthers(tc ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">ACADEMY</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">강사 소개</h1>
      </div>

      {/* 대표원장 (글: config / 사진: DB) */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-2 text-center text-seum-blue">{principal.catch}</p>
          <p className="mb-12 text-center text-lg text-slate-500">{principal.intro}</p>

          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <div className="h-[420px] w-full overflow-hidden rounded-2xl bg-slate-100">
                {principalImg ? (
                  <img src={principalImg} alt={principal.name} className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">대표원장 사진</div>
                )}
              </div>
              <h2 className="mt-6 text-2xl font-extrabold text-slate-800">{principal.name}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {principal.tags.map((t) => (
                  <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">#{t}</span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-8">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-800">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-seum-navy text-xs font-bold text-white">현</span>
                주요 경력
              </h3>
              <ul className="mb-8 space-y-2">
                {principal.careerNow.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-seum-blue" />
                    {c}
                  </li>
                ))}
              </ul>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white">전</span>
                이력
              </h3>
              <ul className="space-y-2">
                {principal.careerPast.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 강사진 (DB) */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-slate-800 md:text-3xl">세움스피치 강사진</h2>
          <p className="mb-12 text-center text-slate-500">세움스피치의 강사진은 모두 스피치 분야에서 최고 수준의 강사진만을 모셨습니다.</p>

          {loading ? (
            <p className="text-center text-slate-400">불러오는 중...</p>
          ) : others.length === 0 ? (
            <p className="text-center text-slate-400">등록된 강사가 없습니다.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="overflow-hidden rounded-2xl bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="h-64 w-full overflow-hidden bg-slate-100">
                    {t.image_url ? (
                      <img src={t.image_url} alt={t.name} className="h-full w-full object-cover object-top" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">사진 없음</div>
                    )}
                  </div>
                  <div className="p-6">
                    {t.field ? <p className="mb-2 text-xs font-medium text-seum-blue">{t.field}</p> : null}
                    <h3 className="mb-3 text-lg font-bold text-slate-800">{t.name}</h3>
                    {t.subjects?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {t.subjects.map((s, i) => (
                          <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">#{s}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 강사 상세 모달 */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="my-8 w-full max-w-4xl rounded-2xl bg-white p-6 md:p-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button onClick={() => setSelected(null)} className="text-2xl text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-slate-100">
                  {selected.image_url ? (
                    <img src={selected.image_url} alt={selected.name} className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">사진 없음</div>
                  )}
                </div>
                <h2 className="mt-5 text-2xl font-extrabold text-slate-800">
                  {selected.name}
                  {selected.role ? <span className="ml-1 text-base font-medium text-slate-400">{selected.role}</span> : null}
                </h2>
                {selected.field ? <p className="mt-1 text-sm text-slate-500">{selected.field}</p> : null}
              </div>

              <div>
                {selected.subjects?.length ? (
                  <>
                    <h3 className="mb-3 text-lg font-bold text-slate-800">담당과목</h3>
                    <div className="mb-6 flex flex-wrap gap-2">
                      {selected.subjects.map((s, i) => (
                        <span key={i} className="rounded-full bg-seum-blue px-3 py-1.5 text-sm font-medium text-white">#{s}</span>
                      ))}
                    </div>
                  </>
                ) : null}
                {selected.career_main ? (
                  <>
                    <h3 className="mb-3 text-lg font-bold text-slate-800">주요이력</h3>
                    <p className="mb-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{selected.career_main}</p>
                  </>
                ) : null}
                {selected.career_summary ? (
                  <>
                    <h3 className="mb-3 text-lg font-bold text-slate-800">주요약력</h3>
                    <p className="mb-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{selected.career_summary}</p>
                  </>
                ) : null}
                {selected.one_liner ? (
                  <>
                    <h3 className="mb-3 text-lg font-bold text-slate-800">한마디</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{selected.one_liner}</p>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}