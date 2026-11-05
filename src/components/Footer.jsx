import { Link } from "react-router-dom";

// 운영 법인 정보 — 바뀌면 여기만 고치면 된다
const BIZ = {
  company: "세움러닝(주)",
  ceo: "김지윤",
  bizNo: "817-31-01468",
  mailOrderNo: "2026-인천서해-0439",
  address: "인천광역시 서구 가정로 451, 1129-1130호",
  email: "company@seumlearning.com",
  privacyOfficer: "곽용신",
};

export default function Footer() {
  return (
    <footer className="bg-[#1a1f2e] py-10 text-white/60">
      <div className="mx-auto max-w-6xl px-6 text-xs leading-relaxed">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/terms" className="font-semibold text-white/80 hover:text-white">
            이용약관
          </Link>
          <span className="text-white/20">|</span>
          <Link to="/privacy" className="font-semibold text-white hover:text-white">
            개인정보처리방침
          </Link>
          <span className="text-white/20">|</span>
          <Link to="/refund" className="font-semibold text-white/80 hover:text-white">
            환불정책
          </Link>
        </div>

        <div className="mt-5 space-y-1 border-t border-white/10 pt-5">
          <p>{BIZ.company} | 대표 {BIZ.ceo} | 사업자등록번호 {BIZ.bizNo}</p>
          <p>통신판매업신고번호 {BIZ.mailOrderNo} | 개인정보보호책임자 {BIZ.privacyOfficer}</p>
          <p>{BIZ.address}</p>
          <p>문의 {BIZ.email}</p>
        </div>

        <p className="mt-5 text-white/40">
          Copyright © {BIZ.company} All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}