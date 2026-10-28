export type OnboardingStep =
  | 'personal-details'
  | 'nin-id-upload'
  | 'biometric-check'
  | 'proof-of-work'
  | 'base-terms'
  | 'guarantor'
  | 'pending';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'personal-details',
  'nin-id-upload',
  'biometric-check',
  'proof-of-work',
  'base-terms',
  'guarantor',
  'pending',
];

export type ProviderStatus = 'draft' | 'submitted' | 'needs_changes' | 'approved' | 'rejected';

// Client-side view of a provider's KYC, assembled from Supabase.
// *Uri fields hold displayable URLs (signed/public), not storage paths.
export interface KycData {
  // Step 1: Personal Details
  legalName?: string;
  avatarUri?: string;
  bio?: string;
  trade?: string; // trade id, see constants/kyc.ts
  tradeSubtitle?: string;
  phone?: string;
  yearsExperience?: string;

  // Step 2: NIN & Gov ID Upload
  ninNumber?: string;
  documentNumber?: string;
  dob?: string; // "DD / MM / YYYY"
  idType?: string; // doc type id, see constants/kyc.ts
  idImageUri?: string;

  // Step 3: Biometric Check
  selfieUri?: string;

  // Step 4: Proof of Work
  proofOfWorkUris?: string[];
  proofOfWorkTitles?: string[];
  workDescription?: string;

  // Step 5: Base & Terms
  baseAddress?: string;
  city?: string;
  workshopPhotoUri?: string;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  soleProviderAgreed?: boolean;

  // Step 6: Guarantor
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorRelationship?: string;
  guarantorAddress?: string;
  guarantorNin?: string;
  guarantorConsentAgreed?: boolean;
}

// Client-writable progress marker (Clerk unsafeMetadata).
export interface ProviderUnsafeMetadata {
  role: 'provider';
  onboardingStep?: OnboardingStep;
}

// Server-written by the provider-status-sync edge function (Clerk publicMetadata).
export interface ProviderPublicMetadata {
  providerStatus?: ProviderStatus;
}
