"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ImportContacts } from "./import-contacts";

interface Contact {
  id: string;
  wa_id: string;
  name: string | null;
  phone: string | null;
  tags: string[] | null;
  profile_id: string | null;
  last_inbound_at: string | null;
  profiles?: { full_name: string | null; total_spend: number | null } | null;
  crm_leads?: { stage: string }[] | { stage: string } | null;
}

const STAGE_LABEL: Record<string, string> = {
  baru: "Baru",
  followup: "Follow-up",
  hangat: "Hangat",
  won: "Won",
  lost: "Lost",
};

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ms-MY", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

export function ContactsClient() {
  const supabase = createClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const tagBoxRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 50;
  const SELECT = "id, wa_id, name, phone, tags, profile_id, last_inbound_at, profiles(full_name, total_spend), crm_leads(stage)";

  useEffect(() => {
    supabase
      .from("crm_tags")
      .select("name")
      .order("name")
      .then(({ data }: { data: { name: string }[] | null }) => setAllTags((data ?? []).map((t) => t.name)));
  }, [supabase]);

  // Tutup dropdown tag bila klik di luar.
  useEffect(() => {
    if (!tagOpen) return;
    const onDown = (e: MouseEvent) => {
      if (tagBoxRef.current && !tagBoxRef.current.contains(e.target as Node)) setTagOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [tagOpen]);

  // Carian / tapis-tag hits DB — cari antara SEMUA contacts (bukan cuma page dimuat).
  // Penting sebab contacts upload (tak pernah mesej) tersusun bawah, di luar page awal.
  const dbSearch = search.trim().length >= 1;
  const dbMode = dbSearch || !!filterTag;

  // Mod browse (tiada carian/tag) — page dari server + jumlah sebenar (count exact),
  // 50 baris satu masa. Jangan muat semua sekaligus: jimat IO (12k+ kontak).
  useEffect(() => {
    if (dbMode) return;
    let cancel = false;
    supabase
      .from("wa_contacts")
      .select(SELECT, { count: "exact" })
      .order("last_inbound_at", { ascending: false, nullsFirst: false })
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)
      .then(({ data, count }: { data: unknown[] | null; count: number | null }) => {
        if (cancel) return;
        setContacts((data as unknown as Contact[]) ?? []);
        if (count != null) setTotal(count);
      });
    return () => {
      cancel = true;
    };
  }, [supabase, page, dbMode]);
  useEffect(() => {
    if (!dbSearch && !filterTag) {
      setSearchResults([]);
      return;
    }
    let cancel = false;
    setSearching(true);
    const t = setTimeout(() => {
      let qb = supabase.from("wa_contacts").select(SELECT);
      if (filterTag) qb = qb.contains("tags", [filterTag]);
      if (dbSearch) {
        const safe = search.trim().replace(/[,()*%]/g, " ").trim();
        qb = qb.or(`name.ilike.*${safe}*,phone.ilike.*${safe}*,wa_id.ilike.*${safe}*`);
      }
      qb
        .order("last_inbound_at", { ascending: false, nullsFirst: false })
        .limit(1000)
        .then(({ data }: { data: unknown[] | null }) => {
          if (cancel) return;
          setSearchResults((data as unknown as Contact[]) ?? []);
          setSearching(false);
        });
    }, 300);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [search, filterTag, dbSearch, supabase]);

  // Padam tag dari senarai kekal. Kalau masih dipakai contact, API balas 409
  // + bilangan → confirm sekali lagi sebelum tanggalkan dari semua & padam.
  async function deleteTag(t: string) {
    if (!window.confirm(`Padam tag "${t}" dari senarai?`)) return;
    let res = await fetch(`/api/whatsapp/contacts/tags?name=${encodeURIComponent(t)}`, { method: "DELETE" });
    if (res.status === 409) {
      const j = await res.json().catch(() => ({ inUse: "?" }));
      if (!window.confirm(`Tag "${t}" masih dipakai ${j.inUse} contact.\n\nTanggalkan dari semua contact tu & padam terus?`)) return;
      res = await fetch(`/api/whatsapp/contacts/tags?name=${encodeURIComponent(t)}&force=1`, { method: "DELETE" });
    }
    if (!res.ok) {
      window.alert("Gagal padam tag.");
      return;
    }
    setAllTags((a) => a.filter((x) => x !== t));
    if (filterTag === t) {
      setFilterTag("");
      setPage(0);
    }
  }

  const stageOf = (c: Contact) => (Array.isArray(c.crm_leads) ? c.crm_leads[0]?.stage : c.crm_leads?.stage);
  const nameOf = (c: Contact) => c.name || c.profiles?.full_name || c.phone || c.wa_id || "?";

  // dbMode (ada tag / carian) → DB dah tapis, page atas hasil carian.
  // Mod browse → server dah page (contacts = satu page), kira dari total.
  const filtered = dbMode ? searchResults : contacts;
  const pageCount = Math.max(1, Math.ceil((dbMode ? filtered.length : total) / PER_PAGE));
  const paged = dbMode ? filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE) : filtered;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold text-gray-800">Contacts</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {searching ? "mencari…" : dbMode ? `${filtered.length} jumpa` : `${total.toLocaleString()} kontak`}
          </span>
          <ImportContacts />
        </div>
      </div>

      {/* Cari + tapis tag */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Cari nama / nombor…"
          className="border rounded-lg px-3 py-2 text-sm w-64"
        />
        {/* Dropdown tapis tag — carian di dalam, ganti bar chip yang panjang.
            Butang ✗ tiap baris masih padam tag (deleteTag) macam sebelum ni. */}
        <div ref={tagBoxRef} className="relative flex items-center">
          <button
            onClick={() => setTagOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 text-sm rounded-lg border px-3 py-2 ${
              filterTag ? "border-emerald-500 text-emerald-700 bg-emerald-50" : "text-gray-600"
            }`}
          >
            {filterTag || "Semua tag"}
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {filterTag && (
            <button
              onClick={() => {
                setFilterTag("");
                setPage(0);
              }}
              title="Buang tapisan"
              className="ml-1 text-gray-400 hover:text-gray-700"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
          {tagOpen && (
            <div className="absolute z-20 top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg">
              <div className="p-2 border-b">
                <input
                  autoFocus
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="Cari tag…"
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  onClick={() => {
                    setFilterTag("");
                    setPage(0);
                    setTagOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${
                    !filterTag ? "text-emerald-600 font-medium" : "text-gray-600"
                  }`}
                >
                  Semua tag
                </button>
                {allTags
                  .filter((t) => t.toLowerCase().includes(tagQuery.toLowerCase()))
                  .map((t) => (
                    <div key={t} className="flex items-center">
                      <button
                        onClick={() => {
                          setFilterTag(t);
                          setPage(0);
                          setTagOpen(false);
                        }}
                        className={`flex-1 text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${
                          filterTag === t ? "text-emerald-600 font-medium" : "text-gray-700"
                        }`}
                      >
                        {t}
                      </button>
                      <button
                        onClick={() => deleteTag(t)}
                        title={`Padam tag "${t}"`}
                        className="px-2 py-1.5 text-gray-300 hover:text-gray-700"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                {allTags.filter((t) => t.toLowerCase().includes(tagQuery.toLowerCase())).length === 0 && (
                  <div className="px-3 py-3 text-sm text-gray-400 text-center">Tiada tag.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Senarai */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Nama</th>
              <th className="text-left px-3 py-2">Nombor</th>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-left px-3 py-2">Stage</th>
              <th className="text-left px-3 py-2">Belanja</th>
              <th className="text-left px-3 py-2">Akhir hubung</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{nameOf(c)}</td>
                <td className="px-3 py-2 text-gray-500">{c.phone || c.wa_id}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(c.tags ?? []).map((t) => (
                      <span key={t} className="text-[10px] bg-emerald-50 text-emerald-600 rounded px-1.5">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-600">{stageOf(c) ? STAGE_LABEL[stageOf(c)!] ?? stageOf(c) : "—"}</td>
                <td className="px-3 py-2 text-gray-600">
                  {c.profiles?.total_spend != null ? `RM${Number(c.profiles.total_spend).toFixed(0)}` : "—"}
                </td>
                <td className="px-3 py-2 text-gray-400">{fmtDate(c.last_inbound_at)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <a href={`/admin/crm/inbox`} className="text-blue-600 hover:underline text-xs mr-2">
                    Chat
                  </a>
                  <a href={`/admin/crm/order?contact=${c.id}`} className="text-emerald-600 hover:underline text-xs">
                    Order
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Tiada kontak.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            ‹ Prev
          </button>
          <span className="text-gray-500">
            Page {page + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}
