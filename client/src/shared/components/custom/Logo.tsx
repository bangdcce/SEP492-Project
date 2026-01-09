import React from "react";

// Logo in public folder - use absolute path
const logoImage = "/assets/logo/Logo.png";

interface LogoProps {
  className?: string;
  alt?: string;
  isCollapsed?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({
  className = "",
  alt = "InterDev",
  size = 'md',
}) => {
  const sizes = {
    sm: 'h-40',   // 40px
    md: 'h-90',   // 56px
    lg: 'h-50',   // 64px
  };

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={logoImage}
        alt={alt}
        className={`${sizes[size]} w-auto object-contain transition-all duration-300`}
      />
    </div>
  );
};
