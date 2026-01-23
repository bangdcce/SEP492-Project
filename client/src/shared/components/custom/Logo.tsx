import React from "react";

// Logo in public folder - use absolute path
const logoImage = "/assets/logo/Logo.png";
const logoIconImage = "/assets/logo/LogoIcon.png";

interface LogoProps {
  className?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: "full" | "icon";
  isCollapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = "",
  alt = "InterDev",
  size = "md",
  variant = "full",
}) => {
  const sizes = {
    sm: "h-40", // 40px
    md: "h-90", // 56px
    lg: "h-50", // 64px
  };

  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  };

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={variant === "icon" ? logoIconImage : logoImage}
        alt={alt}
        className={`${
          variant === "icon" ? iconSizes[size] : `${sizes[size]} w-auto`
        } object-contain transition-all duration-300`}
      />
    </div>
  );
};
