'use client'

// Honeypot anti-bot — manusia tak nampak & tak boleh fokus field ni; bot
// auto-isi semua field → server tolak senyap (fake-200). Offscreen, BUKAN
// display:none (bot naif tahu skip display:none).
//
// PENTING: atribut DOM `name` MESTI nama yang autofill/password manager TAK
// kenal. Sebelum ini `name="website"` + label "Website" — dua-dua sasaran
// autofill utama; browser/PM abaikan `autoComplete="off"` dan isi field ni
// automatik untuk customer SEBENAR → order sah tertolak jadi RM0.00 & tak boleh
// bayar (3 customer terjejas, cth LP-20260730-3721). Fix: nama neutral tanpa
// makna, buang label "Website", + hint data-lpignore/data-1p-ignore supaya
// password manager langkau. Bot tetap isi semua field → masih tertangkap.
//
// NOTA: key JSON yang dihantar ke server kekal `website` (dari state var di
// borang), jadi server `isHoneypotFilled(body.website)` TAK perlu diubah —
// cuma atribut DOM `name` yang berubah (autofill padan ikut name/label, bukan
// key JSON fetch).
export function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 0, height: 0, overflow: 'hidden' }}>
      <input
        type="text"
        name="hp_confirm_field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore
        data-form-type="other"
      />
    </div>
  )
}
