import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const QuestionSchema = z.object({
  question: z.string().max(5000),
  studentAnswer: z.string().max(10000),
  grade: z.number().nullable(),
  maxPoints: z.number(),
  feedbackText: z.string().max(10000),
})

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  totalEarned: z.number(),
  totalPossible: z.number(),
  questions: z.array(QuestionSchema).max(200),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceKey) throw new Error('Server configuration error')

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(url, serviceKey)
    const { data: session, error: sessionError } = await admin
      .from('student_sessions')
      .select('id, student_email, student_name, room_id, rooms!inner(title, teacher_id)')
      .eq('id', parsed.data.sessionId)
      .single()
    if (sessionError || !session) return new Response(JSON.stringify({ error: 'Atividade não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const room = Array.isArray(session.rooms) ? session.rooms[0] : session.rooms
    if (!room || room.teacher_id !== user.id) return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!session.student_email) return new Response(JSON.stringify({ error: 'Aluno sem email cadastrado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const result = await sendTemplateEmail('feedback-completed', session.student_email, {
      templateData: {
        studentName: session.student_name,
        roomTitle: room.title || 'Atividade',
        totalEarned: parsed.data.totalEarned,
        totalPossible: parsed.data.totalPossible,
        questions: parsed.data.questions,
      },
      idempotencyKey: `feedback-completed-${session.id}`,
    })

    const status = result.sent ? 'sent' : 'suppressed'
    const { error: logError } = await admin.from('email_send_log').insert({
      template_name: 'feedback-completed', recipient_email: session.student_email, status,
    })
    if (logError) console.error('Failed to record feedback email result', { code: logError.code, message: logError.message })

    if (result.sent) {
      const sentAt = new Date().toISOString()
      const { error: updateError } = await admin.from('student_sessions').update({ feedback_email_sent_at: sentAt }).eq('id', session.id)
      if (updateError) console.error('Failed to mark feedback email sent', { code: updateError.code, message: updateError.message })
      return new Response(JSON.stringify({ success: true, sentAt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: false, reason: result.reason }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao enviar feedback'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})