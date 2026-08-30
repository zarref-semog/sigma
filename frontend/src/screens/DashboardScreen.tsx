import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api";
import {
  AGV_STATUS_COLORS,
  type LiveAgv,
} from "../agvStatus";
import { connectAgvWebSocket } from "../agvWebSocket";
import {
  PlantEditor,
  type PlantPoint,
  type PlantRoute,
} from "../components/PlantEditor";
import { Select } from "../components/Select";

type ProjectOption = { value: string; label: string };
type ProjectMap = {
  project: {
    name: string;
    description: string;
    backgroundImage: string;
    canvasWidth: number;
    canvasHeight: number;
  };
  points: PlantPoint[];
  routes: PlantRoute[];
};

export function DashboardScreen() {
  const [options, setOptions] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [map, setMap] = useState<ProjectMap | null>(null);
  const [agvs, setAgvs] = useState<LiveAgv[]>([]);
  const [missions, setMissions] = useState({ completed: 0, pending: 0 });
  const [error, setError] = useState("");

  const loadMissionSummary = useCallback(async () => {
    const response = await apiFetch("/api/missions");
    if (!response.ok)
      throw new Error("Não foi possível atualizar o resumo das missões.");
    const items: Record<string, unknown>[] = await response.json();
    setMissions({
      completed: items.filter((mission) => mission.status === "Completed").length,
      pending: items.filter((mission) => mission.status === "Pending").length,
    });
  }, []);

  useEffect(() => {
    apiFetch("/api/projects")
      .then((response) => {
        if (!response.ok)
          throw new Error("Não foi possível carregar os projetos.");
        return response.json();
      })
      .then((projects) =>
        setOptions(
          projects.map((project: Record<string, unknown>) => ({
            value: String(project._id),
            label: String(project.name),
          })),
        ),
      )
      .catch((loadError) => setError(loadError.message));

    apiFetch("/api/missions")
      .then((response) => {
        if (!response.ok)
          throw new Error("Não foi possível carregar o resumo das missões.");
        return response.json();
      })
      .then((items: Record<string, unknown>[]) =>
        setMissions({
          completed: items.filter((mission) => mission.status === "Completed").length,
          pending: items.filter((mission) => mission.status === "Pending").length,
        }),
      )
      .catch((loadError) => setError(loadError.message));
  }, [loadMissionSummary]);

  useEffect(() => {
    if (!projectId) return;
    apiFetch(`/api/projects/${projectId}/graph`)
      .then((response) => {
        if (!response.ok)
          throw new Error("Não foi possível carregar o mapa do projeto.");
        return response.json();
      })
      .then(setMap)
      .catch((loadError) => setError(loadError.message));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const socket = connectAgvWebSocket(projectId, setAgvs, (event) => {
      if (event.type === "MISSION_COMPLETED") {
        loadMissionSummary().catch((loadError) => setError(loadError.message));
      }
    });
    return () => socket.close();
  }, [loadMissionSummary, projectId]);

  useEffect(() => {
    if (!projectId || !map) return;
    const statusLabels = {
      Available: "Disponível",
      "Executing Mission": "Executando missão",
      Charging: "Em carga",
      Offline: "Offline",
    } as const;
    const refreshAgvs = async () => {
      const response = await apiFetch("/api/agvs");
      if (!response.ok) return;
      const items: Array<Record<string, unknown>> = await response.json();
      const points = new Map(map.points.map((point) => [String(point.id), point]));
      setAgvs(items
        .filter((agv) => String(agv.projectId || "") === projectId)
        .map((agv) => {
          const point = points.get(String(agv.location || ""));
          return {
            id: String(agv._id || agv.id),
            name: String(agv.name || "AGV"),
            x: Number(point?.x || 0),
            y: Number(point?.y || 0),
            battery: Number(agv.battery || 0),
            status: statusLabels[String(agv.status) as keyof typeof statusLabels] || "Offline",
          };
        })
        .filter((agv) => points.has(String(items.find((item) => String(item._id || item.id) === agv.id)?.location || ""))));
    };
    refreshAgvs().catch(() => undefined);
    const timer = window.setInterval(() => refreshAgvs().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, [map, projectId]);

  return (
    <>
      <div className="dashboard-heading">
        <h1>Painel</h1>
        <div className="dashboard-project-select">
          <Select
            placeholder="Selecione o projeto"
            value={projectId}
            options={options}
            onChange={setProjectId}
          />
        </div>
      </div>
      {error && <p className="project-error">{error}</p>}
      {!map ? (
        <div className="dashboard-empty">
          Selecione um projeto para visualizar sua planta.
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="dashboard-map">
            <PlantEditor
              imageUrl={map.project.backgroundImage}
              points={map.points}
              routes={map.routes}
              onPointsChange={() => undefined}
              onRoutesChange={() => undefined}
              coordinateWidth={map.project.canvasWidth}
              coordinateHeight={map.project.canvasHeight}
              showGuides={false}
              agvs={agvs}
              readOnly
            />
          </div>
          <aside className="dashboard-sidebar">
            <section className="dashboard-card">
              <h2>Status dos AGVs</h2>
              {Object.entries(AGV_STATUS_COLORS).map(([status, color]) => (
                <div className="status-row" key={status}>
                  <i style={{ background: color }} />
                  <span>{status}</span>
                  <strong>
                    {agvs.filter((agv) => agv.status === status).length}
                  </strong>
                </div>
              ))}
            </section>
            <section className="dashboard-card">
              <h2>Resumo</h2>
              <div className="metric">
                <strong>{missions.completed}</strong>
                <span>
                  Missões
                  <br />
                  concluídas
                </span>
              </div>
              <div className="metric">
                <strong>{missions.pending}</strong>
                <span>
                  Missões
                  <br />
                  pendentes
                </span>
              </div>
              <div className="metric">
                <strong>
                  {agvs.filter((agv) => agv.status !== "Offline").length}
                </strong>
                <span>
                  AGVs
                  <br />
                  ativos
                </span>
              </div>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
