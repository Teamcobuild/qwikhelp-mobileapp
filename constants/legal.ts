// In-app Terms of Service and Privacy Policy. Keep in step with the public copies linked from the store listing.
// Drafted from how the app actually works; have them reviewed by a Nigerian lawyer before relying on them.

export const SUPPORT_EMAIL = 'cobuildofficial@hotmail.com';
export const LEGAL_UPDATED = '4 November 2026';

export interface LegalDoc {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}

export const TERMS: LegalDoc = {
  title: 'Terms of Service',
  intro:
    'These terms are an agreement between you and QwikHelp ("QwikHelp", "we", "us"). By creating an account or using the app you agree to them. If you do not agree, please do not use QwikHelp.',
  sections: [
    {
      heading: '1. What QwikHelp does',
      body: [
        'QwikHelp is a marketplace that connects customers who need a service (such as cleaning, cooking, laundry, plumbing, electrical repairs, gardening, carpentry, companionship or tour guiding) with independent service providers nearby.',
        'Providers are independent professionals, not employees or agents of QwikHelp. The provider is responsible for the service they deliver. QwikHelp provides the platform, payments and support.',
      ],
    },
    {
      heading: '2. Accounts',
      body: [
        'You must be at least 18 years old and give accurate information. You are responsible for activity on your account and for keeping your login details safe.',
        'Providers must complete identity verification. We may suspend or remove any provider whose details cannot be verified or who breaks these terms.',
      ],
    },
    {
      heading: '3. Requests, offers and bookings',
      body: [
        'Customers post a request with a proposed workmanship fee. Nearby providers may accept it or make one counter offer, and the customer may make one final counter. A booking is only confirmed once the customer has paid.',
        'Prices cover workmanship only. Paying for materials and parts in the app is coming soon; until then any materials must be agreed directly and are outside QwikHelp payment protection.',
      ],
    },
    {
      heading: '4. Payments and payment protection',
      body: [
        'Customers pay the agreed price through our payment partner, Paystack. QwikHelp does not charge customers any extra service fee.',
        'Payment is held by QwikHelp and released to the provider only after the customer confirms the job is done, or automatically 5 hours after the provider marks it done if the customer does not respond.',
        'QwikHelp keeps a commission of 10% of the agreed price. The provider receives the remaining 90% in their QwikHelp wallet and can withdraw it to a Nigerian bank account. Bank transfer fees charged by our payment partner are deducted from each withdrawal and shown before you confirm.',
      ],
    },
    {
      heading: '5. Cancellations and refunds',
      body: [
        'A customer may cancel a paid booking in the app before the provider checks in at the job address and receive a full refund to the original payment method.',
        'If a provider cancels a paid booking, the customer receives a full refund.',
        'Once the provider has checked in, the booking cannot be cancelled in the app. Contact support if something goes wrong.',
        'Refunds are processed by Paystack and may take several working days to appear, depending on your bank.',
      ],
    },
    {
      heading: '6. Keeping it on QwikHelp',
      body: [
        'To protect both sides, all communication and payment for jobs found on QwikHelp must stay in the app. Sharing phone numbers, emails, bank details or social media handles in chat is not allowed; we automatically hide contact details, and repeated attempts may pause your account.',
        'Payments made outside QwikHelp are not protected and are not eligible for refunds or support.',
      ],
    },
    {
      heading: '7. Your conduct',
      body: [
        'Treat everyone with respect. Harassment, discrimination, fraud, unsafe work, illegal services and misuse of the app are not allowed and may lead to suspension or permanent removal.',
        'Companion services are strictly non-sexual social companionship. Any other request is prohibited and will be reported where required by law.',
      ],
    },
    {
      heading: '8. Liability',
      body: [
        'QwikHelp is not a party to the service agreement between customer and provider and is not responsible for the quality, safety or legality of services, except as required by Nigerian law.',
        'To the extent permitted by law, our total liability to you for any claim is limited to the amount you paid through QwikHelp for the booking concerned.',
      ],
    },
    {
      heading: '9. Ending your account',
      body: [
        'You can delete your account at any time from Settings. Some records, such as payment history, are kept where the law requires it. We may suspend or close accounts that break these terms.',
      ],
    },
    {
      heading: '10. Changes and governing law',
      body: [
        'We may update these terms and will tell you in the app when we do. These terms are governed by the laws of the Federal Republic of Nigeria.',
        `Questions? Email ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  intro:
    'This policy explains what personal data QwikHelp collects, why, and your rights under the Nigeria Data Protection Act 2023.',
  sections: [
    {
      heading: '1. Data we collect',
      body: [
        'Account details: your name, email address and profile photo.',
        'Location: your approximate and precise location when you use the app, so we can match you with nearby providers or jobs. A customer\'s exact job address is shared only with the provider they have booked and paid for.',
        'Job details: descriptions, photos you upload, dates, prices, offers and booking history.',
        'Messages: chats between customers and providers. Chats are stored on our servers, checked automatically for contact details, and may be reviewed by our team to keep users safe.',
        'Provider verification: identity document type and number (such as NIN, BVN, driver\'s licence or voter\'s card), date of birth, ID photos, a selfie, work photos and service details.',
        'Payments: payment status and amounts. Card details are handled by Paystack and never stored by QwikHelp. For providers we store the bank name, account number and account name used for payouts.',
        'Device data: push notification tokens and basic technical information used to keep the app working and fix crashes.',
      ],
    },
    {
      heading: '2. How we use it',
      body: [
        'To run the marketplace: matching, offers, bookings, chat, notifications and payments.',
        'To verify providers and keep the platform safe, including preventing fraud and off-platform payments.',
        'To provide support and to meet legal, tax and accounting obligations.',
      ],
    },
    {
      heading: '3. Who we share it with',
      body: [
        'The other person in your booking sees what they need: providers see the customer\'s first name, job details and, after payment, the exact address; customers see the provider\'s name, photo and verification status.',
        'Service providers who process data for us: Clerk (sign-in), Supabase (database and file storage), Paystack (payments and payouts), Expo (push notifications) and our AI assistant provider (only the messages you send to the assistant).',
        'Authorities, where required by law. We do not sell your personal data.',
      ],
    },
    {
      heading: '4. How long we keep it',
      body: [
        'We keep your data while your account is active. When you delete your account we delete or anonymise your profile, photos, verification documents and messages, except records we must keep by law (such as payment and transaction records), which are kept only as long as required.',
      ],
    },
    {
      heading: '5. Your rights',
      body: [
        'You can access, correct or delete your data, object to certain uses and withdraw consent. You can edit your profile in the app and delete your account from Settings.',
        `For anything else, email ${SUPPORT_EMAIL}. You may also complain to the Nigeria Data Protection Commission.`,
      ],
    },
    {
      heading: '6. Security',
      body: [
        'Data is encrypted in transit, access is restricted by account, and verification documents are stored in private storage. No system is perfectly secure, so please keep your login details safe.',
      ],
    },
    {
      heading: '7. Changes',
      body: ['We will tell you in the app about important changes to this policy.'],
    },
  ],
};
