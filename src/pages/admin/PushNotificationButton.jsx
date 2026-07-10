import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// VAPID 공개키 (프론트에 노출돼도 되는 키)
const VAPID_PUBLIC_KEY =
  "BOzAl7ZbD9yUTgZqlzVJoJottipLL2G-SHdffhmNYvZqQGh7mcwYfxjYMLBRiGuDvxYRCo4mt_qi2bhoDRZE2jY";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushNotificationButton({ userId }) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    // 현재 구독 상태 확인
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      // 알림 권한 요청
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.");
        setBusy(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "endpoint" }
      );
      if (error) throw error;

      setSubscribed(true);
      alert("알림이 켜졌습니다! 이제 새 상담이 오면 알림을 받아요.");
    } catch (e) {
      alert("알림 설정 실패: " + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      }
      setSubscribed(false);
    } catch (e) {
      alert("알림 끄기 실패: " + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <span className="text-xs text-slate-400">이 브라우저는 알림을 지원하지 않아요</span>
    );
  }

  return subscribed ? (
    <button onClick={disable} disabled={busy}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60">
      🔔 알림 켜짐 (끄기)
    </button>
  ) : (
    <button onClick={enable} disabled={busy}
      className="rounded-lg bg-seum-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
      {busy ? "설정 중..." : "🔔 상담 알림 받기"}
    </button>
  );
}