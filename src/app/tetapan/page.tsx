import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Bell } from 'lucide-react'
import { SfShell } from '@/components/storev2/sf-shell'
import { ProfileSection } from '../profile/profile-section'
import { PushSubscribeButton } from '@/components/store/push-subscribe'

export const metadata: Metadata = { title: 'Tetapan', robots: { index: false, follow: false } }

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data
}

export default async function TetapanPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login?redirect=/tetapan')

  return (
    <SfShell>
      <div className="px-4 pt-4 pb-8 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/profile" className="h-9 w-9 grid place-items-center rounded-full -ml-1 text-gray-600 hover:bg-gray-100" aria-label="Kembali">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[18px] font-extrabold text-gray-900">Tetapan</h1>
        </div>

        {/* Maklumat profil (edit) */}
        <ProfileSection profile={profile as never} />

        {/* Notifikasi push */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-1">
            <div className="h-7 w-7 rounded-lg bg-[#FDECEC] grid place-items-center">
              <Bell className="h-3.5 w-3.5 text-[#E11D2A]" />
            </div>
            <p className="text-[14px] font-bold text-gray-900">Notifikasi Push</p>
          </div>
          <div className="px-4 pb-4 pt-2">
            <PushSubscribeButton />
          </div>
        </div>
      </div>
    </SfShell>
  )
}
