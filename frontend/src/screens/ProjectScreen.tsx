import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import {
  PlantEditor,
  type PlantPoint,
  type PlantRoute,
} from "../components/PlantEditor";
import { apiFetch, canManage } from "../api";

type ProjectStatus = "Ativo" | "Inativo";
type Project = {
  id: string;
  name: string;
  description: string;
  interestPointsCount: number;
  agvsCount: number;
  pathsCount: number;
  status: ProjectStatus;
  createdAt: string;
};

const columns: Column<Project>[] = [
  { title: "ID", accessor: "id", width: 120 },
  { title: "Nome", accessor: "name" },
  { title: "Descrição", accessor: "description" },
  { title: "Pontos de Interesse", accessor: "interestPointsCount" },
  { title: "AGVs", accessor: "agvsCount" },
  { title: "Rotas", accessor: "pathsCount" },
  { title: "Criado Em", accessor: "createdAt", align: "center" },
  {
    title: "Situação",
    accessor: "status",
    align: "center",
    render: (value) => (
      <span
        style={{
          display: "inline-block",
          minWidth: 100,
          padding: "6px 12px",
          borderRadius: 999,
          backgroundColor: value === "Ativo" ? "#22C55E" : "#EF4444",
          color: "#FFF",
          fontSize: 12,
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {String(value)}
      </span>
    ),
  },
];

type ProjectView = {
  project: {
    id: string;
    name: string;
    description: string;
    backgroundImage: string;
    canvasWidth: number;
    canvasHeight: number;
  };
  points: PlantPoint[];
  routes: PlantRoute[];
};

const PROJECT_API_URL = import.meta.env.VITE_PROJECT_API_URL ?? "/api";

export function ProjectScreen() {
  const canEdit = canManage("projects");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [canvasSize, setCanvasSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [points, setPoints] = useState<PlantPoint[]>([]);
  const [routes, setRoutes] = useState<PlantRoute[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<ProjectView | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${PROJECT_API_URL}/projects`)
      .then((response) => {
        if (!response.ok)
          throw new Error("Não foi possível carregar os projetos.");
        return response.json();
      })
      .then((data) =>
        setProjects(
          data.map((project: Record<string, unknown>) => ({
            id: String(project._id),
            name: String(project.name),
            description: String(project.description),
            interestPointsCount: Number(project.interestPointsCount),
            agvsCount: Number(project.agvsCount),
            pathsCount: Number(project.pathsCount),
            status: project.status === "active" ? "Ativo" : "Inativo",
            createdAt: new Date(String(project.createdAt)).toLocaleString(
              "pt-BR",
            ),
          })),
        ),
      )
      .catch((loadError) => setError(loadError.message));
  }, []);

  function resetForm() {
    setName("");
    setDescription("");
    setImageUrl("");
    setCanvasSize(null);
    setPoints([]);
    setRoutes([]);
    setError("");
    setStep(1);
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function goToEditor() {
    if (!name.trim() || !description.trim() || !imageUrl) {
      setError("Informe nome, descrição e uma imagem de planta baixa.");
      return;
    }
    setError("");
    setStep(2);
  }
  function closeModal() {
    if (!saving) {
      setOpen(false);
      resetForm();
    }
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(String(reader.result));
      setError("");
    };
    reader.readAsDataURL(file);
  }

  async function saveProject() {
    if (!name.trim() || !description.trim() || !imageUrl) {
      setError("Informe nome, descrição e uma imagem de planta baixa.");
      return;
    }
    const invalidWaypoint = points.find(
      (point) =>
        point.type === "waypoint" &&
        !point.north &&
        !point.south &&
        !point.east &&
        !point.west,
    );
    if (invalidWaypoint) {
      setError(
        `Defina ao menos uma saída (norte, sul, leste ou oeste) para ${invalidWaypoint.name}.`,
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(`${PROJECT_API_URL}/projects/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: {
            id: editingId ?? undefined,
            name: name.trim(),
            description: description.trim(),
          },
          backgroundImage: imageUrl,
          canvasSize,
          points,
          routes,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Não foi possível salvar o projeto.");
      }
      const result = await response.json();
      const savedProject: Project = {
        id: result.id,
        name: name.trim(),
        description: description.trim(),
        interestPointsCount: result.interestPointsCount,
        agvsCount: 0,
        pathsCount: result.pathsCount,
        status: "Ativo",
        createdAt: result.createdAt
          ? new Date(result.createdAt).toLocaleString("pt-BR")
          : new Date().toLocaleString("pt-BR"),
      };
      setProjects((current) =>
        editingId
          ? current.map((project) =>
              project.id === editingId
                ? { ...savedProject, agvsCount: project.agvsCount }
                : project,
            )
          : [savedProject, ...current],
      );
      setOpen(false);
      resetForm();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Erro inesperado ao salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function viewProject(projectId: string) {
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(
        `${PROJECT_API_URL}/projects/${projectId}/graph`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.message ?? "Não foi possível visualizar o projeto.",
        );
      }
      setView(await response.json());
    } catch (viewError) {
      setError(
        viewError instanceof Error
          ? viewError.message
          : "Erro ao visualizar o projeto.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function editProject(projectId: string) {
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(
        `${PROJECT_API_URL}/projects/${projectId}/graph`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Não foi possível editar o projeto.");
      }
      const data: ProjectView = await response.json();
      setEditingId(projectId);
      setName(data.project.name);
      setDescription(data.project.description);
      setImageUrl(data.project.backgroundImage);
      setCanvasSize({
        width: data.project.canvasWidth,
        height: data.project.canvasHeight,
      });
      setPoints(data.points);
      setRoutes(data.routes);
      setStep(1);
      setOpen(true);
    } catch (editError) {
      setError(
        editError instanceof Error
          ? editError.message
          : "Erro ao editar o projeto.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project: Project) {
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(
        `${PROJECT_API_URL}/projects/${project.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Não foi possível excluir o projeto.");
      }
      setProjects((current) =>
        current.filter((item) => item.id !== project.id),
      );
      setDeleting(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Erro ao excluir o projeto.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        open={Boolean(deleting)}
        message={`Excluir o projeto "${deleting?.name ?? ""}" e todas as suas rotas?`}
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteProject(deleting)}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ marginBottom: 24 }}>Projetos</h1>
        {canEdit && (
          <Button
            className="button"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            Novo Projeto
          </Button>
        )}
      </div>
      <Modal
        open={open}
        title={editingId ? "Editar Projeto" : "Cadastrar Projeto"}
        width="min(1180px, 96vw)"
        loading={saving}
        onClose={closeModal}
        footer={
          <>
            <Button className="button button-danger" onClick={closeModal}>
              Cancelar
            </Button>
            {step === 2 && (
              <Button
                className="button button-outlined"
                onClick={() => setStep(1)}
              >
                Voltar
              </Button>
            )}
            {step === 1 ? (
              <Button
                className="button"
                onClick={goToEditor}
                disabled={!name.trim() || !description.trim() || !imageUrl}
              >
                Próximo
              </Button>
            ) : (
              <Button
                className="button button-success"
                onClick={saveProject}
                disabled={saving}
              >
                Salvar
              </Button>
            )}
          </>
        }
      >
        {error && (
          <p className="project-error" role="alert">
            {error}
          </p>
        )}
        {step === 1 ? (
          <div className="project-step-one">
            <div className="project-fields">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
                placeholder="Nome do Projeto"
              />
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="input"
                placeholder="Descrição"
              />
              <input
                ref={fileInputRef}
                className="input project-file"
                type="file"
                accept="image/*"
                onChange={handleImage}
              />
            </div>
            {imageUrl ? (
              <img
                className="floor-plan-preview"
                src={imageUrl}
                alt="Prévia da planta baixa"
              />
            ) : (
              <button
                type="button"
                className="floor-plan-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                Selecione uma imagem de planta baixa
              </button>
            )}
          </div>
        ) : (
          <PlantEditor
            imageUrl={imageUrl}
            points={points}
            routes={routes}
            onPointsChange={setPoints}
            onRoutesChange={setRoutes}
            coordinateWidth={canvasSize?.width}
            coordinateHeight={canvasSize?.height}
            onCoordinateSpaceChange={setCanvasSize}
          />
        )}
      </Modal>
      {error && !open && (
        <p className="project-error" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={Boolean(view)}
        title={view?.project.name ?? "Visualizar projeto"}
        width="min(1180px, 96vw)"
        onClose={() => setView(null)}
        footer={
          <Button className="button" onClick={() => setView(null)}>
            Fechar
          </Button>
        }
      >
        {view && (
          <>
            <p className="project-view-description">
              {view.project.description}
            </p>
            <PlantEditor
              imageUrl={view.project.backgroundImage}
              points={view.points}
              routes={view.routes}
              onPointsChange={() => undefined}
              onRoutesChange={() => undefined}
              coordinateWidth={view.project.canvasWidth}
              coordinateHeight={view.project.canvasHeight}
              readOnly
            />
          </>
        )}
      </Modal>
      <DataTable<Project>
        columns={columns}
        data={projects}
        pageSize={5}
        actions={(project) => (
          <div className="project-actions">
            <button
              className="button-icon"
              title={`Abrir ${project.name}`}
              aria-label={`Visualizar ${project.name}`}
              onClick={() => viewProject(project.id)}
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
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            {canEdit && (
              <>
                <button
                  className="button-icon"
                  title={`Editar ${project.name}`}
                  aria-label={`Editar ${project.name}`}
                  onClick={() => editProject(project.id)}
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
                  title={`Excluir ${project.name}`}
                  aria-label={`Excluir ${project.name}`}
                  onClick={() => setDeleting(project)}
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
              </>
            )}
          </div>
        )}
      />
    </>
  );
}
