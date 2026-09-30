import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";

let started = false;
let currentToken = null;

// 앱(안드로이드)에서 열렸을 때만 동작. 웹 브라우저에서는 아무것도 안 함
export async function initNativePush() {
  if (!Capacitor.isNativePlatform() || started) return;
  started = true;

  // 알림이 화면 위에 팝업으로 뜨도록 채널 생성 (안드로이드 8 이상)
  await PushNotifications.createChannel({
    id: "default",
    name: "세움스피치 알림",
    description: "숙제·피드백·공지 알림",
    importance: 5,
    visibility: 1,
  });

  // 기기 토큰을 받으면 Supabase에 저장
  PushNotifications.addListener("registration", async ({ value }) => {
    currentToken = value;
    const { error } = await supabase.rpc("register_push_token", {
      p_token: value,
      p_platform: Capacitor.getPlatform(),
    });
    if (error) console.error("푸시 토큰 저장 실패:", error);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("푸시 등록 실패:", err);
  });

  // 알림을 눌렀을 때 지정된 화면으로 이동
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = action.notification?.data?.url;
    if (url) window.location.href = url;
  });

  // 로그인돼 있으면 권한 요청 → 토큰 발급
  supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) {
      requestAndRegister();
    }
  });
}

async function requestAndRegister() {
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;
  await PushNotifications.register();
}

// 로그아웃 직전에 호출하면 이 기기로 알림이 더 안 감
export async function removeNativePushToken() {
  if (!currentToken) return;
  await supabase.from("push_tokens").delete().eq("token", currentToken);
  currentToken = null;
}