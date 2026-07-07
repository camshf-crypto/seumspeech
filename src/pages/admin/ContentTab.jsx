import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

// ════════════════════════════════════════════════
//  슬롯 종류별 목표 크기/비율
// ════════════════════════════════════════════════
const CROP_SIZES = {
  photo: { w: 1200, h: 900 },    // 수업사진·갤러리 (4:3)
  hero: { w: 1920, h: 1080 },    // 히어로 (16:9)
  portrait: { w: 900, h: 1200 }, // 원장 (3:4)
  logo: null,                    // 로고는 크롭 안 함
};

// ════════════════════════════════════════════════
//  스피치 사이트 슬롯
// ════════════════════════════════════════════════
const SPEECH_GROUPS = [
  { title: "인트로 (첫 화면 스피치/면접 배경)", slots: [
    { slot: "intro_speechBg", label: "인트로 - 스피치 배경", hint: "첫 화면 왼쪽(세움스피치) 배경 (16:9)", crop: "hero" },
    { slot: "intro_interviewBg", label: "인트로 - 면접 배경", hint: "첫 화면 오른쪽(세움면접) 배경 (16:9)", crop: "hero" },
  ]},
  { title: "기본", slots: [
    { slot: "logo", label: "로고", hint: "헤더 좌측 · PNG 투명배경", crop: "logo" },
    { slot: "heroBg", label: "메인 히어로 배경", hint: "상단 큰 배경 (16:9)", crop: "hero" },
  ]},
  { title: "소개 / 원장", slots: [
    { slot: "principalImg", label: "원장 사진 (소개)", hint: "아카데미 소개 (3:4 세로)", crop: "portrait" },
    { slot: "principalImg2", label: "대표원장 사진 (강사소개)", hint: "강사소개 상단 (3:4 세로)", crop: "portrait" },
  ]},
  { title: "인기 강좌 (메인)", slots: [
    { slot: "course1", label: "강좌 1", hint: "(4:3)", crop: "photo" },
    { slot: "course2", label: "강좌 2", hint: "(4:3)", crop: "photo" },
    { slot: "course3", label: "강좌 3", hint: "(4:3)", crop: "photo" },
  ]},
  { title: "수강 후기 (메인)", slots: [
    { slot: "review1", label: "후기 1", hint: "(4:3)", crop: "photo" },
    { slot: "review2", label: "후기 2", hint: "(4:3)", crop: "photo" },
    { slot: "review3", label: "후기 3", hint: "(4:3)", crop: "photo" },
    { slot: "review4", label: "후기 4", hint: "(4:3)", crop: "photo" },
  ]},
  { title: "교육현장 갤러리 (메인)", slots: [
    { slot: "gallery1", label: "갤러리 1", hint: "실전 발표 트레이닝 (4:3)", crop: "photo" },
    { slot: "gallery2", label: "갤러리 2", hint: "1:1 맞춤 코칭 (4:3)", crop: "photo" },
    { slot: "gallery3", label: "갤러리 3", hint: "모의 면접 현장 (4:3)", crop: "photo" },
    { slot: "gallery4", label: "갤러리 4", hint: "소수정예 그룹 수업 (4:3)", crop: "photo" },
  ]},
  { title: "강의실 (오시는 길)", slots: [
    { slot: "room1", label: "강의실 1", hint: "(4:3)", crop: "photo" },
    { slot: "room2", label: "강의실 2", hint: "(4:3)", crop: "photo" },
  ]},
  { title: "기업 교육 현장", slots: [
    { slot: "corp1", label: "현장 1", hint: "(4:3)", crop: "photo" },
    { slot: "corp2", label: "현장 2", hint: "(4:3)", crop: "photo" },
    { slot: "corp3", label: "현장 3", hint: "(4:3)", crop: "photo" },
    { slot: "corp4", label: "현장 4", hint: "(4:3)", crop: "photo" },
    { slot: "corp5", label: "현장 5", hint: "(4:3)", crop: "photo" },
    { slot: "corp6", label: "현장 6", hint: "(4:3)", crop: "photo" },
    { slot: "corp7", label: "현장 7", hint: "(4:3)", crop: "photo" },
    { slot: "corp8", label: "현장 8", hint: "(4:3)", crop: "photo" },
  ]},
];

// ════════════════════════════════════════════════
//  면접 사이트 슬롯 (prefix "interview_" 자동)
// ════════════════════════════════════════════════
const classPhotos = (prefix, caps) =>
  caps.map((c, i) => ({ slot: `${prefix}${i + 1}`, label: `수업사진 ${i + 1}`, hint: `${c} (4:3)`, crop: "photo" }));

