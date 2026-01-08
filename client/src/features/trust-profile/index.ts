/**
 * Trust Profile Feature
 * Complete trust profile management with reviews, ratings, and reputation
 *
 * Structure:
 * ├── index.ts                    # Barrel export (this file)
 * ├── api.ts                      # API layer
 * ├── types.ts                    # TypeScript types
 * ├── hooks/                      # Custom hooks
 * │   └── useReviews.ts           # Data fetching logic
 * ├── pages/                      # Full-page views
 * │   ├── ReviewDetailPage.tsx
 * │   └── ReviewEditHistoryPage.tsx
 * ├── sections/                   # Large sections (có thể dùng độc lập)
 * │   └── TrustProfileSection.tsx
 * ├── modals/                     # Modal dialogs
 * │   ├── CreateReviewModal.tsx
 * │   ├── EditReviewModal.tsx
 * │   └── ReportAbuseModal.tsx
 * └── components/                 # Reusable UI components
 *     ├── ui/                     # Atomic (nhỏ nhất)
 *     │   ├── StarRating.tsx
 *     │   ├── TrustBadge.tsx
 *     │   └── DiffViewer.tsx
 *     └── review/                 # Liên quan đến review
 *         ├── ReviewItem.tsx
 *         ├── ReviewFilterBar.tsx
 *         ├── ReviewsFullPage.tsx
 *         └── TrustScoreCard.tsx
 */

// Types
export * from "./types";

// API
export * from "./api";

// Hooks
export * from "./hooks";

// Pages
export * from "./pages";

// Sections
export * from "./sections";

// Modals
export * from "./modals";

// Components
export * from "./components";
