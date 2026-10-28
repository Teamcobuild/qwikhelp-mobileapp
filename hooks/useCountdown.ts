import { useEffect, useState } from 'react';

// Live "mm:ss" until `expiresAt`. Display only; the server enforces every deadline.
export function useCountdown(expiresAt?: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return { label: null, expired: false, msLeft: 0 };

  const msLeft = Math.max(0, new Date(expiresAt).getTime() - now);
  const totalSeconds = Math.floor(msLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    label: `${minutes}:${seconds.toString().padStart(2, '0')}`,
    expired: msLeft === 0,
    msLeft,
  };
}