const INTERVIEW_GROUPS = [
  { title: "기본 (전 페이지 공통)", slots: [
    { slot: "logo", label: "로고", hint: "면접 헤더 로고 · PNG 투명", crop: "logo" },
    { slot: "heroBg", label: "메인 히어로 배경", hint: "면접 메인 상단 (16:9)", crop: "hero" },
    { slot: "principalImg", label: "원장 / 대표 사진", hint: "면접 소개 (3:4 세로)", crop: "portrait" },
  ]},
  { title: "① 고입 면접", slots: classPhotos("high", ["자소서 1:1 첨삭","학교별 기출 분석","AI 모의면접 연습","제시문 면접 훈련","소수정예 그룹 수업","실전 모의면접 촬영"]) },
  { title: "② 대입 면접", slots: classPhotos("univ", ["생기부 1:1 분석","학과별 기출 분석","AI 모의면접 연습","제시문 면접 훈련","1:6 소수정예 수업","실전 모의면접 촬영"]) },
  { title: "③ 편입 면접", slots: classPhotos("trans", ["전공질문 1:1 대비","학교별 기출 분석","간호 전공 면접 연습","AI 모의면접 연습","1:6 소수정예 수업","실전 모의면접 촬영"]) },
  { title: "④ 대학원 면접", slots: classPhotos("grad", ["학업계획서 1:1 분석","대학원별 기출 분석","전공 논리 설명 훈련","AI 모의면접 연습","1:6 소수정예 수업","실전 모의면접 촬영"]) },
  { title: "⑤ 국가직 공무원", slots: classPhotos("public", ["자기기술서 첨삭","5분 발표 훈련","개별면접 코칭","모의면접 현장","그룹 실전 연습","비디오 피드백"]) },
  { title: "⑥ 지방직 공무원", slots: classPhotos("local", ["자기기술서 첨삭","집단토론 실전","개별면접 코칭","모의면접 현장","그룹 실전 연습","비디오 피드백"]) },
  { title: "⑦ 서울시 공무원", slots: classPhotos("seoul", ["5분 스피치 훈련","시정정책 분석","개별면접 코칭","모의면접 현장","그룹 실전 연습","비디오 피드백"]) },
  { title: "⑧ 군무원", slots: classPhotos("military", ["지원동기 코칭","국방·안보 이슈 분석","인성·상황 면접","모의면접 현장","그룹 실전 연습","비디오 피드백"]) },
  { title: "⑨ 공기업 면접", slots: classPhotos("company", ["경험면접 코칭","집단토론 실전","PT 발표 훈련","모의면접 현장","그룹 실전 연습","비디오 피드백"]) },
  { title: "⑩ NCS·직무역량", slots: classPhotos("ncs", ["경험면접 STAR 코칭","상황면접 훈련","자소서 심층 대비","모의면접 현장","그룹 실전 연습","비디오 피드백"]) },
  { title: "⑪ 토론·PT 면접", slots: classPhotos("debate", ["토론 발언 코칭","집단토론 실전","PT 발표 훈련","모의면접 현장","그룹 실전 연습","비디오 피드백"]) },
  { title: "⑫ 경력직 면접", slots: classPhotos("career", ["경력·프로젝트 분석","성과 구조화 코칭","임원면접 대비","모의면접 현장","그룹 실전 연습","비디오 피드백"]) },
  { title: "⑬ 임원 면접", slots: classPhotos("exec", ["리더십 커리어 분석","전략·비전 설계","경영진 모의면접","모의면접 현장","그룹 실전 연습","비디오 피드백"]) },
];

const SITE_TABS = [
  { key: "speech", label: "스피치 사이트", prefix: "", groups: SPEECH_GROUPS },
  { key: "interview", label: "면접 사이트", prefix: "interview_", groups: INTERVIEW_GROUPS },
];

