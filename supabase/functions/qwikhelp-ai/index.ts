// QwikHelp AI: in-app assistant for customers and providers.
// Caller: the app, with Authorization: Bearer <Clerk session token>. The conversation lives on the
// device and is sent with each request; nothing is stored here except a per-user daily message count.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { verifyToken } from 'npm:@clerk/backend@2';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY')!;
const DAILY_LIMIT = Number(Deno.env.get('ASSISTANT_DAILY_LIMIT') ?? 30);
const MAX_HISTORY = 20;
const MAX_CHARS = 2000;

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const anthropic = new Anthropic(); // ANTHROPIC_API_KEY

const SYSTEM_PROMPT = `You are QwikHelp AI, the in-app assistant for QwikHelp, a Nigerian marketplace that connects customers with verified home-service providers (cooking, cleaning, laundry, companions, tour guides, plumbing, electrical repairs, gardening and carpentry).

How QwikHelp works, so you can explain it accurately:
- A customer posts a job with the service, photos, description, date and time, nearest landmark and a proposed workmanship fee in naira (₦).
- The job goes to verified providers nearby. Providers see only the landmark and their distance; the exact address stays private until a booking is confirmed.
- Each provider can accept the price or counter once. The customer can accept, decline, or send one final counter, and the provider then accepts or walks away. Counters expire after 30 minutes.
- An accepted price is an agreed offer, not a booking. The customer compares agreed offers by price and provider profile and picks one to book.
- Customers and providers talk only through in-app chat and in-app calls. Phone numbers are never shared, and you must never ask for or encourage sharing phone numbers, bank details or off-platform payment.

Help with: describing a job clearly, estimating a fair workmanship fee range in naira, choosing a service category, preparing for a visit, understanding offers and counters, and using the app. Keep answers short and practical, written for a mobile screen. Use naira for money. You cannot see the user's bookings, payments or account, and cannot take actions in the app; for account, payment or dispute problems, point them to Chat Support in the Account tab.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function userIdFrom(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    // Depending on the SDK version this either throws or returns { data, errors }.
    const result: any = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    if (result?.errors?.length) return null;
    return (result?.data ?? result)?.sub ?? null;
  } catch {
    return null;
  }
}

function parseMessages(input: unknown): Anthropic.MessageParam[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const messages = input.slice(-MAX_HISTORY).map((m: any) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content ?? '').slice(0, MAX_CHARS),
  })) as Anthropic.MessageParam[];
  // The API needs the conversation to start with a user turn and end with one.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  return messages;
}

Deno.serve(async (req) => {
  try {
    const userId = await userIdFrom(req);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const { messages: raw } = await req.json();
    const messages = parseMessages(raw);
    if (!messages) return json({ error: 'Send at least one message.' }, 400);

    const { data: allowed, error: quotaErr } = await supabase.rpc('take_assistant_quota', {
      p_user: userId,
      p_limit: DAILY_LIMIT,
    });
    if (quotaErr) throw quotaErr;
    if (!allowed) {
      return json({ error: `You've reached today's limit of ${DAILY_LIMIT} messages. Try again tomorrow.` }, 429);
    }

    const response = await anthropic.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low' },
      // On a safety decline, the API retries on a fallback model it picks by category.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages,
    } as any);

    if (response.stop_reason === 'refusal') {
      return json({ reply: "Sorry, I can't help with that. For account or booking issues, please use Chat Support." });
    }

    const reply = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    return json({ reply: reply || "Sorry, I couldn't come up with an answer. Please try rephrasing." });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'QwikHelp AI is busy. Please try again shortly.' }, 503);
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      return json({ error: 'QwikHelp AI is unavailable right now.' }, 502);
    }
    console.error(err);
    return json({ error: 'Something went wrong.' }, 500);
  }
});
