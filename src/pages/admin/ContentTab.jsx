import { useEffect, useState } from "react";
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
//  업로드 용량 제한
//  - 원본은 최대 30MB까지 받음
//  - 일반 사진은 최대 1.5MB로 압축
//  - 로고는 최대 1MB를 목표로 축소
// ════════════════════════════════════════════════
const MAX_SOURCE_FILE_BYTES = 30 * 1024 * 1024;
const MAX_PHOTO_FILE_BYTES = 1.5 * 1024 * 1024;
const MAX_LOGO_FILE_BYTES = 1 * 1024 * 1024;

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("사진 변환에 실패했습니다."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

// JPEG 품질을 낮추고, 그래도 크면 이미지 자체를 조금씩 줄여
// 최대 파일 용량 안으로 맞춘다.
async function exportJpegWithinLimit(sourceCanvas, maxBytes) {
  let canvas = sourceCanvas;
  const qualities = [0.88, 0.82, 0.76, 0.7, 0.64];

  for (let resizeRound = 0; resizeRound < 5; resizeRound += 1) {
    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (blob.size <= maxBytes) return blob;
    }

    const nextWidth = Math.max(1, Math.round(canvas.width * 0.88));
    const nextHeight = Math.max(1, Math.round(canvas.height * 0.88));
    const smallerCanvas = document.createElement("canvas");
    smallerCanvas.width = nextWidth;
    smallerCanvas.height = nextHeight;

    const context = smallerCanvas.getContext("2d");
    if (!context) throw new Error("사진 처리 기능을 사용할 수 없습니다.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(canvas, 0, 0, nextWidth, nextHeight);
    canvas = smallerCanvas;
  }

  // 극단적으로 큰 이미지도 업로드 자체가 막히지 않도록 마지막 결과를 반환
  return canvasToBlob(canvas, "image/jpeg", 0.6);
}

// ════════════════════════════════════════════════
//  일반 사진용 — 원본 비율을 그대로 유지하며 크기만 축소
//  고정 비율 캔버스, 크롭, 흰 여백을 만들지 않는다.
// ════════════════════════════════════════════════
function resizePhotoOriginalRatio(file, cropType) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_SOURCE_FILE_BYTES) {
      reject(new Error("원본 사진은 30MB 이하만 업로드할 수 있습니다."));
      return;
    }

    const target = CROP_SIZES[cropType] || CROP_SIZES.photo;
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("사진 파일을 읽지 못했습니다."));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("사진을 불러오지 못했습니다."));
      image.onload = async () => {
        try {
          // 원본보다 키우지 않고, 슬롯별 최대 크기 안으로만 줄인다.
          // 가로·세로 비율은 그대로 유지한다.
          const scale = Math.min(
            1,
            target.w / image.naturalWidth,
            target.h / image.naturalHeight
          );

          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d");
          if (!context) throw new Error("사진 처리 기능을 사용할 수 없습니다.");

          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(image, 0, 0, width, height);

          // 일반 콘텐츠 사진은 JPEG로 통일해 저장 용량을 제한한다.
          const blob = await exportJpegWithinLimit(
            canvas,
            MAX_PHOTO_FILE_BYTES
          );

          const outputName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve(
            new File([blob], outputName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        } catch (error) {
          reject(error);
        }
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

// ════════════════════════════════════════════════
//  로고용 — 원본 비율 유지, 가로 최대 600px
//  투명 배경을 살리기 위해 PNG를 우선 사용한다.
// ════════════════════════════════════════════════
function resizeLogo(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_SOURCE_FILE_BYTES) {
      reject(new Error("원본 로고는 30MB 이하만 업로드할 수 있습니다."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("로고 파일을 읽지 못했습니다."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("로고 이미지를 불러오지 못했습니다."));
      image.onload = async () => {
        try {
          const maxWidth = 600;
          const scale = Math.min(1, maxWidth / image.naturalWidth);
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d");
          if (!context) throw new Error("로고 처리 기능을 사용할 수 없습니다.");

          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(image, 0, 0, width, height);

          let blob = await canvasToBlob(canvas, "image/png");
          let extension = "png";
          let type = "image/png";

          // 복잡한 PNG라 1MB를 넘는 경우, 투명 배경을 유지하는 WebP로 경량화한다.
          if (blob.size > MAX_LOGO_FILE_BYTES) {
            blob = await canvasToBlob(canvas, "image/webp", 0.9);
            extension = "webp";
            type = "image/webp";
          }

          const outputName =
            file.name.replace(/\.[^.]+$/, "") + "." + extension;

          resolve(
            new File([blob], outputName, {
              type,
              lastModified: Date.now(),
            })
          );
        } catch (error) {
          reject(error);
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ContentTab() {
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [siteTab, setSiteTab] = useState("speech");

  const current = SITE_TABS.find((t) => t.key === siteTab);
  const realSlot = (slot) => current.prefix + slot;

  const load = async () => {
    setLoading(true);
    // 조회 에러를 삼키지 않고 표시한다 (예전엔 error를 안 봐서 원인 파악이 어려웠음)
    const { data, error } = await supabase.from("site_images").select("*");
    if (error) {
      console.error("site_images 조회 실패:", error);
      alert("사진 목록을 불러오지 못했습니다: " + error.message);
    }
    const map = {};
    (data ?? []).forEach((r) => { map[r.slot] = r; });
    setImages(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // 파일 선택 → 원본 비율을 유지한 채 크기만 줄여 바로 업로드
  const onPick = async (slotObj, file) => {
    if (!file) return;

    try {
      setBusy(realSlot(slotObj.slot));

      const finalFile =
        slotObj.crop === "logo"
          ? await resizeLogo(file)
          : await resizePhotoOriginalRatio(file, slotObj.crop);

      await doUpload(slotObj, finalFile);
    } catch (error) {
      alert("사진 처리 실패: " + error.message);
      setBusy("");
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
      <p className="mb-4 text-sm text-slate-400">사진을 올리면 원본 비율을 유지한 채 슬롯별 최대 크기와 1.5MB 이하로 자동 최적화되어 홈페이지에 바로 반영됩니다.</p>

      <div className="mb-6 flex gap-2">
        {SITE_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setSiteTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${siteTab === t.key ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-seum-blue/20 bg-seum-blue/5 p-4 text-sm text-slate-600">
        <b className="text-seum-navy">🖼️ 원본 비율 그대로 업로드</b><br />
        사진은 자르거나 흰 여백을 추가하지 않습니다. <b>가로·세로 비율을 그대로 유지하면서 크기와 용량만 자동으로 줄여</b> 저장합니다. 일반 사진은 최대 1.5MB, 원본 업로드는 30MB까지 가능합니다.
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
                      {img?.image_url ? <img src={img.image_url} alt={s.label} className="h-full w-full object-contain" /> : <span className="text-[10px] text-slate-300">없음</span>}
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

    </div>
  );
}