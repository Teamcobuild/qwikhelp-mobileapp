// Account deletion. POST { action: 'delete' } with the user's Clerk session token.
//   1. delete_my_account() runs as the user (Postgres verifies the token and enforces the rules)
//   2. the user's files are removed from storage (service role)
//   3. their Clerk login is deleted
// Safe to retry: each step tolerates having already run.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY') ?? '';
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Buckets whose objects live under `<userId>/...`. Chat photos live under the conversation id instead and
// are passed back by delete_my_account().
const USER_FOLDER_BUCKETS = ['avatars', 'kyc', 'portfolio', 'job-photos'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function removeFolder(bucket: string, prefix: string) {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data?.length) return;
  const files: string[] = [];
  for (const item of data) {
    // Folders come back without an id.
    if (item.id) files.push(`${prefix}/${item.name}`);
    else await removeFolder(bucket, `${prefix}/${item.name}`);
  }
  if (files.length) await admin.storage.from(bucket).remove(files);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Not found' }, 404);
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Not signed in' }, 401);
  if (!CLERK_SECRET_KEY.startsWith('sk_')) return json({ error: 'Server misconfigured: CLERK_SECRET_KEY is not set' }, 500);

  const body = await req.json().catch(() => ({}));
  if (body.action !== 'delete') return json({ error: 'Unknown action' }, 400);

  const user = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await user.rpc('delete_my_account');
  if (error) return json({ error: error.message }, 400);
  const uid: string = data.uid;

  try {
    for (const bucket of USER_FOLDER_BUCKETS) await removeFolder(bucket, uid);
    const chatPaths: string[] = data.chat_image_paths ?? [];
    if (chatPaths.length) await admin.storage.from('chat').remove(chatPaths);
  } catch (err) {
    console.error('storage cleanup failed', uid, err);
  }

  const res = await fetch(`https://api.clerk.com/v1/users/${uid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  if (!res.ok && res.status !== 404) {
    console.error('clerk delete failed', uid, res.status, await res.text());
    return json({ error: 'Your data was removed but we could not close your login. Please try again or contact support.' }, 500);
  }
  return json({ ok: true });
});
