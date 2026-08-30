import { useMemo, useState } from "react";
import type { ReactNode, CSSProperties } from "react";

type SortDirection = "asc" | "desc";

export interface Column<T> {
  title: string;
  accessor: keyof T;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  align?: "left" | "center" | "right";
  render?: (value: T[keyof T], row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  maxHeight?: number | string;
  selectable?: boolean;
  actions?: (row: T) => ReactNode;
}

export function DataTable<T extends object>({
  columns,
  data,
  pageSize = 5,
  maxHeight = "55vh",
  selectable = false,
  actions,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);

  const [sort, setSort] = useState<{
    field?: keyof T;
    direction: SortDirection;
  }>({
    direction: "asc",
  });

  const [filters, setFilters] = useState<Partial<Record<keyof T, string>>>({});

  const filteredData = useMemo(() => {
    return data.filter((row) =>
      columns.every((column) => {
        const filter = filters[column.accessor];

        if (!filter) return true;

        return String(row[column.accessor])
          .toLowerCase()
          .includes(filter.toLowerCase());
      }),
    );
  }, [data, filters, columns]);

  const sortedData = useMemo(() => {
    if (!sort.field) return filteredData;

    return [...filteredData].sort((a, b) => {
      const comparison = String(a[sort.field!]).localeCompare(
        String(b[sort.field!]),
      );
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sort]);

  const paginated = useMemo(() => {
    const start = page * pageSize;

    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  function toggleSort(field: keyof T) {
    setSort((old) => ({
      field,
      direction:
        old.field === field && old.direction === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <div style={styles.wrapper}>
      <div style={{ ...styles.tableViewport, maxHeight }}>
        <table style={styles.table}>
        <thead>
          <tr>
            {selectable && (
              <th style={styles.th}>
                <input type="checkbox" />
              </th>
            )}

            {columns.map((column) => (
              <th
                key={String(column.accessor)}
                style={{
                  ...styles.th,
                  width: column.width,
                  textAlign: column.align ?? "left",
                }}
                onClick={() =>
                  column.sortable !== false && toggleSort(column.accessor)
                }
              >
                <div style={styles.header}>
                  {column.title}

                  {sort.field === column.accessor &&
                    (sort.direction === "asc" ? "▲" : "▼")}
                </div>

                {column.filterable !== false && (
                  <input
                    style={styles.input}
                    placeholder="Filtrar..."
                    value={filters[column.accessor] ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setFilters((old) => ({
                        ...old,
                        [column.accessor]: e.target.value,
                      }))
                    }
                  />
                )}
              </th>
            ))}

            {actions && <th style={styles.th}>Ações</th>}
          </tr>
        </thead>

        <tbody>
          {paginated.length === 0 && (
            <tr>
              <td
                style={{ ...styles.td, textAlign: "center", color: "#64748B" }}
                colSpan={
                  columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)
                }
              >
                Nenhum registro encontrado.
              </td>
            </tr>
          )}
          {paginated.map((row, index) => (
            <tr key={index}>
              {selectable && (
                <td style={styles.td}>
                  <input type="checkbox" />
                </td>
              )}

              {columns.map((column) => (
                <td
                  key={String(column.accessor)}
                  style={{
                    ...styles.td,
                    textAlign: column.align ?? "left",
                  }}
                >
                  {column.render
                    ? column.render(row[column.accessor], row)
                    : String(row[column.accessor])}
                </td>
              ))}

              {actions && <td style={styles.td}>{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      <div style={styles.pagination}>
        <button
          style={styles.button}
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          ◀
        </button>

        <span>
          Página {page + 1} de{" "}
          {Math.max(1, Math.ceil(sortedData.length / pageSize))}
        </span>

        <button
          style={styles.button}
          disabled={page >= Math.ceil(sortedData.length / pageSize) - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    border: "1px solid #DDD",
    borderRadius: 8,
    overflow: "hidden",
    background: "#FFF",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  tableViewport: {
    overflowX: "auto",
    overflowY: "auto",
  },

  th: {
    padding: 16,
    background: "#FAFAFA",
    borderBottom: "1px solid #DDD",
    fontWeight: 600,
    verticalAlign: "top",
    cursor: "pointer",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },

  td: {
    padding: 16,
    borderBottom: "1px solid #EEE",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  input: {
    width: "100%",
    padding: 6,
    borderRadius: 4,
    border: "1px solid #CCC",
    boxSizing: "border-box",
  },

  pagination: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },

  button: {
    padding: "6px 12px",
    cursor: "pointer",
  },
};
