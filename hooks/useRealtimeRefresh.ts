import { useSupabase } from '@/lib/supabase';
import { useEffect, useLayoutEffect, useRef } from 'react';

interface TableWatch {
  table: string;
  filter?: string; // e.g. `job_id=eq.${jobId}`
}

// Calls `onChange` (debounced) whenever a watched row changes. RLS decides which rows the user receives.
export function useRealtimeRefresh(key: string | null, watches: TableWatch[], onChange: () => void) {
  const supabase = useSupabase();
  const callback = useRef(onChange);
  useLayoutEffect(() => {
    callback.current = onChange;
  });

  const watchKey = JSON.stringify(watches);

  useEffect(() => {
    if (!key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trigger = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), 250);
    };

    let channel = supabase.channel(`${key}:${Date.now()}`);
    for (const w of watches) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: w.table, ...(w.filter && { filter: w.filter }) },
        trigger
      );
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, key, watchKey]);
}
