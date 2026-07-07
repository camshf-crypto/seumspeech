import { useEffect, useState } from "react";
import { CONSULT, LINKS } from "../config";
import { supabase } from "../lib/supabase";

export default function Consult() {
  const [form, setForm] = useState({ course: "", branch: "", name: "", tel: "", content: "", method: "전화상담", agree: false });
  const [branches, setBranches] = useState([]);
  const [sending, setSending] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("branches").select("id, name").order("sort_order");
      setBranches(data ?? []);
    })();
  }, []);

  const submit = async () => {
    if (!form.name || !form.tel) return alert("이름과 연락처를 입력해 주세요.");
    if (!form.branch) return alert("희망 지점을 선택해 주세요.");
    if (!form.agree) return alert("개인정보 수집·이용에 동의해 주세요.");

    setSending(true);
    const { error } = await supabase.from("inquiries").insert({
      kind: "consult",
      branch_id: form.branch || null,
      name: form.name,
      phone: form.tel,
      channel: "web",
      message:
        `[관심과정: ${form.course || "미선택"}]\n` +
        `[희망 상담방식: ${form.method}]` +
        (form.content ? `\n${form.content}` : ""),
    });
    setSending(false);

    if (error) {
      console.error("inquiries insert error:", error);
      return alert("접수 중 오류가 발생했습니다.\n" + (error.message || ""));
    }

    alert("상담 신청이 접수되었습니다.\n빠른 시일 내에 연락드리겠습니다. 감사합니다!");
    setForm({ course: "", branch: "", name: "", tel: "", content: "", method: "전화상담", agree: false });
  };

  const kakao = () => CONSULT.kakao && (window.location.href = CONSULT.kakao);
  const tel = () => (window.location.href = `tel:${LINKS.tel}`);
  const mail = () => (window.location.href = `mailto:${CONSULT.email}`);

  const inputCls = "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-seum-blue";

  return (
    <div className="bg-white pt-16">
      <div className="border-b border-slate-100 bg-slate-50 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">COMMUNITY</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-800">상담 신청</h1>
        <p className="mt-3 text-slate-500">궁금한 점을 남겨주시면 전문 상담사가 친절하게 안내해 드립니다.</p>
      </div>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-3xl border border-slate-100 p-8 shadow-sm md:p-10">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">관심 과정</label>
                <select value={form.course} onChange={(e) => set("course", e.target.value)} className={inputCls}>
                  <option value="">과정을 선택해 주세요</option>
                  {CONSULT.courses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  희망 지점 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => set("branch", b.id)}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        form.branch === b.id ? "border-seum-blue bg-seum-blue/5 text-seum-blue" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="성함을 입력해 주세요" className={inputCls} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input value={form.tel} onChange={(e) => set("tel", e.target.value)} placeholder="010-0000-0000" className={inputCls} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">상담 내용</label>
                <textarea value={form.content} onChange={(e) => set("content", e.target.value)} rows={4} placeholder="문의하실 내용을 자유롭게 작성해 주세요" className={`${inputCls} resize-none`} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">상담 수신 방법</label>
                <div className="flex gap-3">
                  {["전화상담", "방문상담"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set("method", m)}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        form.method === m ? "border-seum-blue bg-seum-blue/5 text-seum-blue" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2 pt-2">
                <input type="checkbox" checked={form.agree} onChange={(e) => set("agree", e.target.checked)} className="mt-1 h-4 w-4 accent-seum-blue" />
                <span className="text-sm text-slate-500">
                  개인정보 수집 및 이용에 동의합니다. <span className="text-red-500">(필수)</span>
                  <br />
                  <span className="text-xs text-slate-400">수집 항목: 이름, 연락처 · 이용 목적: 상담 안내 · 보유 기간: 상담 완료 후 파기</span>
                </span>
              </label>

              <button onClick={submit} disabled={sending} className="w-full rounded-xl bg-seum-navy py-4 text-base font-bold text-white transition hover:bg-[#16234e] disabled:opacity-60">
                {sending ? "접수 중..." : "상담 신청하기"}
              </button>
            </div>
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-slate-800">쉽고 빠른 상담안내</h2>
            <p className="mt-2 text-slate-500">편하신 상담 유형을 선택하세요.</p>

            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <button onClick={kakao} className="rounded-2xl border border-slate-100 p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">💬</div>
                <h3 className="mb-1 font-bold text-slate-800">카카오톡 상담</h3>
                <p className="text-xs text-slate-500">부담 없는 실시간 대화 상담</p>
              </button>

              <button onClick={mail} className="rounded-2xl border border-slate-100 p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl">✉️</div>
                <h3 className="mb-1 font-bold text-slate-800">온라인 상담</h3>
                <p className="text-xs text-slate-500">구체적인 내용의 온라인 상담</p>
              </button>

              <button onClick={tel} className="rounded-2xl border border-slate-100 p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">📞</div>
                <h3 className="mb-1 font-bold text-slate-800">전화 상담</h3>
                <p className="text-xs font-bold text-seum-blue">{LINKS.tel}</p>
              </button>
            </div>
            <p className="mt-6 text-xs text-slate-400">모바일에서 번호를 누르시면 바로 연결됩니다.</p>
          </div>
        </div>
      </section>
    </div>
  );
}