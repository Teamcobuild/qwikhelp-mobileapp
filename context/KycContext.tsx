import { useSupabase } from '@/lib/supabase';
import { KycData, OnboardingStep, ProviderStatus } from '@/types/provider';
import { useUser } from '@clerk/clerk-expo';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type Bucket = 'kyc' | 'avatars' | 'portfolio';
type Row = Record<string, unknown>;

interface SaveStepInput {
  next: OnboardingStep;
  local: Partial<KycData>;
  profile?: Row;   // public.profiles
  provider?: Row;  // public.provider_profiles
  kyc?: Row;       // public.kyc_submissions
}

interface KycContextValue {
  ready: boolean;   // first load finished
  loading: boolean;
  error: string | null;
  kyc: KycData;
  status: ProviderStatus;
  reviewNote: string | null;
  reload: () => Promise<ProviderStatus | undefined>;
  uploadImage: (bucket: Bucket, uri: string, name: string) => Promise<string>;
  publicUrl: (bucket: Exclude<Bucket, 'kyc'>, path: string) => string;
  saveStep: (input: SaveStepInput) => Promise<void>;
  submit: () => Promise<ProviderStatus>;
  // Asks the backend to copy the DB status into Clerk publicMetadata, then reloads the Clerk user.
  syncClerkStatus: () => Promise<ProviderStatus | undefined>;
}

const KycContext = createContext<KycContextValue | undefined>(undefined);

const SIGNED_URL_TTL = 60 * 60 * 24;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
};

