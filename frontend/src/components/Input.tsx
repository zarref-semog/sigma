import type { ChangeEvent } from "react";

interface InputProps {
  className?: string;
  type?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function Input({
  className,
  type = "text",
  value,
  placeholder,
  disabled,
  onChange,
}: InputProps) {
  return (
    <input
      className={className}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
