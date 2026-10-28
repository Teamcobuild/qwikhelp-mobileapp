// Customer-facing services. `id` matches public.service_categories.id and provider trade ids
// (constants/kyc.ts). `slug` is the /booking/[category] route segment used by the home screen.
export interface ServiceConfig {
  id: string;
  slug: string;
  name: string;
  subCategories: string[];
  minFare: number; // fallback; the database value (service_categories.min_fare) wins
}

export const SERVICES: ServiceConfig[] = [
  { id: 'cooking', slug: 'cooking', name: 'Cooking', subCategories: ['Local Meals', 'Foreign Meals', 'Other'], minFare: 6000 },
  { id: 'cleaning', slug: 'cleaning', name: 'Cleaning', subCategories: ['Deep Clean', 'Standard Clean', 'Other'], minFare: 5000 },
  { id: 'laundry', slug: 'laundry', name: 'Laundry', subCategories: ['Wash & Fold', 'Ironing', 'Dry Cleaning'], minFare: 3000 },
  { id: 'companion', slug: 'companion', name: 'Companion', subCategories: ['Events', 'Casual Hangout', 'Other'], minFare: 8000 },
  { id: 'tour_guide', slug: 'tour-guide', name: 'Tour Guide', subCategories: ['City Tour', 'Historical', 'Adventure'], minFare: 10000 },
  { id: 'plumbing', slug: 'plumber', name: 'Plumbing', subCategories: ['Pipe Leak', 'Installation', 'Other'], minFare: 7000 },
  { id: 'electrical', slug: 'electrician', name: 'Electrical Repairs', subCategories: ['Wiring', 'Appliance Repair', 'Other'], minFare: 7000 },
  { id: 'gardening', slug: 'gardeners', name: 'Gardening', subCategories: ['Trimming', 'Planting', 'Maintenance'], minFare: 5000 },
  { id: 'carpentry', slug: 'carpentry', name: 'Carpentry', subCategories: ['Furniture', 'Doors & Windows', 'Other'], minFare: 7000 },
];

export const serviceBySlug = (slug?: string) =>
  SERVICES.find((s) => s.slug === slug?.toLowerCase() || s.id === slug?.toLowerCase());

export const serviceName = (id?: string) => SERVICES.find((s) => s.id === id)?.name ?? id ?? 'Service';
