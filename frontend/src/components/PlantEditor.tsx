import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AGV_STATUS_COLORS } from "../agvStatus";
import { Circle, Group, Image, Layer, Line, Stage, Text } from "react-konva";
import type Konva from "konva";
import useImage from "use-image";
import { Select } from "./Select";

export type PointType = "delivery" | "pickup" | "charging" | "waypoint";

export interface PlantPoint {
  id: string;
  rfidTag: string;
  name: string;
  type: PointType;
  x: number;
  y: number;
  north?: string;
  south?: string;
  east?: string;
  west?: string;
}

export interface PlantRoute {
  id: string;
  from: string;
  to: string;
}

interface PlantEditorProps {
  imageUrl: string;
  points: PlantPoint[];
  routes: PlantRoute[];
  onPointsChange(points: PlantPoint[]): void;
  onRoutesChange(routes: PlantRoute[]): void;
  readOnly?: boolean;
  coordinateWidth?: number;
  coordinateHeight?: number;
  showGuides?: boolean;
  onCoordinateSpaceChange?(size: { width: number; height: number }): void;
  agvs?: Array<{
    id: string;
    name?: string;
    x: number;
    y: number;
    status: "Disponível" | "Executando missão" | "Em carga" | "Offline";
    battery: number;
  }>;
}

const colors: Record<PointType, string> = {
  delivery: "#2563EB",
  pickup: "#16A34A",
  charging: "#7C3AED",
  waypoint: "#F59E0B",
};

const pointIcons: Record<PointType, string> = {
  delivery: "↓",
  pickup: "↑",
  charging: "ϟ",
  waypoint: "↔",
};

type Direction = "north" | "south" | "east" | "west";
const oppositeDirection: Record<Direction, Direction> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};

function directionBetween(from: PlantPoint, to: PlantPoint): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "east" : "west";
  return dy >= 0 ? "south" : "north";
}

function ToolbarIcon({ name }: { name: "add" | "route" | "delete" }) {
  const paths = {
    add: "M12 5v14M5 12h14",
    route: "M6 6h.01M18 18h.01M6 6l12 12",
    delete: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5",
  };
  return (
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
      <path d={paths[name]} />
    </svg>
  );
}

