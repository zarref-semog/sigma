import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  loading?: boolean;
  confirmLabel?: string;
  onCancel(): void;
  onConfirm(): void;
}

export function ConfirmDialog({
  open,
  title = "Confirmar exclusão",
  message,
  loading = false,
  confirmLabel = "Excluir",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      width={480}
      loading={loading}
      closeOnBackdrop={!loading}
      onClose={loading ? () => undefined : onCancel}
      footer={
        <>
          <Button className="button" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            className="button button-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}
