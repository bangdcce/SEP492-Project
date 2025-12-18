import React from "react";

// Logo in public folder - use absolute path
const logoImage = "/assets/logo/logo.png";

interface LogoProps {
  className?: string;
  alt?: string;
  isCollapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = "",
  alt = "InterDev",
}) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={logoImage}
        alt={alt}
        className="w-full h-full object-contain transition-all duration-300"
      />
    </div>
  );
};