export function PlantEditor({
  imageUrl,
  points,
  routes,
  onPointsChange,
  onRoutesChange,
  readOnly = false,
  coordinateWidth,
  coordinateHeight,
  showGuides = true,
  onCoordinateSpaceChange,
  agvs = [],
}: PlantEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [background] = useImage(imageUrl);
  const [width, setWidth] = useState(920);
  const [measured, setMeasured] = useState(false);
  const [pointType, setPointType] = useState<PointType>("delivery");
  const [pointName, setPointName] = useState("");
  const [rfidTag, setRfidTag] = useState("");
  const [mode, setMode] = useState<"point" | "route">("point");
  const [routeStart, setRouteStart] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const logicalWidth = coordinateWidth || width;
  const logicalHeight = coordinateHeight || Math.round(logicalWidth * 0.56);
  const height = Math.round(width * (logicalHeight / logicalWidth));
  const scaleX = width / logicalWidth;
  const scaleY = height / logicalHeight;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateWidth = () => {
      setWidth(Math.max(320, element.clientWidth));
      setMeasured(true);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (measured && (!coordinateWidth || !coordinateHeight)) {
      onCoordinateSpaceChange?.({ width, height: Math.round(width * 0.56) });
    }
  }, [
    coordinateWidth,
    coordinateHeight,
    measured,
    onCoordinateSpaceChange,
    width,
  ]);

  const pointsById = useMemo(
    () => new Map(points.map((point) => [point.id, point])),
    [points],
  );

  function addPoint(event: Konva.KonvaEventObject<MouseEvent>) {
    if (
      readOnly ||
      mode !== "point" ||
      event.target !== event.target.getStage()
    )
      return;
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    const position = stage
      .getAbsoluteTransform()
      .copy()
      .invert()
      .point(pointer);
    const id = crypto.randomUUID();
    const usedTags = new Set(points.map((point) => point.rfidTag));
    let tagNumber = 1;
    while (usedTags.has(`RFID-${String(tagNumber).padStart(3, "0")}`))
      tagNumber += 1;
    onPointsChange([
      ...points,
      {
        id,
        rfidTag: rfidTag.trim() || `RFID-${String(tagNumber).padStart(3, "0")}`,
        name: pointName.trim() || `Ponto ${points.length + 1}`,
        type: pointType,
        x: Math.round(position.x),
        y: Math.round(position.y),
      },
    ]);
    setPointName("");
    setRfidTag("");
    setSelected(null);
  }

  function selectPoint(id: string) {
    setSelected(id);
    const point = pointsById.get(id);
    if (point) {
      setPointName(point.name);
      setRfidTag(point.rfidTag);
      setPointType(point.type);
    }
    if (mode !== "route") return;
    if (!routeStart) {
      setRouteStart(id);
      return;
    }
    if (routeStart !== id) {
      const exists = routes.some(
        (route) =>
          (route.from === routeStart && route.to === id) ||
          (route.from === id && route.to === routeStart),
      );
      if (!exists) {
        const from = pointsById.get(routeStart);
        const to = pointsById.get(id);
        if (from && to) {
          const direction = directionBetween(from, to);
          onPointsChange(
            points.map((point) => {
              if (point.id === from.id) return { ...point, [direction]: to.id };
              if (point.id === to.id)
                return { ...point, [oppositeDirection[direction]]: from.id };
              return point;
            }),
          );
        }
        onRoutesChange([
          ...routes,
          { id: crypto.randomUUID(), from: routeStart, to: id },
        ]);
      }
    }
    setRouteStart(null);
  }

  function removeSelected() {
    if (!selected) return;
    onPointsChange(
      points
        .filter((point) => point.id !== selected)
        .map((point) => ({
          ...point,
          north: point.north === selected ? undefined : point.north,
          south: point.south === selected ? undefined : point.south,
          east: point.east === selected ? undefined : point.east,
          west: point.west === selected ? undefined : point.west,
        })),
    );
    onRoutesChange(
      routes.filter(
        (route) => route.from !== selected && route.to !== selected,
      ),
    );
    setSelected(null);
    setPointName("");
    setRfidTag("");
    setRouteStart(null);
  }

  function changePointName(value: string) {
    setPointName(value);
    if (selected) {
      onPointsChange(
        points.map((point) =>
          point.id === selected ? { ...point, name: value } : point,
        ),
      );
    }
  }

  function changeRfidTag(value: string) {
    setRfidTag(value);
    if (selected) {
      onPointsChange(
        points.map((point) =>
          point.id === selected ? { ...point, rfidTag: value } : point,
        ),
      );
    }
  }

  function changePointType(value: PointType) {
    setPointType(value);
    if (selected)
      onPointsChange(
        points.map((point) =>
          point.id === selected ? { ...point, type: value } : point,
        ),
      );
  }

  function changeDirection(direction: Direction, value: string) {
    if (!selected) return;
    onPointsChange(
      points.map((point) =>
        point.id === selected
          ? { ...point, [direction]: value || undefined }
          : point,
      ),
    );
  }

  function startAddingPoint() {
    setMode("point");
    setRouteStart(null);
    setSelected(null);
    setPointName("");
    setRfidTag("");
  }

  return (
    <div>
      {!readOnly && (
        <div className="plant-editor-toolbar">
          <input
            className="plant-point-name"
            value={pointName}
            onChange={(event) => changePointName(event.target.value)}
            onFocus={() => setMode("point")}
            placeholder="Nome do ponto"
            aria-label="Nome do ponto"
          />
          <input
            className="plant-rfid-tag"
            value={rfidTag}
            onChange={(event) => changeRfidTag(event.target.value)}
            onFocus={() => setMode("point")}
            placeholder="ID da tag RFID"
            aria-label="ID da tag RFID"
          />
          <button
            type="button"
            className={`toolbar-icon-button ${mode === "point" && !selected ? "active" : ""}`}
            onClick={startAddingPoint}
            title="Adicionar ponto"
            aria-label="Adicionar ponto"
          >
            <ToolbarIcon name="add" />
          </button>
          <button
            type="button"
            className={`toolbar-icon-button ${mode === "route" ? "active" : ""}`}
            onClick={() => setMode("route")}
            title="Ligar pontos"
            aria-label="Ligar pontos"
          >
            <ToolbarIcon name="route" />
          </button>
          <Select
            className="plant-point-type"
            value={pointType}
            options={[
              { value: "delivery", label: "Entrega" },
              { value: "pickup", label: "Coleta" },
              { value: "charging", label: "Carregamento" },
              { value: "waypoint", label: "Ponto de rota" },
            ]}
            onChange={(value) => changePointType(value as PointType)}
            disabled={mode !== "point"}
          />
          <button
            type="button"
            className="toolbar-icon-button"
            onClick={removeSelected}
            disabled={!selected}
            title="Excluir ponto"
            aria-label="Excluir ponto"
          >
            <ToolbarIcon name="delete" />
          </button>
          {mode === "route" && (
            <span>
              {routeStart ? "Selecione o destino" : "Selecione a origem"}
            </span>
          )}
          {selected && pointType === "waypoint" && (
            <div className="point-directions">
              {(["north", "south", "east", "west"] as Direction[]).map(
                (direction) => (
                  <label key={direction}>
                    {
                      {
                        north: "Norte",
                        south: "Sul",
                        east: "Leste",
                        west: "Oeste",
                      }[direction]
                    }
                    <Select
                      value={pointsById.get(selected)?.[direction] || ""}
                      options={[
                        { value: "", label: "Sem saída" },
                        ...points
                          .filter((point) => point.id !== selected)
                          .map((point) => ({
                            value: point.id,
                            label: point.name,
                          })),
                      ]}
                      onChange={(value) => changeDirection(direction, value)}
                    />
                  </label>
                ),
              )}
            </div>
          )}
        </div>
      )}

      <div ref={containerRef} className="plant-editor-canvas">
        <Stage
          width={width}
          height={height}
          scaleX={scaleX}
          scaleY={scaleY}
          onClick={addPoint}
        >
          <Layer listening={false}>
            {background && (
              <Image
                image={background}
                width={logicalWidth}
                height={logicalHeight}
              />
            )}
          </Layer>
          {showGuides && (
            <Layer listening={false}>
              {routes.map((route) => {
                const from = pointsById.get(route.from);
                const to = pointsById.get(route.to);
                if (!from || !to) return null;
                return (
                  <Line
                    key={route.id}
                    points={[from.x, from.y, to.x, to.y]}
                    stroke="#475569"
                    strokeWidth={5}
                    lineCap="round"
                    opacity={0.85}
                  />
                );
              })}
            </Layer>
          )}
          {showGuides && (
            <Layer>
              {points.map((point) => (
                <Group
                  key={point.id}
                  x={point.x}
                  y={point.y}
                  draggable={!readOnly}
                  onMouseEnter={(event) => {
                    const stage = event.target.getStage();
                    if (stage) stage.container().style.cursor = "pointer";
                  }}
                  onMouseLeave={(event) => {
                    const stage = event.target.getStage();
                    if (stage) stage.container().style.cursor = "default";
                  }}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    if (!readOnly) selectPoint(point.id);
                  }}
                  onDragEnd={(event) =>
                    onPointsChange(
                      points.map((item) =>
                        item.id === point.id
                          ? {
                              ...item,
                              x: Math.round(event.target.x()),
                              y: Math.round(event.target.y()),
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <Circle
                    radius={
                      selected === point.id || routeStart === point.id ? 14 : 12
                    }
                    fill={colors[point.type]}
                    stroke="#FFFFFF"
                    strokeWidth={3}
                    shadowBlur={5}
                  />
                  <Text
                    x={-10}
                    y={-9}
                    width={20}
                    height={18}
                    align="center"
                    verticalAlign="middle"
                    text={pointIcons[point.type]}
                    fontSize={16}
                    fontStyle="bold"
                    fill="#FFFFFF"
                    listening={false}
                  />
                </Group>
              ))}
              {points.map((point) => (
                <Text
                  key={`${point.id}-label`}
                  x={point.x - 70}
                  y={point.y + 14}
                  width={140}
                  align="center"
                  text={`${point.name}\n${point.rfidTag}`}
                  fontSize={11}
                  lineHeight={1.25}
                  fill="#0F172A"
                  listening={false}
                />
              ))}
            </Layer>
          )}
          <Layer>
            {agvs.map((agv) => {
              return (
                <Fragment key={agv.id}>
                  <Circle
                    x={agv.x}
                    y={agv.y}
                    radius={11}
                    fill={AGV_STATUS_COLORS[agv.status]}
                    stroke="#FFFFFF"
                    strokeWidth={2.5}
                    shadowColor={AGV_STATUS_COLORS[agv.status]}
                    shadowBlur={8}
                    shadowOpacity={0.45}
                    listening={false}
                  />
                  <Text
                    x={agv.x - 32}
                    y={agv.y - 28}
                    width={64}
                    align="center"
                    text={agv.name || agv.id}
                    fontSize={10}
                    fontStyle="bold"
                    fill="#1E293B"
                    listening={false}
                  />
                </Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>
      {showGuides && (
        <div className="plant-editor-legend">
          <span>
            <i style={{ background: colors.delivery }} />
            Entrega
          </span>
          <span>
            <i style={{ background: colors.pickup }} />
            Coleta
          </span>
          <span>
            <i style={{ background: colors.charging }} />
            Carregamento
          </span>
          <span>
            <i style={{ background: colors.waypoint }} />
            Ponto de rota
          </span>
          <strong>
            {points.length} pontos · {routes.length} rotas
          </strong>
        </div>
      )}
    </div>
  );
}
