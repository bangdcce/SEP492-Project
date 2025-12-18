import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  children,
  className = " ",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantStyles = {
    primary: "bg-teal-500 text-white hover:bg-teal-600 focus:ring-teal-500",
    secondary:
      "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900",
    outline:
      "bg-white border border-gray-300 text-slate-900 hover:bg-gray-50 focus:ring-teal-500",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
