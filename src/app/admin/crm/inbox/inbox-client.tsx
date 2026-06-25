"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Reply, Tag, Smartphone, Clock, User, Search, FileText, Paperclip, Send, Loader2, X, Bot } from "lucide-react";

// ---------- Jenis ----------
interface Contact {
  id: string;
  wa_id: string;
  phone: string | null;
  name: string | null;
  tags: string[] | null;
  profile_id: string | null;
  notes: string | null;
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
  needs_reply: boolean;
  ai_enabled: boolean;
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
  status?: string;
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
  const [aiBusy, setAiBusy] = useState(false);
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
  const [needReplyOnly, setNeedReplyOnly] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [numberFilter, setNumberFilter] = useState("");
  const [myOnly, setMyOnly] = useState(false);
  const [waNumbers, setWaNumbers] = useState<{ phone_number_id: string; display_name: string }[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMsg, setPayMsg] = useState("");
  const [snippets, setSnippets] = useState<{ id: string; label: string; body: string }[]>([]);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  // Follow-up reminder (nudge dalaman)
  const [followups, setFollowups] = useState<{ id: string; contact_id: string; remind_at: string; note: string | null; status: string }[]>([]);
  const [fuOnly, setFuOnly] = useState(false);
  const [fuNote, setFuNote] = useState("");
  const [fuWhen, setFuWhen] = useState("");
  // Sejarah pembelian (match ikut nombor)
  const [purchase, setPurchase] = useState<{ count: number; total: number; lastAt: string | null } | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inWindow = selected?.window_expires_at ? new Date(selected.window_expires_at) > new Date() : false;

