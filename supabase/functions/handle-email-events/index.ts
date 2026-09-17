import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceRoleKey)

const reactions = {
  'email.bounced': { reason: 'bounce', status: 'bounced', message: 'Permanent bounce — email address is invalid or rejected' },
  'email.complaint': { reason: 'complaint', status: 'complained', message: 'Spam complaint — recipient marked email as spam' },
  'email.unsubscribed': { reason: 'unsubscribe', status: 'suppressed', message: 'Recipient unsubscribed' },
} as const

async function suppressRecipient(event: {
  event_id: string
  type: keyof typeof reactions
  data: { recipient: string; message_id: string }
}) {
  const reaction = reactions[event.type]
  const email = event.data.recipient.trim().toLowerCase()

  const { error: suppressionError } = await supabase.from('suppressed_emails').upsert({
    email,
    reason: reaction.reason,
    source: 'lovable_managed_email',
    metadata: { event_id: event.event_id, message_id: event.data.message_id },
  }, { onConflict: 'email' })
  if (suppressionError) throw suppressionError

  const { error: logError } = await supabase.from('email_send_log').upsert({
    message_id: `event-${event.event_id}`,
    idempotency_key: `email-event-${event.event_id}`,
    recipient_email: email,
    template_name: 'managed-email-event',
    status: reaction.status,
    provider: 'lovable',
    error_message: reaction.message,
  }, { onConflict: 'message_id', ignoreDuplicates: true })
  if (logError) throw logError
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': suppressRecipient,
    'email.complaint': suppressRecipient,
    'email.unsubscribed': suppressRecipient,
    'email.resubscribed': async (event) => {
      const email = event.data.recipient.trim().toLowerCase()
      const { error } = await supabase.from('suppressed_emails').delete().eq('email', email).eq('reason', 'unsubscribe')
      if (error) throw error
    },
  },
})

Deno.serve((req) => handler(req))
