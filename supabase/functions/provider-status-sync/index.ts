// Fired by a Database Webhook on UPDATE of public.provider_profiles.
// Mirrors the provider's status into Clerk publicMetadata (server-writable only), which the
// app's routing gate reads, and notifies the provider by push.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PROVIDER_STATUS_WEBHOOK_SECRET')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const PUSH_COPY: Record<string, { title: string; body: string } | undefined> = {
  approved: { title: "You're verified!", body: 'Your provider account is approved. Go online to start receiving jobs.' },
  needs_changes: { title: 'Action needed', body: 'Some of your verification details need updating.' },
  rejected: { title: 'Verification unsuccessful', body: 'We could not verify your provider account.' },
};

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { type, record, old_record } = await req.json();
  if (type !== 'UPDATE' || record.status === old_record?.status) {
    return new Response('ignored');
  }

  const userId: string = record.user_id;
  const status: string = record.status;

  const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_metadata: { providerStatus: status } }),
  });
  if (!clerkRes.ok) {
    console.error('Clerk metadata update failed', clerkRes.status, await clerkRes.text());
    return new Response('Clerk update failed', { status: 502 });
  }

  const copy = PUSH_COPY[status];
  if (copy) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', userId)
      .single();

    if (profile?.expo_push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: profile.expo_push_token,
          ...copy,
          data: { type: 'provider_status', status },
        }),
      });
    }
  }

  return new Response('ok');
});
