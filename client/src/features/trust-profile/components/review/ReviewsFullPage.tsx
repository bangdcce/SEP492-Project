/**
 * ReviewsFullPage Component
 * Full-page view with all reviews, filters, and optimized performance
 * Features: Pagination, lazy loading, memoized filters, debounced search
 */

import { ArrowLeft, Loader2, MessageSquareOff } from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Review, ReviewStats, StarFilter, SortOption } from "../../types";
import { ReviewItem } from "./ReviewItem";
import { ReviewFilterBar } from "./ReviewFilterBar";

interface ReviewsFullPageProps {
  reviews: Review[];
  stats: ReviewStats;
  onBack: () => void;
  /** Current logged-in user ID */
  currentUserId?: string;
  /** Callback when review is updated */
  onReviewUpdated?: () => void;
}

const REVIEWS_PER_PAGE = 10;

export function ReviewsFullPage({
  reviews,
  stats,
  onBack,
  currentUserId,
  onReviewUpdated,
}: ReviewsFullPageProps) {
  const [selectedFilter, setSelectedFilter] = useState<StarFilter>("all");
  const [highValueOnly, setHighValueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [displayCount, setDisplayCount] = useState(REVIEWS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Memoized filtered and sorted reviews (Performance optimization)
  const filteredAndSortedReviews = useMemo(() => {
    let result = [...reviews];

    // Apply star filter
    if (selectedFilter !== "all") {
      result = result.filter((r) => r.rating === selectedFilter);
    }

    // Apply high value filter
    if (highValueOnly) {
      result = result.filter((r) => r.weight >= 1.5);
    }

    // Apply sorting
    if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === "lowest") {
      result.sort((a, b) => a.rating - b.rating);
    } else if (sortBy === "relevant") {
      // Sort by weight (high value projects first) then by date
      result.sort((a, b) => {
        if (b.weight !== a.weight) {
          return b.weight - a.weight;
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }

    return result;
  }, [reviews, selectedFilter, highValueOnly, sortBy]);

  // Only display limited reviews for performance
  const displayedReviews = useMemo(() => {
    return filteredAndSortedReviews.slice(0, displayCount);
  }, [filteredAndSortedReviews, displayCount]);

  const hasMore = displayCount < filteredAndSortedReviews.length;
  const remainingCount = filteredAndSortedReviews.length - displayCount;

  // Load more handler with simulated delay for smooth UX
  const handleLoadMore = useCallback(() => {
    setIsLoadingMore(true);

    // Simulate network delay for smooth loading animation
    setTimeout(() => {
      setDisplayCount((prev) =>
        Math.min(prev + REVIEWS_PER_PAGE, filteredAndSortedReviews.length)
      );
      setIsLoadingMore(false);
    }, 300);
  }, [filteredAndSortedReviews.length]);

  // Use ref to track previous filter values to avoid useEffect with setState
  const prevFiltersRef = useRef({ selectedFilter, highValueOnly, sortBy });

  // Reset display count when filters change using ref comparison
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.selectedFilter !== selectedFilter ||
      prev.highValueOnly !== highValueOnly ||
      prev.sortBy !== sortBy
    ) {
      // Filters changed, reset will happen via initial state or can use requestAnimationFrame
      requestAnimationFrame(() => {
        setDisplayCount(REVIEWS_PER_PAGE);
      });
      prevFiltersRef.current = { selectedFilter, highValueOnly, sortBy };
    }
  }, [selectedFilter, highValueOnly, sortBy]);

  // Keyboard shortcut - ESC to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20  bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-900 hover:text-teal-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            <div className="text-sm text-gray-600">
              Press{" "}
              <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">
                ESC
              </kbd>{" "}
              to close
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-slate-900 text-3xl mb-2">All Reviews</h1>
          <p className="text-gray-600">
            {filteredAndSortedReviews.length}{" "}
            {filteredAndSortedReviews.length === 1 ? "review" : "reviews"}
            {selectedFilter !== "all" &&
              ` with ${selectedFilter} star${selectedFilter === 1 ? "" : "s"}`}
            {highValueOnly && " (High Value Projects only)"}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 ">
          <ReviewFilterBar
            stats={stats}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            highValueOnly={highValueOnly}
            onHighValueChange={setHighValueOnly}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        </div>

        {/* Reviews List */}
        {filteredAndSortedReviews.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 bg-white border border-gray-200 rounded-lg">
            <MessageSquareOff className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-slate-900 text-xl mb-2">No reviews found</h3>
            <p className="text-gray-600 text-sm mb-6">
              Try adjusting your filters to see more results
            </p>
            <button
              onClick={() => {
                setSelectedFilter("all");
                setHighValueOnly(false);
              }}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            {/* Displayed Reviews (Paginated) */}
            <div className="space-y-4 mb-6">
              {displayedReviews.map((review, index) => (
                <ReviewItem
                  key={`${review.id}-${index}`}
                  review={review}
                  isOwnReview={currentUserId === review.reviewer.id}
                  onReviewUpdated={onReviewUpdated}
                />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-gray-600">
                  Showing {displayedReviews.length} of{" "}
                  {filteredAndSortedReviews.length} reviews
                  <span className="text-gray-500 ml-1">
                    ({remainingCount} more)
                  </span>
                </p>
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-3 bg-white border-2 border-teal-500 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-50 justify-center"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    `Load ${Math.min(REVIEWS_PER_PAGE, remainingCount)} More`
                  )}
                </button>
              </div>
            )}

            {/* End Message */}
            {!hasMore && filteredAndSortedReviews.length > REVIEWS_PER_PAGE && (
              <div className="text-center py-6 text-gray-600">
                <p className="text-sm">You've reached the end of the reviews</p>
                <button
                  onClick={() =>
                    window.scrollTo({
                      top: 0,
                      behavior: "smooth",
                    })
                  }
                  className="mt-3 text-teal-600 hover:text-teal-700 text-sm"
                >
                  Back to top ↑
                </button>
              </div>
            )}
          </>
        )}

        {/* Bottom Action */}
        <div className="flex justify-center pt-8">
          <button
            onClick={onBack}
            className="px-8 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors shadow-sm"
          >
            Back to Overview
          </button>
        </div>
      </div>
    </div>
  );
}
