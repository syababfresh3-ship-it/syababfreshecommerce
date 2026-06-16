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
  wa_contacts: Contact | null;
}
interface Message {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  type: string;
  body: string | null;
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

export function InboxClient() {
  const supabase = createClient();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTpl, setShowTpl] = useState(false);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [tplParams, setTplParams] = useState<Record<string, string>>({});
  const threadRef = useRef<HTMLDivElement>(null);

  const inWindow = selected?.window_expires_at ? new Date(selected.window_expires_at) > new Date() : false;

  const loadConvos = useCallback(async () => {
    const { data } = await supabase
      .from("wa_conversations")
      .select(
        "id, contact_id, last_message_at, last_message_preview, unread_count, window_expires_at, status, wa_contacts(id, wa_id, phone, name, tags, profile_id, profiles(full_name, total_spend))",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    setConvos((data as unknown as Conversation[]) ?? []);
  }, [supabase]);

  const loadMessages = useCallback(
    async (convId: string) => {
      const { data } = await supabase
        .from("wa_messages")
        .select("id, conversation_id, direction, type, body, template_name, status, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(500);
      setMessages((data as unknown as Message[]) ?? []);
    },
    [supabase],
  );

  // Muat awal + realtime
  useEffect(() => {
    loadConvos();
    const ch = supabase
      .channel("wa-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_messages" }, (p: { new: Message }) => {
        const row = p.new as Message;
        loadConvos();
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
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    setSending(false);
    if (!res.ok) {
      setErr(j.error || "Hantar gagal.");
      return;
    }
    setReply("");
    setTpl(null);
    setShowTpl(false);
    loadMessages(selected.id);
    loadConvos();
  }

  const contact = selected?.wa_contacts;
  const displayName = (c: Conversation | null) =>
    c?.wa_contacts?.name || c?.wa_contacts?.profiles?.full_name || c?.wa_contacts?.phone || c?.wa_contacts?.wa_id || "?";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-gray-100">
      {/* Senarai perbualan */}
      <aside className="w-80 shrink-0 border-r bg-white overflow-y-auto">
        <div className="p-3 border-b font-semibold text-gray-800">Inbox WhatsApp</div>
        {convos.length === 0 && <div className="p-4 text-sm text-gray-400">Tiada perbualan lagi.</div>}
        {convos.map((c) => (
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
          </button>
        ))}
      </aside>

      {/* Thread */}
      <main className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 grid place-items-center text-gray-400 text-sm">Pilih satu perbualan.</div>
        ) : (
          <>
            <div className="px-4 py-3 border-b bg-white">
              <div className="font-semibold text-gray-800">{displayName(selected)}</div>
              <div className="text-xs text-gray-400">{contact?.wa_id}</div>
            </div>

            <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.direction === "out" ? "bg-emerald-500 text-white" : "bg-white border text-gray-800"
                    }`}
                  >
                    {m.type !== "text" && !m.body && <span className="italic opacity-70">[{m.type}]</span>}
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
                <div className="flex gap-2">
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
                    placeholder="Taip balasan…"
                    className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !reply.trim()}
                    className="bg-emerald-500 text-white rounded-lg px-4 text-sm font-medium disabled:opacity-50"
                  >
                    {sending ? "…" : "Hantar"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-amber-600">
                    ⏳ Luar tetingkap 24 jam — wajib guna template diluluskan.
                  </div>
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
        <aside className="w-72 shrink-0 border-l bg-white p-4 hidden lg:block overflow-y-auto">
          <div className="text-sm font-semibold text-gray-800 mb-3">Maklumat Customer</div>
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
            {contact?.tags && contact.tags.length > 0 && (
              <div>
                <dt className="text-gray-400">Tag</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {contact.tags.map((t) => (
                    <span key={t} className="bg-gray-100 rounded px-1.5 py-0.5">
                      {t}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      )}
    </div>
  );
}
