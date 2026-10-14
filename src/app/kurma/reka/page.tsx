import { redirect } from 'next/navigation'

// Konfigurator 3D lama dideprecate — aliran baharu = landing page /kurma + WhatsApp.
// Kekalkan route tapi alihkan ke landing page utama.
export default function RekaPage() {
  redirect('/kurma')
}
