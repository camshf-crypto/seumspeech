import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const fmt = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

export default function HomeworkTab({ studentId, locked = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    const { data: enr } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("student_id", studentId);
    const courseIds = (enr ?? []).map((e) => e.course_id).filter(Boolean);

    if (courseIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: hws } = await supabase
      .from("homeworks")
      .select("*, courses(title), teacher:teacher_id(name)")
      .in("course_id", courseIds)
      .order("created_at", { ascending: false });
    const homeworks = hws ?? [];

    if (homeworks.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const hwIds = homeworks.map((h) => h.id);
    const { data: subs } = await supabase
      .from("homework_submissions")
      .select("*")
      .eq("student_id", studentId)
      .in("homework_id", hwIds);
    const submissions = subs ?? [];

    const subIds = submissions.map((s) => s.id);
    let feedbacks = [];
    if (subIds.length > 0) {
      const { data: fbs } = await supabase
        .from("homework_feedback")
        .select("*, teacher:teacher_id(name)")
        .in("submission_id", subIds);
      feedbacks = fbs ?? [];
    }

    const merged = homeworks.map((h) => {
      const submission = submissions.find((s) => s.homework_id === h.id) || null;
      const feedback = submission
        ? feedbacks.find((f) => f.submission_id === submission.id) || null
        : null;
      return { homework: h, submission, feedback };
    });

    setItems(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [studentId]);

  if (loading) {
    return (
      <div>
        <h2 className="mb-3 font-bold text-seum-navy">숙제</h2>
        <p className="text-slate-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 font-bold text-seum-navy">숙제</h2>
      <p className="mb-4 text-sm text-slate-500">
        선생님이 내주신 과제를 확인하고 제출하세요. 제출 후 선생님 피드백이 달립니다.
      </p>

      {locked ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          수강이 종료되어 숙제를 제출할 수 없습니다. 받은 숙제와 선생님 피드백은 계속 확인하실 수 있으며, 재등록 후 다시 제출할 수 있습니다.
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          아직 등록된 과제가 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <HomeworkCard
              key={it.homework.id}
              data={it}
              studentId={studentId}
              locked={locked}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HomeworkCard({ data, studentId, locked, onChanged }) {
  const { homework: h, submission, feedback } = data;
  const submitType = h.submit_type || "both";
  const allowText = submitType === "text" || submitType === "both";
  const allowFile = submitType === "file" || submitType === "both";

  const [content, setContent] = useState(submission?.content ?? "");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  // 만료면 작성칸을 처음부터 닫아둠 (제출 안 한 숙제도 입력 안 보이게)
  const [open, setOpen] = useState(!submission && !locked);

  const fileInputId = `hw-file-${h.id}`;

  const openFile = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const submit = async () => {
    if (locked) return alert("수강이 종료되어 숙제를 제출할 수 없습니다. 재등록 후 이용해주세요.");
    if (allowText && !allowFile && !content.trim()) {
      return alert("내용을 입력하세요.");
    }
    if (allowFile && !allowText && !file && !submission?.file_url) {
      return alert("파일을 선택하세요.");
    }
    if (allowText && allowFile && !content.trim() && !file && !submission?.file_url) {
      return alert("내용을 입력하거나 파일을 첨부하세요.");
    }

    setSaving(true);

    let filePath = submission?.file_path ?? null;
    let fileUrl = submission?.file_url ?? null;

    if (allowFile && file) {
      const ext = file.name.split(".").pop();
      const path = `${studentId}/homework/${h.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("student-files")
        .upload(path, file);
      if (upErr) {
        setSaving(false);
        return alert("업로드 실패: " + upErr.message);
      }
      if (submission?.file_path) {
        await supabase.storage.from("student-files").remove([submission.file_path]);
      }
      const { data: urlData } = supabase.storage
        .from("student-files")
        .getPublicUrl(path);
      filePath = path;
      fileUrl = urlData.publicUrl;
    }

    const payload = {
      homework_id: h.id,
      student_id: studentId,
      content: allowText ? content.trim() : null,
      file_path: filePath,
      file_url: fileUrl,
      submitted_at: new Date().toISOString(),
    };

    let dbErr;
    if (submission) {
      const { error } = await supabase
        .from("homework_submissions")
        .update(payload)
        .eq("id", submission.id);
      dbErr = error;
    } else {
      const { error } = await supabase
        .from("homework_submissions")
        .insert(payload);
      dbErr = error;
    }

    setSaving(false);
    if (dbErr) return alert("제출 실패: " + dbErr.message);

    setFile(null);
    const input = document.getElementById(fileInputId);
    if (input) input.value = "";
    setOpen(false);
    onChanged();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-seum-navy">{h.title}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {h.courses?.title}
            {h.teacher?.name ? ` · ${h.teacher.name} 선생님` : ""}
            {h.due_date ? ` · 마감 ${fmt(h.due_date)}` : ""}
          </p>
        </div>
        {submission ? (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600">
            제출 완료
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
            미제출
          </span>
        )}
      </div>

      {h.description ? (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {h.description}
        </p>
      ) : null}

      {/* 제출한 내용 보기 */}
      {submission && !open ? (
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
          {submission.content ? (
            <p className="whitespace-pre-wrap">{submission.content}</p>
          ) : null}
          {submission.file_url ? (
            <button
              type="button"
              onClick={() => openFile(submission.file_url)}
              className="mt-1 block font-medium text-seum-blue hover:underline"
            >
              제출한 파일 열기
            </button>
          ) : null}
          <p className="mt-1 text-xs text-slate-400">
            제출일 {new Date(submission.submitted_at).toLocaleString("ko-KR")}
          </p>
          {!locked ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-2 text-sm font-medium text-seum-blue hover:underline"
            >
              다시 제출
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 미제출인데 만료된 경우 안내 */}
      {!submission && locked ? (
        <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-400">
          수강이 종료되어 제출할 수 없습니다.
        </p>
      ) : null}

      {/* 작성 폼 (만료 아닐 때만) */}
      {open && !locked ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {allowText ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="과제 내용을 작성하세요."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-seum-blue"
            />
          ) : null}
          {allowFile ? (
            <div>
              <input
                id={fileInputId}
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:text-slate-600"
              />
              {submission?.file_url && !file ? (
                <p className="mt-1 text-xs text-slate-400">
                  기존 파일이 있습니다. 새 파일을 올리면 교체됩니다.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-seum-blue px-4 py-2 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60"
            >
              {saving ? "제출 중..." : submission ? "수정 제출" : "제출하기"}
            </button>
            {submission ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
              >
                취소
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-bold text-seum-blue">
            {feedback.teacher?.name ? `${feedback.teacher.name} 선생님 피드백` : "선생님 피드백"}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {feedback.content}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {new Date(feedback.created_at).toLocaleString("ko-KR")}
          </p>
        </div>
      ) : null}
    </div>
  );
}