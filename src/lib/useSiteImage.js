import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * site_images 테이블 전체를 한 번에 읽어
 * { 슬롯키: 이미지주소 } 맵으로 돌려주는 공통 훅.
 *
 *   const { img } = useSiteImages();              // 스피치 사이트
 *   const { img } = useSiteImages("interview_");  // 면접 사이트 (자동 접두사)
 *   <img src={img("room1", LOCATION.branches[0].image)} />
 *   → DB에 있으면 그걸, 없으면 config.js 값으로 자동 폴백
 */
export function useSiteImages(prefix = "") {
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error: err } = await supabase
        .from("site_images")
        .select("slot, image_url");

      if (!alive) return;

      if (err) {
        // 조회 에러를 삼키지 않는다 (콘텐츠 관리 때 겪었던 문제)
        console.error("[useSiteImages] site_images 조회 실패:", err);
        setError(err);
        setLoading(false);
        return;
      }

      const map = {};
      (data ?? []).forEach((row) => {
        if (row.slot && row.image_url) map[row.slot] = row.image_url;
      });

      setImages(map);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const img = (slot, fallback = "") => images[prefix + slot] || fallback;

  return { images, img, loading, error };
}

/**
 * 슬롯 하나만 읽어 이미지 주소(문자열)를 돌려준다.
 * 기존에 InterviewHeader 등에서 쓰던 훅.
 *
 *   const logo = useSiteImage("interview_logo", DEFAULT_LOGO);
 *
 * ⚠️ 슬롯 이름은 접두사까지 붙은 실제 키를 그대로 넣는다.
 *    (면접 사이트는 "interview_logo", "interview_heroBg" 형태)
 */
export function useSiteImage(slot, fallback = "") {
  const [url, setUrl] = useState(fallback);

  useEffect(() => {
    if (!slot) return;
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from("site_images")
        .select("image_url")
        .eq("slot", slot)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        console.error("[useSiteImage] 조회 실패:", slot, error);
        return;
      }

      if (data?.image_url) setUrl(data.image_url);
    })();

    return () => {
      alive = false;
    };
  }, [slot]);

  return url;
}

export default useSiteImages;