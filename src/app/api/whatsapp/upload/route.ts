// api/whatsapp/upload — upload gambar untuk hantar dalam inbox CRM.
// Ke Supabase Storage (brand-assets/wa-media/) → pulang URL public.
// Corak sama: api/admin/refunds/upload. Admin only.
import { requireAdmin } from "@/lib/supabase/require-admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Tiada fail" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Fail terlalu besar (max 8MB)" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Hanya gambar dibenarkan" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `wa-media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase!.storage.from("brand-assets").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase!.storage.from("brand-assets").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}
