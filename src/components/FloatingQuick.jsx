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
          // 모바일에서는 폭을 절반 가까이 줄인다 (w-14) — PC는 기존 w-24
          <div className="flex w-14 flex-col items-stretch overflow-hidden border-l border-y border-slate-200 bg-white text-seum-navy shadow-2xl md:w-24">
            {/* 접기 버튼 */}
            <button
              onClick={() => setOpen(false)}
              aria-label="상담 메뉴 접기"
              className="flex h-7 items-center justify-center border-b border-slate-200 text-slate-400 hover:text-seum-navy md:h-9"
            >
              <Ico.close className="h-4 w-4 md:h-5 md:w-5" />
            </button>

            {/* 수강신청 (강조) */}
            <button
              onClick={() => go(LINKS.enroll)}
              className="flex flex-col items-center justify-center gap-1 bg-seum-blue py-2.5 text-white hover:bg-[#2a63c4] md:gap-2 md:py-5"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-7 md:w-7" fill="none">
                <path d="M5 4h11l3 3v13H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="text-[9px] font-bold md:text-[12px]">수강신청</span>
            </button>

            {/* 전화 (번호 누르면 전화 걸기) */}
            <button
              onClick={() => go(`tel:${LINKS.tel}`)}
              className="flex flex-col items-center justify-center gap-0.5 border-t border-slate-200 py-2.5 hover:bg-slate-50 md:gap-1 md:py-5"
            >
              <Ico.phone className="h-5 w-5 text-seum-blue md:h-7 md:w-7" />
              {/* 모바일에서는 '상담전화' 글자와 번호를 숨기고 아이콘만 (탭하면 전화 걸림) */}
              <span className="hidden text-[11px] text-slate-500 md:block">상담전화</span>
              <span className="hidden text-center text-[18px] font-bold leading-snug text-seum-navy md:block">
                {LINKS.tel.split("-").map((part, i) => (
                  <span key={i} className="block">{part}.</span>
                ))}
              </span>
              <span className="text-[9px] text-slate-500 md:hidden">전화</span>
            </button>

            {/* 대화 시작하기 (사이트 내 채팅 위젯 열기) */}
            <button
              onClick={() => setInquiryOpen(true)}
              className="flex flex-col items-center justify-center gap-1 border-t border-slate-200 bg-[#FEE500] py-2.5 text-seum-navy hover:brightness-95 md:gap-1.5 md:py-5"
            >
              {/* 헤드셋 아이콘 */}
              <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-7 md:w-7" fill="none">
                <path d="M4 13v-1a8 8 0 0116 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <rect x="2.5" y="13" width="4" height="6" rx="2" fill="currentColor" />
                <rect x="17.5" y="13" width="4" height="6" rx="2" fill="currentColor" />
                <path d="M20 19v1a3 3 0 01-3 3h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="23" r="1.3" fill="currentColor" />
              </svg>
              <span className="hidden text-center text-[12px] font-bold leading-tight md:block">대화<br />시작하기</span>
              <span className="text-[9px] font-bold md:hidden">대화</span>
            </button>

            {/* 상담 및 문의 (클릭 시 /consult 이동) */}
            <button
              onClick={() => go("/consult")}
              className="flex flex-col items-center justify-center gap-1 border-t border-slate-200 py-2.5 hover:bg-slate-50 md:gap-2 md:py-5"
            >
              <Ico.chat className="h-5 w-5 text-seum-blue md:h-7 md:w-7" />
              <span className="hidden text-[12px] font-medium md:block">상담 및 문의</span>
              <span className="text-[9px] font-medium md:hidden">문의</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            aria-label="상담 메뉴 열기"
            className="flex h-11 w-11 flex-col items-center justify-center rounded-l-full border border-r-0 border-slate-200 bg-white text-seum-navy shadow-xl hover:bg-slate-50 md:h-12 md:w-12"
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