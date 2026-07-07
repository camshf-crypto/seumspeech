export default function Footer() {
  const branches = [
    {
      name: "마곡본점",
      addr: "서울시 강서구 마곡중앙로55 퀸즈파크13 205-206호 ㅣ학원등록번호 : 제6086호ㅣ",
      tel: "02-2662-0991",
    },
    {
      name: "인천루원시티점",
      addr: "인천 서구 가정로451 1129-1131호",
      tel: "032-563-0992",
    },
  ];

  return (
    <footer className="bg-[#1a1f2e] py-10 text-white/60">
      <div className="mx-auto max-w-6xl px-6 text-xs leading-relaxed">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-white">세움스피치학원</p>
          {/* 교습비 안내 PDF 다운로드 버튼 */}
          <a
            href="/교습비안내.pdf"
            download
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white hover:text-slate-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            교습비 안내 (PDF)
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8">
          {branches.map((b) => (
            <div key={b.name}>
              <p className="mb-1 font-bold text-white/90">{b.name}</p>
              <p>{b.addr}</p>
              <p>TEL {b.tel}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-white/40">
          Copyright © 세움스피치학원. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}