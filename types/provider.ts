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

export interface KycData {
  // Step 1: Personal Details
  legalName?: string;
  avatarUri?: string;
  bio?: string;
  trade?: string;
  tradeSubtitle?: string;
  phone?: string;
  yearsExperience?: string;

  // Step 2: NIN & Gov ID Upload
  ninNumber?: string;
  documentNumber?: string;
  dob?: string;
  idType?: string;
  idImageUri?: string;

  // Step 3: Biometric Check
  selfieUri?: string;
  biometricPassed?: boolean;

  // Step 4: Proof of Work
  proofOfWorkUris?: string[];
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

export interface ProviderMetadata {
  role: 'provider';
  providerVerified?: boolean;
  onboardingStep?: OnboardingStep;
  kycData?: KycData;
}
