import { useState } from "react";
import { LINKS } from "../config";
import { Ico } from "./common";
import InquiryChatWidget from "./inquiry/InquiryChatWidget";

export default function FloatingQuick() {
  const [open, setOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 768
  );
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const go = (href) => {
    if (href && href !== "#") window.location.href = href;
  };

  return (
    <>
      <div className="fixed right-0 top-1/2 z-50 flex -translate-y-1/2">
        {open ? (
          <div className="flex w-24 flex-col items-stretch overflow-hidden rounded-l-xl border-l border-y border-slate-200 bg-white text-seum-navy shadow-2xl">
            {/* 접기 버튼 */}
            <button
              onClick={() => setOpen(false)}
              aria-label="상담 메뉴 접기"
              className="flex h-9 items-center justify-center border-b border-slate-200 text-slate-400 hover:text-seum-navy"
            >
              <Ico.close className="h-5 w-5" />
            </button>

            {/* 수강신청 (강조) */}
            <button
              onClick={() => go(LINKS.enroll)}
              className="flex flex-col items-center justify-center gap-2 bg-seum-blue py-5 text-white hover:bg-[#2a63c4]"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
                <path d="M5 4h11l3 3v13H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="text-[12px] font-bold">수강신청</span>
            </button>

            {/* 전화 (번호 누르면 전화 걸기) */}
            <button
              onClick={() => go(`tel:${LINKS.tel}`)}
              className="flex flex-col items-center justify-center gap-1 border-t border-slate-200 py-5 hover:bg-slate-50"
            >
              <Ico.phone className="h-7 w-7 text-seum-blue" />
              <span className="text-[11px] text-slate-500">상담전화</span>
              <span className="text-center text-[18px] font-bold leading-snug text-seum-navy">
                {LINKS.tel.split("-").map((part, i) => (
                  <span key={i} className="block">{part}.</span>
                ))}
              </span>
            </button>

            {/* 대화 시작하기 (사이트 내 채팅 위젯 열기) */}
            <button
              onClick={() => setInquiryOpen(true)}
              className="flex flex-col items-center justify-center gap-1.5 border-t border-slate-200 bg-[#FEE500] py-5 text-seum-navy hover:brightness-95"
            >
              {/* 헤드셋 아이콘 */}
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
                <path d="M4 13v-1a8 8 0 0116 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <rect x="2.5" y="13" width="4" height="6" rx="2" fill="currentColor" />
                <rect x="17.5" y="13" width="4" height="6" rx="2" fill="currentColor" />
                <path d="M20 19v1a3 3 0 01-3 3h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="23" r="1.3" fill="currentColor" />
              </svg>
              <span className="text-[12px] font-bold leading-tight text-center">대화<br />시작하기</span>
            </button>

            {/* 상담 및 문의 (클릭 시 /consult 이동) */}
            <button
              onClick={() => go("/consult")}
              className="flex flex-col items-center justify-center gap-2 border-t border-slate-200 py-5 hover:bg-slate-50"
            >
              <Ico.chat className="h-7 w-7 text-seum-blue" />
              <span className="text-[12px] font-medium">상담 및 문의</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            aria-label="상담 메뉴 열기"
            className="flex h-12 w-12 flex-col items-center justify-center rounded-l-full border border-r-0 border-slate-200 bg-white text-seum-navy shadow-xl hover:bg-slate-50"
          >
            <Ico.chat className="h-5 w-5 text-seum-blue" />
          </button>
        )}
      </div>

      {/* 대화 시작하기 채팅 위젯 */}
      <InquiryChatWidget open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
    </>
  );
}