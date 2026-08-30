import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, isAdmin } from "../api";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CrudActions } from "../components/CrudActions";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { Select } from "../components/Select";

type Role = "admin" | "maintenance" | "operator" | "designer" | "viewer";
type User = {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  role: Role;
  isActive: boolean;
};
const empty = {
  firstName: "",
  surname: "",
  email: "",
  password: "",
  role: "viewer" as Role,
  isActive: true,
};
const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  maintenance: "Manutenção",
  operator: "Operador",
  designer: "Designer",
  viewer: "Visualizador",
};
const columns: Column<User>[] = [
  { title: "ID", accessor: "id", width: 120 },
  {
    title: "Nome",
    accessor: "firstName",
    render: (_, u) => `${u.firstName} ${u.surname}`,
  },
  { title: "E-mail", accessor: "email" },
  { title: "Função", accessor: "role", render: (v) => roleLabels[v as Role] },
  {
    title: "Situação",
    accessor: "isActive",
    render: (v) => (v ? "Ativo" : "Inativo"),
  },
];
export function UserScreen() {
  const admin = isAdmin();
  const [items, setItems] = useState<User[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const load = useCallback(
    () =>
      apiFetch("/api/users")
        .then((r) => {
          if (!r.ok) throw new Error("Não foi possível carregar os usuários.");
          return r.json();
        })
        .then((data) =>
          setItems(
            data.map((u: Record<string, unknown>) => ({
              id: String(u._id),
              firstName: String(u.firstName),
              surname: String(u.surname),
              email: String(u.email),
              role: u.role as Role,
              isActive: Boolean(u.isActive),
            })),
          ),
        )
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    if (admin) load();
  }, [admin, load]);
  function close() {
    setOpen(false);
    setEditing(null);
    setForm(empty);
    setError("");
  }
  function edit(u: User) {
    setEditing(u.id);
    setForm({ ...u, password: "" });
    setOpen(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        ...(editing && !form.password ? { password: undefined } : {}),
      };
      const r = await apiFetch(`/api/users${editing ? `/${editing}` : ""}`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await r.json();
      if (!r.ok)
        throw new Error(b.message || "Não foi possível salvar o usuário.");
      close();
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }
  async function remove(u: User) {
    setSaving(true);
    const r = await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (r.ok) {
      setDeleting(null);
      load();
    } else setError((await r.json()).message);
    setSaving(false);
  }
  return (
    <>
      <div className="screen-heading">
        <h1>Usuários</h1>
        {admin && (
          <Button className="button" onClick={() => setOpen(true)}>
            Novo Usuário
          </Button>
        )}
      </div>
      {error && <p className="project-error">{error}</p>}
      <ConfirmDialog
        open={Boolean(deleting)}
        message={`Excluir o usuário "${deleting?.email ?? ""}"?`}
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
      />
      <Modal
        open={open}
        title={editing ? "Editar usuário" : "Adicionar usuário"}
        onClose={close}
        loading={saving}
        footer={
          <>
            <Button className="button button-danger" onClick={close}>
              Cancelar
            </Button>
            <Button
              className="button button-success"
              onClick={() => {
                (
                  document.getElementById("user-form") as HTMLFormElement
                )?.requestSubmit();
              }}
            >
              Salvar
            </Button>
          </>
        }
      >
        <form id="user-form" className="crud-form" onSubmit={submit}>
          <label>
            Nome
            <input
              className="input"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              minLength={3}
              required
            />
          </label>
          <label>
            Sobrenome
            <input
              className="input"
              value={form.surname}
              onChange={(e) => setForm({ ...form, surname: e.target.value })}
              minLength={3}
              required
            />
          </label>
          <label>
            E-mail
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Senha
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8}
              required={!editing}
              placeholder={editing ? "Deixe vazio para manter" : ""}
            />
          </label>
          <label>
            Função
            <Select
              value={form.role}
              options={Object.entries(roleLabels).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(role) =>
                setForm({ ...form, role: role as Role })
              }
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />{" "}
            Usuário ativo
          </label>
        </form>
      </Modal>
      <DataTable<User>
        columns={columns}
        data={items}
        pageSize={5}
        actions={
          admin
            ? (u) => (
                <CrudActions
                  label={u.email}
                  onEdit={() => edit(u)}
                  onDelete={() => setDeleting(u)}
                />
              )
            : undefined
        }
      />
    </>
  );
}
