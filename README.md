# QwikHelp

QwikHelp is a dynamic, dual-role on-demand service marketplace built with React Native and Expo. It seamlessly connects customers seeking immediate assistance with verified service providers across various categories. The platform is designed to facilitate quick bookings, real-time negotiations, and secure service delivery.

## Core Value Proposition

QwikHelp acts as a two-sided marketplace addressing the friction in local service discovery and fulfillment:
1. **For Customers**: A streamlined interface to browse services, broadcast requests, negotiate pricing in real-time, and manage bookings.
2. **For Service Providers**: A dedicated professional toolkit to discover local jobs, submit offers, manage earnings, and build a verified profile.

## Technical Architecture

QwikHelp is built on a modern mobile tech stack emphasizing performance, type safety, and seamless user experiences.

### Core Technologies
*   **Framework**: [React Native](https://reactnative.dev/) powered by [Expo](https://expo.dev/) (leveraging the New Architecture and React Compiler for enhanced performance).
*   **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) with typed routes, enabling robust file-based navigation and deep linking capabilities out of the box.
*   **Authentication & Identity**: [Clerk](https://clerk.com/) (`@clerk/clerk-expo`) handles secure user authentication, session management, and JWTs.
*   **Styling**: [NativeWind](https://www.nativewind.dev/) (Tailwind CSS) for utility-first, responsive, and consistent UI design across iOS and Android.
*   **Animations**: `react-native-reanimated` for fluid, high-performance gesture-driven animations and UI transitions.

### System Design Highlights

#### Dual-Role Ecosystem
The application implements a bifurcated routing architecture that adapts the environment based on the authenticated user's role:
*   **Customer Environment**: Tailored tab navigation focusing on discovery, booking history, and active job management.
*   **Provider Environment**: A dedicated workspace featuring a performance dashboard, active job queue, and an earnings tracker.
*   **Provider Onboarding Pipeline**: A strict, multi-step verification flow (ID upload, NIN/BVN verification, and facial recognition) ensuring platform trust and safety before providers can accept jobs.

#### Real-Time Interactions & State
*   **Bargain & Offer System**: A unique negotiation engine allowing customers and providers to dynamically discuss terms and pricing before finalizing a booking.
*   **Contextual State Management**: Dedicated React Contexts (`LocationContext`, `NotificationContext`) manage global state requiring frequent updates, such as user geolocation tracking and in-app event handling.
*   **Chat & Dispute Resolution**: Integrated real-time messaging between parties, backed by a structured dispute resolution flow to handle conflicts transparently.

#### Modular Component Architecture
The user interface is built on a custom, reusable presentation layer:
*   **Interactive Modals**: A suite of custom, accessible overlays (`TimePickerModal`, `DatePickerModal`, `LocationModal`) replacing standard OS dialogs for a cohesive brand experience.
*   **Design System Elements**: Standardized `Typography`, `Button`, `OfferCard`, and `Input` components styled via NativeWind, ensuring UI consistency across the application.

## Security & Trust
*   **Secure Caching**: Utilizing `expo-secure-store` for encrypted local storage of sensitive session data and authentication tokens.
*   **Identity Verification**: The platform implements KYC (Know Your Customer) processes during provider onboarding to maintain a secure and trustworthy marketplace.
