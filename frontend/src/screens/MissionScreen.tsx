import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { apiFetch, canManage } from "../api";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CrudActions } from "../components/CrudActions";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { Select, type SelectOption } from "../components/Select";

type Status = "Pending" | "In Progress" | "Completed" | "Cancelled" | "Failed";
type Priority = "Low" | "Medium" | "High";
type Mission = {
  id: string;
  projectId: string;
  projectName: string;
  source: string;
  sourceName: string;
  destination: string;
  destinationName: string;
  agv: string;
  priority: Priority;
  createdAt: string;
  status: Status;
};
type PointOption = SelectOption & { type: string };

const empty = {
  projectId: "",
  source: "",
  destination: "",
  priority: "Medium" as Priority,
  status: "Pending" as Status,
};
const statusLabels: Record<Status, string> = {
  Pending: "Pendente",
  "In Progress": "Em andamento",
  Completed: "Concluída",
  Cancelled: "Cancelada",
  Failed: "Falhou",
};
const priorityLabels: Record<Priority, string> = {
  Low: "Baixa",
  Medium: "Média",
  High: "Alta",
};

const columns: Column<Mission>[] = [
  { title: "ID", accessor: "id", width: 120 },
  { title: "Projeto", accessor: "projectName" },
  { title: "Origem", accessor: "sourceName" },
  { title: "Destino", accessor: "destinationName" },
  {
    title: "AGV",
    accessor: "agv",
    render: (value) => value || "Aguardando atribuição",
  },
  {
    title: "Prioridade",
    accessor: "priority",
    render: (value) => priorityLabels[value as Priority],
  },
  { title: "Criada em", accessor: "createdAt" },
  {
    title: "Situação",
    accessor: "status",
    render: (value) => statusLabels[value as Status],
  },
];

