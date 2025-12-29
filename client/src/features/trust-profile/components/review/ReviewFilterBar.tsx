/**
 * ReviewFilterBar Component
 * Sticky filter and sort bar for the Reviews Modal
 * Features: Star filters, High Value toggle, Sort dropdown
 */

import { Gem, ChevronDown } from "lucide-react";
import type { StarFilter, SortOption, ReviewStats } from "../../types";

interface ReviewFilterBarProps {
  // stats is passed but reserved for future use (e.g., showing counts per star)
  stats?: ReviewStats;
  selectedFilter: StarFilter;
  onFilterChange: (filter: StarFilter) => void;
  highValueOnly: boolean;
  onHighValueChange: (value: boolean) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function ReviewFilterBar({
  selectedFilter,
  onFilterChange,
  highValueOnly,
  onHighValueChange,
  sortBy,
  onSortChange,
}: ReviewFilterBarProps) {
  const filterOptions: { value: StarFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: 5, label: "5 Stars" },
    { value: 4, label: "4 Stars" },
    { value: 3, label: "3 Stars" },
    { value: 2, label: "2 Stars" },
    { value: 1, label: "1 Star" },
  ];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "relevant", label: "Most Relevant" },
    { value: "lowest", label: "Lowest Rating" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Filter Chips */}
      <div className="flex items-center gap-3 mb-3 overflow-x-auto pb-2">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onFilterChange(option.value)}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
              selectedFilter === option.value
                ? "bg-teal-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {option.label}
          </button>
        ))}

        {/* High Value Toggle */}
        <button
          onClick={() => onHighValueChange(!highValueOnly)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all
            ${
              highValueOnly
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }
          `}
        >
          <Gem className="w-4 h-4" />
          High Value Only
        </button>
      </div>
      {/* Sort Dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Sort by:</span>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="
              appearance-none bg-white border border-gray-300 rounded-lg 
              px-3 py-1.5 pr-8 text-sm text-slate-900
              hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500
              cursor-pointer
            "
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
