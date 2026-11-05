import { useEffect, useState } from "react";
import {
  LiveKitRoom, LayoutContextProvider, useCreateLayoutContext, usePinnedTracks, useTracks,
  GridLayout, FocusLayoutContainer, FocusLayout, CarouselLayout, ParticipantTile,
  ControlBar, Chat, RoomAudioRenderer, ConnectionStateToast,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import "@livekit/components-styles";
import { supabase } from "../../lib/supabase";

/**
 * 온라인 수업 (줌 같은 화상 수업) — LiveKit
 *
 * 학생: 내가 수강 중인 온라인 수업 목록 → [입장하기]
 * 선생님·원장(staff): 온라인 수업 전체 목록 → [입장하기]
 * 입장권은 supabase 함수 online-room-token 이 발급 (수강 중인지 서버에서 확인)
 *
 * 온라인 수업 = courses.course_kind 가 'online' 인 수업
 * 지금은 전체 강의방(main)만. 실습방 나누기는 다음 단계에서.
 *
 * 화면 배치 (ClassStage)
 *   누가 화면공유 중 → 공유 화면 크게 + 나머지 옆 줄
 *   학생 화면       → 강사 얼굴 크게 + 학생들 옆 줄 (강사가 여러 명이면 먼저 들어온 사람)
 *   강사 화면       → 학생들 바둑판 (학생 얼굴을 다 봐야 하니까)
 *   누구든 얼굴 칸의 📌를 누르면 그 사람을 크게 (다시 누르면 원래대로)
 */

const isStaffP = (p) => {
  try { return ["teacher", "master"].includes(JSON.parse(p?.metadata || "{}").role); } catch { return false; }
};

function ClassStage({ viewerStaff }) {
  const [chatOpen, setChatOpen] = useState(false);
  const layout = useCreateLayoutContext();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  const pinned = usePinnedTracks(layout)?.[0];
  const share = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const teacherCam = viewerStaff
    ? null
    : tracks.find((t) => t.source === Track.Source.Camera && isStaffP(t.participant));
  const focus = pinned ?? share ?? teacherCam ?? null;
  const same = (a, b) => a && b && a.participant.identity === b.participant.identity && a.source === b.source;
  const others = tracks.filter((t) => !same(t, focus));

  return (
    <LayoutContextProvider value={layout} onWidgetChange={(w) => setChatOpen(!!w.showChat)}>
      <div className="lk-video-conference h-full">
        <div className="lk-video-conference-inner">
          {!focus ? (
            <div className="lk-grid-layout-wrapper">
              <GridLayout tracks={tracks}><ParticipantTile /></GridLayout>
            </div>
          ) : (
            <div className="lk-focus-layout-wrapper">
              <FocusLayoutContainer>
                <CarouselLayout tracks={others}><ParticipantTile /></CarouselLayout>
                <FocusLayout trackRef={focus} />
              </FocusLayoutContainer>
            </div>
          )}
          <ControlBar controls={{ chat: true }} />
        </div>
        <Chat style={{ display: chatOpen ? "grid" : "none" }} />
      </div>
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </LayoutContextProvider>
  );
}
export default function OnlineClassRoom({ userId, staff = false }) {
  const [courses, setCourses] = useState(null);
  const [joining, setJoining] = useState(null);
  const [room, setRoom] = useState(null); // { token, url, title }

  useEffect(() => {
    (async () => {
      if (staff) {
        const { data } = await supabase
          .from("courses")
          .select("id, title, weekday, start_time, start_date")
          .eq("course_kind", "online")
          .order("start_date", { ascending: false });
        setCourses(data ?? []);
      } else {
        const { data } = await supabase
          .from("enrollments")
          .select("id, status, courses!inner(id, title, weekday, start_time, start_date, course_kind)")
          .eq("student_id", userId)
          .eq("status", "active")
          .eq("courses.course_kind", "online");
        setCourses((data ?? []).map((e) => e.courses));
      }
    })();
  }, [userId, staff]);

  const enter = async (c) => {
    setJoining(c.id);
    try {
      const { data, error } = await supabase.functions.invoke("online-room-token", {
        body: { courseId: c.id, room: "main" },
      });
      if (error || data?.error) throw new Error(data?.error ?? error.message);
      setRoom({ token: data.token, url: data.url, title: c.title, staff: data.role === "teacher" || data.role === "master" });
    } catch (e) {
      alert("입장할 수 없어요: " + e.message);
    } finally {
      setJoining(null);
    }
  };

  // 화상 수업 화면 (화면 전체)
  if (room) {
    return (
      <div className="fixed inset-0 z-[300] flex flex-col bg-[#111]" data-lk-theme="default">
        <div className="flex h-12 shrink-0 items-center justify-between px-4 text-white">
          <span className="text-sm font-bold">{room.title} · 전체 강의</span>
          <button type="button" onClick={() => setRoom(null)}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-bold hover:bg-red-700">
            나가기
          </button>
        </div>
        <LiveKitRoom
          serverUrl={room.url}
          token={room.token}
          connect
          video
          audio
          onDisconnected={() => setRoom(null)}
          className="min-h-0 flex-1"
        >
          <ClassStage viewerStaff={room.staff} />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-seum-navy">온라인 수업</h2>
      <p className="mb-5 text-sm text-slate-500">수업 시간에 [입장하기]를 누르면 화상 수업에 들어가요. 카메라·마이크를 허용해 주세요.</p>

      {courses === null ? (
        <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : courses.length === 0 ? (
        <p className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-400">
          {staff ? "온라인 수업이 없어요. 수업 관리에서 온라인 수업을 만들어 주세요." : "수강 중인 온라인 수업이 없어요."}
        </p>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <p className="font-bold text-slate-800">{c.title}</p>
                <p className="text-xs text-slate-500">
                  {[c.start_date && `${c.start_date} 개강`, c.weekday, c.start_time?.slice(0, 5)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button type="button" onClick={() => enter(c)} disabled={joining === c.id}
                className="shrink-0 rounded-lg bg-seum-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-50">
                {joining === c.id ? "연결 중…" : "입장하기"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}