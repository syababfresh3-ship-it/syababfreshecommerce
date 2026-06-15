// Slot masa penghantaran — dikongsi antara checkout storefront & checkout LP supaya
// logik (penapisan waktu + lead time) kekal sama di kedua-dua tempat.

export interface SlotConfig {
  id: string
  day: 'today' | 'tomorrow'
  start: number
  end: number
  label: string
  lead_hours: number
  active: boolean
}

export const DEFAULT_SLOTS: SlotConfig[] = [
  { id: 'today-10',    day: 'today',    start: 10, end: 14, label: '10am – 2pm',  lead_hours: 2, active: true },
  { id: 'today-14',    day: 'today',    start: 14, end: 18, label: '2pm – 6pm',   lead_hours: 2, active: true },
  { id: 'today-18',    day: 'today',    start: 18, end: 21, label: '6pm – 9pm',   lead_hours: 2, active: true },
  { id: 'tomorrow-8',  day: 'tomorrow', start: 8,  end: 12, label: '8am – 12pm',  lead_hours: 0, active: true },
  { id: 'tomorrow-12', day: 'tomorrow', start: 12, end: 16, label: '12pm – 4pm',  lead_hours: 0, active: true },
  { id: 'tomorrow-16', day: 'tomorrow', start: 16, end: 20, label: '4pm – 8pm',   lead_hours: 0, active: true },
]

// Bina senarai slot tersedia ikut waktu semasa (Asia/Kuala_Lumpur). Slot 'today'
// dibuang bila masa semasa + lead_hours sudah melepasi waktu mula slot.
export function buildDeliverySlots(configs: SlotConfig[]): { value: string; label: string }[] {
  const now = new Date()
  const hour = Number(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', hour12: false }))
  const slots: { value: string; label: string }[] = []

  for (const s of configs.filter(c => c.active)) {
    if (s.day === 'today') {
      if (hour + (s.lead_hours ?? 2) <= s.start) {
        slots.push({ value: `today-${s.start}`, label: `Hari ini, ${s.label}` })
      }
    } else {
      slots.push({ value: `tomorrow-${s.start}`, label: `Esok, ${s.label}` })
    }
  }
  return slots
}
