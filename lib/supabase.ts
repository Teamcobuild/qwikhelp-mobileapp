import { useSession } from '@clerk/clerk-expo';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useMemo } from 'react';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Supabase trusts Clerk session tokens via the native Clerk third-party auth integration.
// RLS policies read the Clerk user id from auth.jwt()->>'sub'.
export function createClerkSupabaseClient(getToken: () => Promise<string | null>): SupabaseClient {
    if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env vars');

    return createClient(supabaseUrl, supabaseKey, {
        accessToken: getToken,
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}

export function useSupabase() {
    const { session } = useSession();

    return useMemo(
        () => createClerkSupabaseClient(async () => (await session?.getToken()) ?? null),
        [session?.id]
    );
}
