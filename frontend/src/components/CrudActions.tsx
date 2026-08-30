interface CrudActionsProps {
  label: string;
  onEdit(): void;
  onDelete(): void;
}

export function CrudActions({ label, onEdit, onDelete }: CrudActionsProps) {
  return (
    <div className="project-actions">
      <button
        className="button-icon"
        title={`Editar ${label}`}
        aria-label={`Editar ${label}`}
        onClick={onEdit}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        className="button-icon project-delete"
        title={`Excluir ${label}`}
        aria-label={`Excluir ${label}`}
        onClick={onDelete}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
        </svg>
      </button>
    </div>
  );
}
