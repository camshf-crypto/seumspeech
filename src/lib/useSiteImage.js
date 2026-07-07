import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// 단일 슬롯 이미지 불러오기: const logo = useSiteImage("logo");
export function useSiteImage(slot) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("site_images")
        .select("image_url")
        .eq("slot", slot)
        .maybeSingle();
      if (alive) setUrl(data?.image_url ?? "");
    })();
    return () => { alive = false; };
  }, [slot]);
  return url;
}