export function MissionScreen() {
  const canEdit = canManage("missions");
  const [items, setItems] = useState<Mission[]>([]);
  const [projects, setProjects] = useState<SelectOption[]>([]);
  const [points, setPoints] = useState<PointOption[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [deleting, setDeleting] = useState<Mission | null>(null);

  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.value, project.label])),
    [projects],
  );
  const load = useCallback(
    () =>
      apiFetch("/api/missions")
        .then((response) => {
          if (!response.ok)
            throw new Error("Não foi possível carregar as missões.");
          return response.json();
        })
        .then((data) =>
          setItems(
            data.map((mission: Record<string, unknown>) => ({
              id: String(mission._id),
              projectId: String(mission.projectId || ""),
              projectName:
                projectNames.get(String(mission.projectId || "")) ||
                "Projeto não informado",
              source: String(mission.source),
              sourceName: String(mission.sourceName || mission.source),
              destination: String(mission.destination),
              destinationName: String(
                mission.destinationName || mission.destination,
              ),
              agv: mission.agv ? String(mission.agv) : "",
              priority: mission.priority as Priority,
              status: mission.status as Status,
              createdAt: new Date(String(mission.createdAt)).toLocaleString(
                "pt-BR",
              ),
            })),
          ),
        )
        .catch((loadError) => setError(loadError.message)),
    [projectNames],
  );

  useEffect(() => {
    apiFetch("/api/projects")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Não foi possível carregar os projetos.")),
      )
      .then((data) =>
        setProjects(
          data.map((project: Record<string, unknown>) => ({
            value: String(project._id),
            label: String(project.name),
          })),
        ),
      )
      .catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!form.projectId) return;
    let active = true;
    apiFetch(`/api/projects/${form.projectId}/graph`)
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(
              new Error("Não foi possível carregar os pontos do projeto."),
            ),
      )
      .then((data) => {
        if (!active) return;
        setPoints(
          data.points.map((point: Record<string, unknown>) => ({
            value: String(point.id),
            label: `${String(point.name)} (${String(point.rfidTag)})`,
            type: String(point.type),
          })),
        );
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoadingPoints(false));
    return () => {
      active = false;
    };
  }, [form.projectId]);

  function close() {
    setOpen(false);
    setEditing(null);
    setForm(empty);
    setPoints([]);
    setLoadingPoints(false);
    setError("");
  }

  function edit(mission: Mission) {
    setEditing(mission.id);
    setPoints([]);
    setLoadingPoints(true);
    setForm({
      projectId: mission.projectId,
      source: mission.source,
      destination: mission.destination,
      priority: mission.priority,
      status: mission.status,
    });
    setOpen(true);
  }

  function selectProject(projectId: string) {
    setPoints([]);
    setLoadingPoints(Boolean(projectId));
    setForm((current) => ({
      ...current,
      projectId,
      source: "",
      destination: "",
    }));
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.source === form.destination) {
      setError("A origem e o destino devem ser diferentes.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(
        `/api/missions${editing ? `/${editing}` : ""}`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            sourceName:
              points.find((point) => point.value === form.source)?.label ||
              form.source,
            destinationName:
              points.find((point) => point.value === form.destination)?.label ||
              form.destination,
            agv: undefined,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Não foi possível salvar a missão.");

      close();
      await load();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erro ao salvar a missão.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(mission: Mission) {
    setSaving(true);
    const response = await apiFetch(`/api/missions/${mission.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setDeleting(null);
      load();
    } else setError((await response.json()).message);
    setSaving(false);
  }

  return (
    <>
      <div className="screen-heading">
        <h1>Missões</h1>
        {canEdit && (
          <Button className="button" onClick={() => setOpen(true)}>
            Nova Missão
          </Button>
        )}
      </div>
      {error && <p className="project-error">{error}</p>}
      <ConfirmDialog
        open={Boolean(deleting)}
        message="Excluir esta missão?"
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
      />
      <Modal
        open={open}
        title={editing ? "Editar missão" : "Adicionar missão"}
        onClose={close}
        loading={saving}
        footer={
          <>
            <Button className="button button-danger" onClick={close}>
              Cancelar
            </Button>
            <Button
              className="button button-success"
              onClick={() =>
                (
                  document.getElementById("mission-form") as HTMLFormElement
                )?.requestSubmit()
              }
              disabled={
                saving ||
                loadingPoints ||
                !form.projectId ||
                !form.source ||
                !form.destination
              }
            >
              Salvar
            </Button>
          </>
        }
      >
        {error && (
          <p className="project-error" role="alert">
            {error}
          </p>
        )}
        <form id="mission-form" className="crud-form" onSubmit={submit}>
          <label>
            Projeto
            <Select
              value={form.projectId}
              options={projects}
              placeholder="Selecione o projeto"
              onChange={selectProject}
            />
          </label>
          <label>
            Origem
            <Select
              value={form.source}
              options={points.filter(
                (point) => point.value !== form.destination,
              )}
              placeholder={
                loadingPoints ? "Carregando pontos..." : "Selecione a origem"
              }
              disabled={!form.projectId || loadingPoints}
              onChange={(source) => setForm({ ...form, source })}
            />
          </label>
          <label>
            Destino
            <Select
              value={form.destination}
              options={points.filter((point) => point.value !== form.source)}
              placeholder={
                loadingPoints ? "Carregando pontos..." : "Selecione o destino"
              }
              disabled={!form.projectId || loadingPoints}
              onChange={(destination) => setForm({ ...form, destination })}
            />
          </label>
          <label>
            Prioridade
            <Select
              value={form.priority}
              options={Object.entries(priorityLabels).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(priority) =>
                setForm({ ...form, priority: priority as Priority })
              }
            />
          </label>
          {editing && (
            <label>
              Situação
              <Select
                value={form.status}
                options={Object.entries(statusLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
                onChange={(status) =>
                  setForm({ ...form, status: status as Status })
                }
              />
            </label>
          )}
          {editing && (
            <label>
              AGV atribuído
              <input
                className="input"
                value={
                  items.find((item) => item.id === editing)?.agv ||
                  "Aguardando atribuição"
                }
                disabled
              />
            </label>
          )}
        </form>
      </Modal>
      <DataTable<Mission>
        columns={columns}
        data={items}
        pageSize={5}
        actions={
          canEdit
            ? (mission) => (
                <CrudActions
                  label={mission.id}
                  onEdit={() => edit(mission)}
                  onDelete={() => setDeleting(mission)}
                />
              )
            : undefined
        }
      />
    </>
  );
}
