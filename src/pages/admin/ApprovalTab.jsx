import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const fmtDate = (ds) => {
  if (!ds) return "-";
  const d = new Date(ds);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const STATUS_TABS = [
  { key: "pending", label: "승인 대기" },
  { key: "approved", label: "승인 완료" },
  { key: "rejected", label: "거절" },
];

export default function ApprovalTab() {
  const [tab, setTab] = useState("pending");
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchMap, setBranchMap] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data: brs } = await supabase.from("branches").select("id, name");
    const bm = {};
    (brs ?? []).forEach((b) => { bm[b.id] = b.name; });
    setBranchMap(bm);

    const { data } = await supabase
      .from("enrollment_requests")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });
    setReqs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const approve = async (r) => {
    setBusyId(r.id);
    // 신청서 승인
    const { error: e1 } = await supabase
      .from("enrollment_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    // 학생 프로필 승인 + 정보 반영
    const { error: e2 } = await supabase
      .from("profiles")
      .update({ status: "approved", name: r.name, phone: r.phone, branch_id: r.branch_id })
      .eq("id", r.student_id);
    setBusyId(null);
    if (e1 || e2) return alert("승인 실패: " + (e1?.message || e2?.message));
    alert(`${r.name}님을 승인했습니다.`);
    load();
  };

  const reject = async (r) => {
    if (!window.confirm(`${r.name}님의 가입 신청을 거절할까요?`)) return;
    setBusyId(r.id);
    const { error: e1 } = await supabase
      .from("enrollment_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    const { error: e2 } = await supabase
      .from("profiles")
      .update({ status: "rejected" })
      .eq("id", r.student_id);
    setBusyId(null);
    if (e1 || e2) return alert("처리 실패: " + (e1?.message || e2?.message));
    load();
  };

  // 거절했던 걸 다시 승인 대기로 되돌리기
  const restore = async (r) => {
    setBusyId(r.id);
    await supabase.from("enrollment_requests").update({ status: "pending", reviewed_at: null }).eq("id", r.id);
    await supabase.from("profiles").update({ status: "pending" }).eq("id", r.student_id);
    setBusyId(null);
    load();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <h2 className="mb-4 font-bold text-seum-navy">가입 승인</h2>

      <div className="mb-4 flex gap-2">
        {STATUS_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === t.key ? "bg-seum-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400">불러오는 중...</p>
      ) : reqs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          {tab === "pending" ? "승인 대기 중인 신청이 없습니다." : tab === "approved" ? "승인 완료된 신청이 없습니다." : "거절된 신청이 없습니다."}
        </p>
      ) : (
        <div className="space-y-3">
          {reqs.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-seum-navy">
                    {r.name}
                    {r.gender ? <span className="ml-2 text-xs font-normal text-slate-400">{r.gender}</span> : null}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{r.phone}{r.email ? ` · ${r.email}` : ""}</p>
                </div>
                <span className="text-xs text-slate-400">{fmtDate(r.created_at)} 신청</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-sm sm:grid-cols-3">
                {r.birth ? (
                  <div><span className="text-slate-400">생년월일 </span><span className="text-slate-700">{fmtDate(r.birth)}</span></div>
                ) : null}
                {r.branch_id ? (
                  <div><span className="text-slate-400">지점 </span><span className="text-slate-700">{branchMap[r.branch_id] ?? "-"}</span></div>
                ) : null}
                {r.address ? (
                  <div><span className="text-slate-400">주소 </span><span className="text-slate-700">{r.address}</span></div>
                ) : null}
                <div>
                  <span className="text-slate-400">수강 </span>
                  <span className="text-slate-700">
                    {r.lesson_type === "oneonone" ? "1:1" : "단체반"}{r.lesson_detail ? ` · ${r.lesson_detail}` : ""}
                  </span>
                </div>
                {r.visit_path ? (
                  <div><span className="text-slate-400">방문경로 </span><span className="text-slate-700">{r.visit_path}</span></div>
                ) : null}
                <div>
                  <span className="text-slate-400">개인정보동의 </span>
                  <span className={r.privacy_agree ? "text-green-600" : "text-red-500"}>{r.privacy_agree ? "동의" : "미동의"}</span>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="mt-3 flex justify-end gap-2">
                {tab === "pending" && (
                  <>
                    <button type="button" onClick={() => reject(r)} disabled={busyId === r.id}
                      className="rounded-lg border border-red-200 px-4 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-60">
                      거절
                    </button>
                    <button type="button" onClick={() => approve(r)} disabled={busyId === r.id}
                      className="rounded-lg bg-seum-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2a63c4] disabled:opacity-60">
                      {busyId === r.id ? "처리 중..." : "승인"}
                    </button>
                  </>
                )}
                {tab === "approved" && (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">승인됨</span>
                )}
                {tab === "rejected" && (
                  <button type="button" onClick={() => restore(r)} disabled={busyId === r.id}
                    className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                    다시 대기로
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}