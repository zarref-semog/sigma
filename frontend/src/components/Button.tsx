import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  children: ReactNode;
}

export function Button({
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}