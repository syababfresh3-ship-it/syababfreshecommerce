'use client'

// Honeypot anti-bot — manusia tak nampak & tak boleh fokus field ni; bot
// auto-isi semua field → server tolak senyap (fake-200). Offscreen, BUKAN
// display:none (bot naif tahu skip display:none). Nama 'website' bukan field
// autofill standard browser (elak autofill isi & order sah tertolak).
export function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 0, height: 0, overflow: 'hidden' }}>
      <label>
        Website
        <input
          type="text"
          name="website"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </label>
    </div>
  )
}
