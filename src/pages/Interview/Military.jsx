import { useMemo } from "react";
import { ITV_MILITARY } from "../../interviewConfig";
import { useSiteImage } from "../../lib/useSiteImage";

function ClassPhoto({ slot, caption }) {
  const img = useSiteImage(slot);
  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
      {img ? (
        <img src={img} alt={caption} className="h-full w-full object-cover transition group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">수업 사진</div>
      )}
      {caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p className="text-sm font-semibold text-white">{caption}</p>
        </div>
      )}
    </div>
  );
}

const SURNAMES = "김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허남심노하곽성차주우구민유진지엄채원천방공현".split("");
const LASTCHARS = "린준서우은빈현아호수연진민희재율찬하별솔담윤겸기온결승".split("");

function buildPassList(count, schools) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const sur = SURNAMES[(i * 7 + 3) % SURNAMES.length];
    const last = LASTCHARS[(i * 5 + 1) % LASTCHARS.length];
    const school = schools[i % schools.length];
    list.push({ name: `${sur}*${last}`, school });
  }
  return list;
}

function PassRow({ items, reverse, duration }) {
  const loop = [...items, ...items];
  return (
    <div className="flex overflow-hidden">
      <div
        className="flex shrink-0 gap-3 pr-3"
        style={{ animation: `${reverse ? "passmarquee-rev" : "passmarquee"} ${duration}s linear infinite` }}
      >
        {loop.map((p, i) => (
          <div
            key={i}
            className="flex shrink-0 items-center gap-2.5 rounded-full bg-white/10 px-6 py-3.5 ring-1 ring-white/20"
          >
            <span className="text-xl">👑</span>
            <span className="text-base text-white/70 sm:text-lg">{p.name}</span>
            <span className="text-base font-extrabold text-white sm:text-lg">{p.school}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Military() {
  const go = (url) => { window.location.href = url; };

  const classPhotos = [
    { slot: "interview_military1", caption: "지원동기 코칭" },
    { slot: "interview_military2", caption: "국방·안보 이슈 분석" },
    { slot: "interview_military3", caption: "인성·상황 면접" },
    { slot: "interview_military4", caption: "모의면접 현장" },
    { slot: "interview_military5", caption: "그룹 실전 연습" },
    { slot: "interview_military6", caption: "비디오 피드백" },
  ];

  const rows = useMemo(() => {
    const all = buildPassList(300, ITV_MILITARY.passSchools);
    const per = Math.ceil(all.length / 3);
    return [all.slice(0, per), all.slice(per, per * 2), all.slice(per * 2)];
  }, []);

  return (
    <div>
      <style>{`
        @keyframes passmarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes passmarquee-rev {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* ───── 히어로 ───── */}
      <section className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-gradient-to-br from-seum-navy via-[#22356e] to-seum-blue">
        <div className="absolute inset-0 bg-seum-navy/30" />
        <div className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-28 text-center text-white md:pt-32">
          <span className="mb-5 inline-block rounded-full bg-seum-blue/90 px-4 py-1.5 text-sm font-bold tracking-wide">
            {ITV_MILITARY.hero.badge}
          </span>
          <h1 className="text-3xl font-black sm:text-4xl md:text-5xl">{ITV_MILITARY.hero.title}</h1>
          <p className="mt-3 text-xl font-bold text-seum-blue sm:text-2xl">
            <span className="text-white">{ITV_MILITARY.hero.slogan}</span>
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
            {ITV_MILITARY.hero.desc}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => go("/consult")} className="rounded-xl bg-white px-7 py-3.5 text-base font-bold text-seum-navy shadow-lg transition hover:bg-slate-100">무료 상담 신청</button>
            <button onClick={() => go("/interview")} className="rounded-xl border border-white/40 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10">면접 홈으로 →</button>
          </div>
        </div>
      </section>

      {/* ───── 국가직 면접 구성 (3단계) ───── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-seum-navy sm:text-3xl">군무원 면접, 이렇게 진행됩니다</h2>
            <p className="mt-3 text-sm text-slate-500 sm:text-base">면접 구성을 정확히 알아야 제대로 대비할 수 있습니다.</p>
          </div>
          <div className="mt-12 flex flex-col items-center gap-4 md:flex-row md:items-stretch md:justify-center">
            {ITV_MILITARY.examFlow.map((f, i) => (
              <div key={i} className="flex w-full flex-col items-center md:w-auto md:flex-1 md:flex-row md:items-stretch">
                <div className="flex w-full flex-col rounded-2xl border-2 border-seum-navy/15 bg-slate-50 p-7 text-center">
                  <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-seum-navy text-sm font-black text-white">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-extrabold text-seum-navy">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
                </div>
                {i < ITV_MILITARY.examFlow.length - 1 && (
                  <span className="flex items-center justify-center py-2 text-2xl text-seum-blue md:px-3 md:py-0">
                    <span className="md:hidden">↓</span>
                    <span className="hidden md:inline">→</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 핵심 차별점 ───── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-seum-navy sm:text-3xl">세움면접 군무원과정이 다른 이유</h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
            {ITV_MILITARY.strengths.map((s, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-7 transition hover:border-seum-blue hover:shadow-lg">
                <span className="inline-block rounded-md bg-seum-navy px-3 py-1 text-[11px] font-bold tracking-wide text-white">{s.tag}</span>
                <h3 className="mt-4 text-xl font-extrabold text-seum-navy">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 합격자 명단 (300명 흐름) ───── */}
      <section className="bg-[#0f1629] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center text-white">
            <p className="text-sm font-bold tracking-widest text-red-500">{ITV_MILITARY.passHeadline}</p>
            <h2 className="mt-3 text-4xl font-black text-red-500 sm:text-6xl">{ITV_MILITARY.passCount}명 합격</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-white/60 sm:text-base">{ITV_MILITARY.passSub}</p>
          </div>
        </div>
        <div className="mt-12 space-y-4">
          <PassRow items={rows[0]} reverse={false} duration={280} />
          <PassRow items={rows[1]} reverse={true} duration={300} />
          <PassRow items={rows[2]} reverse={false} duration={290} />
        </div>
      </section>

      {/* ───── 수업 프로세스 6단계 ───── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-seum-navy sm:text-3xl">세움면접만의 특별한 시스템</h2>
            <p className="mt-3 text-sm text-slate-500 sm:text-base">체계적인 6단계 시스템으로 합격까지 함께합니다.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ITV_MILITARY.process.map((p, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                <span className="text-2xl font-black text-seum-blue">{p.no}</span>
                <h3 className="mt-2 text-lg font-extrabold text-seum-navy">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 수업 방식 (그룹 / 1:1) ───── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-seum-navy sm:text-3xl">수업은 두 가지 방식으로</h2>
            <p className="mt-3 text-sm text-slate-500 sm:text-base">목표와 상황에 맞게 선택하세요.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {ITV_MILITARY.classTypes.map((c, i) => (
              <div key={i} className="rounded-2xl border-2 border-seum-blue/20 bg-white p-8 text-center transition hover:border-seum-blue hover:shadow-lg">
                <h3 className="text-2xl font-black text-seum-navy">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 교육 대상 ───── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-seum-navy sm:text-3xl">이런 분에게 추천합니다</h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ITV_MILITARY.targets.map((t, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-5">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-seum-blue/10 text-xs font-bold text-seum-blue">✓</span>
                <span className="text-sm leading-relaxed text-slate-700">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 커리큘럼 (9회) ───── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-seum-navy sm:text-3xl">군무원 커리큘럼 (총 6강)</h2>
            <p className="mt-3 text-sm text-slate-500 sm:text-base">그룹수업 1회 2시간 · 6명 정원 / 1:1 개인지도는 90분 과정으로도 가능합니다.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ITV_MILITARY.curriculum.map((c, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-6">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-seum-blue px-2.5 py-1 text-xs font-bold text-white">{c.no}</span>
                  <h3 className="text-base font-extrabold text-seum-navy">{c.title}</h3>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {c.points.map((p, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-seum-blue" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 수업 현장 사진 ───── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-seum-navy sm:text-3xl">생생한 수업 현장</h2>
            <p className="mt-3 text-sm text-slate-500 sm:text-base">세움면접 공무원과정의 실제 수업 모습입니다.</p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3">
            {classPhotos.map((p, i) => (
              <ClassPhoto key={i} slot={p.slot} caption={p.caption} />
            ))}
          </div>
        </div>
      </section>

      {/* ───── 교육 효과 ───── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-seum-navy sm:text-3xl">수업 후 이렇게 달라집니다</h2>
          </div>
          <div className="mx-auto mt-12 max-w-3xl space-y-3">
            {ITV_MILITARY.effects.map((e, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-5">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-seum-navy text-sm font-black text-white">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm font-semibold text-slate-700">{e}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 하단 CTA ───── */}
      <section className="bg-seum-navy py-16">
        <div className="mx-auto max-w-3xl px-6 text-center text-white">
          <h2 className="text-2xl font-black sm:text-3xl">혼자서 군무원 면접을 준비하고 있나요?</h2>
          <p className="mt-4 text-sm text-white/70 sm:text-base">군별 맞춤 전략과 국방·안보 이슈 대비까지. 세움면접이 합격까지 함께합니다.</p>
          <button onClick={() => go("/consult")} className="mt-8 rounded-xl bg-white px-8 py-4 text-base font-bold text-seum-navy shadow-lg transition hover:bg-slate-100">무료 상담 신청하기</button>
        </div>
      </section>
    </div>
  );
}