// src/pages/Online.jsx
// 온라인 스피치 단체반 상세 페이지 (/online) — 김지윤 대표 클래스
// 숫자·문구는 맨 위 ONLINE / CREATOR 에서만 고치면 전체에 반영됨
// 사진: 콘텐츠 관리에 online_cover(표지), online_creator(대표 사진) 슬롯을 올리면 표시
import { useEffect, useState } from "react";
import { useSiteImage } from "../lib/useSiteImage";

const ONLINE = {
  title: "김지윤의 온라인 스피치 클래스",
  subtitle: "강의는 김지윤 대표가, 실습은 6명 소그룹에서. 6주 동안 직접 말하고 고칩니다.",
  price: 390000,
  weeks: 6,
  capacity: 30,
  roomSize: 6,
  openText: "11월 중순 개강",
  schedule: "매주 1회 · 2시간",
  applyLink: "/online/apply",
  loginLink: "/login",
};

const CREATOR = {
  name: "김지윤",
  role: "세움스피치 대표 · 메인 강의",
  career: [
    "전 방송 앵커",
    "전 EBS PD",
    "2019년 세움스피치 설립, 면접·발표 코칭",
    "『우아한 대화법』 저자 (3쇄)",
    "리더십 커뮤니케이션 신간 · 모티브",
  ],
  methods: [
    ["STAR 모델", "경험을 상황·과제·행동·결과로 정리해 말하기"],
    ["PGD 지시법", "일을 맡길 때 헷갈리지 않게 전달하기"],
    ["사실-영향-기대 피드백", "상대가 받아들이는 피드백 주기"],
    ["목결근방 보고법", "목적·결론·근거·방안 순서로 보고하기"],
  ],
};

const won = (n) => n.toLocaleString("ko-KR");

const TABS = [
  ["intro", "클래스 소개"],
  ["creator", "크리에이터"],
  ["curriculum", "커리큘럼"],
  ["analysis", "음성 분석"],
  ["faq", "자주 묻는 질문"],
];

const POINTS = [
  ["김지윤 대표 직강", "방송 앵커·EBS PD 출신 김지윤 대표가 매주 전체 강의를 직접 진행합니다."],
  [`${ONLINE.roomSize}명 소그룹 실습`, "전담 강사와 함께 한 사람당 약 10분, 매주 내 차례가 옵니다."],
  ["수업 후 피드백·숙제", "오늘 받은 피드백과 나에게 맞춘 숙제가 수업 직후 도착합니다."],
  ["숙제 음성 분석", "말 속도·군말·멈춤·시간을 분석해 6주 동안의 변화를 보여 드립니다."],
];

const WEEK_FLOW = [
  ["60분", "전체 강의", "김지윤 대표"],
  ["60분", "소그룹 실습", "6명 + 전담 강사"],
  ["수업 직후", "피드백·숙제 도착", "앱 알림"],
  ["다음 수업 전", "숙제 녹음 · 음성 분석", "사이트에서 바로"],
];

const PRACTICE = [
  ["발표", "3~4분", "그날 강의를 바로 적용해 말해 봅니다."],
  ["피드백", "3분", "잘한 점 하나, 고칠 점 하나를 짚어 드립니다."],
  ["다시 말하기", "2~3분", "피드백을 반영해 한 번 더. 고쳐지는 걸 직접 느낍니다."],
];

const FOR_WHO = [
  "회의·보고에서 말이 길어지고 요점이 흐려지는 분",
  "발표만 하면 긴장해서 준비한 말을 다 못 하는 분",
  "학원에 다닐 시간은 없지만 제대로 코칭받고 싶은 분",
  "혼자 연습해서는 무엇이 문제인지 모르겠는 분",
];

const ANALYSIS = [
  ["말 속도", "분당 음절 수로 빠른지, 느린지"],
  ["군말", "\"음\", \"어\", \"그러니까\" 같은 습관어"],
  ["멈춤", "흐름이 끊기는 긴 멈춤"],
  ["시간", "정해진 시간 안에 끝냈는지"],
];

const FAQ = [
  ["무엇이 필요한가요?", "카메라와 마이크가 되는 노트북·PC 또는 휴대폰이면 됩니다. 프로그램 설치 없이 세움스피치 사이트에서 바로 수업에 들어갑니다."],
  ["전체 강의는 누가 하나요?", "매주 김지윤 대표가 직접 진행합니다. 소그룹 실습은 세움스피치 전담 강사가 방마다 함께합니다."],
  ["소그룹은 어떻게 나뉘나요?", `전체 강의가 끝나면 ${ONLINE.roomSize}명씩 방이 자동으로 나뉩니다. 같은 강사가 같은 학생을 이어서 코칭합니다.`],
  ["숙제는 어떻게 내나요?", "사이트에서 바로 녹음해서 제출합니다. 마감은 다음 수업 이틀 전이고, 제출하면 음성 분석 결과를 바로 볼 수 있습니다."],
  ["피드백은 어디서 보나요?", "로그인하면 내 강의실의 '온라인 단체반'에서 주차별 피드백·숙제·분석 결과를 모두 볼 수 있습니다."],
];