// "DD / MM / YYYY" <-> "YYYY-MM-DD"
export const dobToIso = (dob: string) => {
  const [d, m, y] = dob.split('/').map((s) => s.trim());
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};
const isoToDob = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d} / ${m} / ${y}`;
};

export function KycProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const supabase = useSupabase();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kyc, setKyc] = useState<KycData>({});
  const [status, setStatus] = useState<ProviderStatus>('draft');
  const [reviewNote, setReviewNote] = useState<string | null>(null);

  // Display URL -> storage path, so already-uploaded images are not re-uploaded on save.
  const pathByUrl = useRef<Record<string, string>>({});

  const userId = user?.id;

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Rows are created on first visit; existing rows are left untouched.
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({ id: userId, role: 'provider', full_name: user?.fullName }, { onConflict: 'id', ignoreDuplicates: true });
      if (profileErr) throw profileErr;

      const { error: providerErr } = await supabase
        .from('provider_profiles')
        .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (providerErr) throw providerErr;

      const [{ data: p, error: pErr }, { data: k, error: kErr }] = await Promise.all([
        supabase.from('provider_profiles').select('*').eq('user_id', userId).single(),
        supabase.from('kyc_submissions').select('*').eq('user_id', userId).maybeSingle(),
      ]);
      if (pErr) throw pErr;
      if (kErr) throw kErr;

      // Locked providers (approved/rejected) cannot insert; that's fine, they only view.
      if (!k && ['draft', 'submitted', 'needs_changes'].includes(p.status)) {
        const { error: insErr } = await supabase.from('kyc_submissions').insert({ user_id: userId });
        if (insErr) throw insErr;
      }

      const urlMap: Record<string, string> = {};
      const publicUrl = (bucket: Bucket, path?: string | null) => {
        if (!path) return undefined;
        const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        urlMap[url] = path;
        return url;
      };

      const privatePaths = [k?.id_image_path, k?.selfie_path, k?.workshop_photo_path].filter(Boolean) as string[];
      const signed: Record<string, string> = {};
      if (privatePaths.length) {
        const { data, error: signErr } = await supabase.storage.from('kyc').createSignedUrls(privatePaths, SIGNED_URL_TTL);
        if (signErr) throw signErr;
        data?.forEach((s) => {
          if (s.signedUrl && s.path) {
            signed[s.path] = s.signedUrl;
            urlMap[s.signedUrl] = s.path;
          }
        });
      }
      const privateUrl = (path?: string | null) => (path ? signed[path] : undefined);

      pathByUrl.current = urlMap;
      setStatus(p.status);
      setReviewNote(p.review_note);
      setKyc({
        legalName: k?.legal_name ?? undefined,
        phone: k?.phone ?? undefined,
        avatarUri: publicUrl('avatars', k?.avatar_path),
        trade: p.trade ?? undefined,
        tradeSubtitle: p.trade_subtitle ?? undefined,
        bio: p.bio ?? undefined,
        yearsExperience: p.years_experience ?? undefined,

        idType: k?.id_type ?? undefined,
        documentNumber: k?.document_number ?? undefined,
        ninNumber: k?.nin ?? undefined,
        dob: k?.dob ? isoToDob(k.dob) : undefined,
        idImageUri: privateUrl(k?.id_image_path),

        selfieUri: privateUrl(k?.selfie_path),

        proofOfWorkUris: (k?.proof_of_work_paths ?? []).map((path: string) => publicUrl('portfolio', path)!),
        proofOfWorkTitles: k?.proof_of_work_titles ?? [],
        workDescription: k?.work_description ?? undefined,

        baseAddress: p.base_address ?? undefined,
        city: p.city ?? undefined,
        workshopPhotoUri: privateUrl(k?.workshop_photo_path),
        gpsLocation:
          p.base_lat != null && p.base_lng != null
            ? { latitude: p.base_lat, longitude: p.base_lng, address: p.base_address ?? undefined }
            : undefined,
        soleProviderAgreed: k?.sole_provider_agreed ?? false,

        guarantorName: k?.guarantor_name ?? undefined,
        guarantorPhone: k?.guarantor_phone ?? undefined,
        guarantorRelationship: k?.guarantor_relationship ?? undefined,
        guarantorAddress: k?.guarantor_address ?? undefined,
        guarantorNin: k?.guarantor_nin ?? undefined,
        guarantorConsentAgreed: k?.guarantor_consent_agreed ?? false,
      });
      setReady(true);
      return p.status as ProviderStatus;
    } catch (err: any) {
      setError(err?.message || 'Could not load your verification details.');
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Live status updates (e.g. an admin approves while the provider is on the pending screen).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`provider-status:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'provider_profiles', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { status: ProviderStatus; review_note: string | null };
          setStatus(row.status);
          setReviewNote(row.review_note);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const uploadImage = useCallback(
    async (bucket: Bucket, uri: string, name: string) => {
      const existing = pathByUrl.current[uri];
      if (existing) return existing;
      if (!userId) throw new Error('Not signed in');

      const res = await fetch(uri);
      const body = await res.arrayBuffer();
      const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
      const contentType = MIME_BY_EXT[ext] || res.headers.get('content-type') || 'image/jpeg';
      const fileExt = Object.entries(MIME_BY_EXT).find(([, mime]) => mime === contentType)?.[0] || 'jpg';
      const path = `${userId}/${name}-${Date.now()}.${fileExt}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, body, { contentType });
      if (upErr) throw upErr;

      pathByUrl.current[uri] = path;
      return path;
    },
    [supabase, userId]
  );

  const publicUrl = useCallback(
    (bucket: Exclude<Bucket, 'kyc'>, path: string) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const saveStep = useCallback(
    async ({ next, local, profile, provider, kyc: kycRow }: SaveStepInput) => {
      if (!user || !userId) throw new Error('Not signed in');

      const writes = [
        profile && supabase.from('profiles').update(profile).eq('id', userId),
        provider && supabase.from('provider_profiles').update(provider).eq('user_id', userId),
        kycRow && supabase.from('kyc_submissions').update(kycRow).eq('user_id', userId),
      ].filter(Boolean);

      for (const result of await Promise.all(writes)) {
        if (result && 'error' in result && result.error) throw result.error;
      }

      // Only the progress marker lives in Clerk now; drop the legacy KYC blob if present.
      const { kycData: _legacyKyc, providerVerified: _legacyVerified, ...rest } = (user.unsafeMetadata ?? {}) as Row;
      await user.update({ unsafeMetadata: { ...rest, onboardingStep: next } });

      setKyc((prev) => ({ ...prev, ...local }));
    },
    [supabase, user, userId]
  );

  const submit = useCallback(async () => {
    const { data, error: rpcErr } = await supabase.rpc('submit_kyc');
    if (rpcErr) throw rpcErr;
    setStatus(data as ProviderStatus);
    return data as ProviderStatus;
  }, [supabase]);

  const syncClerkStatus = useCallback(async () => {
    const { data, error: fnErr } = await supabase.functions.invoke('provider-status-sync', { body: {} });
    if (fnErr) {
      let message = fnErr.message;
      try {
        const body = await (fnErr as any).context?.json?.();
        if (body?.error) message = body.error;
      } catch {}
      throw new Error(message);
    }
    await user?.reload();
    return data?.status as ProviderStatus | undefined;
  }, [supabase, user]);

  return (
    <KycContext.Provider value={{ ready, loading, error, kyc, status, reviewNote, reload, uploadImage, publicUrl, saveStep, submit, syncClerkStatus }}>
      {children}
    </KycContext.Provider>
  );
}

export function useKyc() {
  const ctx = useContext(KycContext);
  if (!ctx) throw new Error('useKyc must be used inside KycProvider');
  return ctx;
}