  const loadConvos = useCallback(async () => {
    const { data } = await supabase
      .from("wa_conversations")
      .select(
        "id, contact_id, last_message_at, last_message_preview, unread_count, window_expires_at, status, assigned_to, phone_number_id, needs_reply, ai_enabled, wa_contacts(id, wa_id, phone, name, tags, notes, profile_id, profiles(full_name, total_spend))",
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

  // Follow-up reminders (nudge dalaman) — muat + set + selesai
  const loadFollowups = useCallback(async () => {
    const res = await fetch("/api/whatsapp/followups");
    const j = await res.json().catch(() => ({}));
    setFollowups(j.followups ?? []);
  }, []);
  useEffect(() => { loadFollowups(); }, [loadFollowups]);

  // Semak sejarah beli bila buka chat (match ikut nombor).
  const selWaId = selected?.wa_contacts?.wa_id ?? null;
  useEffect(() => {
    if (!selWaId) { setPurchase(null); return; }
    let cancelled = false;
    setPurchase(null);
    fetch(`/api/whatsapp/contacts/purchases?waId=${encodeURIComponent(selWaId)}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setPurchase(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selWaId]);

  // Internal notes — muat draf bila tukar conversation
  useEffect(() => { setNoteDraft(selected?.wa_contacts?.notes ?? ""); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function saveNote() {
    if (!selected?.wa_contacts) return;
    setNoteSaving(true);
    const v = noteDraft.trim() || null;
    const cid = selected.wa_contacts.id;
    await supabase.from("wa_contacts").update({ notes: v }).eq("id", cid);
    setSelected((s) => (s && s.wa_contacts ? { ...s, wa_contacts: { ...s.wa_contacts, notes: v } } : s));
    setConvos((cs) => cs.map((c) => (c.wa_contacts?.id === cid ? { ...c, wa_contacts: { ...c.wa_contacts!, notes: v } } : c)));
    setNoteSaving(false);
  }

  // AI auto-reply toggle per-customer (perlu suis induk ON juga untuk benar-benar balas).
  async function toggleAi() {
    if (!selected) return;
    const next = !selected.ai_enabled;
    setAiBusy(true);
    const { error } = await supabase.from("wa_conversations").update({ ai_enabled: next }).eq("id", selected.id);
    setAiBusy(false);
    if (error) return;
    setSelected((s) => (s ? { ...s, ai_enabled: next } : s));
    setConvos((cs) => cs.map((c) => (c.id === selected.id ? { ...c, ai_enabled: next } : c)));
  }

  async function setFollowup(remindAt: string) {
    if (!selected?.wa_contacts) return;
    const res = await fetch("/api/whatsapp/followups", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: selected.wa_contacts.id, conversationId: selected.id, remindAt, note: fuNote.trim() || null }),
    });
    if (res.ok) { setFuNote(""); setFuWhen(""); loadFollowups(); }
  }
  async function doneFollowup(id: string) {
    await fetch("/api/whatsapp/followups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "done" }) });
    loadFollowups();
  }
  function quickWhen(kind: "tomorrow" | "3days" | "week"): string {
    const d = new Date();
    d.setDate(d.getDate() + (kind === "tomorrow" ? 1 : kind === "3days" ? 3 : 7));
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

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
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      // Realtime postgres_changes hormati RLS — socket WAJIB bawa JWT admin
      // (bukan anon), jika tidak policy is_admin() block semua event → mesej
      // baru tak muncul tanpa refresh. Set token sesi pada socket dulu.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;
      ch = supabase
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
    })();
    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
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
    // Template per-WABA: senarai template WABA nombor yang customer hubungi
    // (hantar balas guna nombor sama, jadi template mesti dari WABA itu).
    const pid = selected?.phone_number_id;
    const url = pid ? `/api/whatsapp/templates?phoneId=${encodeURIComponent(pid)}` : "/api/whatsapp/templates";
    const res = await fetch(url);
    const j = await res.json();
    setTemplates(j.templates ?? []);
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
  const fuForContact = (cid?: string | null) => (cid ? followups.find((f) => f.contact_id === cid && f.status === "pending") : undefined);
  const displayName = (c: Conversation | null) =>
    c?.wa_contacts?.name || c?.wa_contacts?.profiles?.full_name || c?.wa_contacts?.phone || c?.wa_contacts?.wa_id || "?";

  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");

  // Konteks = filter SKOP (label, nombor, Saya, search). Badge count + senarai ikut konteks ni
  // → tukar ke nombor #2, count "Perlu balas" jadi 0 (chat #2), bukan kekal global #1.
  const inContext = (c: Conversation) => {
    if (filterTag && !c.wa_contacts?.tags?.includes(filterTag)) return false;
    if (numberFilter && c.phone_number_id !== numberFilter) return false;
    if (myOnly && c.assigned_to !== myId) return false;
    if (q) {
      const name = displayName(c).toLowerCase();
      const phone = c.wa_contacts?.phone || c.wa_contacts?.wa_id || "";
      if (!name.includes(q) && !(qDigits.length >= 3 && phone.includes(qDigits))) return false;
    }
    return true;
  };
  const contextConvos = convos.filter(inContext);
  const needReplyTotal = contextConvos.filter((c) => c.needs_reply).length;
  const dueCount = contextConvos.filter((c) => followups.some((f) => f.status === "pending" && f.contact_id === c.contact_id && new Date(f.remind_at) <= new Date())).length;
  const shownConvos = contextConvos.filter((c) => {
    if (needReplyOnly && !c.needs_reply) return false;
    if (fuOnly && !followups.some((f) => f.status === "pending" && f.contact_id === c.contact_id)) return false;
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
        {/* Bar filter — Perlu balas (utama) + dropdown sebaris + search */}
        <div className="px-2.5 py-2 border-b bg-gray-50 space-y-2">
          {/* Perlu balas — pill utama (ikon plain) */}
          <button
            onClick={() => setNeedReplyOnly((v) => !v)}
            className={`w-full flex items-center justify-center gap-1.5 text-xs rounded-lg px-3 py-2 border transition-colors ${needReplyOnly ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"}`}
          >
            <Reply className="h-3.5 w-3.5" /> Perlu balas
            {needReplyTotal > 0 && (
              <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${needReplyOnly ? "bg-white/25 text-white" : "bg-red-500 text-white"}`}>{needReplyTotal}</span>
            )}
          </button>

          {/* Dropdown label */}
          {allTags.length > 0 && (
            <div className="relative">
              <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="w-full text-xs rounded-lg pl-8 pr-2.5 py-2 border border-gray-200 bg-white text-gray-700"
              >
                <option value="">Semua label</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {/* Dropdown nombor */}
          {waNumbers.length > 1 && (
            <div className="relative">
              <Smartphone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <select
                value={numberFilter}
                onChange={(e) => setNumberFilter(e.target.value)}
                className="w-full text-xs rounded-lg pl-8 pr-2.5 py-2 border border-gray-200 bg-white text-gray-700"
              >
                <option value="">Semua nombor</option>
                {waNumbers.map((n) => (
                  <option key={n.phone_number_id} value={n.phone_number_id}>{n.display_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau no. telefon"
              className="w-full text-xs rounded-lg pl-8 pr-2.5 py-2 border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          {/* Toggle sekunder: Follow-up + Saya */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setFuOnly((v) => !v)}
              title="Follow-up due"
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs rounded-lg px-2 py-1.5 border transition-colors ${fuOnly ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"}`}
            >
              <Clock className="h-3.5 w-3.5" /> Follow-up{dueCount > 0 ? ` ${dueCount}` : ""}
            </button>
            {myId && (
              <button
                onClick={() => setMyOnly((v) => !v)}
                title="Chat assigned ke saya"
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs rounded-lg px-2 py-1.5 border transition-colors ${myOnly ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"}`}
              >
                <User className="h-3.5 w-3.5" /> Saya
              </button>
            )}
          </div>
        </div>
        {shownConvos.length === 0 && (
          <div className="p-4 text-sm text-gray-400">{filterTag || search || needReplyOnly || fuOnly || myOnly || numberFilter ? "Tiada perbualan sepadan." : "Tiada perbualan lagi."}</div>
        )}
        {shownConvos.map((c) => {
          const nm = displayName(c);
          const initial = (nm.trim()[0] || "?").toUpperCase();
          const numName = c.phone_number_id ? waNumbers.find((n) => n.phone_number_id === c.phone_number_id)?.display_name : null;
          return (
            <button
              key={c.id}
              onClick={() => openConvo(c)}
              className={`w-full text-left px-3 py-2.5 border-b hover:bg-gray-50 flex gap-2.5 ${selected?.id === c.id ? "bg-emerald-50" : ""}`}
            >
              {/* Avatar */}
              <div className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-sm font-semibold bg-emerald-100 text-emerald-600">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-sm text-gray-800 truncate">{nm}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{fmtTime(c.last_message_at)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs text-gray-500 truncate">{c.last_message_preview}</span>
                  {c.unread_count > 0 && (
                    <span className="shrink-0 bg-emerald-500 text-white text-[10px] rounded-full px-1.5">{c.unread_count}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {c.needs_reply && <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-red-50 text-red-600 rounded-full px-1.5 py-0.5"><Reply className="h-2.5 w-2.5" /> Perlu balas</span>}
                  {numName && <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-400 bg-gray-50 rounded px-1 py-0.5"><Smartphone className="h-2.5 w-2.5" /> {numName}</span>}
                  {c.assigned_to && <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-400"><User className="h-2.5 w-2.5" /> {admins[c.assigned_to] || "Admin"}</span>}
                  {(c.wa_contacts?.tags ?? []).map((t) => (
                    <span key={t} className="text-[9px] bg-emerald-50 text-emerald-600 rounded px-1">{t}</span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
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
              <button
                onClick={toggleAi}
                disabled={aiBusy}
                title="AI auto-reply untuk customer ini (perlu suis induk AI Chatbot ON)"
                className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border shrink-0 disabled:opacity-50 ${selected.ai_enabled ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-300"}`}
              >
                {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{selected.ai_enabled ? "AI on" : "AI off"}</span>
              </button>
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
              {showTpl ? (
                /* Picker template approved — boleh dalam ATAU luar tetingkap 24j */
                <div className="space-y-2">
                  {!inWindow && (
                    <div className="text-xs text-amber-600 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Luar tetingkap 24 jam — wajib template diluluskan.
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Template approved</span>
                    <button onClick={() => { setShowTpl(false); setTpl(null); }} className="text-gray-400 hover:text-gray-700" title="Tutup">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    value={tpl?.name ?? ""}
                    onChange={(e) => {
                      const t = templates.find((x) => x.name === e.target.value);
                      if (t) pickTemplate(t);
                    }}
                  >
                    <option value="">— pilih template —</option>
                    {templates.filter((t) => !t.status || t.status === "APPROVED").map((t) => (
                      <option key={t.name} value={t.name}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                  {tpl &&
                    Object.keys(tplParams).map((k) => (
                      <input
                        key={k}
                        placeholder={k}
                        value={tplParams[k]}
                        onChange={(e) => setTplParams((p) => ({ ...p, [k]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      />
                    ))}
                  {tpl && (
                    <button
                      onClick={send}
                      disabled={sending}
                      className="flex items-center gap-1.5 bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" /> {sending ? "Menghantar…" : "Hantar template"}
                    </button>
                  )}
                </div>
              ) : inWindow ? (
                <div className="relative">
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
                  {/* Kotak mesej tinggi + toolbar bawah (gaya Murpati) */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-emerald-400">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      rows={3}
                      placeholder="Taip balasan…  (⌘/Ctrl + Enter hantar)"
                      className="w-full resize-none px-3 py-2.5 text-sm focus:outline-none"
                    />
                    <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          title="Hantar gambar"
                          className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-200 rounded-lg px-2 py-1 disabled:opacity-50"
                        >
                          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Attach
                        </button>
                        <button
                          onClick={() => { setShowTpl(true); loadTemplates(); }}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-200 rounded-lg px-2 py-1"
                        >
                          <FileText className="h-3.5 w-3.5" /> Template
                        </button>
                        <button
                          onClick={() => setShowSnippets((s) => !s)}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-200 rounded-lg px-2 py-1"
                        >
                          <FileText className="h-3.5 w-3.5" /> Snippet
                        </button>
                      </div>
                      <button
                        onClick={send}
                        disabled={sending || !reply.trim()}
                        className="flex items-center gap-1.5 bg-emerald-500 text-white rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                      >
                        {sending ? "…" : <><Send className="h-3.5 w-3.5" /> Hantar</>}
                      </button>
                    </div>
                  </div>
                  {/* Snippet dropdown — di LUAR kotak overflow-hidden (elak terpotong atas) */}
                  {showSnippets && (
                    <div className="absolute left-2 bottom-12 bg-white border rounded-lg shadow-lg w-64 z-30 max-h-56 overflow-y-auto">
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
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-amber-600 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Luar tetingkap 24 jam — wajib guna template diluluskan.
                  </div>
                  <button
                    onClick={() => { setShowTpl(true); loadTemplates(); }}
                    className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2"
                  >
                    <FileText className="h-3.5 w-3.5" /> Pilih template
                  </button>
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
          </dl>

          {/* Sejarah pembelian — match ikut nombor (LP + storefront) */}
          <div className="mt-3">
            {purchase === null ? (
              <div className="text-[11px] text-gray-300">Menyemak pembelian…</div>
            ) : purchase.count > 0 ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs">
                <div className="font-semibold text-emerald-700">🛍️ Pernah beli dengan kita ✓</div>
                <div className="text-emerald-600 mt-0.5">{purchase.count} order · RM{purchase.total.toFixed(2)}</div>
                {purchase.lastAt && (
                  <div className="text-emerald-500 text-[11px] mt-0.5">
                    Terakhir: {new Date(purchase.lastAt).toLocaleDateString("ms-MY", { day: "2-digit", month: "short", year: "2-digit" })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-2 text-xs text-gray-400">Belum pernah beli</div>
            )}
          </div>

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

          {/* Internal notes (team-only) */}
          <div className="mt-4 border-t pt-3">
            <div className="text-xs text-gray-400 mb-1">📝 Nota dalaman <span className="text-[10px] text-gray-300">(team sahaja)</span></div>
            <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3}
              placeholder="Nota tentang customer ni…" className="w-full border rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-amber-300" />
            <button onClick={saveNote} disabled={noteSaving || noteDraft.trim() === (contact?.notes ?? "")}
              className="mt-1 w-full bg-gray-800 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-gray-900 disabled:opacity-40">
              {noteSaving ? "Menyimpan…" : "Simpan nota"}
            </button>
          </div>

          {/* Follow-up reminder (nudge dalaman — tiada mesej auto ke customer) */}
          <div className="mt-4 border-t pt-3">
            <div className="text-xs text-gray-400 mb-1">⏰ Follow-up</div>
            {(() => {
              const fu = fuForContact(contact?.id);
              if (fu) {
                const due = new Date(fu.remind_at) <= new Date();
                return (
                  <div className={`rounded-lg p-2 text-xs ${due ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-100"}`}>
                    <div className={due ? "text-red-700 font-semibold" : "text-amber-700"}>{due ? "🔔 Due — follow up sekarang" : `Diingatkan: ${fmtTime(fu.remind_at)}`}</div>
                    {fu.note && <div className="text-gray-600 mt-0.5">{fu.note}</div>}
                    <button onClick={() => doneFollowup(fu.id)} className="mt-1.5 text-emerald-600 hover:underline">✓ Selesai</button>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  <input value={fuNote} onChange={(e) => setFuNote(e.target.value)} placeholder="Nota (cth: tanya restock)" className="w-full border rounded-lg px-2.5 py-1.5 text-xs" />
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1">Ingatkan bila:</div>
                    <div className="grid grid-cols-3 gap-1">
                      <button onClick={() => setFollowup(quickWhen("tomorrow"))} className="text-[11px] bg-gray-100 hover:bg-amber-100 rounded-lg px-1 py-1.5 font-medium">Esok 9am</button>
                      <button onClick={() => setFollowup(quickWhen("3days"))} className="text-[11px] bg-gray-100 hover:bg-amber-100 rounded-lg px-1 py-1.5 font-medium">3 hari</button>
                      <button onClick={() => setFollowup(quickWhen("week"))} className="text-[11px] bg-gray-100 hover:bg-amber-100 rounded-lg px-1 py-1.5 font-medium">Minggu</button>
                    </div>
                  </div>
                  <input type="datetime-local" value={fuWhen} onChange={(e) => setFuWhen(e.target.value)} className="w-full border rounded-lg px-2.5 py-1.5 text-xs text-gray-600" />
                  {fuWhen && (
                    <button onClick={() => setFollowup(new Date(fuWhen).toISOString())} className="w-full bg-amber-500 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-amber-600">
                      Set reminder tarikh ini
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </aside>
      )}
    </div>
  );
}
