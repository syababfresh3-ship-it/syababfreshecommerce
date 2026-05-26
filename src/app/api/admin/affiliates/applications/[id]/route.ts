import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { action, admin_note } = await request.json()
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action mesti approve atau reject' }, { status: 400 })
    }

    const { data: application } = await supabase
      .from('affiliate_applications')
      .select('id, user_id, status')
      .eq('id', id)
      .single()

    if (!application) return NextResponse.json({ error: 'Permohonan tidak dijumpai' }, { status: 404 })
    if (application.status !== 'pending') return NextResponse.json({ error: 'Permohonan sudah diproses' }, { status: 400 })

    // Update application
    await supabase.from('affiliate_applications').update({
      status: action === 'approve' ? 'approved' : 'rejected',
      admin_note: admin_note?.trim() || null,
      processed_at: new Date().toISOString(),
    }).eq('id', id)

    // If approved, set is_affiliate = true
    if (action === 'approve') {
      await supabase.from('profiles').update({ is_affiliate: true }).eq('id', application.user_id)
    }

    // Notify applicant via WhatsApp
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', application.user_id)
      .single()

    if (profile?.phone) {
      const name = profile.full_name ?? 'Anda'
      const msg = action === 'approve'
        ? [
            `🎉 *Tahniah ${name}!*`,
            ``,
            `Permohonan affiliate anda telah *diluluskan*.`,
            ``,
            `Anda kini boleh mula kongsi link rujukan dan jana komisyen setiap kali rakan anda membuat order.`,
            ``,
            `👉 Buka dashboard anda di: ${process.env.NEXT_PUBLIC_APP_URL}/affiliate`,
          ].join('\n')
        : [
            `Hai ${name},`,
            ``,
            `Maaf, permohonan affiliate anda tidak dapat diluluskan buat masa ini.`,
            admin_note?.trim() ? `\n📝 ${admin_note.trim()}` : '',
            ``,
            `_SyababFresh_`,
          ].filter(l => l !== '').join('\n')

      sendWhatsApp(profile.phone, msg).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
