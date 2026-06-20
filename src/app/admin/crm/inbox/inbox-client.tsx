"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ---------- Jenis ----------
interface Contact {
  id: string;
  wa_id: string;
  phone: string | null;
  name: string | null;
  tags: string[] | null;
  profile_id: string | null;
  profiles?: { full_name: string | null; total_spend: number | null } | null;
}
interface Conversation {
  id: string;
  contact_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  window_expires_at: string | null;
  status: string;
  assigned_to: string | null;
  phone_number_id: string | null;
  wa_contacts: Contact | null;
}
interface Message {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  type: string;
  body: string | null;
  media_url: string | null;
  template_name: string | null;
  status: string;
  created_at: string;
}
interface Template {
  name: string;
  language: string;
  category: string;
  components: Array<{ type: string; text?: string }>;
}

const fmtTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("ms-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// Beep notifikasi (Web Audio — tiada fail perlu)
function playNotif() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.36);
  } catch {
    /* abaikan */
  }
}

export function InboxClient() {
  const supabase = createClient();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTpl, setShowTpl] = useState(false);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [tplParams, setTplParams] = useState<Record<string, string>>({});
  const [admins, setAdmins] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState("");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [numberFilter, setNumberFilter] = useState("");
  const [myOnly, setMyOnly] = useState(false);
  const [waNumbers, setWaNumbers] = useState<{ phone_number_id: string; display_name: string }[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMsg, setPayMsg] = useState("");
  const [snippets, setSnippets] = useState<{ id: string; label: string; body: string }[]>([]);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inWindow = selected?.window_expires_at ? new Date(selected.window_expires_at) > new Date() : false;

  const loadConvos = useCallback(async () => {
    const { data } = await supabase
      .from("wa_conversations")
      .select(
        "id, contact_id, last_message_at, last_message_preview, unread_count, window_expires_at, status, assigned_to, phone_number_id, wa_contacts(id, wa_id, phone, name, tags, profile_id, profiles(full_name, total_spend))",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    setConvos((data as unknown as Conversation[]) ?? []);
  }, [supabase]);

  const loadMessages = useCallback(
    async (convId: string) => {
      const { data } = await supabase
        .from("wa_messages")
        .select("id, conversation_id, direction, type, body, media_url, template_name, status, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(500);
      setMessages((data as unknown as Message[]) ?? []);
    },
    [supabase],
  );

  // Senarai admin (untuk papar nama assignee) + nombor WA + user semasa (filter)
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_admin", true)
      .then(({ data }: { data: { id: string; full_name: string | null }[] | null }) => {
        const m: Record<string, string> = {};
        (data ?? []).forEach((p) => (m[p.id] = p.full_name || "Admin"));
        setAdmins(m);
      });
    supabase
      .from("wa_numbers")
      .select("phone_number_id, display_name")
      .eq("is_active", true)
      .order("created_at")
      .then(({ data }: { data: { phone_number_id: string; display_name: string }[] | null }) => setWaNumbers(data ?? []));
    (supabase.auth.getUser() as Promise<{ data: { user: { id: string } | null } }>).then(({ data }) => setMyId(data.user?.id ?? null));
  }, [supabase]);

  // Senarai tag terurus (crm_tags)
  useEffect(() => {
    supabase
      .from("crm_tags")
      .select("name")
      .order("name")
      .then(({ data }: { data: { name: string }[] | null }) => setAllTags((data ?? []).map((t) => t.name)));
  }, [supabase]);

  // Snippet (canned message)
  useEffect(() => {
    supabase
      .from("crm_snippets")
      .select("id, label, body")
      .order("sort")
      .then(({ data }: { data: { id: string; label: string; body: string }[] | null }) => setSnippets(data ?? []));
  }, [supabase]);

  // Muat awal + realtime (bunyi bila mesej masuk)
  useEffect(() => {
    loadConvos();
    const ch = supabase
      .channel("wa-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_messages" }, (p: { new: Message }) => {
        const row = p.new as Message;
        if (row?.direction === "in") {
          playNotif();
          document.title = "🔔 Mesej baru — Inbox";
        }
        loadConvos();
        if (selected && row?.conversation_id === selected.id) loadMessages(selected.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wa_messages" }, (p: { new: Message }) => {
        const row = p.new as Message;
        if (selected && row?.conversation_id === selected.id) loadMessages(selected.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversations" }, () => loadConvos())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    threadRef.current?.scrollTo(0, threadRef.current.scrollHeight);
  }, [messages]);

  async function openConvo(c: Conversation) {
    setSelected(c);
    setErr("");
    setShowTpl(false);
    setTpl(null);
    setPayAmount("");
    setPayMsg("");
    setShowPanel(false);
    document.title = "Inbox WhatsApp";
    await loadMessages(c.id);
    if (c.unread_count > 0) {
      await supabase.from("wa_conversations").update({ unread_count: 0 }).eq("id", c.id);
      loadConvos();
    }
  }

  async function loadTemplates() {
    const res = await fetch("/api/whatsapp/templates");
    const j = await res.json();
    if (j.templates) setTemplates(j.templates);
  }

  function pickTemplate(t: Template) {
    setTpl(t);
    const bodyText = t.components.find((c) => c.type === "BODY")?.text ?? "";
    const names = Array.from(bodyText.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map((m) => m[1]);
    const obj: Record<string, string> = {};
    names.forEach((n) => (obj[n] = ""));
    setTplParams(obj);
  }

  async function postSend(payload: Record<string, unknown>) {
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error || "Hantar gagal.");
      return false;
    }
    if (selected) {
      loadMessages(selected.id);
      loadConvos();
    }
    return true;
  }

  async function send() {
    if (!selected) return;
    setSending(true);
    setErr("");
    const payload: Record<string, unknown> = { conversationId: selected.id };
    if (tpl) {
      payload.templateName = tpl.name;
      payload.templateLang = tpl.language;
      payload.templateParams = tplParams;
    } else {
      if (!reply.trim()) {
        setSending(false);
        return;
      }
      payload.text = reply.trim();
    }
    const ok = await postSend(payload);
    setSending(false);
    if (ok) {
      setReply("");
      setTpl(null);
      setShowTpl(false);
    }
  }

  async function sendImage(file: File) {
    if (!selected) return;
    setUploading(true);
    setErr("");
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch("/api/whatsapp/upload", { method: "POST", body: fd });
    const uj = await up.json();
    if (!up.ok || !uj.url) {
      setUploading(false);
      setErr(uj.error || "Upload gagal.");
      return;
    }
    await postSend({ conversationId: selected.id, imageUrl: uj.url, caption: reply.trim() || undefined });
    setUploading(false);
    setReply("");
  }

  async function updateTags(newTags: string[]) {
    if (!selected?.wa_contacts) return;
    await supabase.from("wa_contacts").update({ tags: newTags }).eq("id", selected.wa_contacts.id);
    setSelected((s) => (s && s.wa_contacts ? { ...s, wa_contacts: { ...s.wa_contacts, tags: newTags } } : s));
    loadConvos();
  }
  async function addTag(fromChip?: string) {
    const t = (fromChip ?? tagInput).trim();
    if (!t || !selected?.wa_contacts) return;
    const cur = selected.wa_contacts.tags ?? [];
    if (!cur.includes(t)) updateTags([...cur, t]);
    setTagInput("");
    // Simpan ke senarai tetap (boleh guna semula) kalau baru
    if (!allTags.includes(t)) {
      await supabase.from("crm_tags").upsert({ name: t }, { onConflict: "name" });
      setAllTags((a) => [...a, t]);
    }
  }
  function removeTag(t: string) {
    const cur = selected?.wa_contacts?.tags ?? [];
    updateTags(cur.filter((x) => x !== t));
  }

  async function sendPaymentLink() {
    if (!selected?.wa_contacts || !payAmount || Number(payAmount) <= 0) {
      setPayMsg("Masukkan jumlah (RM).");
      return;
    }
    setPayMsg("Menghantar link…");
    const res = await fetch("/api/whatsapp/payment-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: selected.wa_contacts.id, amount: Number(payAmount), description: "Pembayaran SyababFresh" }),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      setPayMsg("✅ Link bayar dihantar ke WhatsApp!");
      setPayAmount("");
      loadMessages(selected.id);
    } else {
      setPayMsg("❌ " + (j.error || "Gagal hantar."));
    }
  }

  async function saveSnippet() {
    const body = reply.trim();
    setShowSnippets(false);
    if (!body) return;
    const label = window.prompt("Nama snippet:");
    if (!label?.trim()) return;
    const { data } = await supabase.from("crm_snippets").insert({ label: label.trim(), body }).select("id, label, body").single();
    if (data) setSnippets((s) => [...s, data as { id: string; label: string; body: string }]);
  }

  const contact = selected?.wa_contacts;
  const displayName = (c: Conversation | null) =>
    c?.wa_contacts?.name || c?.wa_contacts?.profiles?.full_name || c?.wa_contacts?.phone || c?.wa_contacts?.wa_id || "?";

  const unreadTotal = convos.filter((c) => c.unread_count > 0).length;
  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const shownConvos = convos.filter((c) => {
    if (filterTag && !c.wa_contacts?.tags?.includes(filterTag)) return false;
    if (unreadOnly && !(c.unread_count > 0)) return false;
    if (numberFilter && c.phone_number_id !== numberFilter) return false;
    if (myOnly && c.assigned_to !== myId) return false;
    if (q) {
      const name = displayName(c).toLowerCase();
      const phone = (c.wa_contacts?.phone || c.wa_contacts?.wa_id || "");
      const matchName = name.includes(q);
      const matchPhone = qDigits.length >= 3 && phone.includes(qDigits);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-gray-100">
      {/* Senarai perbualan */}
      <aside className={`w-full lg:w-80 shrink-0 border-r bg-white overflow-y-auto ${selected ? "hidden lg:block" : "block"}`}>
        <div className="p-3 border-b font-semibold text-gray-800 flex items-center justify-between">
          <span>Inbox WhatsApp</span>
          <a href="/admin/crm/numbers" className="text-xs font-normal text-gray-400 hover:text-gray-700" title="Urus nombor WhatsApp">⚙️ Nombor</a>
        </div>
        {/* Bar filter — search + label dropdown + unread */}
        <div className="px-2 py-2 border-b bg-gray-50 space-y-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau no. telefon"
            className="w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <div className="flex gap-1.5">
            {allTags.length > 0 && (
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="flex-1 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-gray-200 bg-white text-gray-700"
              >
                <option value="">Semua label</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`text-xs font-semibold rounded-lg px-3 py-1.5 border whitespace-nowrap ${unreadOnly ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-200"}`}
            >
              Belum baca{unreadTotal > 0 ? ` (${unreadTotal})` : ""}
            </button>
          </div>
          {(waNumbers.length > 1 || myId) && (
            <div className="flex gap-1.5">
              {waNumbers.length > 1 && (
                <select
                  value={numberFilter}
                  onChange={(e) => setNumberFilter(e.target.value)}
                  className="flex-1 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-gray-200 bg-white text-gray-700"
                >
                  <option value="">Semua nombor</option>
                  {waNumbers.map((n) => (
                    <option key={n.phone_number_id} value={n.phone_number_id}>{n.display_name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setMyOnly((v) => !v)}
                className={`text-xs font-semibold rounded-lg px-3 py-1.5 border whitespace-nowrap ${myOnly ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-200"}`}
              >
                Sembang Saya
              </button>
            </div>
          )}
        </div>
        {shownConvos.length === 0 && (
          <div className="p-4 text-sm text-gray-400">{filterTag || search || unreadOnly ? "Tiada perbualan sepadan." : "Tiada perbualan lagi."}</div>
        )}
        {shownConvos.map((c) => (
          <button
            key={c.id}
            onClick={() => openConvo(c)}
            className={`w-full text-left px-3 py-2.5 border-b hover:bg-gray-50 ${selected?.id === c.id ? "bg-emerald-50" : ""}`}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm text-gray-800 truncate">{displayName(c)}</span>
              <span className="text-[10px] text-gray-400">{fmtTime(c.last_message_at)}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-gray-500 truncate">{c.last_message_preview}</span>
              {c.unread_count > 0 && (
                <span className="shrink-0 bg-emerald-500 text-white text-[10px] rounded-full px-1.5">{c.unread_count}</span>
              )}
            </div>
            {c.assigned_to && (
              <div className="text-[10px] text-blue-500 mt-0.5">👤 {admins[c.assigned_to] || "Admin"}</div>
            )}
            {c.wa_contacts?.tags && c.wa_contacts.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {c.wa_contacts.tags.map((t) => (
                  <span key={t} className="text-[9px] bg-emerald-50 text-emerald-600 rounded px-1">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </aside>

      {/* Thread */}
      <main className={`flex-1 flex-col min-w-0 ${selected ? "flex" : "hidden lg:flex"}`}>
        {!selected ? (
          <div className="flex-1 grid place-items-center text-gray-400 text-sm">Pilih satu perbualan.</div>
        ) : (
          <>
            <div className="px-3 py-3 border-b bg-white flex items-center gap-2">
              <button onClick={() => setSelected(null)} className="lg:hidden text-gray-500 text-xl shrink-0 px-1" aria-label="Kembali">
                ←
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 truncate">{displayName(selected)}</div>
                <div className="text-xs text-gray-400 truncate">{contact?.wa_id}</div>
              </div>
              {selected.assigned_to && (
                <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-1 hidden sm:inline">
                  👤 {admins[selected.assigned_to] || "Admin"}
                </span>
              )}
              <button onClick={() => setShowPanel(true)} className="lg:hidden text-lg shrink-0 px-1" aria-label="Maklumat customer">
                ℹ️
              </button>
            </div>

            <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.direction === "out" ? "bg-emerald-500 text-white" : "bg-white border text-gray-800"
                    }`}
                  >
                    {m.media_url && m.type === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.media_url} alt="gambar" className="rounded-md max-w-full mb-1" />
                    )}
                    {m.type !== "text" && m.type !== "image" && !m.body && <span className="italic opacity-70">[{m.type}]</span>}
                    {m.template_name && <span className="italic opacity-70">[template: {m.template_name}]</span>}
                    {m.body}
                    <div className={`text-[10px] mt-1 ${m.direction === "out" ? "text-emerald-100" : "text-gray-400"}`}>
                      {fmtTime(m.created_at)} {m.direction === "out" && `· ${m.status}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Kotak balas */}
            <div className="border-t bg-white p-3">
              {err && <div className="text-xs text-red-500 mb-2">{err}</div>}
              {inWindow ? (
                <div className="space-y-2">
                  {/* Snippet (canned message) */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSnippets((s) => !s)}
                      className="text-xs bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1"
                    >
                      📋 Snippet
                    </button>
                    {showSnippets && (
                      <div className="absolute bottom-full mb-1 left-0 bg-white border rounded-lg shadow-lg w-64 z-20 max-h-60 overflow-y-auto">
                        {snippets.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setReply(s.body);
                              setShowSnippets(false);
                            }}
                            className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b"
                          >
                            <div className="font-medium text-gray-700">{s.label}</div>
                            <div className="text-gray-400 truncate">{s.body}</div>
                          </button>
                        ))}
                        <button
                          onClick={saveSnippet}
                          className="block w-full text-left px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50"
                        >
                          + Simpan balasan ini jadi snippet
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-end">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) sendImage(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    title="Hantar gambar"
                    className="shrink-0 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 text-lg disabled:opacity-50"
                  >
                    {uploading ? "⏳" : "🖼️"}
                  </button>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    placeholder="Taip balasan… (atau caption gambar)"
                    className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !reply.trim()}
                    className="shrink-0 bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {sending ? "…" : "Hantar"}
                  </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-amber-600">⏳ Luar tetingkap 24 jam — wajib guna template diluluskan.</div>
                  {!showTpl ? (
                    <button
                      onClick={() => {
                        setShowTpl(true);
                        loadTemplates();
                      }}
                      className="text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2"
                    >
                      Pilih template
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <select
                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                        value={tpl?.name ?? ""}
                        onChange={(e) => {
                          const t = templates.find((x) => x.name === e.target.value);
                          if (t) pickTemplate(t);
                        }}
                      >
                        <option value="">— pilih template —</option>
                        {templates.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name} ({t.category})
                          </option>
                        ))}
                      </select>
                      {tpl &&
                        Object.keys(tplParams).map((k) => (
                          <input
                            key={k}
                            placeholder={k}
                            value={tplParams[k]}
                            onChange={(e) => setTplParams((p) => ({ ...p, [k]: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                          />
                        ))}
                      {tpl && (
                        <button
                          onClick={send}
                          disabled={sending}
                          className="bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                          {sending ? "Menghantar…" : "Hantar template"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Panel Customer 360 */}
      {selected && (
        <aside
          className={`bg-white p-4 overflow-y-auto ${showPanel ? "fixed inset-0 z-50 w-full" : "hidden lg:block"} lg:static lg:w-72 lg:shrink-0 lg:border-l`}
        >
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-semibold text-gray-800">Maklumat Customer</div>
            <button onClick={() => setShowPanel(false)} className="lg:hidden text-gray-400 text-lg">
              ✕
            </button>
          </div>
          <dl className="text-xs space-y-2 text-gray-600">
            <div>
              <dt className="text-gray-400">Nama</dt>
              <dd>{displayName(selected)}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Nombor</dt>
              <dd>{contact?.phone || contact?.wa_id}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Customer berdaftar</dt>
              <dd>{contact?.profile_id ? "Ya" : "Tidak"}</dd>
            </div>
            {contact?.profiles?.total_spend != null && (
              <div>
                <dt className="text-gray-400">Jumlah belanja</dt>
                <dd>RM {Number(contact.profiles.total_spend).toFixed(2)}</dd>
              </div>
            )}
          </dl>

          {/* Tindakan: buat order + pay link (macam pipeline) */}
          <div className="mt-4 space-y-2 border-t pt-3">
            <a
              href={`/admin/crm/order?contact=${contact?.id}`}
              className="block text-center text-sm bg-emerald-500 text-white rounded-lg py-2 font-medium"
            >
              🛒 Buat Order + Pay Link
            </a>
            <div>
              <label className="text-[11px] text-gray-400">Atau hantar link bayar je (RM)</label>
              <div className="flex gap-1 mt-1">
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Jumlah"
                  className="flex-1 border rounded px-2 py-1.5 text-sm"
                />
                <button onClick={sendPaymentLink} className="bg-blue-600 text-white rounded px-3 text-sm">
                  Hantar
                </button>
              </div>
              {payMsg && <div className="text-[11px] mt-1 text-gray-600">{payMsg}</div>}
            </div>
          </div>

          {/* Tags */}
          <div className="mt-4">
            <div className="text-xs text-gray-400 mb-1">Tag</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {(contact?.tags ?? []).map((t) => (
                <span key={t} className="bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5 text-xs flex items-center gap-1">
                  {t}
                  <button onClick={() => removeTag(t)} className="text-emerald-400 hover:text-red-500">
                    ✕
                  </button>
                </span>
              ))}
              {(contact?.tags ?? []).length === 0 && <span className="text-xs text-gray-300">Tiada tag</span>}
            </div>
            {allTags.filter((t) => !(contact?.tags ?? []).includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {allTags
                  .filter((t) => !(contact?.tags ?? []).includes(t))
                  .map((t) => (
                    <button
                      key={t}
                      onClick={() => addTag(t)}
                      className="text-xs bg-gray-100 hover:bg-emerald-100 text-gray-500 rounded px-1.5 py-0.5"
                    >
                      + {t}
                    </button>
                  ))}
              </div>
            )}
            <div className="flex gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                placeholder="tambah tag baru…"
                className="flex-1 border rounded px-2 py-1 text-xs"
              />
              <button onClick={() => addTag()} className="bg-gray-100 hover:bg-gray-200 rounded px-2 text-xs">
                +
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