// ════════════════════════════════════════════════
//  크롭 편집 모달 — 드래그로 위치 이동 + 슬라이더로 확대
// ════════════════════════════════════════════════
function CropModal({ file, cropType, onCancel, onConfirm }) {
  const size = CROP_SIZES[cropType] || CROP_SIZES.photo;
  const boxW = 420;                       // 미리보기 가로(px)
  const boxH = Math.round(boxW * size.h / size.w); // 비율 맞춘 세로

  const [imgEl, setImgEl] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });   // 이미지 좌상단 오프셋(px)
  const drag = useRef(null);

  // 이미지 로드 + 초기 배치(박스를 꽉 채우는 최소 스케일)
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { setImgEl(im); URL.revokeObjectURL(url); };
    im.src = url;
  }, [file]);

  // 박스를 채우는 기본 스케일(cover)
  const baseScale = imgEl ? Math.max(boxW / imgEl.width, boxH / imgEl.height) : 1;
  const dispW = imgEl ? imgEl.width * baseScale * zoom : 0;
  const dispH = imgEl ? imgEl.height * baseScale * zoom : 0;

  // 초기 위치 = 가운데
  useEffect(() => {
    if (imgEl) setPos({ x: (boxW - dispW) / 2, y: (boxH - dispH) / 2 });
    // eslint-disable-next-line
  }, [imgEl]);

  // 이미지가 박스 밖으로 빠지지 않게 제한
  const clamp = (x, y) => ({
    x: Math.min(0, Math.max(boxW - dispW, x)),
    y: Math.min(0, Math.max(boxH - dispH, y)),
  });

  const onDown = (e) => {
    const p = e.touches ? e.touches[0] : e;
    drag.current = { sx: p.clientX, sy: p.clientY, ox: pos.x, oy: pos.y };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const p = e.touches ? e.touches[0] : e;
    const nx = drag.current.ox + (p.clientX - drag.current.sx);
    const ny = drag.current.oy + (p.clientY - drag.current.sy);
    setPos(clamp(nx, ny));
  };
  const onUp = () => { drag.current = null; };

  // zoom 바뀌면 위치 재보정
  useEffect(() => { setPos((p) => clamp(p.x, p.y)); // eslint-disable-next-line
  }, [zoom]);

  const doConfirm = () => {
    if (!imgEl) return;
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size.w, size.h);

    // 미리보기 박스(boxW×boxH)에 보이는 영역을, 원본 이미지 좌표계로 역산해서 잘라 그림
    // 미리보기에서 이미지는 (pos.x, pos.y) 위치에 dispW×dispH 크기로 그려져 있음.
    // 박스(0,0 ~ boxW,boxH)에 해당하는 "원본 이미지 상의 영역"을 구한다.
    const scale = dispW / imgEl.width; // 원본 → 미리보기 표시 배율
    // 박스 좌상단(0,0)이 원본 이미지의 어느 좌표인지
    const srcX = (0 - pos.x) / scale;
    const srcY = (0 - pos.y) / scale;
    const srcW = boxW / scale;
    const srcH = boxH / scale;

    ctx.drawImage(
      imgEl,
      srcX, srcY, srcW, srcH,   // 원본에서 잘라올 영역
      0, 0, size.w, size.h      // 캔버스에 채울 영역
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const out = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      onConfirm(out);
    }, "image/jpeg", 0.85);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseUp={onUp} onMouseMove={onMove} onTouchMove={onMove} onTouchEnd={onUp}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h3 className="mb-1 font-bold text-seum-navy">사진 위치 조정</h3>
        <p className="mb-3 text-xs text-slate-400">드래그해서 위치를 옮기고, 아래 막대로 확대/축소하세요. 파란 테두리 안이 실제로 보이는 영역입니다.</p>

        <div className="mx-auto overflow-hidden rounded-xl ring-2 ring-seum-blue" style={{ width: boxW, height: boxH, position: "relative", touchAction: "none", cursor: "move" }}
          onMouseDown={onDown} onTouchStart={onDown}>
          {imgEl ? (
            <img src={imgEl.src} alt="crop" draggable={false}
              style={{ position: "absolute", left: pos.x, top: pos.y, width: dispW, height: dispH, maxWidth: "none", userSelect: "none" }} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">불러오는 중...</div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-slate-400">축소</span>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="flex-1 accent-seum-blue" />
          <span className="text-xs text-slate-400">확대</span>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50">취소</button>
          <button onClick={doConfirm} disabled={!imgEl} className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">이 위치로 저장</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
//  로고용 — 크롭 없이 리사이즈만 (비율 유지, 가로 최대 600)
// ════════════════════════════════════════════════
function resizeLogo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 600;
      const scale = Math.min(1, maxW / im.width);
      const canvas = document.createElement("canvas");
      canvas.width = im.width * scale;
      canvas.height = im.height * scale;
      canvas.getContext("2d").drawImage(im, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" })), "image/png");
    };
    im.src = url;
  });
}