export default function Online() {
  const cover = useSiteImage("online_cover");
  const creatorImg = useSiteImage("online_creator");
  const principalImg = useSiteImage("principalImg");
  const photo = creatorImg || principalImg;
  const [activeTab, setActiveTab] = useState("intro");

  // 스크롤 위치에 맞춰 탭 강조
  useEffect(() => {
    const onScroll = () => {
      const current = TABS.map(([id]) => document.getElementById(id))
        .filter(Boolean)
        .filter((el) => el.getBoundingClientRect().top < 140)
        .pop();
      if (current) setActiveTab(current.id);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTab = (id) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: "smooth" });
  };

  return (
    <div className="bg-white text-slate-800">
      {/* 상단 바 */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-seum-navy text-sm font-extrabold text-white">M</span>
            <span className="font-extrabold text-seum-navy">세움스피치 <span className="font-semibold text-teal-600">온라인</span></span>
          </a>
          <a href={ONLINE.loginLink} className="text-sm font-medium text-slate-500 hover:text-seum-navy">로그인</a>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pt-6">
        {/* 표지 */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-seum-navy md:aspect-[21/9]">
          {cover ? (
            <img src={cover} alt={ONLINE.title} className="h-full w-full object-cover" />
          ) : photo ? (
            <img src={photo} alt={CREATOR.name} className="h-full w-full object-cover object-top" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-seum-navy to-teal-800">
              <span className="text-6xl font-extrabold text-white/20 md:text-8xl">SPEECH</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 text-white md:p-10">
            <span className="bg-teal-400 px-2.5 py-1 text-xs font-bold text-slate-900">1기 모집 중</span>
            <p className="mt-3 text-sm text-white/80">{CREATOR.name} 대표 · 세움스피치</p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_340px]">
        {/* 왼쪽 본문 */}
        <main className="min-w-0">
          <div className="pt-8">
            <p className="text-sm font-semibold text-teal-600">스피치 · 커뮤니케이션</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-snug text-seum-navy md:text-4xl">{ONLINE.title}</h1>
            <p className="mt-3 text-lg text-slate-600">{ONLINE.subtitle}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {[`${ONLINE.weeks}주 과정`, ONLINE.schedule, `정원 ${ONLINE.capacity}명`, ONLINE.openText].map((t) => (
                <span key={t} className="bg-slate-100 px-3 py-1.5 text-slate-600">{t}</span>
              ))}
            </div>
          </div>

          {/* 섹션 탭 */}
          <nav className="sticky top-[57px] z-20 -mx-5 mt-8 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-5">
            {TABS.map(([id, label]) => (
              <button key={id} onClick={() => goTab(id)}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition ${
                  activeTab === id ? "border-seum-navy text-seum-navy" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                {label}
              </button>
            ))}
          </nav>

          {/* 클래스 소개 */}
          <section id="intro" className="py-12">
            <h2 className="text-2xl font-extrabold text-seum-navy">이 클래스는 이렇게 다릅니다</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {POINTS.map(([title, desc], i) => (
                <div key={title} className="border border-slate-200 p-5">
                  <span className="text-sm font-extrabold text-teal-600">0{i + 1}</span>
                  <h3 className="mt-2 font-bold text-seum-navy">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-12 text-xl font-extrabold text-seum-navy">이런 분께 맞습니다</h3>
            <ul className="mt-4 space-y-2">
              {FOR_WHO.map((t) => (
                <li key={t} className="flex gap-3 bg-slate-50 px-4 py-3 text-[15px]">
                  <span className="font-bold text-teal-600">✓</span>{t}
                </li>
              ))}
            </ul>

            <h3 className="mt-12 text-xl font-extrabold text-seum-navy">한 주는 이렇게 흘러갑니다</h3>
            <ol className="mt-4 grid gap-px bg-slate-200 sm:grid-cols-4">
              {WEEK_FLOW.map(([time, title, who]) => (
                <li key={title} className="bg-white p-4">
                  <div className="text-xs font-semibold text-teal-600">{time}</div>
                  <div className="mt-1 font-bold text-seum-navy">{title}</div>
                  <div className="mt-1 text-xs text-slate-400">{who}</div>
                </li>
              ))}
            </ol>

            <h3 className="mt-12 text-xl font-extrabold text-seum-navy">소그룹 실습, 한 사람당 약 10분</h3>
            <p className="mt-2 text-slate-600">듣기만 하다 끝나는 단체반이 아닙니다.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {PRACTICE.map(([title, time, desc], i) => (
                <div key={title} className="relative border border-slate-200 p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold text-seum-navy">{i + 1}. {title}</span>
                    <span className="text-sm font-semibold text-teal-600">{time}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 크리에이터 */}
          <section id="creator" className="border-t border-slate-100 py-12">
            <p className="text-sm font-semibold text-teal-600">CREATOR</p>
            <div className="mt-4 flex flex-col gap-6 sm:flex-row">
              <div className="h-40 w-40 flex-shrink-0 overflow-hidden rounded-full bg-slate-100">
                {photo ? (
                  <img src={photo} alt={CREATOR.name} className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl font-extrabold text-slate-300">{CREATOR.name[0]}</div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-seum-navy">{CREATOR.name}</h2>
                <p className="mt-1 text-slate-500">{CREATOR.role}</p>
                <ul className="mt-4 space-y-1.5 text-[15px]">
                  {CREATOR.career.map((c) => (
                    <li key={c} className="flex gap-2"><span className="text-teal-600">·</span>{c}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10 bg-seum-navy p-6 text-white md:p-8">
              <h3 className="text-lg font-extrabold">김지윤 대표가 직접 만든 말하기 방법</h3>
              <div className="mt-5 grid gap-px bg-white/15 sm:grid-cols-2">
                {CREATOR.methods.map(([name, desc]) => (
                  <div key={name} className="bg-seum-navy p-4">
                    <div className="font-bold text-teal-300">{name}</div>
                    <div className="mt-1 text-sm text-white/75">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 커리큘럼 */}
          <section id="curriculum" className="border-t border-slate-100 py-12">
            <h2 className="text-2xl font-extrabold text-seum-navy">커리큘럼</h2>
            <p className="mt-2 text-slate-600">{ONLINE.weeks}주 · 매주 전체 강의 60분 + 소그룹 실습 60분</p>
            <ol className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
              {Array.from({ length: ONLINE.weeks }, (_, i) => (
                <li key={i} className="flex items-center gap-4 py-4">
                  <span className="w-14 text-sm font-extrabold text-teal-600">{i + 1}주차</span>
                  <span className="text-slate-400">주차별 주제는 곧 공개됩니다</span>
                </li>
              ))}
            </ol>
          </section>

          {/* 음성 분석 */}
          <section id="analysis" className="border-t border-slate-100 py-12">
            <h2 className="text-2xl font-extrabold text-seum-navy">숙제를 내면 내 말하기가 숫자로 보입니다</h2>
            <p className="mt-2 text-slate-600">스피치는 늘었는지 스스로 느끼기 어렵습니다. 1주차부터 {ONLINE.weeks}주차까지 달라지는 모습을 보여 드립니다.</p>
            <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {ANALYSIS.map(([k, v]) => (
                <div key={k} className="border border-slate-200 p-4">
                  <dt className="font-bold text-seum-navy">{k}</dt>
                  <dd className="mt-1 text-sm text-slate-500">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* 자주 묻는 질문 */}
          <section id="faq" className="border-t border-slate-100 py-12">
            <h2 className="text-2xl font-extrabold text-seum-navy">자주 묻는 질문</h2>
            <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                    {q}
                    <span className="text-xl text-teal-600 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </main>

        {/* 오른쪽 신청 카드 (데스크탑, 따라다님) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 mt-8 border border-slate-200 p-6 shadow-sm">
            <p className="text-sm text-slate-500">{CREATOR.name} 대표 클래스</p>
            <p className="mt-1 font-bold text-seum-navy">{ONLINE.title}</p>
            <p className="mt-5 text-3xl font-extrabold text-seum-navy">{won(ONLINE.price)}<span className="text-lg">원</span></p>
            <p className="text-sm text-slate-400">{ONLINE.weeks}주 전체</p>
            <ul className="mt-5 space-y-2 border-t border-slate-100 pt-5 text-sm">
              {[
                ["일정", `${ONLINE.openText} · ${ONLINE.schedule}`],
                ["수업", "전체 강의 + 6명 소그룹 실습"],
                ["관리", "피드백·숙제·음성 분석"],
                ["정원", `${ONLINE.capacity}명`],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-3"><span className="w-10 text-slate-400">{k}</span><span>{v}</span></li>
              ))}
            </ul>
            <a href={ONLINE.applyLink} className="mt-6 block bg-seum-navy py-4 text-center font-bold text-white hover:bg-seum-blue">
              수강 신청하기
            </a>
            <p className="mt-3 text-center text-xs text-slate-400">정원이 차면 다음 기수로 넘어갑니다</p>
          </div>
        </aside>
      </div>

      {/* 하단 신청 바 (모바일) */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-slate-200 bg-white px-5 py-3 lg:hidden">
        <div className="mr-auto">
          <p className="text-xs text-slate-400">{ONLINE.weeks}주 · 정원 {ONLINE.capacity}명</p>
          <p className="text-lg font-extrabold text-seum-navy">{won(ONLINE.price)}원</p>
        </div>
        <a href={ONLINE.applyLink} className="bg-seum-navy px-8 py-3 font-bold text-white">수강 신청</a>
      </div>

      {/* 하단 CTA (화면 끝까지) */}
      <section className="mt-12 bg-seum-navy py-16 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 text-center md:flex-row md:justify-between md:text-left">
          <div>
            <p className="text-sm font-semibold text-teal-300">{CREATOR.name} 대표와 함께하는 6주</p>
            <h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{ONLINE.openText}, 정원 {ONLINE.capacity}명</h2>
          </div>
          <a href={ONLINE.applyLink} className="bg-teal-400 px-10 py-4 font-bold text-slate-900 hover:bg-teal-300">
            수강 신청하기
          </a>
        </div>
      </section>

    </div>
  );
}