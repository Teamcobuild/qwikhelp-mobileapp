import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AvatarContextValue {
  avatarUrl: string | null;
  reload: () => Promise<void>;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

// The photo the user uploaded (profiles.avatar_url), falling back to a Clerk image they set themselves.
export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const supabase = useSupabase();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle();
    if (error) console.warn('Avatar fetch error:', error.message);
    setAvatarUrl(data?.avatar_url || (user.hasImage ? user.imageUrl : null));
  }, [supabase, user]);

  useEffect(() => {
    reload();
  }, [reload]);

  return <AvatarContext.Provider value={{ avatarUrl, reload }}>{children}</AvatarContext.Provider>;
}

export function useAvatar() {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error('useAvatar must be used inside AvatarProvider');
  return ctx;
}