export default function ContentTab() {
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [siteTab, setSiteTab] = useState("speech");
  const [cropTarget, setCropTarget] = useState(null); // { slotObj, file }

  const current = SITE_TABS.find((t) => t.key === siteTab);
  const realSlot = (slot) => current.prefix + slot;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_images").select("*");
    const map = {};
    (data ?? []).forEach((r) => { map[r.slot] = r; });
    setImages(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // 파일 선택 → 로고면 바로 업로드, 아니면 크롭 모달 열기
  const onPick = async (slotObj, file) => {
    if (!file) return;
    if (slotObj.crop === "logo") {
      const resized = await resizeLogo(file);
      await doUpload(slotObj, resized);
    } else {
      setCropTarget({ slotObj, file });
    }
  };

  const doUpload = async (slotObj, finalFile) => {
    const key = realSlot(slotObj.slot);
    setBusy(key);
    try {
      const existing = images[key];
      if (existing?.file_path) await supabase.storage.from("site-images").remove([existing.file_path]);
      const ext = finalFile.name.split(".").pop();
      const path = `${key}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("site-images").upload(path, finalFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("site-images").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("site_images").upsert({ slot: key, image_url: pub.publicUrl, file_path: path, updated_at: new Date().toISOString() }, { onConflict: "slot" });
      if (dbErr) throw dbErr;
      await load();
    } catch (e) {
      alert("업로드 실패: " + e.message);
    } finally {
      setBusy("");
    }
  };

  const remove = async (slotObj) => {
    if (!window.confirm("이 사진을 삭제할까요?")) return;
    const key = realSlot(slotObj.slot);
    setBusy(key);
    try {
      const existing = images[key];
      if (existing?.file_path) await supabase.storage.from("site-images").remove([existing.file_path]);
      await supabase.from("site_images").delete().eq("slot", key);
      await load();
    } catch (e) {
      alert("삭제 실패: " + e.message);
    } finally {
      setBusy("");
    }
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      <h2 className="mb-1 font-bold text-seum-navy">콘텐츠 관리</h2>
      <p className="mb-4 text-sm text-slate-400">사진을 올린 뒤 위치를 직접 조정할 수 있습니다. 조정 후 저장하면 홈페이지에 바로 반영됩니다.</p>

      <div className="mb-6 flex gap-2">
        {SITE_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setSiteTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${siteTab === t.key ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-seum-blue/20 bg-seum-blue/5 p-4 text-sm text-slate-600">
        <b className="text-seum-navy">✂️ 사진 위치 직접 조정</b><br />
        사진을 선택하면 편집 창이 열립니다. <b>드래그로 위치를 옮기고, 막대로 확대/축소</b>해서 원하는 부분을 맞춘 뒤 저장하세요. (로고는 조정 없이 바로 올라갑니다)
      </div>

      <div className="space-y-8">
        {current.groups.map((g) => (
          <section key={g.title}>
            <h3 className="mb-3 border-l-4 border-seum-blue pl-2 text-sm font-bold text-seum-navy">{g.title}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.slots.map((s) => {
                const key = realSlot(s.slot);
                const img = images[key];
                const isBusy = busy === key;
                return (
                  <div key={s.slot} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex h-16 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {img?.image_url ? <img src={img.image_url} alt={s.label} className="h-full w-full object-cover" /> : <span className="text-[10px] text-slate-300">없음</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-seum-navy">{s.label}</p>
                      {s.hint ? <p className="truncate text-xs text-slate-400">{s.hint}</p> : null}
                      <div className="mt-1.5 flex gap-1.5">
                        <label className={`cursor-pointer rounded-md bg-seum-blue px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#2a63c4] ${isBusy ? "opacity-60" : ""}`}>
                          {isBusy ? "처리중" : img?.image_url ? "교체" : "업로드"}
                          <input type="file" accept="image/*" className="hidden" disabled={isBusy}
                            onChange={(e) => { onPick(s, e.target.files?.[0]); e.target.value = ""; }} />
                        </label>
                        {img?.image_url ? <button onClick={() => remove(s)} disabled={isBusy} className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-60">삭제</button> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {cropTarget && (
        <CropModal
          file={cropTarget.file}
          cropType={cropTarget.slotObj.crop}
          onCancel={() => setCropTarget(null)}
          onConfirm={async (croppedFile) => {
            const target = cropTarget;
            setCropTarget(null);
            await doUpload(target.slotObj, croppedFile);
          }}
        />
      )}
    </div>
  );
}