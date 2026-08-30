import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  className?: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;

  onChange(value: string): void;
}

export function Select({
  className = "",
  value,
  options,
  placeholder = "Selecione...",
  disabled = false,
  onChange,
}: SelectProps) {
  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(event: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const positionMenu = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 6;
    const availableBelow = window.innerHeight - rect.bottom - gap - 12;
    const availableAbove = rect.top - gap - 12;
    const openAbove = availableBelow < 160 && availableAbove > availableBelow;
    setMenuStyle({
      position: "fixed",
      left: rect.left,
      right: "auto",
      top: openAbove ? "auto" : rect.bottom + gap,
      bottom: openAbove ? window.innerHeight - rect.top + gap : "auto",
      width: rect.width,
      maxHeight: Math.max(96, Math.min(240, openAbove ? availableAbove : availableBelow)),
      zIndex: 10001,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, positionMenu]);

  return (
    <div ref={ref} className={`custom-select ${className}`}>
      <button
        type="button"
        disabled={disabled}
        className={`select-selected ${open ? "active" : ""}`}
        onClick={() => setOpen(!open)}
      >
        {selected?.label ?? placeholder}

        <span className="select-arrow">▼</span>
      </button>

      {open && createPortal(
        <div ref={menuRef} className="select-items" style={menuStyle}>
          {options.map((option) => (
            <div
              key={option.value}
              className={option.value === value ? "same-as-selected" : ""}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
