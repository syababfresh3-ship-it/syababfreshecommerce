import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Verify caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { full_name, email, phone, password } = await request.json()

  if (!email || !full_name) {
    return NextResponse.json({ error: 'Nama dan email wajib' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Create auth user
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: password || undefined,
    email_confirm: true, // skip email verification
    user_metadata: { full_name },
  })

  if (createError) {
    const msg = createError.message.includes('already registered')
      ? 'Email sudah didaftarkan'
      : createError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Update profile with phone if provided
  if (phone && newUser.user) {
    await adminClient
      .from('profiles')
      .update({ phone, full_name })
      .eq('id', newUser.user.id)
  }

  return NextResponse.json({ success: true, userId: newUser.user?.id })
}
