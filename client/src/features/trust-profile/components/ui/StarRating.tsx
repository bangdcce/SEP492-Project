import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  rating: number;
  editable?: boolean;
  onChange?: (rating: number) => void;
}

export function StarRating({
  rating,
  editable = false,
  onChange,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const handleClick = (index: number) => {
    if (editable && onChange) {
      // Editable mode: Only whole numbers (1, 2, 3, 4, 5)
      onChange(index + 1);
    }
  };
  const handleMouseMove = (index: number) => {
    if (editable) {
      // Editable mode: Only show full star on hover
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

    // Calculate partial fill percentage for read-only mode
    const partialFill =
      !editable && displayRating > starValue - 1 && displayRating < starValue
        ? (displayRating - (starValue - 1)) * 100
        : 0;
    if (isFullFilled) {
      // Full star
      return (
        <Star
          key={index}
          className={`w-5 h-5 transition-colors $ {editable ? 'cursor-pointer': ''} fill-yellow-400 text-yellow-400`}
          onClick={() => handleClick(index)}
          onMouseEnter={() => handleMouseMove(index)}
          onMouseLeave={handleMouseLeave}
        />
      );
    } else if (partialFill > 0) {
      // Partial star (only for read-only mode) - displays any percentage from 0-100%
      return (
        <div key={index} className="relative">
          {/* Layer 1: Sao rỗng (nền xám) */}
          <Star className="w-5 h-5 fill-none text-gray-300" />
          {/* Layer 2: Sao vàng bị cắt theo % */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${partialFill}%` }}
          >
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 pointer-events-none" />
          </div>
        </div>
      );
    } else {
      // Empty star
      return (
        <Star
          key={index}
          className={`w-5 h-5 transition-colors ${
            editable ? "cursor-pointer" : ""
          } fill-none text-gray-300`}
          onClick={() => handleClick(index)}
          onMouseEnter={() => handleMouseMove(index)}
          onMouseLeave={handleMouseLeave}
        />
      );
    }
  };
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, index) => renderStar(index))}
      <span className="ml-2 text-gray-600">{displayRating.toFixed(1)}/5.0</span>
    </div>
  );
}
