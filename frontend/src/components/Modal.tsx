import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  title: string;

  children: ReactNode;

  footer?: ReactNode;

  width?: number | string;

  loading?: boolean;

  closeOnBackdrop?: boolean;

  onClose(): void;
}

export function Modal({
  open,
  title,
  children,
  footer,
  width = 700,
  loading = false,
  closeOnBackdrop = true,
  onClose,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEsc);

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      style={styles.overlay}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={ref}
        style={{
          ...styles.modal,
          width,
        }}
      >
        <header style={styles.header}>
          <h2
            style={{
              margin: 0,
            }}
          >
            {title}
          </h2>

          <button onClick={onClose} style={styles.close}>
            ✕
          </button>
        </header>

        <main style={styles.body}>{children}</main>

        {footer && <footer style={styles.footer}>{footer}</footer>}

        {loading && <div style={styles.loading}>Carregando...</div>}
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",

    display: "flex",
    justifyContent: "center",
    alignItems: "center",

    zIndex: 9999,
  },

  modal: {
    position: "relative",
    background: "#FFF",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 12px 40px rgba(0,0,0,.25)",
    maxHeight: "90vh",
    maxWidth: "calc(100vw - 32px)",
  },

  header: {
    padding: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #EEE",
  },

  body: {
    padding: 24,
    overflowY: "auto",
    flex: 1,
    width: "100%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
  },

  footer: {
    padding: 20,
    borderTop: "1px solid #EEE",
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
  },

  close: {
    width: 36,
    height: 36,
    cursor: "pointer",
    border: "none",
    borderRadius: 8,
    background: "#F4F4F4",
    fontSize: 18,
  },

  loading: {
    position: "absolute",
    inset: 0,
    background: "rgba(255,255,255,.75)",

    display: "flex",
    justifyContent: "center",
    alignItems: "center",

    fontWeight: 600,
  },
};
