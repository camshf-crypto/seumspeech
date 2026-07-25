import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-[#1a1f2e] py-10 text-white/60">
      <div className="mx-auto max-w-6xl px-6 text-xs leading-relaxed">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-white">세움스피치학원</p>
          <a href="/tuition.pdf" download className="inline-flex w-fit items-center rounded-lg border border-white/30 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white hover:text-slate-900">
            교습비 안내 (PDF)
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8">
          <div>
            <p className="mb-1 font-bold text-white/90">마곡본점</p>
            <p>서울시 강서구 마곡중앙로55 퀸즈파크13 205-206호</p>
            <p>학원등록번호 : 제6086호</p>
            <p>TEL 02-2662-0991</p>
          </div>
          <div>
            <p className="mb-1 font-bold text-white/90">인천루원시티점</p>
            <p>인천 서구 가정로451 1129-1131호</p>
            <p>TEL 032-563-0992</p>
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p>상호 : 세움스피치학원</p>
          <p className="mt-1">대표자 : 김지윤</p>
          <p className="mt-1">사업자등록번호 : 432-91-01752</p>
          <p className="mt-1">통신판매업신고 : 제0000-지역-0000호</p>
          <p className="mt-1">이메일 : 이메일주소</p>
          <p className="mt-1">주소 : 서울시 강서구 마곡중앙로55 퀸즈파크13 205-206호</p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/terms" className="font-semibold text-white/80 hover:text-white">
            이용약관
          </Link>
          <span className="text-white/20">|</span>
          <Link to="/privacy" className="font-semibold text-white/80 hover:text-white">
            개인정보처리방침
          </Link>
          <span className="text-white/20">|</span>
          <Link to="/refund" className="font-semibold text-white/80 hover:text-white">
            환불정책
          </Link>
        </div>

        <p className="mt-5 text-white/40">
          Copyright © 세움스피치학원. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}