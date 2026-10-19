// Contoh HTML permulaan untuk LP kurma (hos 'kurma') dalam LP builder — team sales duplicate
// & ubah teks/gambar. Semua blok funnel datang dari tag {{kurma:...}} (lib/lp-kurma-tags.ts).
// Tiada angka/dakwaan rekaan: teks umum sahaja; fakta sebenar ditulis sales sendiri.
export const LP_KURMA_STARTER_HTML = `{{kurma:menu}}

<section style="width:100%;padding:40px 20px 28px;background:#FDECEC;text-align:center;">
  <p style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#E11D2A;background:#fff;padding:5px 12px;border-radius:999px;margin:0 0 14px;">Custom Gift Box Kurma</p>
  <h1 style="font-size:30px;line-height:1.15;font-weight:900;color:#111;margin:0 0 12px;">Gift box kurma dengan logo &amp; design syarikat anda</h1>
  <p style="font-size:15px;color:#4b5563;max-width:520px;margin:0 auto 20px;">Pilih saiz kotak, letak artwork sendiri atau pilih template kami, isi dengan kurma pilihan — dapat anggaran harga terus di bawah.</p>
  <a href="#kira" style="display:inline-block;background:#E11D2A;color:#fff;font-weight:800;font-size:15px;padding:13px 24px;border-radius:14px;text-decoration:none;">Kira harga sekarang</a>
</section>

{{kurma:renders}}

<section style="width:100%;padding:8px 20px 24px;">
  <h2 style="font-size:22px;font-weight:900;color:#111;text-align:center;margin:0 0 6px;">Kira anggaran harga</h2>
  <p style="font-size:14px;color:#6b7280;text-align:center;margin:0;">Pilih kurma, berat &amp; kuantiti — harga terus keluar, boleh hantar ke WhatsApp.</p>
</section>

{{kurma:kira}}

{{kurma:galeri|8}}

<section style="width:100%;padding:28px 20px;text-align:center;">
  <h2 style="font-size:22px;font-weight:900;color:#111;margin:0 0 8px;">Nak reka sendiri dengan logo anda?</h2>
  <p style="font-size:14px;color:#6b7280;max-width:480px;margin:0 auto 16px;">Buka Studio: pilih template, letak logo, tengok pratonton kotak dan hantar permintaan sebut harga.</p>
  {{kurma:studio|Buka Studio}}
</section>

<section style="width:100%;padding:8px 20px 36px;text-align:center;">
  {{kurma:wa|WhatsApp kami untuk sebut harga}}
</section>

{{kurma:fab}}
{{kurma:footer}}
`
