import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  rating: number;
  editable?: boolean;
  onChange?: (rating: number) => void;
  testIdPrefix?: string;
}

export function StarRating({
  rating,
  editable = false,
  onChange,
  testIdPrefix,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const handleClick = (index: number) => {
    if (editable && onChange) {
      onChange(index + 1);
    }
  };

  const handleMouseMove = (index: number) => {
    if (editable) {
      setHoverRating(index + 1);
    }
  };

  const handleMouseLeave = () => {
    if (editable) {
      setHoverRating(null);
    }
  };

  const displayRating = hoverRating !== null ? hoverRating : rating;

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const isFullFilled = displayRating >= starValue;
    const partialFill =
      !editable && displayRating > starValue - 1 && displayRating < starValue
        ? (displayRating - (starValue - 1)) * 100
        : 0;
    const starTestId = testIdPrefix ? `${testIdPrefix}-star-${starValue}` : undefined;

    if (isFullFilled) {
      return (
        <Star
          key={index}
          data-testid={starTestId}
          aria-label={editable ? `Rate ${starValue} star${starValue === 1 ? "" : "s"}` : undefined}
          className={`w-5 h-5 transition-colors ${
            editable ? "cursor-pointer" : ""
          } fill-yellow-400 text-yellow-400`}
          onClick={() => handleClick(index)}
          onMouseEnter={() => handleMouseMove(index)}
          onMouseLeave={handleMouseLeave}
        />
      );
    }

    if (partialFill > 0) {
      return (
        <div key={index} className="relative" data-testid={starTestId}>
          <Star className="w-5 h-5 fill-none text-gray-300" />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${partialFill}%` }}
          >
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 pointer-events-none" />
          </div>
        </div>
      );
    }

    return (
      <Star
        key={index}
        data-testid={starTestId}
        aria-label={editable ? `Rate ${starValue} star${starValue === 1 ? "" : "s"}` : undefined}
        className={`w-5 h-5 transition-colors ${
          editable ? "cursor-pointer" : ""
        } fill-none text-gray-300`}
        onClick={() => handleClick(index)}
        onMouseEnter={() => handleMouseMove(index)}
        onMouseLeave={handleMouseLeave}
      />
    );
  };

  return (
    <div
      className="flex items-center gap-1"
      data-testid={testIdPrefix ? `${testIdPrefix}-widget` : undefined}
    >
      {[...Array(5)].map((_, index) => renderStar(index))}
      <span className="ml-2 text-gray-600">{displayRating.toFixed(1)}/5.0</span>
    </div>
  );
}
