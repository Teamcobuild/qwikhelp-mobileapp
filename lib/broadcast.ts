// Client types + helpers for the job broadcast / negotiation backend
// (supabase/migrations/20261028000600_broadcast_negotiation.sql).
import { SupabaseClient } from '@supabase/supabase-js';

export type JobStatus = 'open' | 'booked' | 'expired' | 'cancelled';
export type OfferStatus =
  | 'awaiting_customer'
  | 'awaiting_provider'
  | 'agreed'
  | 'selected'
  | 'declined'
  | 'walked_away'
  | 'expired'
  | 'withdrawn'
  | 'not_selected'
  | 'job_closed';
export type BookingStatus = 'confirmed' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';

export interface ProviderCard {
  id: string;
  name: string;
  avatar_url: string | null;
  trade: string | null;
  bio: string | null;
  years_experience: string | null;
  rating: number;
  review_count: number;
  verified: boolean;
}

export interface JobSummary {
  id: string;
  category: string;
  sub_category: string | null;
  description: string;
  photo_paths: string[];
  scheduled_at: string;
  duration_hours: number;
  budget: number;
  landmark: string;
  city: string | null;
  status: JobStatus;
  expires_at: string;
  search_radius_km: number;
  created_at: string;
}

export interface OfferSummary {
  id: string;
  job_id: string;
  status: OfferStatus;
  amount: number;
  provider_counter: number | null;
  customer_counter: number | null;
  expires_at: string | null;
  distance_km: number | null;
  updated_at: string;
}

export interface OfferEvent {
  actor: 'provider' | 'customer' | 'system';
  action: string;
  amount: number | null;
  note: string | null;
  created_at: string;
}

export interface JobOffers {
  job: JobSummary & { address: string };
  dispatched_count: number;
  booking_id: string | null;
  offers: (OfferSummary & { provider: ProviderCard })[];
}

export interface OfferDetail extends OfferSummary {
  job: JobSummary;
  viewer: 'customer' | 'provider';
  provider: ProviderCard;
  customer_name: string;
  events: OfferEvent[];
}

export interface FeedItem extends JobSummary {
  distance_km: number;
  dispatched_at: string;
  customer_name: string;
  offer: OfferSummary | null;
}

export interface BookingItem {
  id: string;
  job_id: string;
  offer_id: string;
  status: BookingStatus;
  agreed_amount: number;
  scheduled_at: string;
  duration_hours: number;
  category: string;
  description: string;
  landmark: string;
  payment_status: 'unpaid' | 'paid' | 'refunded';
  role: 'customer' | 'provider';
  customer_name: string;
  provider: ProviderCard;
}

export const ACTIVE_OFFER_STATUSES: OfferStatus[] = ['awaiting_customer', 'awaiting_provider', 'agreed'];

export const formatNaira = (amount: number | string | null | undefined) =>
  `₦${Number(amount ?? 0).toLocaleString('en-NG')}`;

export const formatJobDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const formatJobTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// Postgres `raise exception` messages are written for end users; surface them as-is.
export const errorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.') =>
  (err as { message?: string })?.message || fallback;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
};

// Uploads a local image to {folder}/... in a storage bucket and returns its path.
export async function uploadImage(supabase: SupabaseClient, bucket: string, folder: string, uri: string) {
  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'image/jpeg';
  const fileExt = ext in MIME_BY_EXT ? ext : 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType });
  if (error) throw error;
  return path;
}

export const uploadJobPhoto = (supabase: SupabaseClient, userId: string, uri: string) =>
  uploadImage(supabase, 'job-photos', userId, uri);

export async function signJobPhotos(supabase: SupabaseClient, paths: string[]) {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage.from('job-photos').createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
}
