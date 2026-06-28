'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Phone } from 'lucide-react'
import { ProfileForm } from './profile-form'
import type { Profile } from '@/types'

export function ProfileSection({ profile }: { profile: Profile }) {
  const [expanded, setExpanded] = useState(false)

  const hasPhone = !!profile.phone
  const initial  = profile.full_name?.charAt(0).toUpperCase() ?? '?'

  return (
    // account page v3 conversion polish: amber left accent when phone missing = attention signal
    <div
      id="profil"
      className={`bg-white rounded-2xl overflow-hidden transition-all ${
        !hasPhone
          ? 'shadow-[-3px_0_0_0_rgba(245,158,11,0.55),0_2px_14px_rgba(0,0,0,0.06)]'
          : 'shadow-[0_2px_14px_rgba(0,0,0,0.06)]'
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3.5 px-4 py-4 text-left active:bg-gray-50/80 transition-colors"
      >
        {/* account page v3 conversion polish: avatar initial instead of settings icon — personal */}
        <div className="w-10 h-10 rounded-xl bg-brand-red-50 flex items-center justify-center shrink-0 text-base font-black text-brand-red-600">
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Profil Saya</p>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-gray-400 truncate max-w-[110px]">
              {profile.full_name ?? '—'}
            </span>

            <span className="text-gray-200 text-[11px]">·</span>

            {/* account page v3 conversion polish: phone as amber badge when missing */}
            {hasPhone ? (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Phone className="h-3 w-3 shrink-0" />
                {profile.phone}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200/70 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                <Phone className="h-2.5 w-2.5" />
                Belum diisi
              </span>
            )}
          </div>

          {/* account page v3 conversion polish: completion hint when phone is empty */}
          {!hasPhone && (
            <p className="text-[10px] text-amber-500 font-medium mt-1 leading-snug">
              Lengkapkan profil untuk pengalaman lebih pantas
            </p>
          )}
        </div>

        {expanded ? (
          <ChevronUp className={`h-4 w-4 shrink-0 ${!hasPhone ? 'text-amber-300' : 'text-gray-300'}`} />
        ) : (
          <ChevronDown className={`h-4 w-4 shrink-0 ${!hasPhone ? 'text-amber-300' : 'text-gray-300'}`} />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-5 pt-4 border-t border-gray-50">
          <ProfileForm profile={profile} />
        </div>
      )}
    </div>
  )
}
