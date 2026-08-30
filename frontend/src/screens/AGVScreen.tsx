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

type AGVStatus = "Executing Mission" | "Available" | "Offline" | "Charging";
type AGV = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  model: string;
  battery: number;
  currentMission: string;
  location: string;
  locationName: string;
  status: AGVStatus;
};

const empty = {
  projectId: "",
  name: "",
  model: "",
  location: "",
  status: "Offline" as AGVStatus,
};
const labels: Record<AGVStatus, string> = {
  "Executing Mission": "Executando missão",
  Available: "Disponível",
  Offline: "Offline",
  Charging: "Carregando",
};
const colors: Record<AGVStatus, string> = {
  "Executing Mission": "#2563EB",
  Available: "#22C55E",
  Offline: "#EF4444",
  Charging: "#F59E0B",
};
const columns: Column<AGV>[] = [
  { title: "Nome", accessor: "name" },
  { title: "Projeto", accessor: "projectName" },
  { title: "Modelo", accessor: "model" },
  {
    title: "Bateria",
    accessor: "battery",
    align: "center",
    render: (value) => `${value}%`,
  },
  { title: "Missão atual", accessor: "currentMission" },
  { title: "Localização", accessor: "locationName" },
  {
    title: "Situação",
    accessor: "status",
    align: "center",
    render: (value) => {
      const status = value as AGVStatus;
      return (
        <span
          style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 999,
            background: colors[status],
            color: "#FFF",
          }}
        >
          {labels[status]}
        </span>
      );
    },
  },
];

export function AGVScreen() {
  const canEdit = canManage("agvs");
  const [agvs, setAgvs] = useState<AGV[]>([]);
  const [projects, setProjects] = useState<SelectOption[]>([]);
  const [projectPoints, setProjectPoints] = useState<SelectOption[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AGV | null>(null);
  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.value, project.label])),
    [projects],
  );

  const load = useCallback(
    () =>
      apiFetch("/api/agvs")
        .then((response) => {
          if (!response.ok)
            throw new Error("Não foi possível carregar os AGVs.");
          return response.json();
        })
        .then(async (data: Record<string, unknown>[]) => {
          const projectIds = [...new Set(data.map((agv) => String(agv.projectId || "")).filter(Boolean))];
          const graphEntries = await Promise.all(projectIds.map(async (projectId) => {
            const response = await apiFetch(`/api/projects/${projectId}/graph`);
            if (!response.ok) return [] as Array<[string, string]>;
            const graph = await response.json();
            return graph.points.map((point: Record<string, unknown>) => [
              `${projectId}:${String(point.id)}`,
              `${String(point.name)} (${String(point.rfidTag)})`,
            ] as [string, string]);
          }));
          const pointNames = new Map<string, string>();
          graphEntries.flat().forEach(([id, name]) => pointNames.set(id, name));
          setAgvs(
            data.map((agv) => {
              const projectId = String(agv.projectId || "");
              const location = agv.location ? String(agv.location) : "";
              return {
              id: String(agv._id),
              projectId,
              projectName:
                projectNames.get(projectId) ||
                "Projeto não informado",
              name: String(agv.name),
              model: String(agv.model),
              battery: Number(agv.battery),
              currentMission: agv.currentMission
                ? String(agv.currentMission)
                : "-",
              location,
              locationName: location ? pointNames.get(`${projectId}:${location}`) || "Ponto não encontrado" : "Localização não identificada",
              status: agv.status as AGVStatus,
              };
            }),
          );
        })
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
      .then((response) => {
        if (!response.ok)
          throw new Error("Não foi possível carregar os pontos do projeto.");
        return response.json();
      })
      .then((graph) => {
        if (!active) return;
        setProjectPoints(
          graph.points.map((point: Record<string, unknown>) => ({
            value: String(point.id),
            label: `${String(point.name)} (${String(point.rfidTag)})`,
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
    setProjectPoints([]);
    setLoadingPoints(false);
    setError("");
  }
  function edit(agv: AGV) {
    setEditing(agv.id);
    setProjectPoints([]);
    setLoadingPoints(true);
    setForm({
      projectId: agv.projectId,
      name: agv.name,
      model: agv.model,
      location: agv.location,
      status: agv.status,
    });
    setOpen(true);
  }
  function selectProject(projectId: string) {
    setProjectPoints([]);
    setLoadingPoints(Boolean(projectId));
    setForm({ ...form, projectId, location: "" });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(
        `/api/agvs${editing ? `/${editing}` : ""}`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Não foi possível salvar o AGV.");
      close();
      load();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erro ao salvar o AGV.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove(agv: AGV) {
    setSaving(true);
    const response = await apiFetch(`/api/agvs/${agv.id}`, {
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
        <h1>AGVs</h1>
        {canEdit && (
          <Button className="button" onClick={() => setOpen(true)}>
            Novo AGV
          </Button>
        )}
      </div>
      {error && <p className="project-error">{error}</p>}
      <ConfirmDialog
        open={Boolean(deleting)}
        message={`Excluir o AGV "${deleting?.name ?? ""}"?`}
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
      />
      <Modal
        open={open}
        title={editing ? "Editar AGV" : "Adicionar AGV"}
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
                  document.getElementById("agv-form") as HTMLFormElement
                )?.requestSubmit()
              }
              disabled={
                saving ||
                !form.projectId ||
                !form.name.trim() ||
                !form.model.trim()
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
        <form id="agv-form" className="crud-form" onSubmit={submit}>
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
            Posição
            <Select
              value={form.location}
              options={projectPoints.filter(
                (point) =>
                  point.value === form.location ||
                  !agvs.some(
                    (agv) =>
                      agv.id !== editing &&
                      agv.projectId === form.projectId &&
                      agv.location === point.value &&
                      agv.status !== "Offline",
                  ),
              )}
              placeholder={
                loadingPoints
                  ? "Carregando pontos..."
                  : "Selecione a posição do AGV"
              }
              disabled={!form.projectId || loadingPoints}
              onChange={(location) => setForm({ ...form, location })}
            />
          </label>
          <label>
            Nome
            <input
              className="input"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
          </label>
          <label>
            Modelo
            <input
              className="input"
              value={form.model}
              onChange={(event) =>
                setForm({ ...form, model: event.target.value })
              }
              required
            />
          </label>
          <label>
            Situação
            <Select
              value={form.status}
              options={Object.entries(labels).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(status) =>
                setForm({ ...form, status: status as AGVStatus })
              }
            />
          </label>
        </form>
      </Modal>
      <DataTable<AGV>
        columns={columns}
        data={agvs}
        pageSize={5}
        actions={
          canEdit
            ? (agv) => (
                <CrudActions
                  label={agv.name}
                  onEdit={() => edit(agv)}
                  onDelete={() => setDeleting(agv)}
                />
              )
            : undefined
        }
      />
    </>
  );
}
